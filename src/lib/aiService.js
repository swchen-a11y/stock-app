/**
 * AI 分析服務 - 即時聯網股票分析核心大腦
 * 整合全量財務數據、聯網搜尋 (Search Grounding) 與個人化建議
 */

import { supabase } from './supabase';

/**
 * 獲取用戶的 Gemini API 金鑰和選擇的模型
 */
const getGeminiApiKey = async (userId) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('custom_api_key, daily_ai_usage, selected_model')
      .eq('id', userId)
      .single();

    if (error) throw error;

    const dailyUsage = profile?.daily_ai_usage || 0;
    const customApiKey = profile?.custom_api_key?.trim();
    
    // 修正：確保模型名稱符合官方規範 (1.5 為目前主流聯網支援版本)
    let selectedModel = profile?.selected_model || 'gemini-1.5-flash';
    if (selectedModel.includes('2.5')) selectedModel = 'gemini-1.5-flash'; 

    if (customApiKey && customApiKey.length > 0) {
      return {
        apiKey: customApiKey,
        isDeveloperKey: false,
        dailyUsage,
        selectedModel
      };
    }

    const developerApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!developerApiKey) {
      throw new Error('未配置 API 金鑰。請在設定中填寫您的 Gemini API Key。');
    }

    if (dailyUsage >= 10) {
      throw new Error('每日試用次數已達上限（10次）。請使用自定義 API 金鑰以解除限制。');
    }

    return {
      apiKey: developerApiKey,
      isDeveloperKey: true,
      dailyUsage,
      selectedModel
    };
  } catch (error) {
    console.error('Error in getGeminiApiKey:', error);
    throw error;
  }
};

/**
 * 數據清洗輔助函數
 */
const cleanVal = (val, isPercent = false) => {
  if (val === null || val === undefined || isNaN(val)) return 0;
  return isPercent ? `${parseFloat(val).toFixed(2)}%` : parseFloat(val).toFixed(2);
};

/**
 * 獲取完整的股票分析數據包
 */
const buildAnalysisDataPackage = async (stock, userId) => {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();

    const { data: stockDetails } = await supabase
      .from('stock_metadata')
      .select('*')
      .eq('symbol', stock.symbol)
      .single();

    const { data: accounts } = await supabase
      .from('accounts')
      .select('balance, currency, market')
      .eq('user_id', userId);

    const { data: stockTarget } = await supabase
      .from('stock_targets')
      .select('monthly_income_target')
      .eq('user_id', userId)
      .eq('symbol', stock.symbol)
      .single();

    return {
      user: {
        username: userProfile?.username || '書緯',
        userId: userId
      },
      stock: {
        symbol: stock.symbol,
        name: stock.name,
        market: stock.market,
        category: stock.category || '未分類',
        currentPrice: cleanVal(stock.current_price),
        averageCost: cleanVal(stock.average_cost),
        sharesQty: stock.current_shares || 0,
        prevClose: cleanVal(stock.prev_close),
        changePercent: cleanVal(stock.change_percent, true)
      },
      fundamentals: {
        eps: cleanVal(stockDetails?.eps),
        roe: cleanVal(stockDetails?.roe, true),
        pe: cleanVal(stockDetails?.pe_ratio),
        pb: cleanVal(stockDetails?.pb_ratio),
        dividendYield: cleanVal(stockDetails?.dividend_yield, true),
        netValue: cleanVal(stockDetails?.net_value_per_share)
      },
      technicals: {
        rsi14: cleanVal(stockDetails?.rsi_14),
        ma20Deviation: cleanVal(stockDetails?.ma20_distance, true),
        volume: stock.volume || 0,
        avgVolume10d: stock.avg_volume_10d || 0
      },
      personalFinance: {
        totalBalance: accounts?.reduce((sum, acc) => sum + (acc.balance || 0), 0) || 0,
        targetIncome: stockTarget?.monthly_income_target || 0
      }
    };
  } catch (error) {
    console.error('數據包構建失敗:', error);
    throw error;
  }
};

/**
 * 調用 Gemini API 進行聯網分析
 */
const callGeminiAnalysis = async (dataPackage, modelId, apiKey) => {
  const systemPrompt = `你是一位資深量化投資 Agent。請針對用戶 ${dataPackage.user.username} 進行深度分析。
需結合最新市場新聞(Search Grounding)與提供的財務數據。

報告架構：
1. 【最新市場動態】：基於即時搜尋的財報亮點或新聞。
2. 【財務體質診斷】：分析 EPS(${dataPackage.fundamentals.eps})、ROE(${dataPackage.fundamentals.roe}) 與量價關係。
3. 【${dataPackage.user.username} 專屬策略】：基於成本(${dataPackage.stock.averageCost})與餘額(${dataPackage.personalFinance.totalBalance})給出買入/賣出/持有建議。

請在開頭親切稱呼：「${dataPackage.user.username}，您好！」並使用 Markdown 格式。`;

  const requestBody = {
    contents: [{
      role: "user",
      parts: [{ text: systemPrompt }]
    }],
    tools: [{ googleSearchRetrieval: {} }], // 🌟 開啟聯網搜尋
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2500
    },
    safetySettings: [
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } // 避免阻斷投資建議
    ]
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'API 請求失敗');
  }

  const result = await response.json();
  return result.candidates[0].content.parts[0].text;
};

/**
 * 主函數：執行分析流程
 */
export const performAiAnalysis = async (stock, userId, forceRefresh = false) => {
  try {
    // 1. 快取檢查 (24小時內)
    if (!forceRefresh && stock.last_ai_generated_at) {
      const hoursDiff = (new Date() - new Date(stock.last_ai_generated_at)) / (1000 * 60 * 60);
      if (hoursDiff < 24 && stock.ai_analysis_report) {
        return {
          success: true,
          report: stock.ai_analysis_report,
          aiScore: stock.ai_score || 70,
          fromCache: true,
          lastGenerated: stock.last_ai_generated_at
        };
      }
    }

    // 2. 準備環境
    const { apiKey, isDeveloperKey, dailyUsage, selectedModel } = await getGeminiApiKey(userId);
    const dataPackage = await buildAnalysisDataPackage(stock, userId);

    // 3. 獲取報告
    const report = await callGeminiAnalysis(dataPackage, selectedModel, apiKey);

    // 4. 持久化到資料庫
    const aiScore = report.length > 1000 ? 85 : 70;
    await supabase.from('watchlist').update({
      ai_analysis_report: report,
      ai_score: aiScore,
      last_ai_generated_at: new Date().toISOString()
    }).eq('user_id', userId).eq('symbol', stock.symbol);

    if (isDeveloperKey) {
      await supabase.from('profiles').update({ daily_ai_usage: dailyUsage + 1 }).eq('id', userId);
    }

    return {
      success: true,
      report,
      aiScore,
      fromCache: false,
      lastGenerated: new Date().toISOString()
    };
  } catch (error) {
    console.error('AI 分析流程錯誤:', error);
    throw error;
  }
};

export default { performAiAnalysis };