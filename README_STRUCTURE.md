# Stock-App 開發規範 (Trae Rules)

## 1. 專案架構與分工
- **Frontend**: Next.js (App Router). UI 檔案位於 `src/components/`，路由位於 `src/app/`。
- **Data Hook**: 資料庫邏輯統一封裝在 `src/hooks/useStockData.js`，禁止在 UI 元件內直接呼叫 Supabase。
- **Scripts**: 所有 Python 自動化與資料抓取腳本放在 `scripts/` 資料夾中。

## 2. 技術棧與環境配置
- **前端框架**: Next.js 14 (App Router) + TypeScript
- **樣式系統**: Tailwind CSS + CSS Modules
- **UI 元件庫**: shadcn/ui (基於 Radix UI)
- **狀態管理**: React Context + Zustand (輕量級狀態)
- **後端服務**: Supabase (Auth/Database/RLS)
- **數據同步**: Python (yfinance + 退避機制)
- **AI 引擎**: Google Gemini 1.5 Pro/Flash
- **開發工具**: ESLint, Prettier, TypeScript

### 環境變數配置
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Gemini AI
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
GEMINI_DAILY_LIMIT=10

# 數據源
YAHOO_FINANCE_USER_AGENTS=user_agent1,user_agent2,user_agent3
```

## 3. 資料庫與安全策略

### 核心表格結構
1. **profiles** - 用戶資料與 AI 配額管理
2. **stock_metadata** - 股票主檔（產業分類）
3. **watchlist** - 觀察清單與持股管理
4. **accounts** - 多幣別資金帳戶
5. **stock_targets** - 分市場月領息目標
6. **stock_history** - 價格歷史紀錄

### 安全策略
- **Row Level Security (RLS)**: 所有表格啟用 RLS
- **用戶隔離**: 每用戶只能存取自己的數據
- **公開讀取**: `stock_metadata` 允許公開讀取
- **認證寫入**: 所有寫入操作需經過認證
- **服務角色密鑰**: 後端 API 端點需使用 `SUPABASE_SERVICE_ROLE_KEY` 繞過 RLS 限制

### 資料庫操作規範
- **前端禁止直接 DB 呼叫**: 所有資料庫操作必須透過 `src/hooks/useStockData.js` 或後端 API 路由
- **類型安全**: 使用 TypeScript 類型定義 Supabase 查詢結果
- **錯誤處理**: 所有資料庫操作必須包含錯誤處理與用戶回饋
- **批量操作**: 大量數據操作使用批次處理，避免單筆操作

## 4. 視覺規範 (iOS Style)
- **配色**: 漲用 `text-apple-red (#FF3B30)`，跌用 `text-apple-green (#34C759)`。
- **特效**: 彈窗與 Header 使用 `backdrop-blur` (毛玻璃) 效果。
- **圓角**: 大容器統一使用 `rounded-2xl` 或 `rounded-3xl`。

### iOS 原生液態玻璃規範
- **全局背景**: `#000000` (純黑背景)
- **卡片背景**: `rgba(28, 28, 30, 0.6)` 搭配 `backdrop-filter: blur(30px) saturate(150%)`
- **玻璃切面邊框**: `0.5px solid rgba(255, 255, 255, 0.12)`
- **內陰影效果**: `inset 0 0 0 0.5px rgba(255, 255, 255, 0.05)`
- **iOS 原生色彩系統**:
  - 上漲膠囊色: `#FF453A` (iOS Red) - 文字白色，圓角 8px
  - 下跌膠囊色: `#30D158` (iOS Green) - 文字白色，圓角 8px
  - 主要文字: `#FFFFFF` (白色) - SF Pro 粗體
  - 次要文字: `#8E8E93` (iOS 次要灰色) - 用於副標題
  - 交互色: `#007AFF` (iOS Blue) - 用於按鈕與選中狀態

## 5. 代碼禁忌 (節省 Token & 避坑)
- **禁止死循環**: 嚴格檢查 `useEffect` 依賴項。若修改 `groups` 或 `selectedMarket` 狀態，必須確保不會互相觸發。
- **股票代碼**: 處理 A 股時，必須使用 `.zfill(6)` 確保 6 位數補零。
- **同步規範**: 提交代碼請提醒我運行 `python push.py` 而非使用 IDE 內建按鈕。

### 同步腳本規範
- **User-Agent 輪替**: 實現多個 User-Agent 隨機輪替，避免被封鎖
- **429 錯誤退避機制**: 檢測到 429 錯誤時自動暫停，指數退避重試（1s, 2s, 4s, 8s...）
- **批量處理**: 支援批量同步多支股票數據
- **錯誤處理**: 完善的錯誤處理與日誌記錄

## 6. 對話優化 (Token Saving)
- 在分析問題前，先讀取 `supabase_schema.sql` 確定欄位名稱，不要通篇掃描 `node_modules`。
- 回覆代碼時，若檔案超過 100 行，僅輸出「修改的部分」，不要重複輸出完整檔案。
- 優先使用現有記憶體中的專案知識，避免重複掃描相同檔案。

## 7. 開發流程規範
- **功能分支**: 每個功能建立獨立分支
- **提交訊息**: 使用 Conventional Commits 規範
- **代碼審查**: 所有變更需要經過審查
- **品質保證**:
  - 類型檢查: 每次提交前執行 `npm run typecheck`
  - 代碼格式化: 使用 Prettier 統一格式
  - 代碼檢查: ESLint 檢查代碼品質

## 8. 專案結構參考
```
stock-app/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 認證相關頁面
│   ├── (dashboard)/              # 主應用頁面
│   │   ├── stocks/               # 股市分頁
│   │   ├── funding/              # 資金帳戶分頁
│   │   ├── settings/             # 設定分頁
│   │   └── layout.tsx           # 主佈局
│   ├── api/                      # API 路由
│   │   ├── stock/                # 股票相關 API
│   │   ├── funding/              # 資金相關 API
│   │   ├── ai/                   # AI 分析 API
│   │   └── auth/                 # 認證 API
│   ├── layout.tsx               # 根佈局
│   └── page.tsx                 # 首頁
├── components/                   # 共用元件
│   ├── ui/                      # 基礎 UI 元件 (shadcn)
│   ├── stocks/                  # 股票相關元件
│   ├── funding/                 # 資金相關元件
│   ├── layout/                  # 佈局元件
│   └── shared/                  # 共用元件
├── lib/                         # 工具函式庫
│   ├── supabase/               # Supabase 客戶端
│   ├── api/                    # API 工具
│   ├── utils/                  # 工具函數
│   └── types/                  # TypeScript 類型定義
├── hooks/                       # 自定義 React Hooks
├── styles/                      # 全域樣式
├── scripts/                     # 數據同步腳本
│   └── sync_stocks.py          # 股票數據同步
├── public/                      # 靜態資源
└── .env.local                   # 環境變數
```