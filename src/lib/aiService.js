/**
 * AI 分析服務 - 資深量化策略師版 (V4)
 * 核心：強化資金控管、量價背離分析、精確加碼股數計算
 */

import { supabase } from './supabase';

const cleanVal = (val, isPercent = false) => {
  if (val === null || val === undefined || isNaN(val)) return null;
  const num = parseFloat(val);
  return isPercent ? `${num.toFixed(2)}%` : num.toFixed(2);
};

const getGeminiApiKey = async (userId) => {
  try {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    const MODEL_PRIORITY = [
      profile?.selected_model,
      'gemini-3.1-flash-lite-preview',
      
    ].filter(model => model && model !== 'gemini-1.5-flash');

    return {
      apiKey: profile?.custom_api_key?.trim() || process.env.NEXT_PUBLIC_GEMINI_API_KEY,
      models: MODEL_PRIORITY
    };
  } catch (error) { throw error; }
};

const buildAnalysisDataPackage = async (stock, userId) => {
  const { data: userProfile } = await supabase.from('profiles').select('username').eq('id', userId).single();
  
  const isCN = stock.symbol.includes('.SS') || stock.symbol.includes('.SZ');
  const targetMarket = isCN ? 'CN' : 'TW';
  const currency = isCN ? 'CNY' : 'TWD';
  const lotSize = isCN ? 100 : 1; // A股須為 100 股倍數

  const { data: accounts } = await supabase.from('accounts').select('balance').eq('user_id', userId).eq('market', targetMarket);
  const { data: target } = await supabase.from('stock_targets').select('monthly_income_target').eq('user_id', userId).eq('symbol', stock.symbol).single();

  return {
    user: { username: userProfile?.username || '書緯' },
    stock: {
      symbol: stock.symbol,
      name: stock.name,
      currency: currency,
      lotSize: lotSize,
      currentPrice: cleanVal(stock.current_price),
      averageCost: cleanVal(stock.average_cost),
      sharesQty: stock.current_shares || 0,
      rsi: cleanVal(stock.rsi_14),
      bias: cleanVal(stock.ma20_distance, true),
      yield: cleanVal(stock.dividend_yield, true),
      pe: cleanVal(stock.pe_ratio),
      pb: cleanVal(stock.pb_ratio),
      vol: stock.volume || 0,
      avgVol10d: stock.avg_volume_10d || 0,
      high52: cleanVal(stock.high_52w),
      low52: cleanVal(stock.low_52w)
    },
    finance: {
      balance: accounts?.reduce((sum, acc) => sum + (acc.balance || 0), 0) || 0,
      target: target?.monthly_income_target || 0
    }
  };
};

