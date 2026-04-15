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

# --- 1. 初始化 ---
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

# --- 2. AkShare 官方名稱抓取與轉換 ---

def get_china_data_with_mapping(symbol):
    """
    依照 AkShare 官方輸出參數名稱抓取，再轉換為資料庫欄位
    """
    try:
        pure_code = symbol.split('.')[0]
        df_all = ak.stock_zh_a_spot_em()
        # 官方文件代碼欄位為簡體「代码」
        row = df_all[df_all['代码'] == pure_code]
        
        if not row.empty:
            res = row.iloc[0]
            print(f"📊 成功匹配 A 股: {pure_code} ({res.get('名称')})")
            
            # 建立「官方名稱 -> 你的資料庫欄位」映射表
            official_mapping = {
                "最新价": "current_price",
                "昨收": "prev_close",
                "今开": "open_price",
                "最高": "day_high",
                "最低": "day_low",
                "成交量": "volume",
                "总市值": "market_cap",
                "市盈率-动态": "pe_ratio",
                "市净率": "pb_ratio",
                "漲跌幅": "change_percent"
            }
            
            converted_data = {}
            for off_key, db_key in official_mapping.items():
                val = res.get(off_key)
                if off_key == "成交量":
                    converted_data[db_key] = int(clean_val(val)) * 100 # 手轉股
                else:
                    converted_data[db_key] = clean_val(val)
            
            return converted_data
    except Exception as e:
        print(f"⚠️ AkShare 抓取/轉換失敗 ({symbol}): {e}")
    return {}

# --- 3. 執行主同步 ---

def fetch_and_sync(symbol):
    try:
        ticker = yf.Ticker(symbol)
        # 這裡改用 1d 獲取最即時的 52 週資訊（yfinance info 抓取較全）
        yf_info = ticker.info if ticker.info else {}
        
        # A. 優先獲取陸股數據 (AkShare)
        payload = {}
        if symbol.endswith(('.SZ', '.SS')):
            payload = get_china_data_with_mapping(symbol)
        
        # B. 歷史指標計算 (RSI, MA20) - 這部分你目前的資料是有值的
        hist = ticker.history(period="60d")
        if not hist.empty:
            latest = hist.iloc[-1]
            ma20 = hist['Close'].rolling(window=20).mean().iloc[-1]
            payload["ma20_distance"] = clean_val((latest['Close'] - ma20) / ma20 * 100)
            
            delta = hist['Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean().iloc[-1]
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean().iloc[-1]
            payload["rsi_14"] = clean_val(100 - (100 / (1 + (gain/loss)))) if loss != 0 else 100
            payload["trend_signal"] = "多頭" if latest['Close'] > ma20 else "空頭"

        # C. yfinance 二次補全 (Fallback)
        # 針對 high_52w, low_52w, eps 等 AkShare 實時行情沒提供的欄位
        fallback_mapping = {
            "high_52w": "fiftyTwoWeekHigh",
            "low_52w": "fiftyTwoWeekLow",
            "market_cap": "marketCap",
            "pe_ratio": "trailingPE",
            "eps": "trailingEps",
            "dividend_yield": "dividendYield"
        }

        for db_k, yf_k in fallback_mapping.items():
            # 如果目前 payload 沒這項數據或是 0，就嘗試用 yfinance 補
            if clean_val(payload.get(db_k)) == 0:
                val = yf_info.get(yf_k)
                if db_k == "dividend_yield": val = clean_val(val) * 100
                payload[db_k] = clean_val(val)

        payload["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # D. 更新至 Supabase
        res = supabase.table("watchlist").update(payload).eq("symbol", symbol).execute()
        if res.data:
            print(f"✅ {symbol} 同步成功，包含欄位: {list(payload.keys())}")
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