# Faculty Specs AI

老師專長搜尋系統，採前後端分離：

```text
Web project
  /client   Vue + Vite
  /server   Express API + SQLite
```

## 後端啟動

```bash
cd server
npm install
copy .env.example .env
npm run import
npm run dev
```

後端預設網址：

```text
http://localhost:3000
```

API：

```text
GET  /api/professors
POST /api/professors/:id/generate-tags
```

Gemini API Key 請填在 `server/.env`：

```text
GEMINI_API_KEY=你的_API_KEY
```

如果還沒有填 API Key，後端會先用本地關鍵字規則產生 tags，方便展示與測試。

## 前端啟動

```bash
cd client
npm install
npm run dev
```

前端預設網址：

```text
http://localhost:5173
```
