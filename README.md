# 餐卡 Restaurant Card

月底會歸零的餐卡餘額紀錄與計算機。第 1 版是靜態網頁：資料存在你自己的瀏覽器，不必登入。

## 現在能做什麼

- 手動登記／直接改剩餘金額
- 從系統菜單點餐（飲料可選熱小／熱中／冰中／特大），或手動記一筆金額
- 切換「怕花完」／「花不完」
- 把餘額平攤到月底，換成幾餐、幾杯、幾天湊一餐
- 本月明細、匯出 JSON
- 建議回饋：開 GitHub Issue（Telegram 獨立 bot 之後再接）

## 本機開發

```bash
npm install
npm test
npm run dev
```

瀏覽器打開終端機顯示的本機網址。

## 菜單

真實價目請填 `data/menu.xlsx`（Excel 開著時會有 `~$menu.xlsx` 鎖檔，不要提交那個）。改完後編譯：

```bash
python scripts/menu_xlsx_to_json.py
```

需要本機已安裝 `openpyxl`。目前已匯入 33 項（飲料較齊，餐食還在補）。

## 部署

目標是 Cloudflare Pages，連這個 GitHub repo 即可。尚未接帳號同步，也不需要資料庫。