const callGeminiWithRetry = async (dataPackage, models, apiKey) => {
  const systemPrompt = `你是一位精通台股與 A 股的「首席量化策略師」。禁止聯網，請根據以下數據進行嚴謹的資金管理與技術面分析。

【標的量化快照】
- 標的：${dataPackage.stock.name} (${dataPackage.stock.symbol})
- 持倉：成本 ${dataPackage.stock.averageCost} / 持股 ${dataPackage.stock.sharesQty} 股
- 技術面：現價 ${dataPackage.stock.currentPrice}, RSI14(${dataPackage.stock.rsi}), 20日乖離率(${dataPackage.stock.bias}), 今日成交量(${dataPackage.stock.vol}), 10日均量(${dataPackage.stock.avgVol10d})
- 52週區間：${dataPackage.stock.low52} ~ ${dataPackage.stock.high52}
- 購買力：該市場可用餘額 ${dataPackage.finance.balance.toLocaleString()} ${dataPackage.stock.currency} (交易單位: ${dataPackage.stock.lotSize}股)

【任務指令：精確量化決策】
1. **量價動能評價**：
   - 分析今日成交量與 10 日均量關係。判斷處於「縮量築底」、「量增價揚」或「爆量背離」。
   - 基於 RSI 與 乖離率 定義位階（超買/合理/超賣）。

2. **效益最大化買入建議**：
   - **分批加碼點**：給出具體支撐位數字。
   - **加碼數量計算**：基於餘額 ${dataPackage.finance.balance}，精算在支撐位買入多少股（必須是 ${dataPackage.stock.lotSize} 的倍數），計算出新成本。
   - **攤平試算**：列出「(舊成本 * 舊股數 + 新買價 * X) / (總股數)」的試算結果。

3. **獲利與風控**：
   - 給出具體壓力位止盈價。若 20 日乖離率過高，請果斷提醒減碼。

【報告規範】
- 繁體中文條列式，總字數 350 字內。
- 拒絕「可能、建議關注」等廢話，請給出明確價格與股數指令。
- 稱呼用戶為「${dataPackage.user.username}」。

【綜合評分要求】
請在報告結尾提供一個 0-100 的綜合評分，格式為：
[AI_SCORE:XX]
其中 XX 是基於以下維度的加權評分：
1. 技術面健康度 (30%)：RSI、乖離率、量價關係
2. 基本面支撐度 (30%)：成本位置、52週區間位置
3. 資金管理合理性 (20%)：加碼點位計算、風險控制
4. 短期機會度 (20%)：當前價位與支撐/壓力位距離
請確保評分是整數，並在 [AI_SCORE:XX] 標籤後結束報告。`;

  for (const modelId of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
          generationConfig: { 
            temperature: 0.05, // 近乎零隨機性，確保計算精確
            maxOutputTokens: 800 
          } 
        })
      });
      const result = await response.json();
      if (response.ok) return result.candidates[0].content.parts[0].text;
      continue;
    } catch (e) { continue; }
  }
  throw new Error('分析服務暫時忙碌');
};

/**
 * 從 AI 報告中提取評分
 * @param {string} report - AI 生成的報告
 * @returns {number|null} 提取到的評分 (0-100)，未找到則返回 null
 */
const extractAiScore = (report) => {
  if (!report) return null;
  
  // 正則表達式匹配 [AI_SCORE:XX] 格式
  const scoreRegex = /\[AI_SCORE:(\d{1,3})\]/i;
  const match = report.match(scoreRegex);
  
  if (match && match[1]) {
    const score = parseInt(match[1], 10);
    // 確保分數在 0-100 範圍內
    if (score >= 0 && score <= 100) {
      return score;
    }
  }
  
  return null;
};

/**
 * 清理報告中的評分標籤
 * @param {string} report - 原始 AI 報告
 * @returns {string} 清理後的報告（移除 [AI_SCORE:XX] 標籤）
 */
const cleanReportFromScoreTag = (report) => {
  if (!report) return '';
  
  // 移除 [AI_SCORE:XX] 標籤及其前後的空白字符
  return report.replace(/\s*\[AI_SCORE:\d{1,3}\]\s*/i, '').trim();
};

export const performAiAnalysis = async (stock, userId, forceRefresh = false) => {
  try {
    const { apiKey, models } = await getGeminiApiKey(userId);
    const dataPackage = await buildAnalysisDataPackage(stock, userId);
    const rawReport = await callGeminiWithRetry(dataPackage, models, apiKey);

    // 提取 AI 評分
    const aiScore = extractAiScore(rawReport) || 50; // 預設值 50
    console.log(`AI 評分提取結果: ${aiScore} (原始報告長度: ${rawReport.length})`);
    
    // 清理報告中的評分標籤
    const cleanReport = cleanReportFromScoreTag(rawReport);
    
    const now = new Date().toISOString();
    await supabase.from('watchlist').update({
      ai_analysis_report: cleanReport,
      ai_score: aiScore,
      last_ai_generated_at: now
    }).eq('user_id', userId).eq('symbol', stock.symbol);

    return { success: true, report: cleanReport, aiScore, lastGenerated: now };
  } catch (error) {
    return { success: false, report: `分析失敗：${error.message}` };
  }
};

const aiService = { performAiAnalysis };
export default aiService;