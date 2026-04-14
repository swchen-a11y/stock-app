import { NextResponse } from 'next/server';

// 環境變數
const FINMIND_API_TOKEN = process.env.FINMIND_API_TOKEN;

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
      volume: parseInt(latestData.Trading_volume) || 0, // 單位: 股數
      source: 'finmind',
      success: true
    };
  } catch (error) {
    console.error(`FinMind API 抓取失敗 (${symbol}):`, error.message);
    return {
      current_price: 0,
      prev_close: 0,
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
    const volume = quote.volume?.[quote.volume.length - 1] || 0;
    
    return {
      current_price: currentPrice,
      prev_close: prevClose,
      volume: volume, // 單位: 股數
      source: 'yahoo',
      success: true
    };
  } catch (error) {
    console.error(`Yahoo Finance API 抓取失敗 (${symbol}):`, error.message);
    return {
      current_price: 0,
      prev_close: 0,
      volume: 0,
      source: 'yahoo',
      success: false,
      error: error.message
    };
  }
}

/**
 * 根據市場規範轉換成交量單位
 */
function normalizeVolume(market, volume) {
  // volume 預設為股數
  let normalizedVolume = volume;
  let unit = '股';
  
  switch (market) {
    case 'TW':
      // 台股: 轉換為張數 (1張 = 1000股)
      normalizedVolume = volume / 1000;
      unit = '張';
      break;
    case 'CN':
      // 陸股: 轉換為手數 (1手 = 100股)
      normalizedVolume = volume / 100;
      unit = '手';
      break;
    case 'HK':
      // 港股: 保持股數
      unit = '股';
      break;
    case 'US':
      // 美股: 保持股數
      unit = '股';
      break;
    default:
      unit = '股';
  }
  
  return {
    volume: Math.round(normalizedVolume * 100) / 100, // 保留兩位小數
    original_volume: volume,
    unit
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const market = searchParams.get('market') || 'TW';
    
    if (!symbol) {
      return NextResponse.json(
        { error: '缺少必要參數: symbol' },
        { status: 400 }
      );
    }
    
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
    
    // 轉換成交量單位
    const volumeData = normalizeVolume(market, quoteData.volume);
    
    const responseData = {
      symbol,
      market,
      current_price: quoteData.current_price,
      prev_close: quoteData.prev_close,
      volume: volumeData.volume,
      volume_unit: volumeData.unit,
      original_volume: volumeData.original_volume,
      source: quoteData.source,
      success: quoteData.success,
      fetched_at: new Date().toISOString()
    };
    
    if (!quoteData.success) {
      responseData.error = quoteData.error;
    }
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('API 路由錯誤:', error);
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