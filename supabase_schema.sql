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
-- 2. 用戶資料 (活躍檢測)
-- ==========================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 活躍打點
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profile manage" ON profiles FOR ALL USING (auth.uid() = id);

-- ==========================================
-- 3. 股票主檔 (公共庫：支持用戶首次貢獻)
-- ==========================================
CREATE TABLE stock_metadata (
    symbol TEXT PRIMARY KEY,             -- 代號 (如 600519.SS)
    name_zh TEXT NOT NULL,               -- 中文名
    name_en TEXT,                        -- 英文名
    market TEXT NOT NULL CHECK (market IN ('TW', 'CN', 'US')), -- 市場
    category TEXT,                       -- 板塊/行業
    search_keywords TEXT,                -- 搜尋關鍵字
    is_active BOOLEAN DEFAULT TRUE,      -- 啟用狀態
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE stock_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read stocks" ON stock_metadata FOR SELECT USING (true); -- 所有人可讀
CREATE POLICY "Users contribute stocks" ON stock_metadata FOR INSERT WITH CHECK (auth.role() = 'authenticated'); -- 登入者可新增
CREATE INDEX idx_meta_search ON stock_metadata USING gin (to_tsvector('simple', symbol || ' ' || name_zh)); -- 搜尋加速

-- ==========================================
-- 4. 多幣種帳戶 (資產管理)
-- ==========================================
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name TEXT NOT NULL DEFAULT '預設帳戶', 
    currency TEXT NOT NULL CHECK (currency IN ('TWD', 'CNY', 'USD')), -- 幣別
    balance DECIMAL(18, 2) NOT NULL DEFAULT 0.0, -- 餘額
    user_id UUID DEFAULT auth.uid() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account manage" ON accounts FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- 5. 觀察清單 (行情核心)
-- ==========================================
CREATE TABLE watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid() NOT NULL, 
    symbol TEXT NOT NULL,
    name TEXT,                           -- 冗餘名稱 (供快顯)
    market TEXT NOT NULL,
    current_price DECIMAL(15, 2),        -- 現價
    change_amount DECIMAL(15, 2),         -- 漲跌額
    change_percent DECIMAL(5, 2),         -- 漲跌幅
    volume BIGINT,                        -- 成交量
    high_52w DECIMAL(15, 2),             -- 52週高
    low_52w DECIMAL(15, 2),              -- 52週低
    eps DECIMAL(15, 2),                   -- EPS
    net_value_per_share DECIMAL(15, 2),   -- 淨值
    roe DECIMAL(8, 2),                    -- ROE
    cash_dividend DECIMAL(15, 2),         -- 現金股利
    pe_ratio DECIMAL(15, 2),              -- 本益比
    pb_ratio DECIMAL(15, 2),              -- 淨值比
    dividend_yield DECIMAL(8, 2),         -- 殖利率 (自動算)
    ma20_distance DECIMAL(8, 2),          -- 乖離率
    rsi_14 DECIMAL(8, 2),                 -- RSI
    bb_upper DECIMAL(15, 2),              -- 布林上
    bb_lower DECIMAL(15, 2),              -- 布林下
    trend_signal TEXT,                    -- 趨勢訊號
    ai_score INTEGER,                     -- AI 評分
    ai_analysis_report TEXT,              -- AI 報告
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT watchlist_user_symbol_unique UNIQUE (user_id, symbol)
);
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Watchlist manage" ON watchlist FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- 6. 存股目標 (績效計算)
-- ==========================================
CREATE TABLE stock_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid() NOT NULL,
    symbol TEXT NOT NULL,
    current_shares INTEGER DEFAULT 0,     -- 現持股數
    average_cost DECIMAL(15, 2) DEFAULT 0, -- 平均成本
    target_shares INTEGER DEFAULT 0,      -- 目標股數
    target_monthly_income DECIMAL(15, 2) DEFAULT 0, -- 目標月領
    dividend_frequency INTEGER DEFAULT 1, -- 配息頻率
    total_cost DECIMAL(18, 2),            -- 總成本 (自動)
    market_value DECIMAL(18, 2),          -- 市值 (自動)
    profit_loss DECIMAL(18, 2),           -- 損益額 (自動)
    profit_loss_percent DECIMAL(8, 2),     -- 損益率 (自動)
    annual_estimate_dividend DECIMAL(15, 2), -- 年預估股息 (自動)
    monthly_estimate_dividend DECIMAL(15, 2), -- 月預估股息 (自動)
    target_achievement_rate DECIMAL(8, 2), -- 達成率 (自動)
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, symbol)
);
ALTER TABLE stock_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Target manage" ON stock_targets FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- 7. 歷史數據 (全域共享)
-- ==========================================
CREATE TABLE stock_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT NOT NULL,
    trade_date DATE NOT NULL,
    close_price DECIMAL(15, 2),           -- 收盤價
    volume BIGINT,                        -- 成交量
    rsi_14 DECIMAL(8, 2),                 -- RSI
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT stock_history_symbol_date_unique UNIQUE (symbol, trade_date)
);

