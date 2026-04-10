# 股市投資管理平台 - 專案結構與開發準則

## 專案概述
本專案為一個現代化的股市投資管理平台，整合即時行情、資產管理、AI分析與多幣別資金帳戶功能。專案採用 Next.js 14 (App Router) 作為前端框架，Supabase 作為後端服務，並整合 Google Gemini AI 引擎進行智能分析。

## 核心架構

### 技術棧
- **前端框架**: Next.js 14 (App Router) + TypeScript
- **樣式系統**: Tailwind CSS + CSS Modules
- **UI 元件庫**: shadcn/ui (基於 Radix UI)
- **狀態管理**: React Context + Zustand (輕量級狀態)
- **後端服務**: Supabase (Auth/Database/RLS)
- **數據同步**: Python (yfinance + 退避機制)
- **AI 引擎**: Google Gemini 1.5 Pro/Flash
- **開發工具**: ESLint, Prettier, TypeScript

### 專案結構
```
stock-app/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 認證相關頁面
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/              # 主應用頁面
│   │   ├── stocks/               # 股市分頁
│   │   ├── funding/              # 資金帳戶分頁
│   │   ├── settings/             # 設定分頁
│   │   └── layout.tsx           # 主佈局
│   ├── api/                      # API 路由
│   │   ├── stock/
│   │   │   ├── search/          # 股票搜尋 API
│   │   │   ├── metadata/        # 股票元數據 API
│   │   │   └── sync/            # 同步 API
│   │   ├── funding/
│   │   ├── ai/
│   │   └── auth/
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
├── .env.local                   # 環境變數
├── package.json                 # 依賴管理
├── tailwind.config.js           # Tailwind 配置
├── tsconfig.json                # TypeScript 配置
└── README_STRUCTURE.md          # 本文件
```

## 分頁功能定義

### A. 股市分頁 (Stocks)

#### 分組邏輯
- **我的代號**: 依 `watchlist` 表中的 `group_name` 欄位顯示
- **自定義分組**: 用戶可自行輸入組名（如：核心持股、短線交易、觀察名單）
- **產業分類**: 顯示來自 `stock_metadata` 的 `category` 欄位（產業分類）
- **獨立顯示**: 分組與產業分類互不干擾，可同時顯示

#### 持股管理
- **行情模式**: 顯示即時價格、漲跌幅、成交量等市場數據
- **資產模式**: 顯示 `average_cost` 與 `current_shares` 計算後的損益
  - 實現損益 = (當前價格 - 平均成本) × 持股數量
  - 實現損益率 = (實現損益 / (平均成本 × 持股數量)) × 100%
- **模式切換**: 卡片支援兩種模式即時切換

#### 智能搜尋
- **API 端點**: `api/stock/search`
- **A 股代號自動判別**:
  - 6 開頭 → `.SS` (上海證券交易所)
  - 0/3 開頭 → `.SZ` (深圳證券交易所)
- **動態新增邏輯**:
  1. 用戶搜尋股票代號
  2. 系統檢查 `stock_metadata` 是否存在
  3. 若不存在，自動抓取股票資訊（名稱、市場、分類）
  4. 顯示預覽，允許用戶手動修正名稱、市場與分類
  5. 用戶確認後新增至資料庫

#### 主分頁實作 (`src/app/stocks/page.tsx`)
- **視覺設計**:
  - 純黑背景 (`#000000`) 搭配 iOS 原生液態玻璃組件
  - 使用 `.ios-liquid-glass` 類別實現玻璃切面效果
  - 卡片邊框: `0.5px solid rgba(255, 255, 255, 0.12)`
  - 內陰影: `inset 0 0 0 0.5px rgba(255, 255, 255, 0.05)`

- **數據處理**:
  - 讀取 `watchlist` 表並依照 `group_name` 分組顯示
  - 支援「未分組」類別處理
  - 分組標題使用 iOS 原生樣式: 次要灰色 (`#8E8E93`) 文字

- **交互功能**:
  - 點擊搜尋框跳出搜尋彈窗 (`SearchModal.tsx`)
  - 搜尋結果若不在資料庫，顯示「新增股票」提示
  - 支援股票代號與名稱搜尋
  - 搜尋結果顯示資料庫存在狀態指示器

- **動態效果**:
  - 使用 framer-motion 實現優雅的淡入效果
  - 列表載入時有交錯延遲動畫 (staggered animation)
  - 搜尋彈窗滑入/滑出動畫
  - 載入狀態與空狀態的平滑過渡

- **組件結構**:
  - `SearchModal.tsx`: 搜尋彈窗組件，整合搜尋 API 與結果顯示
  - `StockCard.tsx`: 股票卡片組件，支援 iOS 液態玻璃樣式
  - `IOSActionSheet.tsx`: iOS 原生 Action Sheet 組件，用於觀察列表管理

### B. 資金帳戶分頁 (Funding)

#### 多幣別帳戶
- **帳戶顯示**: 依 `accounts` 表顯示 TWD、CNY、USD 的可用資金
- **幣別轉換**: 支援即時匯率轉換顯示
- **帳戶管理**: 可新增、編輯、刪除資金帳戶

