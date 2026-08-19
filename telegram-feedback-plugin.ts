import { loadEnv, type Plugin, type ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

const MAX_BODY_BYTES = 8192

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  if (res.writableEnded) return
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

async function readBoundedBody(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
    total += buffer.byteLength
    if (total > MAX_BODY_BYTES) {
      req.resume()
      return null
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

async function verifyTurnstile(input: {
  secret: string
  response: string
  remoteIp?: string
  expectedHostnames: string
}): Promise<boolean> {
  const hostnames = new Set(
    input.expectedHostnames.split(',').map((hostname) => hostname.trim()).filter(Boolean),
  )
  if (hostnames.size === 0) return false
  const body = new URLSearchParams({ secret: input.secret, response: input.response })
  if (input.remoteIp) body.set('remoteip', input.remoteIp)
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return false
    const result = await response.json() as Record<string, unknown>
    return result.success === true
      && result.action === 'feedback'
      && typeof result.hostname === 'string'
      && hostnames.has(result.hostname)
  } catch {
    return false
  }
}

async function handleFeedback(
  req: IncomingMessage,
  res: ServerResponse,
  server: ViteDevServer,
): Promise<void> {
  const host = req.headers.host
  const origin = req.headers.origin
  const expectedOrigin = host ? `http://${host}` : ''
  if (!origin || origin !== expectedOrigin) {
    sendJson(res, 403, { ok: false, error: 'forbidden' })
    return
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('access-control-allow-origin', origin)
    res.setHeader('access-control-allow-headers', 'content-type')
    res.setHeader('access-control-allow-methods', 'POST, OPTIONS')
    res.end()
    return
  }
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST, OPTIONS')
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
    return
  }

  const contentType = req.headers['content-type']?.split(';', 1)[0]?.trim()
  if (contentType !== 'application/json') {
    sendJson(res, 415, { ok: false, error: 'unsupported_media_type' })
    return
  }
  const raw = await readBoundedBody(req)
  if (!raw) {
    sendJson(res, 413, { ok: false, error: 'body_too_large' })
    return
  }

  let payload: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw.toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad_json')
    payload = parsed as Record<string, unknown>
  } catch {
    sendJson(res, 400, { ok: false, error: 'bad_json' })
    return
  }

  const telegramEnv = loadEnv(server.config.mode, server.config.root, 'TELEGRAM_')
  const turnstileEnv = loadEnv(server.config.mode, server.config.root, 'TURNSTILE_')
  const token = telegramEnv.TELEGRAM_BOT_TOKEN
  const chatId = telegramEnv.TELEGRAM_CHAT_ID
  const turnstileSecret = turnstileEnv.TURNSTILE_SECRET
  const expectedHostnames = turnstileEnv.TURNSTILE_HOSTNAMES
  if (!token || !chatId || !turnstileSecret || !expectedHostnames) {
    sendJson(res, 503, { ok: false, error: 'service_not_configured' })
    return
  }

  const message = typeof payload.message === 'string' ? payload.message.trim() : ''
  const turnstileToken = typeof payload.turnstileToken === 'string'
    ? payload.turnstileToken.trim()
    : ''
  if (!message || message.length > 3000) {
    sendJson(res, 400, { ok: false, error: 'bad_message' })
    return
  }
  if (!turnstileToken || turnstileToken.length > 2048) {
    sendJson(res, 403, { ok: false, error: 'verification_failed' })
    return
  }

  const verified = await verifyTurnstile({
    secret: turnstileSecret,
    response: turnstileToken,
    remoteIp: req.socket.remoteAddress,
    expectedHostnames,
  })
  if (!verified) {
    sendJson(res, 403, { ok: false, error: 'verification_failed' })
    return
  }

  try {
    const telegram = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        chat_id: chatId,
        text: `餐卡建議\n${message}\n時間：${new Date().toISOString()}`,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!telegram.ok) {
      sendJson(res, 502, { ok: false, error: 'telegram_failed' })
      return
    }
    sendJson(res, 200, { ok: true })
  } catch {
    sendJson(res, 502, { ok: false, error: 'telegram_failed' })
  }
}

export function telegramFeedbackPlugin(): Plugin {
  return {
    name: 'telegram-feedback',
    configureServer(server) {
      server.middlewares.use('/api/feedback', (req, res) => {
        void handleFeedback(req, res, server).catch(() => {
          sendJson(res, 500, { ok: false, error: 'internal_error' })
        })
      })
    },
  }
}
