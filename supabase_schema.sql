-- ==========================================
-- 1. 清理舊架構 (按依賴順序)
-- ==========================================
DROP TABLE IF EXISTS stock_history CASCADE;
DROP TABLE IF EXISTS stock_targets CASCADE;
DROP TABLE IF EXISTS watchlist CASCADE;
DROP TABLE IF EXISTS stock_metadata CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ==========================================
-- 2. 用戶資料
-- ==========================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profile manage" ON profiles FOR ALL USING (auth.uid() = id);

-- ==========================================
-- 3. 股票主檔 (公共庫：支持用戶貢獻與分類同步)
-- ==========================================
CREATE TABLE stock_metadata (
    symbol TEXT PRIMARY KEY,             -- 交易代碼 (如 2330.TW, 600519.SS)
    name_zh TEXT NOT NULL,               -- 中文名稱
    name_en TEXT,                        -- 英文名稱
    market TEXT NOT NULL CHECK (market IN ('TW', 'CN', 'US')), -- 市場
    category TEXT,                       -- 行業分類 (如：半導體、銀行)
    search_keywords TEXT,                -- 搜尋關鍵字
    is_active BOOLEAN DEFAULT TRUE,      -- 啟用狀態
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE stock_metadata ENABLE ROW LEVEL SECURITY;

-- 權限設定：解決陸股匯入問題，允許用戶自主新增與更新分類
CREATE POLICY "Public read stocks" ON stock_metadata FOR SELECT USING (true);
CREATE POLICY "Users contribute stocks" ON stock_metadata FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users update stocks" ON stock_metadata FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_meta_search ON stock_metadata USING gin (to_tsvector('simple', symbol || ' ' || name_zh));

-- ==========================================
-- 4. 觀察清單 (用戶個人行情中心)
-- ==========================================
CREATE TABLE watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid() NOT NULL, 
    symbol TEXT NOT NULL,
    name TEXT,                           -- 冗餘名稱 (供前端快顯)
    market TEXT NOT NULL,
    category TEXT,                       -- 分類副本 (新增：方便前端直接分組)
    
    -- 核心價格區域
    current_price DECIMAL(15, 2),        -- 現價
    change_amount DECIMAL(15, 2),        -- 漲跌額
    change_percent DECIMAL(5, 2),        -- 漲跌幅
    prev_close DECIMAL(15, 2),           -- 昨收價
    open_price DECIMAL(15, 2),           -- 開盤價
    day_high DECIMAL(15, 2),             -- 今日最高
    day_low DECIMAL(15, 2),              -- 今日最低
    
    -- 交易與量能
    volume BIGINT,                       -- 今日成交量
    avg_volume_10d BIGINT,               -- 10日平均成交量
    market_cap DECIMAL(20, 2),           -- 市值
    high_52w DECIMAL(15, 2),             -- 52週最高
    low_52w DECIMAL(15, 2),              -- 52週最低
    
    -- 財務指標區域
    eps DECIMAL(15, 2),                  -- 每股盈餘
    net_value_per_share DECIMAL(15, 2),  -- 每股淨值
    roe DECIMAL(8, 2),                   -- ROE
    cash_dividend DECIMAL(15, 2),        -- 現金股利
    pe_ratio DECIMAL(15, 2),             -- 本益比
    pb_ratio DECIMAL(15, 2),             -- 淨值比
    dividend_yield DECIMAL(8, 2),        -- 殖利率 (由 Function 自動計算)
    
    -- 技術指標與 AI 分析
    ma20_distance DECIMAL(8, 2),         -- 20日均線乖離率
    rsi_14 DECIMAL(8, 2),                -- RSI (14)
    bb_upper DECIMAL(15, 2),             -- 布林通道上軌
    bb_lower DECIMAL(15, 2),             -- 布林通道下軌
    trend_signal TEXT,                   -- 趨勢訊號
    ai_score INTEGER,                    -- AI 綜合評分
    ai_analysis_report TEXT,             -- AI 深度報告本文
    
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT watchlist_user_symbol_unique UNIQUE (user_id, symbol)
);
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Watchlist manage" ON watchlist FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- 5. 自動計算邏輯 (Trigger Functions)
-- ==========================================

CREATE OR REPLACE FUNCTION handle_watchlist_calculations() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- 1. 自動計算殖利率 (股利 / 現價)
    IF NEW.current_price > 0 AND NEW.cash_dividend IS NOT NULL THEN
        NEW.dividend_yield = (NEW.cash_dividend / NEW.current_price) * 100;
    END IF;
    
    -- 2. 自動計算漲跌幅 ( (現價 - 昨收) / 昨收 )
    IF NEW.current_price IS NOT NULL AND NEW.prev_close > 0 THEN
        NEW.change_amount = NEW.current_price - NEW.prev_close;
        NEW.change_percent = (NEW.change_amount / NEW.prev_close) * 100;
    END IF;

    RETURN NEW;
END; $$ language 'plpgsql';

-- 綁定觸發器
CREATE TRIGGER watchlist_calc_trigger 
BEFORE INSERT OR UPDATE OF current_price, cash_dividend, prev_close 
ON watchlist FOR EACH ROW EXECUTE PROCEDURE handle_watchlist_calculations();

-- ==========================================
-- 6. 其他輔助表格
-- ==========================================

-- 帳戶資產
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name TEXT NOT NULL DEFAULT '預設帳戶', 
    currency TEXT NOT NULL CHECK (currency IN ('TWD', 'CNY', 'USD')),
    balance DECIMAL(18, 2) NOT NULL DEFAULT 0.0,
    user_id UUID DEFAULT auth.uid() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account manage" ON accounts FOR ALL USING (auth.uid() = user_id);

-- 價格歷史紀錄 (用於圖表)
CREATE TABLE stock_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT NOT NULL,
    trade_date DATE NOT NULL,
    close_price DECIMAL(15, 2),
    volume BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT stock_history_symbol_date_unique UNIQUE (symbol, trade_date)
);

-- 存股目標管理
CREATE TABLE stock_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid() NOT NULL,
    symbol TEXT NOT NULL,
    current_shares INTEGER DEFAULT 0,
    average_cost DECIMAL(15, 2) DEFAULT 0,
    target_shares INTEGER DEFAULT 0,
    target_monthly_income DECIMAL(15, 2) DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, symbol)
);
ALTER TABLE stock_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Target manage" ON stock_targets FOR ALL USING (auth.uid() = user_id);