import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from './feedback.ts'

function request(method: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://restaurant-card.pages.dev/api/feedback', {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('feedback Pages Function', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns 405 instead of falling through to the SPA for GET requests', async () => {
    const response = await onRequest({
      request: request('GET'),
      env: {},
    })

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST, OPTIONS')
  })

  it('rejects a POST from an unrelated browser origin', async () => {
    const response = await onRequest({
      request: request('POST', { message: 'spam' }, {
        'content-type': 'application/json',
        origin: 'https://example.invalid',
      }),
      env: {},
    })

    expect(response.status).toBe(403)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('rejects non-JSON POST bodies before calling external services', async () => {
    const response = await onRequest({
      request: request('POST', { message: 'hello' }, {
        'content-type': 'text/plain',
        origin: 'https://restaurant-card.pages.dev',
      }),
      env: {},
    })

    expect(response.status).toBe(415)
  })

  it('stops reading a JSON body that exceeds the byte limit', async () => {
    const response = await onRequest({
      request: request('POST', { message: 'x'.repeat(9000) }, {
        'content-type': 'application/json',
        origin: 'https://restaurant-card.pages.dev',
      }),
      env: {
        TELEGRAM_BOT_TOKEN: 'test-bot-token',
        TELEGRAM_CHAT_ID: 'test-chat-id',
      },
    })

    expect(response.status).toBe(413)
  })

  it('requires a Turnstile token before contacting Telegram', async () => {
    const externalFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    const response = await onRequest({
      request: request('POST', { message: 'hello' }, {
        'content-type': 'application/json',
        origin: 'https://restaurant-card.pages.dev',
      }),
      env: {
        TELEGRAM_BOT_TOKEN: 'test-bot-token',
        TELEGRAM_CHAT_ID: 'test-chat-id',
        TURNSTILE_SECRET: 'test-turnstile-secret',
        TURNSTILE_HOSTNAMES: 'restaurant-card.pages.dev',
      },
    })

    expect(response.status).toBe(403)
    expect(externalFetch).not.toHaveBeenCalled()
  })

  it('contacts Telegram only after Turnstile verifies the action and hostname', async () => {
    const externalFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/siteverify')) {
        return new Response(JSON.stringify({
          success: true,
          action: 'feedback',
          hostname: 'restaurant-card.pages.dev',
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })
    const response = await onRequest({
      request: request('POST', { message: 'hello', turnstileToken: 'verified-once' }, {
        'content-type': 'application/json',
        origin: 'https://restaurant-card.pages.dev',
      }),
      env: {
        TELEGRAM_BOT_TOKEN: 'test-bot-token',
        TELEGRAM_CHAT_ID: 'test-chat-id',
        TURNSTILE_SECRET: 'test-turnstile-secret',
        TURNSTILE_HOSTNAMES: 'restaurant-card.pages.dev',
      },
    })

    expect(response.status).toBe(200)
    expect(externalFetch).toHaveBeenCalledTimes(2)
    expect(String(externalFetch.mock.calls[0]?.[0])).toContain('/siteverify')
    expect(String(externalFetch.mock.calls[1]?.[0])).toContain('api.telegram.org')
  })

  it('returns a generic 502 when the Telegram network request throws', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        action: 'feedback',
        hostname: 'restaurant-card.pages.dev',
      }), { status: 200 }))
      .mockRejectedValueOnce(new Error('outgoing URL contained a sensitive path'))
    const response = await onRequest({
      request: request('POST', { message: 'hello', turnstileToken: 'verified-once' }, {
        'content-type': 'application/json',
        origin: 'https://restaurant-card.pages.dev',
      }),
      env: {
        TELEGRAM_BOT_TOKEN: 'test-bot-token',
        TELEGRAM_CHAT_ID: 'test-chat-id',
        TURNSTILE_SECRET: 'test-turnstile-secret',
        TURNSTILE_HOSTNAMES: 'restaurant-card.pages.dev',
      },
    })

    expect(response.status).toBe(502)
    expect(await response.text()).toBe('{"ok":false,"error":"telegram_failed"}')
  })

  it('rejects feedback that would leave too little room for the Telegram envelope', async () => {
    const externalFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    const response = await onRequest({
      request: request('POST', {
        message: 'x'.repeat(3001),
        turnstileToken: 'unused',
      }, {
        'content-type': 'application/json',
        origin: 'https://restaurant-card.pages.dev',
      }),
      env: {
        TELEGRAM_BOT_TOKEN: 'test-bot-token',
        TELEGRAM_CHAT_ID: 'test-chat-id',
        TURNSTILE_SECRET: 'test-turnstile-secret',
        TURNSTILE_HOSTNAMES: 'restaurant-card.pages.dev',
      },
    })

    expect(response.status).toBe(400)
    expect(externalFetch).not.toHaveBeenCalled()
  })

  it.each([
    ['wrong action', { success: true, action: 'signup', hostname: 'restaurant-card.pages.dev' }],
    ['wrong hostname', { success: true, action: 'feedback', hostname: 'example.invalid' }],
  ])('fails closed when Siteverify returns %s', async (_label, siteverify) => {
    const externalFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(siteverify), { status: 200 }),
    )
    const response = await onRequest({
      request: request('POST', { message: 'hello', turnstileToken: 'invalid-context' }, {
        'content-type': 'application/json',
        origin: 'https://restaurant-card.pages.dev',
      }),
      env: {
        TELEGRAM_BOT_TOKEN: 'test-bot-token',
        TELEGRAM_CHAT_ID: 'test-chat-id',
        TURNSTILE_SECRET: 'test-turnstile-secret',
        TURNSTILE_HOSTNAMES: 'restaurant-card.pages.dev',
      },
    })

    expect(response.status).toBe(403)
    expect(externalFetch).toHaveBeenCalledTimes(1)
    expect(String(externalFetch.mock.calls[0]?.[0])).toContain('/siteverify')
  })

  it('fails closed when Siteverify is unavailable', async () => {
    const externalFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('unavailable', { status: 503 }),
    )
    const response = await onRequest({
      request: request('POST', { message: 'hello', turnstileToken: 'unverified' }, {
        'content-type': 'application/json',
        origin: 'https://restaurant-card.pages.dev',
      }),
      env: {
        TELEGRAM_BOT_TOKEN: 'test-bot-token',
        TELEGRAM_CHAT_ID: 'test-chat-id',
        TURNSTILE_SECRET: 'test-turnstile-secret',
        TURNSTILE_HOSTNAMES: 'restaurant-card.pages.dev',
      },
    })
    expect(response.status).toBe(403)
    expect(externalFetch).toHaveBeenCalledTimes(1)
  })
})
