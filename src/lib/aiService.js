/**
 * AI 分析服務 - 數據源校正版
 * 修正：完全從 watchlist 表格抓取技術面與財務面數據
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
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite'
    ].filter(model => model && model !== 'gemini-1.5-flash');

    return {
      apiKey: profile?.custom_api_key?.trim() || process.env.NEXT_PUBLIC_GEMINI_API_KEY,
      models: MODEL_PRIORITY
    };
  } catch (error) { throw error; }
};

/**
 * 🌟 核心修正：統一從 watchlist 抓取數據
 */
const buildAnalysisDataPackage = async (stock, userId) => {
  const { data: userProfile } = await supabase.from('profiles').select('username').eq('id', userId).single();
  
  // 1. 判定市場與交易規範
  const isCN = stock.symbol.includes('.SS') || stock.symbol.includes('.SZ');
  const targetMarket = isCN ? 'CN' : 'TW';
  const currency = isCN ? 'CNY' : 'TWD';
  const lotSize = isCN ? 100 : 1;

  // 2. 從 accounts 與 stock_targets 抓取資金及目標
  const { data: accounts } = await supabase.from('accounts').select('balance').eq('user_id', userId).eq('market', targetMarket);
  const { data: target } = await supabase.from('stock_targets').select('monthly_income_target').eq('user_id', userId).eq('symbol', stock.symbol).single();

  return {
    user: { username: userProfile?.username || '書緯' },
    stock: {
      symbol: stock.symbol,
      name: stock.name,
      currency: currency,
      lotSize: lotSize,
      // 🌟 直接使用傳入的 stock 物件數據（來自 watchlist 表格）
      currentPrice: cleanVal(stock.current_price),
      averageCost: cleanVal(stock.average_cost),
      sharesQty: stock.current_shares || 0,
      // 🌟 這些欄位現在確保從 watchlist 讀取
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
  const systemPrompt = `你是一位不廢話的首席量化交易員。禁止聯網，僅針對以下數據進行精確計算與分析。

【量化數據快照】
- 標的：${dataPackage.stock.name} (${dataPackage.stock.symbol})
- 價格：現價 ${dataPackage.stock.currentPrice} / 個人成本 ${dataPackage.stock.averageCost} / 持股 ${dataPackage.stock.sharesQty} 股
- 技術面：RSI14(${dataPackage.stock.rsi}), 20日乖離率(${dataPackage.stock.bias}), 今日成交量(${dataPackage.stock.vol}), 10日均量(${dataPackage.stock.avgVol10d})
- 52週區間：${dataPackage.stock.low52} ~ ${dataPackage.stock.high52}
- 財務面：殖利率(${dataPackage.stock.yield}), PE(${dataPackage.stock.pe}), PB(${dataPackage.stock.pb})
- 可用資金：${dataPackage.finance.balance.toLocaleString()} ${dataPackage.stock.currency} (單位須為 ${dataPackage.stock.lotSize} 的倍數)

【任務指令：極精簡量化報告】
1. 【數據診斷】：基於 RSI 與 乖離率 評價位階（超買/超賣/盤整）。評價成交量動能。
2. 【適合買入價位】：給出具體支撐位數字。
3. 【效益最大化加碼】：
   - 基於餘額 ${dataPackage.finance.balance} 與單位 ${dataPackage.stock.lotSize}，精算具體建議：建議在「X 價位」買入「Y 股」。
   - 攤平計算：精算出加碼後預期成本從 ${dataPackage.stock.averageCost} 降至多少。
4. 【獲利了結】：給出具體壓力位與建議止盈點。

【要求】：繁體中文條列式，總字數 300 字內，禁止任何市場預測廢話。稱呼用戶為「${dataPackage.user.username}」。`;

  for (const modelId of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 600 } 
        })
      });
      const result = await response.json();
      if (response.ok) return result.candidates[0].content.parts[0].text;
      continue;
    } catch (e) { continue; }
  }
  throw new Error('分析暫時不可用');
};

export const performAiAnalysis = async (stock, userId, forceRefresh = false) => {
  try {
    const { apiKey, models } = await getGeminiApiKey(userId);
    const dataPackage = await buildAnalysisDataPackage(stock, userId);
    const report = await callGeminiWithRetry(dataPackage, models, apiKey);

    const now = new Date().toISOString();
    await supabase.from('watchlist').update({
      ai_analysis_report: report,
      ai_score: 95,
      last_ai_generated_at: now
    }).eq('user_id', userId).eq('symbol', stock.symbol);

    return { success: true, report, lastGenerated: now };
  } catch (error) {
    return { success: false, report: `分析失敗：${error.message}` };
  }
};

export default { performAiAnalysis };