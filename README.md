# 餐卡 Restaurant Card

月底會歸零的餐卡餘額紀錄與計算機。第 1 版是靜態網頁：資料存在你自己的瀏覽器，不必登入。

線上：https://kudi68.github.io/Restaurant-Card/

手機瀏覽器打開後，可「加入主畫面」（PWA）。

## 現在能做什麼

- 手動登記／直接改剩餘金額
- 從系統菜單點餐，或手動記一筆金額
- 飲料預設尺寸＋其他冷熱／大小
- 右上角「設定」：淺色／深色、只算平日／自訂剩餘天數、換算單價
- 切換「怕花完」／「花不完」
- 本月明細、匯出 JSON
- 建議回饋：Telegram（本機 dev）或 GitHub Issue

## 本機開發

```bash
npm install
npm test
npm run dev
```

## 菜單

真實價目請填 `data/menu.xlsx`。改完後：

```bash
python scripts/menu_xlsx_to_json.py
```

需要 `openpyxl`。

## 部署

push `main` 後，GitHub Actions 會發到 GitHub Pages。
Telegram 上線 API 在 `functions/api/feedback.ts`，要接到 Cloudflare Pages 並設定 secrets 才會在正式站生效。
