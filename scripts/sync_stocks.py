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
    if val is None or pd.isna(val) or val == "" or val == "-" or val == "None": return default
    try:
        v = float(val)
        return v if not (np.isnan(v) or np.isinf(v)) else default
    except: return default

# --- 2. 數據抓取：分流處理 ---

def get_dynamic_data(symbol):
    """ 動態行情優先：A股(AkShare), 台股(FinMind) """
    res = {}
    try:
        if symbol.endswith(('.SZ', '.SS')):
            # 陸股：使用 AkShare 官方文件接口
            pure_code = symbol.split('.')[0]
            df_all = ak.stock_zh_a_spot_em()
            row = df_all[df_all['代码'] == pure_code]
            if not row.empty:
                r = row.iloc[0]
                res = {
                    "current_price": clean_val(r.get('最新价')),
                    "change_percent": clean_val(r.get('涨跌幅')),
                    "volume": int(clean_val(r.get('成交量'))) * 100, # 手轉股
                    "pe_ratio": clean_val(r.get('市盈率-动态')),
                    "pb_ratio": clean_val(r.get('市净率')),
                    "market_cap": clean_val(r.get('总市值')),
                    "day_high": clean_val(r.get('最高')),
                    "day_low": clean_val(r.get('最低')),
                    "open_price": clean_val(r.get('今开')),
                    "prev_close": clean_val(r.get('昨收'))
                }
        elif symbol.endswith(('.TW', '.TWO')):
            # 台股：此處以 yfinance 為基礎行情，FinMind 補強動態指標
            pass 
    except Exception as e:
        print(f"⚠️ 動態數據抓取失敗 ({symbol}): {e}")
    return res

def fetch_and_sync(symbol):
    try:
        # 1. 抓取動態數據 (AkShare/FinMind 優先)
        payload = get_dynamic_data(symbol)
        
        # 2. 抓取靜態與歷史指標 (yfinance)
        ticker = yf.Ticker(symbol)
        
        # 處理技術指標 (RSI, MA20)
        hist = ticker.history(period="60d")
        if not hist.empty:
            latest = hist.iloc[-1]
            if clean_val(payload.get("current_price")) == 0:
                payload["current_price"] = clean_val(latest['Close'])
                payload["volume"] = int(latest['Volume'])
            
            # 計算 RSI 14
            delta = hist['Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean().iloc[-1]
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean().iloc[-1]
            payload["rsi_14"] = clean_val(100 - (100 / (1 + (gain/loss)))) if loss != 0 else 100
            
            # MA20 乖離
            ma20 = hist['Close'].rolling(window=20).mean().iloc[-1]
            payload["ma20_distance"] = clean_val((payload["current_price"] - ma20) / ma20 * 100)
            payload["trend_signal"] = "多頭" if payload["current_price"] > ma20 else "空頭"

        # 3. 靜態數據補全 (yfinance Fallback)
        # 如果動態數據沒抓到 PE 或 市值，則強制用 yfinance 補齊
        inf = ticker.info if ticker.info else {}
        static_mapping = {
            "market_cap": "marketCap",
            "pe_ratio": "trailingPE",
            "pb_ratio": "priceToBook",
            "high_52w": "fiftyTwoWeekHigh",
            "low_52w": "fiftyTwoWeekLow",
            "eps": "trailingEps",
            "dividend_yield": "dividendYield"
        }

        for db_k, yf_k in static_mapping.items():
            if clean_val(payload.get(db_k)) == 0:
                val = inf.get(yf_k)
                if db_k == "dividend_yield": val = clean_val(val) * 100
                payload[db_k] = clean_val(val)

        payload["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # 4. 更新 Supabase
        supabase.table("watchlist").update(payload).eq("symbol", symbol).execute()
        print(f"✅ {symbol} 同步完成 (含靜態補全)")
        return True

    except Exception as e:
        print(f"❌ {symbol} 同步出錯: {e}")
        return False

def main():
    res = supabase.table("watchlist").select("symbol").execute()
    for row in res.data:
        fetch_and_sync(row['symbol'])
        time.sleep(1)

if __name__ == "__main__":
    main()