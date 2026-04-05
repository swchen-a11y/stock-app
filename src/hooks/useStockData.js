import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const MARKET_MAP = { '陸股': 'CN', '台股': 'TW', '美股': 'US' };

const useStockData = (selectedMarket) => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // 新增觸發器以強制重新渲染
  const [userLists, setUserLists] = useState(() => {
    const saved = localStorage.getItem('user_custom_lists');
    return saved ? JSON.parse(saved) : [
      { id: 'default', name: '我的代號', isFixed: true },
      { id: 'tw', name: '台股' },
      { id: 'cn', name: '陸股' }
    ];
  });

  // 保存用戶列表到 localStorage
  useEffect(() => {
    localStorage.setItem('user_custom_lists', JSON.stringify(userLists));
  }, [userLists]);

  // 獲取股票所屬列表的輔助函式
  const getStockBelongsTo = useCallback((symbol) => {
    const categories = JSON.parse(localStorage.getItem('stock_categories') || '{}');
    return categories[symbol] || ['我的代號'];
  }, [refreshTrigger]); // 監聽觸發器

  // 獲取排序狀態的輔助函式
  const getSortedSymbols = useCallback((marketName) => {
    const sorted = JSON.parse(localStorage.getItem(`sort_order_${marketName}`) || '[]');
    return sorted;
  }, []);

  const fetchStocks = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('watchlist')
        .select('*')
        .order('added_at', { ascending: false });

      if (error) throw error;

      let filteredData = data || [];
      
      // 根據選定分類過濾
      filteredData = filteredData.filter(stock => {
        const belongsTo = getStockBelongsTo(stock.symbol);
        return belongsTo.includes(selectedMarket);
      });

      // 應用拖拽排序持久化
      const sortOrder = getSortedSymbols(selectedMarket);
      if (sortOrder.length > 0) {
        filteredData.sort((a, b) => {
          const indexA = sortOrder.indexOf(a.symbol);
          const indexB = sortOrder.indexOf(b.symbol);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      }

      setStocks(filteredData);
    } catch (error) {
      console.error('Error fetching stocks:', error.message);
      // 如果是網絡錯誤或連接關閉，可以考慮在 UI 顯示重試按鈕或自動重試
      if (error.message === 'Failed to fetch' || error.message.includes('CONNECTION_CLOSED')) {
        // 這裡可以根據需要設置一個特定的錯誤狀態
      }
    } finally {
      setLoading(false);
    }
  }, [selectedMarket, getStockBelongsTo, getSortedSymbols]);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  // 更新排序並保存到 localStorage
  const updateSortOrder = (newStocks) => {
    setStocks(newStocks);
    const symbolOrder = newStocks.map(s => s.symbol);
    localStorage.setItem(`sort_order_${selectedMarket}`, JSON.stringify(symbolOrder));
  };

  const toggleStockInList = async (symbol, listName) => {
    const categories = JSON.parse(localStorage.getItem('stock_categories') || '{}');
    let currentLists = categories[symbol] || [];

    if (currentLists.includes(listName)) {
      currentLists = currentLists.filter(name => name !== listName);
    } else {
      currentLists = [...currentLists, listName];
    }
    
    if (currentLists.length === 0) currentLists = ['我的代號'];

    categories[symbol] = currentLists;
    localStorage.setItem('stock_categories', JSON.stringify(categories));
    setRefreshTrigger(prev => prev + 1); // 觸發重新渲染
    return currentLists;
  };

  const deleteList = (listId) => {
    const listToDelete = userLists.find(l => l.id === listId);
    if (!listToDelete || listToDelete.isFixed) return;

    // 1. 刪除列表本身
    const newList = userLists.filter(l => l.id !== listId);
    setUserLists(newList);

    // 2. 清理該列表下的股票映射
    const categories = JSON.parse(localStorage.getItem('stock_categories') || '{}');
    Object.keys(categories).forEach(symbol => {
      categories[symbol] = categories[symbol].filter(name => name !== listToDelete.name);
      if (categories[symbol].length === 0) categories[symbol] = ['我的代號'];
    });
    localStorage.setItem('stock_categories', JSON.stringify(categories));
    
    // 3. 如果當前選中的是已刪除的列表，切換回預設
    if (selectedMarket === listToDelete.name) {
      return true; // 通知外部需要切換市場
    }
    return false;
  };

  const renameList = (listId, newName) => {
    const listToRename = userLists.find(l => l.id === listId);
    if (!listToRename || listToRename.isFixed) return;

    const oldName = listToRename.name;
    const updatedLists = userLists.map(l => l.id === listId ? { ...l, name: newName } : l);
    setUserLists(updatedLists);

    // 同步更新股票映射中的名稱
    const categories = JSON.parse(localStorage.getItem('stock_categories') || '{}');
    Object.keys(categories).forEach(symbol => {
      categories[symbol] = categories[symbol].map(name => name === oldName ? newName : name);
    });
    localStorage.setItem('stock_categories', JSON.stringify(categories));
    
    return oldName;
  };

  const addList = (name) => {
    if (!name.trim()) return;
    const newList = { id: Date.now().toString(), name };
    setUserLists(prev => [...prev, newList]);
    return newList;
  };

  return {
    stocks,
    loading,
    userLists,
    setUserLists,
    fetchStocks,
    updateSortOrder,
    toggleStockInList,
    getStockBelongsTo,
    deleteList,
    renameList,
    addList
  };
};

export default useStockData;
