# 餐卡 Restaurant Card

月底會歸零的餐卡餘額紀錄、必要餐費與規劃試算工具。資料存在使用者自己的瀏覽器，不必登入。

- 正式站（Cloudflare Pages）：https://restaurant-card.pages.dev
- 備用靜態站（GitHub Pages，沒有 Telegram API）：https://kudi68.github.io/Restaurant-Card/

手機瀏覽器打開後，可「加入主畫面」（PWA）。

## 現在能做什麼

- 手動登記／直接改剩餘金額
- 從系統菜單點餐，或手動記一筆金額
- 飲料預設尺寸＋其他冷熱／大小
- 淺色 Apple／深色考古豹
- 首頁日均可選日曆天、只算平日或自訂天數
- 星期一至日分別設定午餐／晚餐習慣
- 必要餐費從今天估到月底，可手動排除今天已吃的午／晚餐
- 規劃頁飲料購物車試算：跨天保存、換月清空、不扣餐卡餘額
- 「如果全換成飲料」杯數估算
- 切換「怕花完」／「花不完」
- 本月明細、匯出 JSON
- 建議回饋：正式站使用 Telegram＋Turnstile；備用站使用 GitHub Issue

## 本機開發

```bash
npm install
npm test
npm run dev
```

本機 Telegram／Turnstile 設定請參考 `docs/telegram-feedback.md`。所有 secrets 必須放在被 gitignore 的 `.env.local`，禁止放入前端或 commit。

## 菜單

真實價目請填 `data/menu.xlsx`。改完後：

```bash
python scripts/menu_xlsx_to_json.py
```

需要 `openpyxl`。目前「生活食品」分頁為空，規劃購物車先使用飲料。

## 部署

GitHub Actions 會把 `main` 發到 GitHub Pages 備用站。正式站使用 Cloudflare Pages Direct Upload：

```bash
npm test
npm run build
wrangler pages deploy dist --project-name restaurant-card --branch main --commit-dirty=true
```

Cloudflare Pages secrets 與 Turnstile hostname allowlist 的設定、驗證方式請見 `docs/telegram-feedback.md`。本專案只使用 Pages／Functions／Turnstile 免費能力，不應啟用付費方案。
