# Telegram 回饋 bot（獨立，不要跟 Hermes 混用）

第 1 版畫面先用「開 GitHub Issue」。自動推 Telegram 需要 secrets，等這個 PR 合進 main、Pages 站起來再做 Worker。

## 你需要準備

1. 用手機開 Telegram，找 `@BotFather`
2. `/newbot`，名稱建議 `Restaurant Card Feedback`，username 自訂（要以 `bot` 結尾）
3. 把 token 存好，**不要貼進這個 repo、不要貼進前端**
4. 對新 bot 傳一句話，然後用瀏覽器打開：
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
   從 JSON 抄你的 `chat.id`
5. 之後把 `TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID` 設在 Cloudflare Worker secrets

GitHub Issue 用的 token 也一樣，只放在 Worker，不進 git。
