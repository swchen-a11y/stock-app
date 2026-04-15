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

# --- 1. 環境與客戶端初始化 ---
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
        raise ValueError("❌ 缺失核心環境變數：SUPABASE_URL 或 SERVICE_KEY。")
    
    return create_client(url, key.strip()), finmind_token

supabase, FINMIND_TOKEN = init_supabase()

def clean_val(val, default=0.0):
    if val is None or pd.isna(val) or val == "" or val == "None": return default
    try:
        v = float(val)
        return v if not (np.isnan(v) or np.isinf(v)) else default
    except: return default

# --- 2. 核心抓取邏輯：單支股票處理 ---

def fetch_single_stock_data(symbol):
    """
    依照分流邏輯抓取單支股票的所有數據：
    1. yfinance 抓取歷史與基礎指標
    2. 陸股用 AkShare / 台股用 FinMind 覆蓋
    3. yfinance 補全其餘空欄位
    """
    try:
        print(f"🔍 正在抓取: {symbol}...")
        
        # A. 使用 yfinance 抓取歷史數據並計算指標
        df = yf.download(symbol, period="3mo", progress=False)
        if df.empty or len(df) < 2:
            return None
        
        latest = df.iloc[-1]
        prev = df.iloc[-2]
        close_prices = df['Close']
        
        # 基本價格數據
        data = {
            "current_price": clean_val(latest['Close']),
            "prev_close": clean_val(prev['Close']),
            "open_price": clean_val(latest['Open']),
            "day_high": clean_val(latest['High']),
            "day_low": clean_val(latest['Low']),
            "volume": int(clean_val(latest['Volume'])),
            "change_percent": ((clean_val(latest['Close']) - clean_val(prev['Close'])) / clean_val(prev['Close']) * 100)
        }

        # 計算技術指標 (RSI, MA20, BBands)
        if len(df) >= 20:
            ma20 = close_prices.rolling(window=20).mean().iloc[-1]
            std20 = close_prices.rolling(window=20).std().iloc[-1]
            data.update({
                "ma20_distance": ((data["current_price"] - ma20) / ma20 * 100) if ma20 != 0 else 0,
                "bb_upper": ma20 + (std20 * 2),
                "bb_lower": ma20 - (std20 * 2),
                "trend_signal": "多頭" if data["current_price"] > ma20 else "空頭"
            })
            
            delta = close_prices.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            data["rsi_14"] = clean_val(100 - (100 / (1 + rs.iloc[-1])))

        # B. 區域優先數據抓取
        region_info = {}
        if symbol.endswith(('.SZ', '.SS')):
            # 陸股優先 AkShare
            try:
                code = symbol.split('.')[0]
                ak_df = ak.stock_zh_a_spot_em()
                row = ak_df[ak_df['代碼'] == code]
                if not row.empty:
                    res = row.iloc[0]
                # 获取全市场数据后，需要根据股票代码过滤特定股票信息
                    region_info = {
                        "market_cap": clean_val(res.get('總市值')),
                        "pe_ratio": clean_val(res.get('動態市盈率')),
                        "pb_ratio": clean_val(res.get('市淨率'))
                    }
            except Exception as e: print(f"⚠️ AkShare 失敗: {e}")

        elif symbol.endswith(('.TW', '.TWO')):
            # 台股優先 FinMind
            try:
                dl = DataLoader()
                if FINMIND_TOKEN: dl.login(token=FINMIND_TOKEN)
                code = symbol.split('.')[0]
                start_date = (datetime.datetime.now() - datetime.timedelta(days=10)).strftime('%Y-%m-%d')
                df_per = dl.taiwan_stock_per_pbr(stock_id=code, start_date=start_date)
                if not df_per.empty:
                    latest_fm = df_per.iloc[-1]
                    region_info = {
                        "pe_ratio": clean_val(latest_fm.get('PE')),
                        "pb_ratio": clean_val(latest_fm.get('PBR')),
                        "dividend_yield": clean_val(latest_fm.get('dividend_yield'))
                    }
            except Exception as e: print(f"⚠️ FinMind 失敗: {e}")

        # C. 使用 yfinance 補全 (Fallback)
        ticker = yf.Ticker(symbol)
        inf = ticker.info
        mapping = {
            "market_cap": "marketCap", "pe_ratio": "trailingPE", "pb_ratio": "priceToBook",
            "high_52w": "fiftyTwoWeekHigh", "low_52w": "fiftyTwoWeekLow",
            "eps": "trailingEps", "dividend_yield": "dividendYield", "roe": "returnOnEquity"
        }

        for db_key, yf_key in mapping.items():
            # 如果優先來源沒抓到 (0.0)，則使用 yfinance 補上
            if clean_val(region_info.get(db_key)) == 0:
                val = inf.get(yf_key)
                if db_key in ["dividend_yield", "roe"]: val = clean_val(val) * 100
                region_info[db_key] = clean_val(val)

        data.update(region_info)
        data["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        return data

    except Exception as e:
        print(f"❌ 抓取 {symbol} 失敗: {e}")
        return None

# --- 3. 執行同步任務 ---

def sync_watchlist():
    print(f"🚀 開始同步 Watchlist... {datetime.datetime.now()}")
    # 從資料庫抓取現有的股票列表
    res = supabase.table("watchlist").select("symbol").execute()
    for row in res.data:
        symbol = row['symbol']
        data = fetch_single_stock_data(symbol)
        if data:
            supabase.table("watchlist").update(data).eq("symbol", symbol).execute()
            print(f"✅ {symbol} 已更新")
            time.sleep(1) # 防禦性延遲

if __name__ == "__main__":
    sync_watchlist()