#### 分市場目標設定
- **目標設定**: 支援用戶在同一頁面針對 TW (台幣) 與 CN (人民幣) 設定不同的 `monthly_income_target`
- **獨立管理**: 每個市場的月領息目標獨立設定與追蹤
- **貨幣標示**: 目標金額顯示對應貨幣符號

#### 進度追蹤
- **計算邏輯**:
  - 月平均領息 = 該市場持股的預估年領息 ÷ 12
  - 進度百分比 = (月平均領息 ÷ 月領息目標) × 100%
- **視覺化**:
  - 進度條顯示當前進度
  - 顏色區分：<50% (紅色)、50-80% (黃色)、>80% (綠色)
  - 顯示具體數字與百分比

### C. 設定分頁 (Settings)

#### API 管理
- **Gemini Key 管理**: 讓用戶填入自己的 `custom_gemini_key`
- **安全儲存**: API Key 加密儲存於 `profiles` 表
- **即時驗證**: 輸入後立即驗證 API Key 有效性

#### 配額限制
- **預設限制**: 若無個人 Key，每日限制使用 Gemini 分析 10 次
- **使用紀錄**: 分析次數紀錄於 `profiles` 表的 `daily_ai_usage` 欄位
- **重置機制**: `last_ai_reset_at` 記錄最後重置時間，每日 00:00 自動重置
- **配額顯示**: 清晰顯示當日已使用次數與剩餘次數

## 技術開發重點

### 同步腳本重寫
**檔案位置**: `scripts/sync_stocks.py`

#### 核心要求
1. **使用 yfinance**: 替換現有數據源，使用 Yahoo Finance API
2. **User-Agent 輪替**: 實現多個 User-Agent 隨機輪替，避免被封鎖
3. **429 錯誤退避機制**:
   - 檢測到 429 錯誤時自動暫停
   - 指數退避重試（1s, 2s, 4s, 8s...）
   - 最大重試次數限制
4. **批量處理**: 支援批量同步多支股票數據
5. **錯誤處理**: 完善的錯誤處理與日誌記錄

#### 同步內容
- 即時價格與漲跌幅
- 成交量與成交額
- 股息資訊與殖利率
- 技術指標（MA20 距離）

### UI 風格規範
**設計理念**: iOS 原生液態玻璃風格 (iOS Native Liquid Glass)

#### 背景與層次規範
- **全局背景**: `#000000` (純黑背景)
- **卡片背景**: `rgba(28, 28, 30, 0.6)` 搭配 `backdrop-filter: blur(30px) saturate(150%)`
- **玻璃切面邊框**: `0.5px solid rgba(255, 255, 255, 0.12)`
- **內陰影效果**: `inset 0 0 0 0.5px rgba(255, 255, 255, 0.05)`
- **移除外部陰影**: 僅使用內陰影模擬玻璃折射

#### iOS 原生色彩系統
- **上漲膠囊色**: `#FF453A` (iOS Red) - 文字白色，圓角 8px
- **下跌膠囊色**: `#30D158` (iOS Green) - 文字白色，圓角 8px
- **主要文字**: `#FFFFFF` (白色) - SF Pro 粗體
- **次要文字**: `#8E8E93` (iOS 次要灰色) - 用於副標題
- **交互色**: `#007AFF` (iOS Blue) - 用於按鈕與選中狀態

#### 字體與排版規範
- **主要字體**: SF Pro (系統優先，備用 -apple-system, BlinkMacSystemFont)
- **標題字重**: 700 (粗體)
- **資訊緊湊**: 標題與副標題高度緊湊排列
- **圓角系統**: 卡片使用 16px 圓角，膠囊使用 8px 圓角

#### 排版優化與視覺規範 (基於 Figma 設計稿分析)

**設計稿分析總結**:
- **主畫面 (30_115)**: 402px × 874px 容器，圓角 34px，背景 #1a1a1a
- **觀察列表 (77_213)**: 402px × 874px 容器，圓角 34px，背景 #1a1a1a  
- **其他選單 (137_15)**: 181px × 143px 容器，圓角 14px，背景 #262626
- **資金帳戶選單 (137_32)**: 132px × 69px 容器，圓角 14px，背景 #262626

**統一字體規範**:
- **主要字體**: SF Pro (系統優先)，備用 "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei"
- **標題字體**: Blinker (用於分組標題)，字間距 4px
- **字體大小系統**:
  - 超大標題: 34px (行高 41px，字間距 0.4px)
  - 主標題: 17px (行高 22px，字間距 -0.43px)
  - 副標題: 15px (行高 20px，字間距 -0.23px)
  - 小字: 13px (行高 18px，字間距 -0.08px)

**色彩系統規範**:
- **背景色階**: #000000 → #1a1a1a → #262626 → #6e6e6e33
- **文字顏色**: #FFFFFF (主要), #959595 (次要), #c7c7c7 (分隔線)
- **漲跌顏色**: #04d301 (上漲), #d30101 (下跌)
- **交互顏色**: #6e6e6e33 (按鈕背景), #ffffff33 (內陰影)

