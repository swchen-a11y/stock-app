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

# --- 1. 環境初始化 ---
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
    if val is None or pd.isna(val) or val == "" or val == "-" or val == "None": return default
    try:
        v = float(val)
        return v if not (np.isnan(v) or np.isinf(v)) else default
    except: return default

# --- 2. 數據抓取模組 ---

def get_china_data_full(symbol):
    """ 
    根據 AkShare 官方文件修正：stock_zh_a_spot_em
    """
    try:
        code = symbol.split('.')[0]
        # 單次返回所有 A 股實時行情
        df_all = ak.stock_zh_a_spot_em() 
        # 注意：文件顯示欄位名為簡體「代码」
        row = df_all[df_all['代码'] == code]
        
        if not row.empty:
            res = row.iloc[0]
            # 依照官方輸出參數對應
            return {
                "current_price": clean_val(res.get('最新價')),
                "pe_ratio": clean_val(res.get('市盈率-動態')), 
                "pb_ratio": clean_val(res.get('市淨率')),
                "market_cap": clean_val(res.get('總市值')),
                "volume": int(clean_val(res.get('成交量'))) * 100, # 單位是手，轉為股
                "day_high": clean_val(res.get('最高')),
                "day_low": clean_val(res.get('最低')),
                "open_price": clean_val(res.get('今開')),
                "prev_close": clean_val(res.get('昨收'))
            }
    except Exception as e: 
        print(f"⚠️ AkShare 陸股 ({symbol}) 匹配失敗: {e}")
    return {}

def fetch_and_sync(symbol):
    try:
        # 1. 獲取區域優先數據 (AkShare/FinMind)
        region_info = {}
        if symbol.endswith(('.SZ', '.SS')):
            region_info = get_china_data_full(symbol)
            print(f"🇨🇳 {symbol} 優先級 1: AkShare 獲取數據 {len(region_info)} 項")

        # 2. yfinance 歷史數據 (計算指標用)
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="60d")
        
        payload = {
            "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        # 基礎行情 (如果 AkShare 沒抓到，則由 yfinance 補位)
        if not hist.empty:
            latest = hist.iloc[-1]
            if clean_val(region_info.get("current_price")) == 0:
                region_info["current_price"] = clean_val(latest['Close'])
                region_info["volume"] = int(latest['Volume'])

            # 計算 RSI 與 MA20 乖離率
            if len(hist) >= 20:
                ma20 = hist['Close'].rolling(window=20).mean().iloc[-1]
                payload["ma20_distance"] = clean_val((latest['Close'] - ma20) / ma20 * 100)
                payload["trend_signal"] = "多頭" if latest['Close'] > ma20 else "空頭"
                
                delta = hist['Close'].diff()
                gain = (delta.where(delta > 0, 0)).rolling(window=14).mean().iloc[-1]
                loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean().iloc[-1]
                payload["rsi_14"] = clean_val(100 - (100 / (1 + (gain / loss)))) if loss != 0 else 100

        # 3. yfinance 補全其餘基本面 (Fallback)
        yf_inf = ticker.info
        mapping = {
            "market_cap": "marketCap", 
            "pe_ratio": "trailingPE", 
            "pb_ratio": "priceToBook",
            "high_52w": "fiftyTwoWeekHigh", 
            "low_52w": "fiftyTwoWeekLow", 
            "eps": "trailingEps",
            "dividend_yield": "dividendYield"
        }

        payload.update(region_info)

        for db_k, yf_k in mapping.items():
            # 只有當目前 payload 是空的時候，才調用 yfinance 補齊
            if clean_val(payload.get(db_k)) == 0:
                val = yf_inf.get(yf_k)
                if db_k == "dividend_yield": val = clean_val(val) * 100
                payload[db_k] = clean_val(val)

        # 4. 更新至資料庫
        supabase.table("watchlist").update(payload).eq("symbol", symbol).execute()
        print(f"✅ {symbol} 同步補全成功")
        return True
    except Exception as e:
        print(f"❌ {symbol} 同步出錯: {e}")
        return False

def main():
    # 獲取 Watchlist 所有代號
    res = supabase.table("watchlist").select("symbol").execute()
    for row in res.data:
        fetch_and_sync(row['symbol'])
        time.sleep(1) # 避免 API 頻率限制

if __name__ == "__main__":
    main()