-- ==========================================
-- 8. 自動計算邏輯 (Functions)
-- ==========================================

-- Watchlist: 自動算殖利率
CREATE OR REPLACE FUNCTION handle_watchlist_calculations() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    IF NEW.current_price > 0 AND NEW.cash_dividend IS NOT NULL THEN
        NEW.dividend_yield = (NEW.cash_dividend / NEW.current_price) * 100; -- 殖利率公式
    END IF;
    RETURN NEW;
END; $$ language 'plpgsql';

-- Stock Targets: 自動算損益/達成率
CREATE OR REPLACE FUNCTION handle_investment_calculations() RETURNS TRIGGER AS $$
DECLARE cur_p DECIMAL; div_v DECIMAL;
BEGIN
    NEW.updated_at = NOW(); NEW.last_updated = NOW();
    SELECT current_price, cash_dividend INTO cur_p, div_v FROM watchlist WHERE symbol = NEW.symbol AND user_id = NEW.user_id LIMIT 1;
    IF NEW.current_shares > 0 AND NEW.average_cost > 0 THEN
        NEW.total_cost = NEW.current_shares * NEW.average_cost; -- 算總成本
        IF cur_p IS NOT NULL THEN
            NEW.market_value = NEW.current_shares * cur_p; -- 算市值
            NEW.profit_loss = NEW.market_value - NEW.total_cost; -- 算損益額
            IF NEW.total_cost > 0 THEN NEW.profit_loss_percent = (NEW.profit_loss / NEW.total_cost) * 100; END IF; -- 算損益率
        END IF;
    END IF;
    IF div_v IS NOT NULL AND NEW.current_shares > 0 THEN
        NEW.annual_estimate_dividend = NEW.current_shares * div_v; -- 算年息
        NEW.monthly_estimate_dividend = NEW.annual_estimate_dividend / 12; -- 算月息
        IF NEW.target_monthly_income > 0 THEN NEW.target_achievement_rate = (NEW.monthly_estimate_dividend / NEW.target_monthly_income) * 100; END IF; -- 算達成率
    END IF;
    RETURN NEW;
END; $$ language 'plpgsql';

-- 連動機制: 價格更新觸發 Target 重算
CREATE OR REPLACE FUNCTION trigger_target_recalc() RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.current_price IS DISTINCT FROM NEW.current_price OR OLD.cash_dividend IS DISTINCT FROM NEW.cash_dividend) THEN
        UPDATE stock_targets SET last_updated = NOW() WHERE symbol = NEW.symbol AND user_id = NEW.user_id; -- 連動計算
    END IF;
    RETURN NEW;
END; $$ language 'plpgsql';

-- ==========================================
-- 9. 觸發器綁定 (Triggers)
-- ==========================================

DROP TRIGGER IF EXISTS watchlist_calc_trigger ON watchlist;
CREATE TRIGGER watchlist_calc_trigger BEFORE INSERT OR UPDATE OF current_price, cash_dividend ON watchlist FOR EACH ROW EXECUTE PROCEDURE handle_watchlist_calculations();

DROP TRIGGER IF EXISTS stock_targets_calc_trigger ON stock_targets;
CREATE TRIGGER stock_targets_calc_trigger BEFORE INSERT OR UPDATE ON stock_targets FOR EACH ROW EXECUTE PROCEDURE handle_investment_calculations();

DROP TRIGGER IF EXISTS watchlist_price_update_trigger ON watchlist;
CREATE TRIGGER watchlist_price_update_trigger AFTER UPDATE OF current_price, cash_dividend ON watchlist FOR EACH ROW EXECUTE PROCEDURE trigger_target_recalc();