**間距系統 (基於 8px 網格)**:
- **大間距**: 42px, 34px, 20px
- **中間距**: 14px, 13px, 10px, 8px, 7px, 5px
- **小間距**: 4px, 3px, 2px, 1px
- **內邊距模式**: 對稱內邊距為主，如 76px 30px 509px

**RWD 響應式斷點系統**:
- `xs`: 375px (小手機)
- `sm`: 640px (手機橫向/小平板)
- `md`: 768px (平板)
- `lg`: 1024px (小筆電)
- `xl`: 1280px (筆電)
- `2xl`: 1536px (桌機)

**元件尺寸規範**:
- **圓角系統**: 34px (大容器), 14px (卡片), 8px (膠囊), 4px (小元素)
- **分隔線**: 1px 實線，顏色 #c7c7c7 或 #ffffff
- **按鈕尺寸**: 77px × 31px (搜尋按鈕), 25px × 25px (圖標按鈕)
- **膠囊尺寸**: 51px × 20px (漲跌顯示)

#### 交互與動畫規範

1. **觸感回饋**:
   - 點擊卡片: `whileTap: { scale: 0.96 }` (framer-motion)
   - 按鈕點擊: `.ios-tap-feedback` CSS 類別

2. **動畫系統**:
   - 卡片出現: 彈簧動畫 (spring stiffness: 260, damping: 20)
   - 懸浮效果: 輕微縮放與玻璃邊緣光暈
   - Action Sheet: 底部滑出彈簧動畫

3. **Action Sheet 規範**:
   - 半透明背景: `bg-black/40 backdrop-blur-sm`
   - 玻璃效果: `.ios-liquid-glass` 類別
   - 選中標記: 藍色勾選圖示 (iOS 系統樣式)
   - 取消按鈕: 獨立卡片樣式

#### 元件規範
1. **股票卡片 (StockCard.tsx)**:
   - iOS 原生液態玻璃容器
   - 行情模式與資產模式切換
   - 漲跌膠囊樣式 (`.ios-pill-up`, `.ios-pill-down`)
   - 「新增觀察列表」按鈕觸發 Action Sheet

2. **iOS Action Sheet (IOSActionSheet.tsx)**:
   - 底部滑出半透明彈窗
   - backdrop-blur 模糊背景
   - 選項列表與選中標記
   - 取消按鈕獨立顯示

3. **CSS 類別定義**:
   - `.ios-liquid-glass`: 核心玻璃效果
   - `.ios-liquid-glass-hover`: 懸浮狀態
   - `.ios-pill-up`/`.ios-pill-down`: 漲跌膠囊
   - `.ios-title`/`.ios-subtitle`: 字體樣式
   - `.ios-tap-feedback`: 觸感回饋

#### 技術實現
- **CSS**: 定義於 `app/styles/globals.css`
- **Tailwind 配置**: 更新 `tailwind.config.js` 中的 iOS 色系
- **動畫庫**: framer-motion 用於彈簧動畫與交互
- **圖標庫**: lucide-react 提供系統圖標

## 資料庫結構摘要

### 核心表格
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

## 開發流程規範

### 代碼提交
1. **功能分支**: 每個功能建立獨立分支
2. **提交訊息**: 使用 Conventional Commits 規範
3. **代碼審查**: 所有變更需要經過審查
4. **測試要求**: 新增功能需包含單元測試

### 品質保證
1. **類型檢查**: 每次提交前執行 `npm run typecheck`
2. **代碼格式化**: 使用 Prettier 統一格式
3. **代碼檢查**: ESLint 檢查代碼品質
4. **測試覆蓋**: 核心功能需達到 80% 測試覆蓋率

### 部署流程
1. **開發環境**: Vercel 自動部署（每次推送）
2. **預覽環境**: 功能分支部署預覽
3. **生產環境**: 手動觸發部署（主分支）

## 環境變數配置

### 必要變數
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

### 可選變數
```env
# 開發調試
NEXT_PUBLIC_DEBUG=true
NEXT_PUBLIC_LOG_LEVEL=info

# 功能開關
NEXT_PUBLIC_ENABLE_AI_ANALYSIS=true
NEXT_PUBLIC_ENABLE_SYNC_SCRIPT=true
```

## 後續開發指引

### 優先級順序
1. ✅ 建立專案基礎結構
2. ✅ 實作股票搜尋 API (`api/stock/search`)
3. ✅ 建立股市分頁 UI (`src/app/stocks/page.tsx`)
4. ⏳ 實作資金帳戶分頁
5. ⏳ 重寫同步腳本 (`scripts/sync_stocks.py`)
6. ⏳ 整合 Gemini AI 分析
7. ⏳ 實作設定分頁

### 注意事項
1. **安全性**: 所有用戶輸入需經過驗證與清理
2. **性能**: 實現數據緩存與懶加載
3. **可訪問性**: 遵循 WCAG 2.1 AA 標準
4. **響應式**: 支援桌面、平板、手機三種尺寸
5. **錯誤處理**: 所有 API 呼叫需有錯誤處理

---

**最後更新**: 2026-04-05  
**版本**: 1.0.0  
**維護者**: 開發團隊