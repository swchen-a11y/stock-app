-- ==========================================
-- 1. 結構確保 (防止遺失)
-- ==========================================

-- 用戶分組管理表
CREATE TABLE IF NOT EXISTS user_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE(user_id, name)
);

-- 資金帳戶表 (統一命名為 accounts)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid() NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TWD',
    balance DECIMAL(20, 2) DEFAULT 0,
    goal_amount DECIMAL(20, 2) DEFAULT 0,
    prev_balance DECIMAL(20, 2) DEFAULT 0, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, account_name)
);

-- 觀察清單 (Watchlist)
CREATE TABLE IF NOT EXISTS watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid() NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, 
    symbol TEXT NOT NULL,
    name TEXT,                           
    market TEXT NOT NULL,
    group_name TEXT[] DEFAULT ARRAY['我的代號']::text[], 
    category TEXT,                       
    average_cost DECIMAL(15, 2) DEFAULT 0,
    shares_qty DECIMAL(15, 2) DEFAULT 0,
    current_price DECIMAL(15, 2) DEFAULT 0,  
    prev_close DECIMAL(15, 2) DEFAULT 0,     
    change_amount DECIMAL(15, 2) DEFAULT 0,  
    change_percent DECIMAL(8, 2) DEFAULT 0,  
    sort_order INTEGER DEFAULT 0,
    -- AI 分析相關字段
    ai_analysis_report TEXT,
    ai_score INTEGER DEFAULT 0,
    last_ai_generated_at TIMESTAMPTZ,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT watchlist_user_symbol_unique UNIQUE (user_id, symbol)
);

-- ==========================================
-- 2. 核心自動化 (必須保留，用於註冊與同步)
-- ==========================================

-- A. 新用戶自動初始化函數 (處理 UUID 與 Profiles)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. 建立個人資料 (含 API Key 與初始模型)
  INSERT INTO public.profiles (id, username, avatar_url, selected_model, daily_ai_usage)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'full_name', 
    NEW.raw_user_meta_data->>'avatar_url',
    'gemini-1.5-flash',
    0
  );

  -- 2. 建立預設不可刪除的分組
  INSERT INTO public.user_groups (user_id, name) 
  VALUES (NEW.id, '我的代號');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. 重新綁定觸發器 (避免重複執行)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- 3. 安全政策 (RLS) - 建議保留以防策略跑掉
-- ==========================================

ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- 僅列出最核心的帳戶存取政策
DROP POLICY IF EXISTS "Manage own accounts" ON accounts;
CREATE POLICY "Manage own accounts" ON accounts FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Manage own watchlist" ON watchlist;
CREATE POLICY "Manage own watchlist" ON watchlist FOR ALL USING (auth.uid() = user_id);