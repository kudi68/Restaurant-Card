export async function onRequestPost(context: {
  request: Request
  env: {
    TELEGRAM_BOT_TOKEN?: string
    TELEGRAM_CHAT_ID?: string
  }
}): Promise<Response> {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "content-type": "application/json; charset=utf-8",
  }

  const token = context.env.TELEGRAM_BOT_TOKEN
  const chatId = context.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    return new Response(JSON.stringify({ ok: false, error: "telegram_not_configured" }), {
      status: 503,
      headers,
    })
  }

  let payload: { message?: string; contact?: string } = {}
  try {
    payload = (await context.request.json()) as { message?: string; contact?: string }
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad_json" }), { status: 400, headers })
  }

  const message = (payload.message || "").trim()
  if (!message || message.length > 4000) {
    return new Response(JSON.stringify({ ok: false, error: "bad_message" }), { status: 400, headers })
  }

  const text = [
    "餐卡建議",
    message,
    payload.contact ? `聯絡：${payload.contact}` : "",
    `時間：${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n")

  const telegram = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ chat_id: chatId, text }),
  })
  if (!telegram.ok) {
    return new Response(JSON.stringify({ ok: false, error: "telegram_failed" }), {
      status: 502,
      headers,
    })
  }
  return new Response(JSON.stringify({ ok: true }), { headers })
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  })
}
