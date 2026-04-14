/**
 * AI 分析服務 - 即時聯網股票分析核心大腦
 * 使用 Gemini 2.5 Flash 模型，支援 Search Grounding
 */

import { supabase } from './supabase';

/**
 * 獲取用戶的 Gemini API 金鑰
 * @param {string} userId - 用戶 ID
 * @returns {Promise<{apiKey: string, isDeveloperKey: boolean, dailyUsage: number}>}
 */
const getGeminiApiKey = async (userId) => {
  try {
    // 1. 從 profiles 表獲取用戶的自定義 API 金鑰和用量
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('custom_api_key, daily_ai_usage')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }

    const dailyUsage = profile?.daily_ai_usage || 0;
    const customApiKey = profile?.custom_api_key?.trim();

    // 2. 優先使用用戶的自定義 API 金鑰
    if (customApiKey && customApiKey.length > 0) {
      return {
        apiKey: customApiKey,
        isDeveloperKey: false,
        dailyUsage
      };
    }

    // 3. 使用開發者金鑰（環境變數）
    const developerApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!developerApiKey) {
      throw new Error('未配置 Gemini API 金鑰。請在環境變數中設置 NEXT_PUBLIC_GEMINI_API_KEY 或使用自定義 API 金鑰。');
    }

    // 4. 檢查試用限制（僅針對開發者金鑰）
    if (dailyUsage >= 10) {
      throw new Error('每日 AI 分析試用次數已達上限（10次）。請使用自定義 API 金鑰以解除限制。');
    }

    return {
      apiKey: developerApiKey,
      isDeveloperKey: true,
      dailyUsage
    };
  } catch (error) {
    console.error('Error in getGeminiApiKey:', error);
    throw error;
  }
};

/**
 * 獲取完整的股票分析數據包
 * @param {Object} stock - 股票基本數據（來自 watchlist）
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 完整的分析數據包
 */
const buildAnalysisDataPackage = async (stock, userId) => {
  try {
    // 1. 獲取用戶個人資料（包含username）
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.warn('無法獲取用戶個人資料:', profileError);
    }

    // 2. 獲取股票詳細數據（從 stock_metadata 或 stock_history）
    const { data: stockDetails, error: detailsError } = await supabase
      .from('stock_metadata')
      .select('*')
      .eq('symbol', stock.symbol)
      .single();

    if (detailsError) {
      console.warn('無法獲取股票詳細數據，使用基本數據:', detailsError);
    }

    // 3. 獲取用戶的財務數據
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('balance, currency, market')
      .eq('user_id', userId);

    if (accountsError) {
      console.warn('無法獲取用戶帳戶數據:', accountsError);
    }

    // 4. 獲取用戶的存股目標（如果存在）
    const { data: stockTarget, error: targetError } = await supabase
      .from('stock_targets')
      .select('monthly_income_target')
      .eq('user_id', userId)
      .eq('symbol', stock.symbol)
      .single();

    // 4. 構建數據包
    const dataPackage = {
      // 用戶個人資料
      user: {
        username: userProfile?.username || '用戶',
        userId: userId
      },

      // 股票基本信息
      stock: {
        symbol: stock.symbol,
        name: stock.name,
        market: stock.market,
        category: stock.category || '未分類',
        currentPrice: stock.current_price || 0,
        averageCost: stock.average_cost || 0,
        sharesQty: stock.shares_qty || 0,
        prevClose: stock.prev_close || 0,
        changeAmount: stock.change_amount || 0,
        changePercent: stock.change_percent || 0
      },

      // 基本面數據
      fundamentals: {
        eps: stockDetails?.eps || 0,
        roe: stockDetails?.roe || 0,
        pe: stockDetails?.pe_ratio || 0,
        pb: stockDetails?.pb_ratio || 0,
        dividendYield: stockDetails?.dividend_yield || 0,
        cashDividend: stockDetails?.cash_dividend || 0,
        netValuePerShare: stockDetails?.net_value_per_share || 0
      },

      // 技術面數據
      technicals: {
        currentPrice: stock.current_price || 0,
        rsi14: stockDetails?.rsi_14 || 0,
        bollingerUpper: stockDetails?.bollinger_upper || 0,
        bollingerMiddle: stockDetails?.bollinger_middle || 0,
        bollingerLower: stockDetails?.bollinger_lower || 0,
        ma20Deviation: stockDetails?.ma20_deviation || 0,
        high52w: stockDetails?.high_52w || 0,
        low52w: stockDetails?.low_52w || 0
      },

      // 個人財務數據
      personalFinance: {
        averageCost: stock.average_cost || 0,
        currentShares: stock.shares_qty || 0,
        totalInvestment: (stock.average_cost || 0) * (stock.shares_qty || 0),
        accounts: accounts || [],
        totalBalance: accounts?.reduce((sum, acc) => sum + (acc.balance || 0), 0) || 0,
        monthlyIncomeTarget: stockTarget?.monthly_income_target || 0
      },

      // 時間戳記
      timestamp: new Date().toISOString(),
      dataSources: ['profiles', 'watchlist', 'stock_metadata', 'accounts', 'stock_targets']
    };

    return dataPackage;
  } catch (error) {
    console.error('Error building analysis data package:', error);
    throw error;
  }
};

