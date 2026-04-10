-- ==========================================
-- 1. 清理舊架構 (按依賴順序)
-- ==========================================
--DROP TRIGGER IF EXISTS trigger_sync_category ON stock_metadata;
--DROP TRIGGER IF EXISTS trigger_sync_watchlist ON public.user_groups;
--DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--DROP TRIGGER IF EXISTS watchlist_calc_trigger ON watchlist;

--DROP TABLE IF EXISTS stock_history CASCADE;
--DROP TABLE IF EXISTS stock_targets CASCADE;
--DROP TABLE IF EXISTS watchlist CASCADE;
--DROP TABLE IF EXISTS stock_metadata CASCADE;
--DROP TABLE IF EXISTS accounts CASCADE;
--DROP TABLE IF EXISTS user_groups CASCADE;
--DROP TABLE IF EXISTS profiles CASCADE;

-- ==========================================
-- 2. 用戶基礎資料 (Profiles & Groups)
-- ==========================================

-- 用戶個人資料表
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    username TEXT,
    avatar_url TEXT,
    custom_gemini_key TEXT,              -- 用戶 API Key
    daily_ai_usage INTEGER DEFAULT 0,    -- 當日已分析次數
    last_ai_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profile manage" ON profiles FOR ALL USING (auth.uid() = id);

-- 用戶分組管理表
CREATE TABLE user_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE(user_id, name)                -- 避免同用戶建立重複組名
);
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own groups" 
ON public.user_groups FOR ALL TO authenticated 
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 3. 股票主檔 (Stock Metadata)
-- ==========================================

CREATE TABLE stock_metadata (
    symbol TEXT PRIMARY KEY,             
    name_zh TEXT NOT NULL,               
    market TEXT NOT NULL CHECK (market IN ('TW', 'CN', 'US')), 
    category TEXT,                       -- 產業分類
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE stock_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read stocks" ON stock_metadata FOR SELECT USING (true);
CREATE POLICY "Users contribute stocks" ON stock_metadata FOR ALL TO authenticated USING (true);

-- ==========================================
-- 4. 觀察清單 (Watchlist - 完全對應 sync_stocks.py 欄位)
-- ==========================================

CREATE TABLE watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid() NOT NULL, 
    symbol TEXT NOT NULL,
    name TEXT,                           
    market TEXT NOT NULL,
    group_name TEXT[] DEFAULT ARRAY['我的代號']::text[], -- 支援多標籤陣列
    category TEXT,                       
    sort_order INTEGER DEFAULT 0,        -- 拖拽排序權重
    
    -- 【持股與基礎行情數據】
    current_shares DECIMAL(15, 2) DEFAULT 0, 
    average_cost DECIMAL(15, 2) DEFAULT 0,   
    current_price DECIMAL(15, 2) DEFAULT 0,  -- 現價
    prev_close DECIMAL(15, 2) DEFAULT 0,     -- 昨收 (計算漲跌基準)
    open_price DECIMAL(15, 2),               -- 開盤價 (Python 同步)
    day_high DECIMAL(15, 2),                 -- 今日最高 (Python 同步)
    day_low DECIMAL(15, 2),                  -- 今日最低 (Python 同步)
    change_amount DECIMAL(15, 2) DEFAULT 0,  -- 漲跌額
    change_percent DECIMAL(8, 2) DEFAULT 0,  -- 漲跌幅
    volume BIGINT DEFAULT 0,                 -- 成交量
    
    -- 【Python 腳本專用行情欄位】
    high_52w DECIMAL(15, 2),                 -- 52週最高 (Python 同步)
    low_52w DECIMAL(15, 2),                  -- 52週最低 (Python 同步)
    avg_volume_10d BIGINT,                   -- 10日均量 (Python 同步)
    market_cap DECIMAL(20, 2),               -- 市值 (Python 同步)
    net_value_per_share DECIMAL(15, 2),      -- 每股淨值 (Python 同步)
    
    -- 【財務估值與技術指標 (Python 計算)】
    eps DECIMAL(15, 2),                      -- 每股盈餘
    pe_ratio DECIMAL(15, 2),                 -- 本益比
    pb_ratio DECIMAL(15, 2),                 -- 股價淨值比
    dividend_yield DECIMAL(8, 2),            -- 殖利率
    cash_dividend DECIMAL(15, 2),            -- 現金股利
    roe DECIMAL(8, 2),                       -- 股東權益報酬率
    rsi_14 DECIMAL(8, 2),                    -- RSI 指標
    ma20_distance DECIMAL(8, 2),             -- 20日均線乖離率
    bb_upper DECIMAL(15, 2),                 -- 布林上軌
    bb_lower DECIMAL(15, 2),                 -- 布林下軌
    
    -- 【AI 分析區域】
    ai_score INTEGER DEFAULT 0,              
    ai_analysis_report TEXT,                 
    trend_signal TEXT,                       -- 趨勢訊號 (Python 判定)
    last_ai_generated_at TIMESTAMP WITH TIME ZONE, 
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT watchlist_user_symbol_unique UNIQUE (user_id, symbol)
);
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Watchlist manage" ON watchlist FOR ALL USING (auth.uid() = user_id);

