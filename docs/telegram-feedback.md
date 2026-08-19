# Telegram 回饋 bot（獨立，不要跟 Hermes 混用）

畫面現在仍用「開 GitHub Issue」。自動推 Telegram 要等這個檔填好。

## 你要填的檔（不會進 git）

路徑：

`D:\Project\Restaurant-Card\.env.local`

內容只要兩行：

```
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=123456789
```

填完存檔，在對話跟我說「telegram 填好了」。不要把 token 貼進 GitHub，也不必貼到聊天裡。

## 怎麼拿到這兩個值

1. Telegram 找 `@BotFather`
2. `/newbot`，名稱建議跟 Hermes 無關，例如 `Restaurant Card Feedback`
3. BotFather 給的 token → `TELEGRAM_BOT_TOKEN`
4. 先對新 bot 傳一句話（例如 `hi`）
5. 瀏覽器打開：`https://api.telegram.org/bot<TOKEN>/getUpdates`
6. JSON 裡的 `message.chat.id` → `TELEGRAM_CHAT_ID`（對自己通常是正整數）

`.env.example` 是給別人看的空範本；真正的值只放 `.env.local`。
