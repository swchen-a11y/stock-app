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

# --- 2. 強化版數據抓取 ---

def get_region_data(symbol):
    """ 根據市場取得優先數據，若失敗回傳空字典 """
    res = {}
    try:
        if symbol.endswith(('.SZ', '.SS')):
            # 陸股：AkShare
            pure_code = symbol.split('.')[0]
            df_all = ak.stock_zh_a_spot_em()
            row = df_all[df_all['代码'] == pure_code]
            if not row.empty:
                r = row.iloc[0]
                res = {
                    "pe_ratio": clean_val(r.get('市盈率-动态')),
                    "pb_ratio": clean_val(r.get('市净率')),
                    "market_cap": clean_val(r.get('总市值'))
                }
        elif symbol.endswith(('.TW', '.TWO')):
            # 台股：FinMind
            dl = DataLoader()
            if FINMIND_TOKEN: dl.login(token=FINMIND_TOKEN)
            code = symbol.split('.')[0]
            start = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y-%m-%d')
            df_per = dl.taiwan_stock_per_pbr(stock_id=code, start_date=start)
            if not df_per.empty:
                l = df_per.iloc[-1]
                res = {
                    "pe_ratio": clean_val(l.get('PE')),
                    "pb_ratio": clean_val(l.get('PBR')),
                    "dividend_yield": clean_val(l.get('dividend_yield'))
                }
    except Exception as e:
        print(f"⚠️ 區域來源抓取失敗 ({symbol}): {e}")
    return res

def fetch_and_sync(symbol):
    try:
        # 1. 取得歷史數據計算技術指標 (這部分你目前是成功的)
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="60d")
        if hist.empty: return False
        
        latest = hist.iloc[-1]
        prev = hist.iloc[-2]
        
        payload = {
            "current_price": clean_val(latest['Close']),
            "prev_close": clean_val(prev['Close']),
            "open_price": clean_val(latest['Open']),
            "day_high": clean_val(latest['High']),
            "day_low": clean_val(latest['Low']),
            "volume": int(latest['Volume']),
            "change_percent": ((latest['Close'] - prev['Close']) / prev['Close'] * 100),
            "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        # 計算 RSI 與 MA20 乖離
        if len(hist) >= 20:
            ma20 = hist['Close'].rolling(window=20).mean().iloc[-1]
            payload["ma20_distance"] = clean_val((payload["current_price"] - ma20) / ma20 * 100)
            payload["trend_signal"] = "多頭" if payload["current_price"] > ma20 else "空頭"

        # 2. 獲取優先來源數據
        primary_data = get_region_data(symbol)
        payload.update(primary_data)

        # 3. ！！關鍵補全邏輯！！：使用 yfinance 補齊所有還是 0 的欄位
        yf_info = ticker.info if ticker.info else {}
        mapping = {
            "market_cap": "marketCap",
            "pe_ratio": "trailingPE",
            "pb_ratio": "priceToBook",
            "high_52w": "fiftyTwoWeekHigh",
            "low_52w": "fiftyTwoWeekLow",
            "eps": "trailingEps",
            "dividend_yield": "dividendYield"
        }

        for db_key, yf_key in mapping.items():
            # 檢查目前 payload 裡該欄位是否為 0 或不存在
            if clean_val(payload.get(db_key)) == 0:
                val = yf_info.get(yf_key)
                if db_key == "dividend_yield": val = clean_val(val) * 100
                payload[db_key] = clean_val(val)
                # 如果 yfinance 補成功了，印出來確認
                if payload[db_key] != 0:
                    print(f"🔹 {symbol} 的 {db_key} 由 yfinance 補全成功")

        # 4. 更新至資料庫
        supabase.table("watchlist").update(payload).eq("symbol", symbol).execute()
        print(f"✅ {symbol} 同步完成 (Price: {payload['current_price']})")
        return True

    except Exception as e:
        print(f"❌ {symbol} 發生錯誤: {e}")
        return False

def main():
    res = supabase.table("watchlist").select("symbol").execute()
    for row in res.data:
        fetch_and_sync(row['symbol'])
        time.sleep(1)

if __name__ == "__main__":
    main()