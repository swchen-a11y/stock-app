import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