/**
 * 調用 Gemini API 進行聯網分析
 * @param {Object} dataPackage - 完整的分析數據包
 * @param {string} apiKey - Gemini API 金鑰
 * @param {boolean} forceRefresh - 是否強制重新聯網分析
 * @returns {Promise<string>} AI 分析報告（Markdown 格式）
 */
const callGeminiAnalysis = async (dataPackage, apiKey, forceRefresh = false) => {
  try {
    // 構建系統提示詞
    const systemPrompt = `你是專業的股票投資分析師，擁有豐富的市場經驗和財務分析能力。
請根據提供的完整財務數據和最新市場資訊，為用戶 ${dataPackage.user.username} 提供深度投資分析。

分析必須包含以下三個章節：
1. 【最新市場動態】- 基於即時網路搜尋的最新新聞、財報和市場趨勢
2. 【財務體質診斷】- 對該股票的財務指標進行全面評估
3. 【${dataPackage.user.username}專屬投資策略】- 根據用戶的持倉狀況和財務目標給出個性化建議

請特別注意：
- 結合技術面指標（RSI、布林通道、乖離率）判斷短期走勢
- 根據基本面數據（EPS、ROE、PE、PB）評估長期價值
- 考慮用戶的持倉成本、持股數和可用餘額給出具體的「買入/賣出/持有」建議
- 如果現價低於平均成本且基本面良好，計算建議加碼比例
- 所有建議必須有數據支持，避免空泛結論
- 在報告開頭使用個人化稱呼：「${dataPackage.user.username}，您好！」

請使用專業但易懂的中文撰寫報告，重要數據用 **粗體** 標示。`;

    // 構建用戶提示詞
    const userPrompt = `請分析以下股票數據：

【用戶資訊】
- 用戶名稱：${dataPackage.user.username}
- 用戶ID：${dataPackage.user.userId}

【股票基本資訊】
- 股票代號：${dataPackage.stock.symbol}
- 股票名稱：${dataPackage.stock.name}
- 所屬市場：${dataPackage.stock.market}
- 產業分類：${dataPackage.stock.category}

【當前價格】
- 現價：${dataPackage.stock.currentPrice}
- 昨收：${dataPackage.stock.prevClose}
- 漲跌：${dataPackage.stock.changeAmount} (${dataPackage.stock.changePercent}%)

【基本面指標】
- EPS：${dataPackage.fundamentals.eps}
- ROE：${dataPackage.fundamentals.roe}%
- 本益比(PE)：${dataPackage.fundamentals.pe}
- 股價淨值比(PB)：${dataPackage.fundamentals.pb}
- 殖利率：${dataPackage.fundamentals.dividendYield}%
- 現金股利：${dataPackage.fundamentals.cashDividend}
- 每股淨值：${dataPackage.fundamentals.netValuePerShare}

【技術面指標】
- RSI-14：${dataPackage.technicals.rsi14}
- 布林通道上軌：${dataPackage.technicals.bollingerUpper}
- 布林通道中軌：${dataPackage.technicals.bollingerMiddle}
- 布林通道下軌：${dataPackage.technicals.bollingerLower}
- MA20乖離率：${dataPackage.technicals.ma20Deviation}%
- 52週高點：${dataPackage.technicals.high52w}
- 52週低點：${dataPackage.technicals.low52w}

【用戶持倉狀況】
- 平均成本：${dataPackage.personalFinance.averageCost}
- 持股數：${dataPackage.personalFinance.currentShares}
- 總投資額：${dataPackage.personalFinance.totalInvestment}
- 可用總餘額：${dataPackage.personalFinance.totalBalance}
- 月存股目標：${dataPackage.personalFinance.monthlyIncomeTarget}

請結合最新市場資訊和以上數據，為 ${dataPackage.user.username} 提供完整的投資分析報告。`;

    // 構建請求體
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            { text: userPrompt }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ],
      // 開啟 Search Grounding 功能
      tools: [
        {
          googleSearchRetrieval: {}
        }
      ],
      toolConfig: {
        googleSearchRetrieval: {
          dynamicRetrievalConfig: {
            mode: "MODE_DYNAMIC",
            dynamicThreshold: 0.5
          }
        }
      }
    };

    // 調用 Gemini API - 使用 gemini-2.5-flash（支援 Search Grounding）
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API 請求失敗: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // 提取生成的文本
    if (!result.candidates || result.candidates.length === 0) {
      throw new Error('AI 未生成任何內容');
    }

    const generatedText = result.candidates[0].content.parts[0].text;
    return generatedText;

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    
    // 備用：如果 API 調用失敗，返回本地生成的建議
    return `【系統提示】AI 分析服務暫時不可用，以下是基於本地數據的建議：

【財務體質診斷】
- 當前價格：${dataPackage.stock.currentPrice}
- 平均成本：${dataPackage.personalFinance.averageCost}
- 持倉狀態：${dataPackage.stock.currentPrice > dataPackage.personalFinance.averageCost ? '浮盈' : '浮虧'}

【簡易策略】
${dataPackage.stock.currentPrice > dataPackage.personalFinance.averageCost ? 
  '考慮部分獲利了結，設定停利點在成本價的 110%。' : 
  '價格低於成本價，若基本面良好可考慮逢低加碼。'}

請稍後再試以獲取完整的聯網分析報告。`;
  }
};

