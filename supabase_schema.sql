-- ==========================================
-- 1. 基礎表格 (Groups & Metadata)
-- ==========================================

-- 用戶分組管理表
CREATE TABLE IF NOT EXISTS user_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE(user_id, name)
);
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
--CREATE POLICY "Users can manage their own groups" ON user_groups FOR ALL USING (auth.uid() = user_id);

-- 股票主檔 (Metadata)
CREATE TABLE IF NOT EXISTS stock_metadata (
    symbol TEXT PRIMARY KEY,             
    name_zh TEXT NOT NULL,               
    market TEXT NOT NULL, 
    category TEXT,                       
    added_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE stock_metadata ENABLE ROW LEVEL SECURITY;
--CREATE POLICY "Public read stocks" ON stock_metadata FOR SELECT USING (true);

-- ==========================================
-- 2. 觀察清單 (Watchlist - 與 Python 欄位完全對齊)
-- ==========================================

CREATE TABLE IF NOT EXISTS watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid() NOT NULL, 
    symbol TEXT NOT NULL,
    name TEXT,                           
    market TEXT NOT NULL,
    group_name TEXT[] DEFAULT ARRAY['我的代號']::text[], -- 陣列格式
    category TEXT,                       
    
    -- 【行情與技術指標 - 對應 sync_stocks.py】
    current_price DECIMAL(15, 2) DEFAULT 0,  
    prev_close DECIMAL(15, 2) DEFAULT 0,     
    open_price DECIMAL(15, 2),               
    day_high DECIMAL(15, 2),                 
    day_low DECIMAL(15, 2),                  
    change_amount DECIMAL(15, 2) DEFAULT 0,  
    change_percent DECIMAL(8, 2) DEFAULT 0,  
    volume BIGINT DEFAULT 0,                 
    
    high_52w DECIMAL(15, 2),                 
    low_52w DECIMAL(15, 2),                  
    avg_volume_10d BIGINT,                   
    market_cap DECIMAL(20, 2),               
    net_value_per_share DECIMAL(15, 2),      
    
    eps DECIMAL(15, 2),                      
    pe_ratio DECIMAL(15, 2),                 
    pb_ratio DECIMAL(15, 2),                 
    dividend_yield DECIMAL(8, 2),            
    cash_dividend DECIMAL(15, 2),            
    roe DECIMAL(8, 2),                       
    rsi_14 DECIMAL(8, 2),                    
    ma20_distance DECIMAL(8, 2),             
    bb_upper DECIMAL(15, 2),                 
    bb_lower DECIMAL(15, 2),                 
    trend_signal TEXT,                       
    
    -- 【狀態欄位】
    added_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT watchlist_user_symbol_unique UNIQUE (user_id, symbol)
);
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
--CREATE POLICY "Watchlist manage" ON watchlist FOR ALL USING (auth.uid() = user_id);

-- 建立索引加速分組操作 (GIN 索引)
CREATE INDEX IF NOT EXISTS idx_watchlist_group_name_gin ON watchlist USING GIN (group_name);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);

-- ==========================================
-- 3. 自動化觸發器 (Triggers)
-- ==========================================

-- A. 當分組改名/刪除時，同步更新 Watchlist 陣列
CREATE OR REPLACE FUNCTION sync_watchlist_groups()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.name IS DISTINCT FROM NEW.name) THEN
        UPDATE public.watchlist SET group_name = array_replace(group_name, OLD.name, NEW.name)
        WHERE user_id = OLD.user_id AND group_name @> ARRAY[OLD.name];
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.watchlist SET group_name = array_remove(group_name, OLD.name)
        WHERE user_id = OLD.user_id AND group_name @> ARRAY[OLD.name];
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_watchlist ON user_groups;
CREATE TRIGGER trigger_sync_watchlist AFTER UPDATE OR DELETE ON user_groups FOR EACH ROW EXECUTE FUNCTION sync_watchlist_groups();

-- B. 當 Metadata 名稱或分類變動，同步至 Watchlist
CREATE OR REPLACE FUNCTION sync_metadata_to_watchlist() 
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.watchlist 
    SET category = NEW.category, name = NEW.name_zh
    WHERE symbol = NEW.symbol;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_category ON stock_metadata;
CREATE TRIGGER trigger_sync_category AFTER UPDATE OF category, name_zh ON stock_metadata FOR EACH ROW EXECUTE PROCEDURE sync_metadata_to_watchlist();

ALTER TABLE stock_history ADD CONSTRAINT unique_symbol_date UNIQUE (symbol, trade_date);

-- 增加排序欄位，預設為 0
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 1. 開啟 Watchlist 的 RLS 政策，讓使用者只能操作自己的資料
DROP POLICY IF EXISTS "Watchlist manage" ON public.watchlist;
CREATE POLICY "Watchlist manage" ON public.watchlist 
FOR ALL USING (auth.uid() = user_id);

-- 2. 開啟 Metadata 的 RLS 政策，讓所有人都能讀取股票清單（搜尋用）
DROP POLICY IF EXISTS "Public read stocks" ON public.stock_metadata;
CREATE POLICY "Public read stocks" ON public.stock_metadata 
FOR SELECT USING (true);

-- 3. 開啟 User Groups 的 RLS 政策
DROP POLICY IF EXISTS "Users can manage their own groups" ON public.user_groups;
CREATE POLICY "Users can manage their own groups" ON public.user_groups 
FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- 4. 財務相關表格 (Finance Tables)
-- ==========================================

-- 4.1 多幣別資金帳戶表 (accounts)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    currency TEXT NOT NULL,  -- 幣別: TWD, CNY, USD 等
    balance DECIMAL(15, 2) DEFAULT 0,  -- 帳戶餘額
    account_name TEXT,  -- 帳戶名稱 (可選)
    market TEXT,  -- 對應市場: TW, CN, US 等
    daily_pnl DECIMAL(15, 2) DEFAULT 0,  -- 當日損益
    daily_pnl_percent DECIMAL(8, 2) DEFAULT 0,  -- 當日損益百分比
    last_balance DECIMAL(15, 2) DEFAULT 0,  -- 昨日結餘
    total_pnl DECIMAL(15, 2) DEFAULT 0,  -- 累計收益
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT accounts_user_currency_unique UNIQUE (user_id, currency)
);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own accounts" ON accounts 
FOR ALL USING (auth.uid() = user_id);

-- 4.2 分市場月領息目標表 (stock_targets)
CREATE TABLE IF NOT EXISTS stock_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    market TEXT NOT NULL,  -- 市場: TW (台股), CN (A股), US (美股)
    monthly_income_target DECIMAL(15, 2) DEFAULT 0,  -- 月領息目標金額
    target_currency TEXT NOT NULL,  -- 目標幣別
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT stock_targets_user_market_unique UNIQUE (user_id, market)
);
ALTER TABLE stock_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own stock targets" ON stock_targets 
FOR ALL USING (auth.uid() = user_id);

-- 4.3 價格歷史紀錄表 (stock_history)
CREATE TABLE IF NOT EXISTS stock_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT NOT NULL,
    trade_date DATE NOT NULL,
    open_price DECIMAL(15, 2),
    high_price DECIMAL(15, 2),
    low_price DECIMAL(15, 2),
    close_price DECIMAL(15, 2),
    volume BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_symbol_date UNIQUE (symbol, trade_date)
);
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read stock history" ON stock_history 
FOR SELECT USING (true);