-- 建立 GIN 索引優化分組陣列搜尋
CREATE INDEX idx_watchlist_group_name_gin ON public.watchlist USING GIN (group_name);

-- ==========================================
-- 5. 輔助表格 (Accounts, Targets, History)
-- ==========================================

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid() NOT NULL,
    account_name TEXT NOT NULL,
    market TEXT NOT NULL CHECK (market IN ('TW', 'CN', 'US')), 
    currency TEXT NOT NULL CHECK (currency IN ('TWD', 'CNY', 'USD')), 
    balance DECIMAL(18, 2) DEFAULT 0,    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account manage" ON accounts FOR ALL USING (auth.uid() = user_id);

CREATE TABLE stock_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid() NOT NULL,
    market TEXT NOT NULL CHECK (market IN ('TW', 'CN', 'US')), 
    monthly_income_target DECIMAL(15, 2) DEFAULT 0,           
    target_currency TEXT NOT NULL,                            
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, market)
);
ALTER TABLE stock_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Target manage" ON stock_targets FOR ALL USING (auth.uid() = user_id);

CREATE TABLE stock_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT NOT NULL,
    trade_date DATE NOT NULL,
    close_price DECIMAL(15, 2),
    volume BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT stock_history_symbol_date_unique UNIQUE (symbol, trade_date)
);
CREATE INDEX idx_history_symbol_date ON stock_history (symbol, trade_date DESC);

-- ==========================================
-- 6. 自動化邏輯 (Functions & Triggers)
-- ==========================================

-- A. 新用戶自動初始化 (Profile + 我的代號)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
  INSERT INTO public.user_groups (user_id, name) VALUES (NEW.id, '我的代號');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- B. 分組改名或刪除時，同步更新 Watchlist 陣列
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

CREATE TRIGGER trigger_sync_watchlist AFTER UPDATE OR DELETE ON public.user_groups FOR EACH ROW EXECUTE FUNCTION sync_watchlist_groups();

-- C. 自動同步 Metadata 分類至 Watchlist
CREATE OR REPLACE FUNCTION sync_metadata_to_watchlist() 
RETURNS TRIGGER AS $$
BEGIN
    UPDATE watchlist SET category = NEW.category WHERE symbol = NEW.symbol;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_category AFTER INSERT OR UPDATE OF category ON stock_metadata FOR EACH ROW EXECUTE PROCEDURE sync_metadata_to_watchlist();

-- D. 行情數據自動計算 (漲跌幅、殖利率)
CREATE OR REPLACE FUNCTION handle_stock_calculations() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    -- 自動計算漲跌
    IF NEW.current_price IS NOT NULL AND NEW.prev_close IS NOT NULL AND NEW.prev_close > 0 THEN
        NEW.change_amount = NEW.current_price - NEW.prev_close;
        NEW.change_percent = (NEW.change_amount / NEW.prev_close) * 100;
    END IF;
    -- 自動計算殖利率
    IF NEW.current_price IS NOT NULL AND NEW.current_price > 0 AND NEW.cash_dividend IS NOT NULL THEN
        NEW.dividend_yield = (NEW.cash_dividend / NEW.current_price) * 100;
    END IF;
    RETURN NEW;
END; $$ language 'plpgsql';

CREATE TRIGGER watchlist_calc_trigger BEFORE INSERT OR UPDATE OF current_price, cash_dividend, prev_close ON watchlist FOR EACH ROW EXECUTE PROCEDURE handle_stock_calculations();