import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 修正重點：顯式指定 db schema 為 'public'，防止系統誤導至 'net' schema
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public'
  }
});

/**
 * Supabase 資料庫服務層
 * 提供 watchlist 相關的 CRUD 操作
 */

/**
 * 取得用戶的所有觀察列表項目
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
 */
export const searchStocks = async (query) => {
  try {
    const searchTerm = `%${query}%`;
    const { data, error } = await supabase
      .from('stock_metadata')
      .select('*')
      .or(`symbol.ilike.${searchTerm},name.ilike.${searchTerm}`)
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
      .maybeSingle(); // 使用 maybeSingle 避免找不到時噴錯

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
 */
export const addAccount = async (userId, accountName, currency, market) => {
  try {
    // 檢查是否已存在相同幣別的帳戶
    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('currency', currency)
      .maybeSingle();

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