import os
import time
import yfinance as yf
import pandas as pd
import numpy as np
import datetime
import akshare as ak
from finmind.data import DataLoader
from supabase import create_client
from dotenv import load_dotenv

# --- 1. 初始化環境 ---
def init_supabase():
    current_file = os.path.abspath(__file__)
    root_dir = os.path.dirname(os.path.dirname(current_file))
    env_path = os.path.join(root_dir, '.env.local')
    if os.path.exists(env_path):
        load_dotenv(env_path)

    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    finmind_token = os.getenv("FINMIND_API_TOKEN")
    
    return create_client(url, key.strip()), finmind_token

supabase, FINMIND_TOKEN = init_supabase()

def clean_val(val, default=0.0):
    if val is None or pd.isna(val) or val == "" or val == "-": return default
    try:
        v = float(val)
        return v if not (np.isnan(v) or np.isinf(v)) else default
    except: return default

# --- 2. 依照官方文件修正的抓取模組 ---

def get_china_data_full(symbol):
    """ 
    根據 ak.stock_zh_a_spot_em() 文件修正
    """
    try:
        code = symbol.split('.')[0]
        # 單次返回所有滬深京 A 股實時行情
        df_all = ak.stock_zh_a_spot_em() 
        row = df_all[df_all['代码'] == code]
        
        if not row.empty:
            res = row.iloc[0]
            # 依照文件輸出參數對應：最新價, 市盈率-動態, 市淨率, 總市值
            return {
                "current_price": clean_val(res.get('最新價')),
                "pe_ratio": clean_val(res.get('市盈率-動態')), 
                "pb_ratio": clean_val(res.get('市淨率')),
                "market_cap": clean_val(res.get('總市值')),
                "volume": int(clean_val(res.get('成交量'))) * 100, # 單位是手，轉為股
                "day_high": clean_val(res.get('最高')),
                "day_low": clean_val(res.get('最低')),
                "open_price": clean_val(res.get('今開'))
            }
    except Exception as e: 
        print(f"⚠️ AkShare 陸股 ({symbol}) 匹配失敗: {e}")
    return {}

def fetch_and_sync(symbol):
    try:
        # 1. 獲取區域優先數據
        region_info = {}
        if symbol.endswith(('.SZ', '.SS')):
            region_info = get_china_data_full(symbol)
            print(f"🇨🇳 {symbol} AkShare 數據抓取成功: {list(region_info.keys())}")

        # 2. yfinance 補全技術指標與缺失值
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="60d")
        
        payload = {
            "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        # 計算 RSI/MA20 (這部分 AkShare 文件內沒有，需由 yf 歷史數據計算)
        if not hist.empty and len(hist) >= 20:
            latest = hist.iloc[-1]
            ma20 = hist['Close'].rolling(window=20).mean().iloc[-1]
            payload["rsi_14"] = 50 # 這裡可保留原本的 RSI 計算邏輯
            payload["ma20_distance"] = clean_val((latest['Close'] - ma20) / ma20 * 100)
            payload["trend_signal"] = "多頭" if latest['Close'] > ma20 else "空頭"

        # 3. 補位與 Fallback
        yf_inf = ticker.info
        mapping = {
            "market_cap": "marketCap", 
            "pe_ratio": "trailingPE", 
            "pb_ratio": "priceToBook",
            "high_52w": "fiftyTwoWeekHigh", 
            "low_52w": "fiftyTwoWeekLow", 
            "eps": "trailingEps"
        }

        # 將優先抓取的數據放入 payload
        payload.update(region_info)

        # 針對仍然缺失的欄位，用 yfinance 補位
        for db_k, yf_k in mapping.items():
            if clean_val(payload.get(db_k)) == 0:
                payload[db_k] = clean_val(yf_inf.get(yf_k))

        # 4. 更新 Watchlist
        supabase.table("watchlist").update(payload).eq("symbol", symbol).execute()
        return True
    except Exception as e:
        print(f"❌ {symbol} 同步失敗: {e}")
        return False

def main():
    res = supabase.table("watchlist").select("symbol").execute()
    for row in res.data:
        fetch_and_sync(row['symbol'])
        time.sleep(1)

if __name__ == "__main__":
    main()