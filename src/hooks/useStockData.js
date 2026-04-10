"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function useStockData(selectedMarket) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 使用 useRef 儲存當前的 selectedMarket，確保 Realtime 回調永遠能拿到最新值
  const marketRef = useRef(selectedMarket);

  useEffect(() => {
    marketRef.current = selectedMarket;
  }, [selectedMarket]);

  // 1. 核心抓取函數：增加 isSilent 參數避免 UI 閃爍
  const fetchStocks = useCallback(async (isSilent = false) => {
    // 只有在非靜默加載（如切換市場或初次載入）時才顯示 Loading
    if (!isSilent) setLoading(true);
    
    try {
        const currentMarket = marketRef.current;
        let query = supabase.from('watchlist').select('*');
        
        // 根據分組過濾 (與 supabase_schema.sql 中的 TEXT[] 陣列對齊)
        if (currentMarket && currentMarket !== '我的代號') {
          query = query.contains('group_name', [currentMarket]);
        }

        // 按照排序權重和新增時間排序
        query = query
          .order('sort_order', { ascending: true })
          .order('added_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;
        
        // 驗證資料完整性
        const validatedData = (data || []).map(stock => {
          // 確保所有必要欄位都有值
          return {
            ...stock,
            market: stock.market || 'TW',
            name: stock.name || '',
            group_name: stock.group_name || ['我的代號'],
            category: stock.category || ''
          };
        });
        
        console.log('[useStockData] 抓取到', validatedData.length, '筆股票資料');
        if (validatedData.length > 0) {
          console.log('[useStockData] 第一筆資料結構:', Object.keys(validatedData[0]));
        }
        
        setStocks(validatedData);
      } catch (error) {
        console.error('[useStockData] 抓取失敗:', error);
      } finally {
        setLoading(false);
      }
  }, []); // 移除依賴項，完全透過 marketRef 獲取最新狀態

  // 2. 設置實時監聽與初始載入
  useEffect(() => {
    // 監聽觀察清單變動 (Insert/Update/Delete)
    const watchlistChannel = supabase
      .channel('watchlist-realtime')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'watchlist' }, 
        () => fetchStocks(true) // 靜默刷新
      )
      .subscribe();

    // 監聽分組變動 (當分組改名觸發 SQL Trigger 時)
    const groupChannel = supabase
      .channel('groups-realtime')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'user_groups' }, 
        () => fetchStocks(true)
      )
      .subscribe();

    // 執行初始載入
    fetchStocks(false);

    return () => {
      supabase.removeChannel(watchlistChannel);
      supabase.removeChannel(groupChannel);
    };
  }, [fetchStocks]);

  // 3. 響應外部 selectedMarket 變更 (手動切換時)
  useEffect(() => {
    fetchStocks(false); // 切換分組時顯示 Loading 轉圈，提升互動回饋
  }, [selectedMarket, fetchStocks]);

  // 4. 更新本地排序 (由 Reorder.Group 呼叫)
  const updateSortOrder = useCallback((newStocks) => {
    setStocks(newStocks);
    // 此處可擴充：將新的排序序號寫回資料庫
  }, []);

  return { 
    stocks, 
    loading, 
    refresh: () => fetchStocks(true), // 提供給 page.jsx 手動觸發的靜默刷新
    updateSortOrder
  };
}