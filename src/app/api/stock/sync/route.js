import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 環境變數
const CRON_SECRET = process.env.CRON_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FINMIND_API_TOKEN = process.env.FINMIND_API_TOKEN;

// 創建 Supabase 客戶端（使用服務角色以繞過 RLS）
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'public' }
});

// 清理數值，處理 NaN 和無限值
function cleanVal(val, defaultValue = 0) {
  if (val === null || val === undefined || val === '') {
    return defaultValue;
  }
  
  const num = typeof val === 'string' ? parseFloat(val) : Number(val);
  
  if (isNaN(num) || !isFinite(num)) {
    return defaultValue;
  }
  
  return num;
}

// 處理股息收益率（邏輯與 Python 版本一致）
function processDividendYield(rawYield) {
  const cleaned = cleanVal(rawYield);
  if (cleaned === 0) return 0;
  
  // 若原始數據 < 1 則 * 100，否則保持原樣
  return cleaned < 1 ? cleaned * 100 : cleaned;
}

/**
 * 從 FinMind API 獲取台股即時行情
 */
async function fetchFinMindQuote(symbol) {
  try {
    // 移除 .TW 後綴以獲取基礎代號
    const baseSymbol = symbol.replace('.TW', '');
    
    const url = new URL('https://api.finmindtrade.com/api/v4/data');
    url.searchParams.append('dataset', 'TaiwanStockPrice');
    url.searchParams.append('data_id', baseSymbol);
    url.searchParams.append('start_date', new Date().toISOString().split('T')[0]);
    url.searchParams.append('end_date', new Date().toISOString().split('T')[0]);
    if (FINMIND_API_TOKEN) {
      url.searchParams.append('token', FINMIND_API_TOKEN);
    }
    
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`FinMind API 請求失敗: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      throw new Error('未找到股票數據');
    }
    
    // 獲取最新一筆數據
    const latestData = data.data[data.data.length - 1];
    
    return {
      current_price: parseFloat(latestData.close) || 0,
      prev_close: parseFloat(latestData.previous_close) || 0,
      open_price: parseFloat(latestData.open) || 0,
      day_high: parseFloat(latestData.max) || 0,
      day_low: parseFloat(latestData.min) || 0,
      volume: parseInt(latestData.Trading_volume) || 0, // 單位: 股數
      source: 'finmind',
      success: true
    };
  } catch (error) {
    console.error(`FinMind API 抓取失敗 (${symbol}):`, error.message);
    return {
      current_price: 0,
      prev_close: 0,
      open_price: 0,
      day_high: 0,
      day_low: 0,
      volume: 0,
      source: 'finmind',
      success: false,
      error: error.message
    };
  }
}

/**
 * 從 Yahoo Finance API 獲取即時行情
 */
async function fetchYahooFinanceQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance API 請求失敗: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error('未找到股票數據');
    }
    
    const chartResult = data.chart.result[0];
    const meta = chartResult.meta || {};
    const quote = chartResult.indicators?.quote?.[0] || {};
    
    const currentPrice = meta.regularMarketPrice || meta.previousClose || 0;
    const prevClose = meta.previousClose || currentPrice || 0;
    const openPrice = quote.open?.[quote.open.length - 1] || 0;
    const dayHigh = quote.high?.[quote.high.length - 1] || 0;
    const dayLow = quote.low?.[quote.low.length - 1] || 0;
    const volume = quote.volume?.[quote.volume.length - 1] || 0;
    
    // 從 meta 獲取基本面數據（如果可用）
    const marketCap = meta.marketCap;
    const trailingPE = meta.trailingPE;
    const trailingEps = meta.trailingEps;
    const dividendRate = meta.dividendRate;
    const dividendYield = meta.dividendYield;
    const bookValue = meta.bookValue;
    const priceToBook = meta.priceToBook;
    const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh;
    const fiftyTwoWeekLow = meta.fiftyTwoWeekLow;
    
    return {
      current_price: currentPrice,
      prev_close: prevClose,
      open_price: openPrice,
      day_high: dayHigh,
      day_low: dayLow,
      volume: volume, // 單位: 股數
      market_cap: marketCap,
      trailing_pe: trailingPE,
      trailing_eps: trailingEps,
      dividend_rate: dividendRate,
      dividend_yield: dividendYield,
      book_value: bookValue,
      price_to_book: priceToBook,
      fifty_two_week_high: fiftyTwoWeekHigh,
      fifty_two_week_low: fiftyTwoWeekLow,
      source: 'yahoo',
      success: true
    };
  } catch (error) {
    console.error(`Yahoo Finance API 抓取失敗 (${symbol}):`, error.message);
    return {
      current_price: 0,
      prev_close: 0,
      open_price: 0,
      day_high: 0,
      day_low: 0,
      volume: 0,
      source: 'yahoo',
      success: false,
      error: error.message
    };
  }
}

/**
 * 從 Yahoo Finance 獲取基本面數據 (quoteSummary)
 */
async function fetchYahooFinanceFundamentals(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=financialData,summaryDetail,defaultKeyStatistics`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance 基本面 API 請求失敗: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.quoteSummary || !data.quoteSummary.result || data.quoteSummary.result.length === 0) {
      throw new Error('未找到基本面數據');
    }
    
    const result = data.quoteSummary.result[0];
    
    return {
      financialData: result.financialData || {},
      summaryDetail: result.summaryDetail || {},
      defaultKeyStatistics: result.defaultKeyStatistics || {},
      success: true
    };
  } catch (error) {
    console.error(`Yahoo Finance 基本面 API 抓取失敗 (${symbol}):`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 根據市場選擇數據源並抓取數據
 */
async function fetchStockData(symbol, market, needFundamentalUpdate = false) {
  let quoteData;
  
  // 根據市場選擇數據源
  if (market === 'TW') {
    // 台股: 優先使用 FinMind API
    quoteData = await fetchFinMindQuote(symbol);
    
    // 如果 FinMind 失敗，回退到 Yahoo Finance
    if (!quoteData.success) {
      console.log(`FinMind 失敗，回退到 Yahoo Finance: ${symbol}`);
      quoteData = await fetchYahooFinanceQuote(symbol);
    }
  } else if (market === 'CN') {
    // 陸股: 目前使用 Yahoo Finance (未來可整合 AkShare API)
    // TODO: 整合 AkShare API 獲取陸股數據
    quoteData = await fetchYahooFinanceQuote(symbol);
  } else {
    // 其他市場 (US, HK): 使用 Yahoo Finance
    quoteData = await fetchYahooFinanceQuote(symbol);
  }
  
  // 如果需要基本面數據且 Yahoo Finance 未提供，則單獨獲取
  let fundamentalData = null;
  if (needFundamentalUpdate && quoteData.source === 'yahoo') {
    // Yahoo Finance quote 可能已經包含了一些基本面數據
    // 如果缺少關鍵數據，則調用基本面 API
    if (!quoteData.trailing_eps || !quoteData.trailing_pe) {
      fundamentalData = await fetchYahooFinanceFundamentals(symbol);
    }
  } else if (needFundamentalUpdate && quoteData.source === 'finmind') {
    // FinMind 不提供基本面數據，使用 Yahoo Finance 基本面 API
    fundamentalData = await fetchYahooFinanceFundamentals(symbol);
  }
  
  return { quoteData, fundamentalData };
}

/**
 * 更新單一股票的數據
 */
async function updateStock(symbol, market, watchlistItem) {
  try {
    console.log(`開始處理股票: ${symbol} (市場: ${market})`);
    
    // 檢查是否需要更新基本面數據
    let needFundamentalUpdate = true;
    if (watchlistItem) {
      const epsMissing = !watchlistItem.eps || watchlistItem.eps === 0;
      
      let updatedTooOld = false;
      if (watchlistItem.updated_at) {
        const updatedAt = new Date(watchlistItem.updated_at);
        const now = new Date();
        const hoursDiff = (now.getTime() - updatedAt.getTime()) / (1000 * 3600);
        updatedTooOld = hoursDiff >= 24;
      }
      
      needFundamentalUpdate = epsMissing || updatedTooOld;
      
      if (!needFundamentalUpdate) {
        console.log(`📊 ${symbol} 基本面數據仍在 24 小時快取期內且數據完整，僅更新行情數據`);
      } else {
        if (epsMissing) {
          console.log(`📈 ${symbol} 基本面數據缺失，觸發完整更新`);
        } else {
          console.log(`📈 ${symbol} 基本面數據已超過 24 小時，觸發完整更新`);
        }
      }
    } else {
      console.log(`⚠️ ${symbol} 未在 watchlist 中找到對應項目，進行完整更新`);
    }
    
    // 抓取數據
    const { quoteData, fundamentalData } = await fetchStockData(symbol, market, needFundamentalUpdate);
    
    if (!quoteData.success) {
      console.error(`無法獲取 ${symbol} 的行情數據: ${quoteData.error}`);
      return { symbol, success: false, error: quoteData.error };
    }
    
    // 構建更新負載
    const now = new Date().toISOString();
    const payload = {
      current_price: cleanVal(quoteData.current_price),
      prev_close: cleanVal(quoteData.prev_close),
      open_price: cleanVal(quoteData.open_price),
      day_high: cleanVal(quoteData.day_high),
      day_low: cleanVal(quoteData.day_low),
      volume: Math.round(cleanVal(quoteData.volume, 0)),
      updated_at: now
    };
    
    // 計算漲跌
    payload.change_amount = payload.current_price - payload.prev_close;
    payload.change_percent = payload.prev_close !== 0 ? (payload.change_amount / payload.prev_close) * 100 : 0;
    
    // 如果需要更新基本面數據且抓取成功
    if (needFundamentalUpdate) {
      // 從 quoteData 中提取基本面數據（如果可用）
      if (quoteData.market_cap !== undefined) {
        payload.market_cap = cleanVal(quoteData.market_cap);
      }
      if (quoteData.trailing_eps !== undefined) {
        payload.eps = cleanVal(quoteData.trailing_eps);
      }
      if (quoteData.dividend_rate !== undefined) {
        payload.cash_dividend = cleanVal(quoteData.dividend_rate);
      }
      if (quoteData.book_value !== undefined) {
        payload.net_value_per_share = cleanVal(quoteData.book_value);
      }
      if (quoteData.fifty_two_week_high !== undefined) {
        payload.high_52w = cleanVal(quoteData.fifty_two_week_high);
      }
      if (quoteData.fifty_two_week_low !== undefined) {
        payload.low_52w = cleanVal(quoteData.fifty_two_week_low);
      }
      if (quoteData.price_to_book !== undefined) {
        payload.pb_ratio = cleanVal(quoteData.price_to_book);
      }
      if (quoteData.trailing_pe !== undefined) {
        payload.pe_ratio = cleanVal(quoteData.trailing_pe);
      }
      if (quoteData.dividend_yield !== undefined) {
        payload.dividend_yield = processDividendYield(quoteData.dividend_yield);
      }
      
      // 從基本面 API 中提取額外數據（如果可用）
      if (fundamentalData && fundamentalData.success) {
        const { financialData, summaryDetail, defaultKeyStatistics } = fundamentalData;
        
        // ROE
        if (financialData.returnOnEquity?.raw !== undefined) {
          payload.roe = cleanVal(financialData.returnOnEquity.raw) * 100; // 轉換為百分比
        }
        
        // 如果 quoteData 中缺少某些數據，則使用基本面 API 的數據
        if (!payload.market_cap && summaryDetail.marketCap?.raw !== undefined) {
          payload.market_cap = cleanVal(summaryDetail.marketCap.raw);
        }
        if (!payload.eps && defaultKeyStatistics.trailingEps?.raw !== undefined) {
          payload.eps = cleanVal(defaultKeyStatistics.trailingEps.raw);
        }
        if (!payload.cash_dividend && summaryDetail.dividendRate?.raw !== undefined) {
          payload.cash_dividend = cleanVal(summaryDetail.dividendRate.raw);
        }
        if (!payload.net_value_per_share && summaryDetail.bookValue?.raw !== undefined) {
          payload.net_value_per_share = cleanVal(summaryDetail.bookValue.raw);
        }
        if (!payload.high_52w && summaryDetail.fiftyTwoWeekHigh?.raw !== undefined) {
          payload.high_52w = cleanVal(summaryDetail.fiftyTwoWeekHigh.raw);
        }
        if (!payload.low_52w && summaryDetail.fiftyTwoWeekLow?.raw !== undefined) {
          payload.low_52w = cleanVal(summaryDetail.fiftyTwoWeekLow.raw);
        }
        if (!payload.pb_ratio && summaryDetail.priceToBook?.raw !== undefined) {
          payload.pb_ratio = cleanVal(summaryDetail.priceToBook.raw);
        }
        if (!payload.pe_ratio && summaryDetail.trailingPE?.raw !== undefined) {
          payload.pe_ratio = cleanVal(summaryDetail.trailingPE.raw);
        }
        if (!payload.dividend_yield && summaryDetail.dividendYield?.raw !== undefined) {
          payload.dividend_yield = processDividendYield(summaryDetail.dividendYield.raw);
        }
      }
      
      console.log(`📈 ${symbol} 更新完整數據（行情 + 基本面）`);
    } else {
      console.log(`📊 ${symbol} 僅更新行情數據`);
    }
    
    // 更新 watchlist 表格
    const { error: watchlistError } = await supabase
      .from('watchlist')
      .update(payload)
      .eq('symbol', symbol);
    
    if (watchlistError) {
      throw new Error(`更新 watchlist 失敗: ${watchlistError.message}`);
    }
    
    // 更新 stock_history 表格（歷史記錄）
    const historyPayload = {
      symbol: symbol,
      trade_date: new Date().toISOString().split('T')[0],
      close_price: payload.current_price,
      open_price: payload.open_price,
      high_price: payload.day_high,
      low_price: payload.day_low,
      volume: payload.volume,
      change_percent: payload.change_percent
    };
    
    const { error: historyError } = await supabase
      .from('stock_history')
      .upsert(historyPayload, { onConflict: 'symbol, trade_date' });
    
    if (historyError) {
      console.error(`stock_history 更新錯誤: ${historyError.message}`);
    }
    
    console.log(`✅ ${symbol} 同步完成`);
    return { symbol, success: true };
    
  } catch (error) {
    console.error(`❌ ${symbol} 同步失敗:`, error.message);
    return { symbol, success: false, error: error.message };
  }
}

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // 驗證 Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '未經授權: 缺少或無效的 Authorization header' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7); // 移除 'Bearer ' 前綴
    if (token !== CRON_SECRET) {
      return NextResponse.json(
        { error: '未經授權: 無效的 token' },
        { status: 401 }
      );
    }
    
    // 獲取所有 watchlist 項目（按用戶和股票分組）
    console.log('開始獲取 watchlist 項目...');
    const { data: watchlistItems, error: watchlistError } = await supabase
      .from('watchlist')
      .select('*');
    
    if (watchlistError) {
      throw new Error(`無法獲取 watchlist: ${watchlistError.message}`);
    }
    
    if (!watchlistItems || watchlistItems.length === 0) {
      console.log('⚠️ Watchlist 為空，無需同步');
      return NextResponse.json({
        success: true,
        message: 'Watchlist 為空，無需同步',
        updated_count: 0
      });
    }
    
    console.log(`📦 正在同步 ${watchlistItems.length} 支股票...`);
    
    // 按 symbol 分組，避免重複處理同一股票
    const symbolMap = new Map();
    watchlistItems.forEach(item => {
      if (!symbolMap.has(item.symbol)) {
        symbolMap.set(item.symbol, {
          symbol: item.symbol,
          market: item.market,
          watchlistItem: item // 保留一個項目作為參考
        });
      }
    });
    
    const uniqueSymbols = Array.from(symbolMap.values());
    
    // 限制並發請求數量，避免過度請求 API
    const BATCH_SIZE = 5;
    const results = [];
    
    for (let i = 0; i < uniqueSymbols.length; i += BATCH_SIZE) {
      const batch = uniqueSymbols.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(item => 
        updateStock(item.symbol, item.market, item.watchlistItem)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({ symbol: 'unknown', success: false, error: result.reason.message });
        }
      });
      
      // 批次之間添加延遲，避免觸發 API 速率限制
      if (i + BATCH_SIZE < uniqueSymbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✨ 同步完成。成功: ${successful}, 失敗: ${failed}`);
    
    return NextResponse.json({
      success: true,
      message: `股票同步完成。成功: ${successful}, 失敗: ${failed}`,
      updated_count: successful,
      failed_count: failed,
      results: results
    });
    
  } catch (error) {
    console.error('同步處理失敗:', error);
    return NextResponse.json(
      { 
        error: '伺服器內部錯誤',
        message: error.message,
        success: false 
      },
      { status: 500 }
    );
  }
}