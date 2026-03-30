-- 建立用戶資金帳戶表
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency TEXT NOT NULL CHECK (currency IN ('TWD', 'CNY')),
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID DEFAULT auth.uid() -- 如果之後要支援多用戶
);

-- 建立觀察清單表
CREATE TABLE IF NOT EXISTS watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT NOT NULL,
    name TEXT,
    market TEXT NOT NULL CHECK (market IN ('TW', 'CN', 'US')),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID DEFAULT auth.uid(),
    UNIQUE(user_id, symbol)
);

-- 建立存股目標表
CREATE TABLE IF NOT EXISTS stock_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT NOT NULL,
    target_shares INTEGER NOT NULL,
    target_cost_price DECIMAL(15, 2),
    current_shares INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID DEFAULT auth.uid(),
    UNIQUE(user_id, symbol)
);

-- 建立匯率表
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate DECIMAL(15, 6) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(from_currency, to_currency)
);

-- 開啟 RLS (選用)
-- ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stock_targets ENABLE ROW LEVEL SECURITY;