/**
 * 更新數據庫中的 AI 分析結果
 * @param {string} userId - 用戶 ID
 * @param {string} symbol - 股票代號
 * @param {string} analysisReport - AI 分析報告
 * @param {boolean} isDeveloperKey - 是否使用開發者金鑰
 * @returns {Promise<Object>} 更新結果
 */
const updateAnalysisInDatabase = async (userId, symbol, analysisReport, isDeveloperKey) => {
  try {
    // 1. 計算 AI 評分（簡單基於報告長度和關鍵詞）
    const aiScore = calculateAiScore(analysisReport);

    // 2. 更新 watchlist 中的 AI 分析字段
    const { data: watchlistUpdate, error: watchlistError } = await supabase
      .from('watchlist')
      .update({
        ai_analysis_report: analysisReport,
        ai_score: aiScore,
        last_ai_generated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('symbol', symbol)
      .select()
      .single();

    if (watchlistError) {
      console.error('Error updating watchlist analysis:', watchlistError);
      throw watchlistError;
    }

    // 3. 如果使用開發者金鑰，更新用量計數
    if (isDeveloperKey) {
      try {
        // 先獲取當前的用量
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('daily_ai_usage')
          .eq('id', userId)
          .single();
        
        if (!fetchError && profile) {
          const currentUsage = profile.daily_ai_usage || 0;
          const { error: usageError } = await supabase
            .from('profiles')
            .update({
              daily_ai_usage: currentUsage + 1
            })
            .eq('id', userId);
          
          if (usageError) {
            console.error('Error updating AI usage:', usageError);
          }
        }
      } catch (usageError) {
        console.error('Error updating AI usage:', usageError);
        // 不拋出錯誤，因為分析報告已保存
      }
    }

    return {
      success: true,
      watchlistUpdate,
      aiScore
    };
  } catch (error) {
    console.error('Error updating analysis in database:', error);
    throw error;
  }
};

/**
 * 計算 AI 評分（0-100）
 * @param {string} report - AI 分析報告
 * @returns {number} 評分
 */
const calculateAiScore = (report) => {
  if (!report || report.length < 100) return 50;

  let score = 60;
  
  // 根據報告長度加分
  if (report.length > 500) score += 10;
  if (report.length > 1000) score += 15;
  if (report.length > 1500) score += 15;

  // 檢查是否包含關鍵章節
  const sections = ['最新市場動態', '財務體質診斷', '專屬投資策略'];
  sections.forEach(section => {
    if (report.includes(section)) score += 5;
  });

  // 檢查是否包含具體建議
  const recommendations = ['買入', '賣出', '持有', '加碼', '減碼'];
  recommendations.forEach(rec => {
    if (report.includes(rec)) score += 2;
  });

  // 限制在 0-100 之間
  return Math.min(Math.max(score, 0), 100);
};

/**
 * 主函數：執行完整的 AI 分析流程
 * @param {Object} stock - 股票數據
 * @param {string} userId - 用戶 ID
 * @param {boolean} forceRefresh - 是否強制重新分析（忽略快取）
 * @returns {Promise<Object>} 分析結果
 */
export const performAiAnalysis = async (stock, userId, forceRefresh = false) => {
  try {
    console.log(`開始 AI 分析流程: ${stock.symbol} for user ${userId}`);

    // 1. 檢查快取（如果不需要強制刷新）
    if (!forceRefresh && stock.last_ai_generated_at) {
      const lastGenerated = new Date(stock.last_ai_generated_at);
      const now = new Date();
      const hoursDiff = (now - lastGenerated) / (1000 * 60 * 60);

      // 如果快取在 24 小時內，直接返回快取結果
      if (hoursDiff < 24 && stock.ai_analysis_report) {
        console.log('使用快取的分析報告');
        return {
          success: true,
          report: stock.ai_analysis_report,
          aiScore: stock.ai_score || 75,
          fromCache: true,
          lastGenerated: stock.last_ai_generated_at
        };
      }
    }

    // 2. 獲取 API 金鑰並檢查限制
    const { apiKey, isDeveloperKey, dailyUsage } = await getGeminiApiKey(userId);
    console.log(`API 金鑰獲取成功，每日用量: ${dailyUsage}, 開發者金鑰: ${isDeveloperKey}`);

    // 3. 構建完整數據包
    const dataPackage = await buildAnalysisDataPackage(stock, userId);
    console.log('數據包構建完成');

    // 4. 調用 Gemini API
    console.log('調用 Gemini API...');
    const analysisReport = await callGeminiAnalysis(dataPackage, apiKey, forceRefresh);
    console.log('AI 分析完成，報告長度:', analysisReport.length);

    // 5. 更新數據庫
    const updateResult = await updateAnalysisInDatabase(userId, stock.symbol, analysisReport, isDeveloperKey);
    console.log('數據庫更新完成，AI 評分:', updateResult.aiScore);

    // 6. 返回結果
    return {
      success: true,
      report: analysisReport,
      aiScore: updateResult.aiScore,
      fromCache: false,
      lastGenerated: new Date().toISOString(),
      dailyUsage: isDeveloperKey ? dailyUsage + 1 : dailyUsage
    };

  } catch (error) {
    console.error('AI 分析流程失敗:', error);
    
    // 返回錯誤信息，但保持格式一致
    return {
      success: false,
      report: `【分析失敗】\n\n抱歉，AI 分析服務暫時遇到問題：\n\n${error.message}\n\n請檢查網路連接或稍後再試。`,
      aiScore: 0,
      fromCache: false,
      error: error.message
    };
  }
};

/**
 * 檢查用戶的 AI 分析配額
 * @param {string} userId - 用戶 ID
 * @returns {Promise<{hasQuota: boolean, dailyUsage: number, maxUsage: number, customApiKey: boolean}>}
 */
export const checkAiQuota = async (userId) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('custom_api_key, daily_ai_usage')
      .eq('id', userId)
      .single();

    if (error) throw error;

    const hasCustomApiKey = !!profile.custom_api_key?.trim();
    const dailyUsage = profile.daily_ai_usage || 0;
    const maxUsage = hasCustomApiKey ? Infinity : 10;

    return {
      hasQuota: hasCustomApiKey || dailyUsage < maxUsage,
      dailyUsage,
      maxUsage,
      customApiKey: hasCustomApiKey,
      remaining: hasCustomApiKey ? '無限制' : maxUsage - dailyUsage
    };
  } catch (error) {
    console.error('Error checking AI quota:', error);
    throw error;
  }
};

const aiService = {
  performAiAnalysis,
  checkAiQuota,
  getGeminiApiKey,
  buildAnalysisDataPackage
};

export default aiService;