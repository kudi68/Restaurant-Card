type FeedbackContext = {
  request: Request
  env: {
    TELEGRAM_BOT_TOKEN?: string
    TELEGRAM_CHAT_ID?: string
    TURNSTILE_SECRET?: string
    TURNSTILE_HOSTNAMES?: string
  }
}

const MAX_BODY_BYTES = 8192

type JsonReadResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: "bad_json" | "body_too_large" }

async function readBoundedJson(request: Request): Promise<JsonReadResult> {
  const declaredLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { ok: false, error: "body_too_large" }
  }
  if (!request.body) return { ok: false, error: "bad_json" }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY_BYTES) {
        await reader.cancel()
        return { ok: false, error: "body_too_large" }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, error: "bad_json" }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, error: "bad_json" }
    }
    return { ok: true, value: value as Record<string, unknown> }
  } catch {
    return { ok: false, error: "bad_json" }
  }
}

async function verifyTurnstile(input: {
  secret: string
  response: string
  remoteIp: string | null
  expectedHostnames: string
}): Promise<boolean> {
  const allowedHostnames = new Set(
    input.expectedHostnames.split(",").map((hostname) => hostname.trim()).filter(Boolean),
  )
  if (allowedHostnames.size === 0) return false

  const body = new URLSearchParams({
    secret: input.secret,
    response: input.response,
  })
  if (input.remoteIp) body.set("remoteip", input.remoteIp)

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return false
    const result: unknown = await response.json()
    if (!result || typeof result !== "object") return false
    const record = result as Record<string, unknown>
    return (
      record.success === true &&
      record.action === "feedback" &&
      typeof record.hostname === "string" &&
      allowedHostnames.has(record.hostname)
    )
  } catch {
    return false
  }
}

export async function onRequest(context: FeedbackContext): Promise<Response> {
  const method = context.request.method
  if (method === "POST" || method === "OPTIONS") {
    const origin = context.request.headers.get("origin")
    const expectedOrigin = new URL(context.request.url).origin
    if (!origin || origin !== expectedOrigin) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json; charset=utf-8" },
      })
    }
    if (method === "OPTIONS") return handleOptions(origin)
  }
  if (method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: {
        "allow": "POST, OPTIONS",
        "content-type": "application/json; charset=utf-8",
      },
    })
  }
  return handlePost(context)
}

async function handlePost(context: FeedbackContext): Promise<Response> {
  const origin = context.request.headers.get("origin")!
  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "content-type": "application/json; charset=utf-8",
  }
  const contentType = context.request.headers.get("content-type")?.split(";", 1)[0]?.trim()
  if (contentType !== "application/json") {
    return new Response(JSON.stringify({ ok: false, error: "unsupported_media_type" }), {
      status: 415,
      headers,
    })
  }

  const parsed = await readBoundedJson(context.request)
  if (!parsed.ok) {
    const status = parsed.error === "body_too_large" ? 413 : 400
    return new Response(JSON.stringify({ ok: false, error: parsed.error }), { status, headers })
  }
  const payload = parsed.value

  const token = context.env.TELEGRAM_BOT_TOKEN
  const chatId = context.env.TELEGRAM_CHAT_ID
  const turnstileSecret = context.env.TURNSTILE_SECRET
  const turnstileHostnames = context.env.TURNSTILE_HOSTNAMES
  if (!token || !chatId || !turnstileSecret || !turnstileHostnames) {
    return new Response(JSON.stringify({ ok: false, error: "service_not_configured" }), {
      status: 503,
      headers,
    })
  }

  const message = typeof payload.message === "string" ? payload.message.trim() : ""
  if (!message || message.length > 3000) {
    return new Response(JSON.stringify({ ok: false, error: "bad_message" }), { status: 400, headers })
  }
  const contact = payload.contact == null
    ? ""
    : typeof payload.contact === "string"
      ? payload.contact.trim()
      : null
  if (contact == null || contact.length > 200) {
    return new Response(JSON.stringify({ ok: false, error: "bad_contact" }), { status: 400, headers })
  }
  const turnstileToken =
    typeof payload.turnstileToken === "string" ? payload.turnstileToken.trim() : ""
  if (!turnstileToken || turnstileToken.length > 2048) {
    return new Response(JSON.stringify({ ok: false, error: "verification_failed" }), {
      status: 403,
      headers,
    })
  }
  const verified = await verifyTurnstile({
    secret: turnstileSecret,
    response: turnstileToken,
    remoteIp: context.request.headers.get("cf-connecting-ip"),
    expectedHostnames: turnstileHostnames,
  })
  if (!verified) {
    return new Response(JSON.stringify({ ok: false, error: "verification_failed" }), {
      status: 403,
      headers,
    })
  }

  const text = [
    "餐卡建議",
    message,
    contact ? `聯絡：${contact}` : "",
    `時間：${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n")
  if (text.length > 4096) {
    return new Response(JSON.stringify({ ok: false, error: "bad_message" }), { status: 400, headers })
  }

  let telegram: Response
  try {
    telegram = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "telegram_failed" }), {
      status: 502,
      headers,
    })
  }
  if (!telegram.ok) {
    return new Response(JSON.stringify({ ok: false, error: "telegram_failed" }), {
      status: 502,
      headers,
    })
  }
  return new Response(JSON.stringify({ ok: true }), { headers })
}

function handleOptions(origin: string): Response {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Cache-Control": "no-store",
    },
  })
}
