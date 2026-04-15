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
    if val is None or pd.isna(val) or val == "" or val == "None": return default
    try:
        v = float(val)
        return v if not (np.isnan(v) or np.isinf(v)) else default
    except: return default

# --- 2. 強化版分流抓取 ---

def get_china_data_full(symbol):
    """ 陸股：使用 AkShare 抓取最完整的財務與行情 """
    try:
        code = symbol.split('.')[0]
        # 抓取 A 股即時行情
        df_spot = ak.stock_zh_a_spot_em()
        row = df_spot[df_spot['代碼'] == code]
        
        if not row.empty:
            res = row.iloc[0]
            return {
                "market_cap": clean_val(res.get('總市值')),
                "pe_ratio": clean_val(res.get('動態市盈率')),
                "pb_ratio": clean_val(res.get('市淨率')),
                "current_price": clean_val(res.get('最新價')),
                "volume": int(clean_val(res.get('成交量'))),
                "high_52w": clean_val(res.get('最高')), # 暫代方案
                "low_52w": clean_val(res.get('最低'))
            }
    except Exception as e: print(f"⚠️ AkShare 陸股補全失敗: {e}")
    return {}

def get_taiwan_data_full(symbol):
    """ 台股：使用 FinMind 補全 PE/PB/殖利率 """
    try:
        dl = DataLoader()
        if FINMIND_TOKEN: dl.login(token=FINMIND_TOKEN)
        code = symbol.split('.')[0]
        # 抓取綜合指標
        df_per = dl.taiwan_stock_per_pbr(stock_id=code, start_date=(datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y-%m-%d'))
        if not df_per.empty:
            latest = df_per.iloc[-1]
            return {
                "pe_ratio": clean_val(latest.get('PE')),
                "pb_ratio": clean_val(latest.get('PBR')),
                "dividend_yield": clean_val(latest.get('dividend_yield')),
                "eps": clean_val(latest.get('EPS'))
            }
    except Exception as e: print(f"⚠️ FinMind 台股補全失敗: {e}")
    return {}

# --- 3. 執行主邏輯 ---

def fetch_and_sync(symbol):
    try:
        # A. yfinance 歷史數據與指標計算
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="60d")
        if hist.empty: return False
        
        latest = hist.iloc[-1]
        prev = hist.iloc[-2]
        
        payload = {
            "current_price": clean_val(latest['Close']),
            "prev_close": clean_val(prev['Close']),
            "change_percent": ((latest['Close'] - prev['Close']) / prev['Close'] * 100),
            "volume": int(latest['Volume']),
            "day_high": clean_val(latest['High']),
            "day_low": clean_val(latest['Low']),
            "open_price": clean_val(latest['Open']),
            "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        # B. 技術指標計算 (需滿足數據長度)
        if len(hist) >= 20:
            ma20 = hist['Close'].rolling(window=20).mean().iloc[-1]
            payload["ma20_distance"] = clean_val((payload["current_price"] - ma20) / ma20 * 100)
            payload["trend_signal"] = "多頭" if payload["current_price"] > ma20 else "空頭"

        # C. 分流補全
        extra_info = {}
        if symbol.endswith(('.SZ', '.SS')):
            extra_info = get_china_data_full(symbol)
        elif symbol.endswith(('.TW', '.TWO')):
            extra_info = get_taiwan_data_full(symbol)

        # D. yfinance 最後墊底補強
        yf_inf = ticker.info
        mapping = {
            "market_cap": "marketCap", "pe_ratio": "trailingPE", "pb_ratio": "priceToBook",
            "high_52w": "fiftyTwoWeekHigh", "low_52w": "fiftyTwoWeekLow", "eps": "trailingEps"
        }
        for db_k, yf_k in mapping.items():
            if clean_val(extra_info.get(db_k)) == 0:
                extra_info[db_k] = clean_val(yf_inf.get(yf_k))

        payload.update(extra_info)
        
        # E. 更新至 Supabase
        supabase.table("watchlist").update(payload).eq("symbol", symbol).execute()
        print(f"✅ {symbol} 補全更新成功")
        return True
    except Exception as e:
        print(f"❌ {symbol} 補全失敗: {e}")
        return False

def main():
    res = supabase.table("watchlist").select("symbol").execute()
    for row in res.data:
        fetch_and_sync(row['symbol'])
        time.sleep(1) # 避開 API 頻率限制

if __name__ == "__main__":
    main()