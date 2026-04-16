import { createClient } from '@supabase/supabase-js';

// 前端公開配置（瀏覽器端使用）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 後端服務角色配置（伺服器端使用）
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// 判斷是否在伺服器環境
const isServer = typeof window === 'undefined';

// 創建 Supabase 客戶端
// 在伺服器端使用服務角色密鑰以繞過 RLS，在瀏覽器端使用匿名密鑰
export const supabase = createClient(
  supabaseUrl, 
  isServer && supabaseServiceKey ? supabaseServiceKey : supabaseAnonKey,
  {
    db: { schema: 'public' },
    schema: 'public'
  }
);

// 伺服器專用的 Supabase 客戶端（始終使用服務角色密鑰）
export const supabaseServer = isServer && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' },
      schema: 'public'
    })
  : null;

/**
 * Supabase 資料庫服務層
 * 提供 watchlist 相關的 CRUD 操作
 */

/**
 * 取得用戶的所有觀察列表項目
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Array>} 按 sort_order 升序排列的觀察列表項目
 */
export const fetchWatchlist = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    throw error;
  }
};

/**
 * 搜尋股票元數據
 * @param {string} query - 搜尋關鍵字
 * @returns {Promise<Array>} 搜尋結果，最多 20 筆
 */
export const searchStocks = async (query) => {
  try {
    const searchTerm = `%${query}%`;
    const { data, error } = await supabase
      .from('stock_metadata')
      .select('*')
      .or(`symbol.ilike.${searchTerm},name_zh.ilike.${searchTerm}`)
      .order('symbol', { ascending: true })
      .limit(20);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error searching stocks:', error);
    throw error;
  }
};

/**
 * 新增股票到觀察列表
 * @param {string} userId - 用戶 ID
 * @param {string} symbol - 股票代號
 * @param {string} market - 市場代號
 * @param {string} name - 股票名稱
 * @param {string} category - 產業分類
 * @returns {Promise<Object>} 新增的項目
 */
export const addToWatchlist = async (userId, symbol, market, name, category) => {
  try {
    // 先檢查是否已存在
    const { data: existing } = await supabase
      .from('watchlist')
      .select('id')
      .eq('user_id', userId)
      .eq('symbol', symbol)
      .eq('market', market)
      .single();

    if (existing) {
      throw new Error('股票已在觀察列表中');
    }

    // 取得最大的 sort_order
    const { data: maxOrderData } = await supabase
      .from('watchlist')
      .select('sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const maxOrder = maxOrderData?.[0]?.sort_order || 0;
    const newOrder = maxOrder + 1;

    const { data, error } = await supabase
      .from('watchlist')
      .insert({
        user_id: userId,
        symbol,
        market,
        name,
        category,
        group_name: ['我的代號'],
        sort_order: newOrder
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    throw error;
  }
};

/**
 * 更新觀察列表項目的排序順序
 * @param {string} userId - 用戶 ID
 * @param {string} symbol - 股票代號
 * @param {number} newOrder - 新的排序順序
 * @returns {Promise<Object>} 更新後的項目
 */
export const updateWatchlistSort = async (userId, symbol, newOrder) => {
  try {
    const { data, error } = await supabase
      .from('watchlist')
      .update({
        sort_order: newOrder
      })
      .eq('user_id', userId)
      .eq('symbol', symbol)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating watchlist sort order:', error);
    throw error;
  }
};

/**
 * 從觀察列表中移除股票
 * @param {string} userId - 用戶 ID
 * @param {string} symbol - 股票代號
 * @returns {Promise<Object>} 刪除的項目
 */
export const removeFromWatchlist = async (userId, symbol) => {
  try {
    const { data, error } = await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('symbol', symbol)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    throw error;
  }
};

/**
 * 更新觀察列表項目的分組
 * @param {string} userId - 用戶 ID
 * @param {string} symbol - 股票代號
 * @param {Array<string>} groups - 分組名稱陣列
 * @returns {Promise<Object>} 更新後的項目
 */
export const updateWatchlistGroups = async (userId, symbol, groups) => {
  try {
    const { data, error } = await supabase
      .from('watchlist')
      .update({
        group_name: groups
      })
      .eq('user_id', userId)
      .eq('symbol', symbol)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating watchlist groups:', error);
    throw error;
  }
};

/**
 * 財務相關函數
 */

/**
 * 新增資金帳戶
 * @param {string} userId - 用戶 ID
 * @param {string} accountName - 帳戶名稱
 * @param {string} currency - 幣別 (TWD, CNY, USD 等)
 * @param {string} market - 對應市場 (TW, CN, US 等)
 * @returns {Promise<Object>} 新增的帳戶
 */
export const addAccount = async (userId, accountName, currency, market) => {
  try {
    // 檢查是否已存在相同幣別的帳戶
    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('currency', currency)
      .single();

    if (existing) {
      throw new Error(`已存在 ${currency} 幣別的帳戶`);
    }

    const { data, error } = await supabase
      .from('accounts')
      .insert({
        user_id: userId,
        account_name: accountName,
        currency: currency,
        market: market,
        balance: 0,
        daily_pnl: 0,
        daily_pnl_percent: 0,
        last_balance: 0,
        total_pnl: 0
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding account:', error);
    throw error;
  }
};

/**
 * 取得用戶的所有資金帳戶
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Array>} 資金帳戶列表
 */
export const fetchAccounts = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('currency', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching accounts:', error);
    throw error;
  }
};

/**
 * 根據幣別取得資金帳戶
 * @param {string} userId - 用戶 ID
 * @param {string} currency - 幣別
 * @returns {Promise<Object>} 資金帳戶
 */
export const fetchAccountByCurrency = async (userId, currency) => {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('currency', currency)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching account by currency:', error);
    throw error;
  }
};

/**
 * 更新資金帳戶餘額
 * @param {string} userId - 用戶 ID
 * @param {string} currency - 幣別
 * @param {number} balance - 新的餘額
 * @returns {Promise<Object>} 更新後的帳戶
 */
export const updateAccountBalance = async (userId, currency, balance) => {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .update({
        balance: balance,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('currency', currency)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating account balance:', error);
    throw error;
  }
};
