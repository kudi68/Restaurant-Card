import { loadEnv, type Plugin } from 'vite'

export function telegramFeedbackPlugin(): Plugin {
  return {
    name: 'telegram-feedback',
    configureServer(server) {
      server.middlewares.use('/api/feedback', (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method !== 'POST') {
          next()
          return
        }
        const chunks: Buffer[] = []
        req.on('data', (chunk) => chunks.push(chunk as Buffer))
        req.on('end', () => {
          void (async () => {
            res.setHeader('content-type', 'application/json; charset=utf-8')
            const env = loadEnv('development', server.config.root, '')
            const token = env.TELEGRAM_BOT_TOKEN
            const chatId = env.TELEGRAM_CHAT_ID
            if (!token || !chatId) {
              res.statusCode = 503
              res.end(JSON.stringify({ ok: false, error: 'telegram_not_configured' }))
              return
            }
            let payload: { message?: string } = {}
            try {
              payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
                message?: string
              }
            } catch {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: 'bad_json' }))
              return
            }
            const message = (payload.message || '').trim()
            if (!message || message.length > 4000) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: 'bad_message' }))
              return
            }
            const body = new URLSearchParams({
              chat_id: chatId,
              text: `餐卡建議\n${message}\n時間：${new Date().toISOString()}`,
            })
            const telegram = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'content-type': 'application/x-www-form-urlencoded' },
              body,
            })
            if (!telegram.ok) {
              res.statusCode = 502
              res.end(JSON.stringify({ ok: false, error: 'telegram_failed' }))
              return
            }
            res.end(JSON.stringify({ ok: true }))
          })()
        })
      })
    },
  }
}
