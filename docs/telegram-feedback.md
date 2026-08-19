# Telegram 回饋與 Turnstile

正式站的「送到 Telegram」使用 Cloudflare Pages Function，並先以 Cloudflare Turnstile 防止公開 API 被濫用。GitHub Pages 備用站沒有後端，因此只顯示「開 GitHub Issue」。

## 本機設定

設定檔：`D:\Project\Restaurant-Card\.env.local`

此檔已被 `.gitignore` 排除，禁止 commit、貼進聊天或放進前端程式碼。

```dotenv
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
VITE_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET=
TURNSTILE_HOSTNAMES=localhost,127.0.0.1
```

- `VITE_TURNSTILE_SITE_KEY` 是公開 site key，可以進 frontend bundle。
- `TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`、`TURNSTILE_SECRET` 是 server-only；禁止使用 `VITE_` prefix。
- Turnstile widget action 固定為 `feedback`。

## Telegram 基本設定

1. Telegram 找 `@BotFather`。
2. 執行 `/newbot`，名稱應與 Hermes bot 分開，例如 `Restaurant Card Feedback`。
3. 把 BotFather 提供的 token 寫入 `.env.local` 的 `TELEGRAM_BOT_TOKEN`。
4. 先對新 bot 傳 `/start` 或 `hi`。
5. 不要把 token 放進瀏覽器 URL、聊天訊息或 shell 指令參數；瀏覽器歷史與同步紀錄可能保留它。
6. 讓本機診斷工具從 `.env.local` 讀 token 後呼叫 Telegram `getUpdates`。
7. 將回傳的 `message.chat.id` 寫入 `TELEGRAM_CHAT_ID`。

若出現 `chat not found` 或 `getUpdates` 為空，通常是尚未對正確的新 bot 傳過 `/start`。

## Cloudflare Pages production

Cloudflare Pages project：`restaurant-card`。

Production secrets 必須在 Pages secret store 內設定，不能寫進 `wrangler.jsonc`：

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TURNSTILE_SECRET`

`wrangler.jsonc` 只保存非機密 hostname allowlist：

```json
{
  "vars": {
    "TURNSTILE_HOSTNAMES": "restaurant-card.pages.dev"
  }
}
```

Turnstile widget 必須允許：

- `restaurant-card.pages.dev`
- `localhost`
- `127.0.0.1`

Production Siteverify 只接受回傳 hostname `restaurant-card.pages.dev`；localhost 只供本機開發。

## 驗證與部署

```bash
npm test
npm run build
wrangler pages functions build functions
wrangler pages deploy dist --project-name restaurant-card --branch main --commit-dirty=true
```

部署後應驗證：

1. 沒有 Turnstile token 時 API 回 `403`。
2. 錯誤 action／hostname 被拒絕。
3. 成功 token 只能使用一次，重播必須失敗。
4. Production bundle 不包含 Telegram 或 Turnstile secret。
5. 此專案只使用 Pages／Functions／Turnstile 免費能力，不應啟用 Workers Paid、AI、KV、R2 或 D1。
