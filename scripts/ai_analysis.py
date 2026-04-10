import os
import json
import re
import google.generativeai as genai
from supabase import create_client
from dotenv import load_dotenv

# 初始化環境
current_file = os.path.abspath(__file__)
root_dir = os.path.dirname(os.path.dirname(current_file))
load_dotenv(os.path.join(root_dir, '.env.local'))

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash-lite')

def analyze_single_stock(stock_uuid):
    """
    針對單一股票 UUID 進行 AI 分析並更新資料庫
    """
    # 1. 從資料庫抓取該股當前數據
    res = supabase.table("watchlist").select("*").eq("id", stock_uuid).single().execute()
    s = res.data
    if not s: return {"error": "找不到股票數據"}

    print(f"🧠 正在即時分析: {s['name']}...")

    # 2. 設定 Prompt
    prompt = f"""
    你是專業分析師。請分析 {s['name']} ({s['symbol']}) 並嚴格以 JSON 格式回覆。
    現價: {s['current_price']}, RSI: {s['rsi_14']}, 趨勢: {s['trend_signal']}, PE: {s['pe_ratio']}
    格式：{{ "score": 評分, "recommendation": "建議", "analysis": "簡短分析" }}
    """
    
    try:
        response = model.generate_content(prompt)
        # 提取 JSON (延用之前的 extract_json 邏輯)
        match = re.search(r'\{.*\}', response.text, re.DOTALL)
        data = json.loads(match.group()) if match else None
        
        if data:
            update_data = {
                "ai_score": int(data.get("score", 0)),
                "ai_analysis_report": f"【{data.get('recommendation')}】{data.get('analysis')}",
                "last_ai_generated_at": "now()"
            }
            # 3. 更新回資料庫
            supabase.table("watchlist").update(update_data).eq("id", stock_uuid).execute()
            return {"success": True, "data": update_data}
            
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    # 測試用：手動填入一個資料庫中的 UUID
    # analyze_single_stock("你的-股票-UUID")
    pass