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
    
    if not url or not key:
        raise ValueError("❌ 缺失 SUPABASE_URL 或 SUPABASE_SERVICE_KEY。")
    
    # 建立客戶端
    client = create_client(url, key.strip())
    return client, finmind_token

# 修正：確保接收兩個回傳值
supabase, FINMIND_TOKEN = init_supabase()

def clean_val(val, default=0.0):
    if val is None or pd.isna(val) or val == "" or val == "None": return default
    try:
        v = float(val)
        return v if not (np.isnan(v) or np.isinf(v)) else default
    except: return default

# --- 2. 數據抓取模組 ---

def get_china_data(symbol):
    """ 陸股使用 AkShare """
    try:
        code = symbol.split('.')[0]
        df = ak.stock_zh_a_spot_em()
        row = df[df['代碼'] == code]
        if not row.empty:
            res = row.iloc[0]
            return {
                "market_cap": clean_val(res.get('總市值')),
                "pe_ratio": clean_val(res.get('動態市盈率')),
                "pb_ratio": clean_val(res.get('市淨率')),
                "current_price": clean_val(res.get('最新價')),
                "volume": int(clean_val(res.get('成交量')))
            }
    except Exception as e: print(f"⚠️ AkShare 失敗: {e}")
    return {}

def get_taiwan_data(symbol):
    """ 台股使用 FinMind """
    try:
        dl = DataLoader()
        if FINMIND_TOKEN: dl.login(token=FINMIND_TOKEN)
        code = symbol.split('.')[0]
        # 獲取最近一週的 PE/PB
        start_date = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y-%m-%d')
        df_per = dl.taiwan_stock_per_pbr(stock_id=code, start_date=start_date)
        
        if not df_per.empty:
            latest = df_per.iloc[-1]
            return {
                "pe_ratio": clean_val(latest.get('PE')),
                "pb_ratio": clean_val(latest.get('PBR')),
                "dividend_yield": clean_val(latest.get('dividend_yield'))
            }
    except Exception as e: print(f"⚠️ FinMind 失敗: {e}")
    return {}

def process_indicators(df):
    if df.empty or len(df) < 2: return None
    latest = df.iloc[-1]
    prev = df.iloc[-2]
    current_price = clean_val(latest['Close'])
    prev_close = clean_val(prev['Close'])
    
    d = {
        "current_price": current_price,
        "prev_close": prev_close,
        "change_percent": ((current_price - prev_close) / prev_close * 100) if prev_close != 0 else 0,
        "open_price": clean_val(latest['Open']),
        "day_high": clean_val(latest['High']),
        "day_low": clean_val(latest['Low']),
        "volume": int(clean_val(latest['Volume'])),
        "trade_date": latest.name.strftime('%Y-%m-%d')
    }
    return d

# --- 3. 主程序 ---

def sync():
    print(f"🚀 同步開始: {datetime.datetime.now()}")
    res = supabase.table("watchlist").select("symbol").execute()
    active_symbols = [r['symbol'] for r in res.data]
    if not active_symbols: return

    all_history = yf.download(active_symbols, period="60d", group_by='ticker', progress=False)

    for symbol in active_symbols:
        try:
            df = all_history[symbol] if len(active_symbols) > 1 else all_history
            df = df.dropna(subset=['Close'])
            payload = process_indicators(df)
            if not payload: continue

            final_info = {}
            if symbol.endswith('.SZ') or symbol.endswith('.SS'):
                final_info = get_china_data(symbol)
            elif symbol.endswith('.TW') or symbol.endswith('.TWO'):
                final_info = get_taiwan_data(symbol)

            # yfinance 補全
            ticker_obj = yf.Ticker(symbol)
            inf = ticker_obj.info
            
            mapping = {
                "market_cap": "marketCap", "pe_ratio": "trailingPE",
                "pb_ratio": "priceToBook", "high_52w": "fiftyTwoWeekHigh",
                "low_52w": "fiftyTwoWeekLow", "eps": "trailingEps",
                "roe": "returnOnEquity", "dividend_yield": "dividendYield"
            }

            for db_key, yf_key in mapping.items():
                if clean_val(final_info.get(db_key)) == 0:
                    val = inf.get(yf_key)
                    if db_key in ["roe", "dividend_yield"]: val = clean_val(val) * 100
                    final_info[db_key] = clean_val(val)

            payload.update(final_info)
            trade_date = payload.pop("trade_date")

            supabase.table("watchlist").update(payload).eq("symbol", symbol).execute()
            print(f"✅ {symbol} 更新成功")
            time.sleep(1)

        except Exception as e:
            print(f"❌ {symbol} 錯誤: {e}")

if __name__ == "__main__":
    sync()