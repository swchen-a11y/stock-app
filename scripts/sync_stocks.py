import os
import time
import yfinance as yf
import pandas as pd
import numpy as np
import datetime
import pytz
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
        raise ValueError("❌ 缺失核心環境變數。")
    
    return create_client(url, key.strip()), finmind_token

supabase, FINMIND_TOKEN = init_supabase()

def clean_val(val, default=0.0):
    """ 強制轉換數據並過濾異常字串 """
    if val is None or pd.isna(val) or val == "" or val == "-" or val == "None": return default
    try:
        v = float(val)
        return v if not (np.isnan(v) or np.isinf(v)) else default
    except: return default

# --- 2. 數據抓取模組 (分流策略) ---

def get_china_data(symbol):
    """ 陸股優先：AkShare """
    try:
        pure_code = symbol.split('.')[0]
        df_all = ak.stock_zh_a_spot_em()
        row = df_all[df_all['代码'] == pure_code]
        if not row.empty:
            res = row.iloc[0]
            return {
                "market_cap": clean_val(res.get('总市值')),
                "pe_ratio": clean_val(res.get('市盈率-动态')),
                "pb_ratio": clean_val(res.get('市净率')),
                "current_price": clean_val(res.get('最新价')),
                "volume": int(clean_val(res.get('成交量'))) * 100 # 手轉股
            }
    except Exception as e: print(f"⚠️ AkShare 抓取失敗 ({symbol}): {e}")
    return {}

def get_taiwan_data(symbol):
    """ 台股優先：FinMind """
    try:
        dl = DataLoader()
        if FINMIND_TOKEN: dl.login(token=FINMIND_TOKEN)
        code = symbol.split('.')[0]
        start = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y-%m-%d')
        df_per = dl.taiwan_stock_per_pbr(stock_id=code, start_date=start)
        if not df_per.empty:
            l = df_per.iloc[-1]
            return {
                "pe_ratio": clean_val(l.get('PE')),
                "pb_ratio": clean_val(l.get('PBR')),
                "dividend_yield": clean_val(l.get('dividend_yield'))
            }
    except Exception as e: print(f"⚠️ FinMind 抓取失敗 ({symbol}): {e}")
    return {}

# --- 3. 市場狀態判斷 ---
def is_market_open(market="US"):
    now = datetime.datetime.now(pytz.utc)
    if market == "US":
        et_tz = pytz.timezone('US/Eastern')
        now_et = now.astimezone(et_tz)
        if now_et.weekday() >= 5: return False
        return datetime.time(9, 30) <= now_et.time() <= datetime.time(16, 0)
    elif market in ["TW", "CN"]:
        tw_tz = pytz.timezone('Asia/Taipei')
        now_tw = now.astimezone(tw_tz)
        if now_tw.weekday() >= 5: return False
        t = now_tw.time()
        if market == "TW": return datetime.time(9, 0) <= t <= datetime.time(13, 30)
        elif market == "CN":
            morning = datetime.time(9, 30) <= t <= datetime.time(11, 30)
            afternoon = datetime.time(13, 0) <= t <= datetime.time(15, 0)
            return morning or afternoon
    return True

# --- 4. 同步邏輯整合 ---
def sync():
    print(f"🚀 同步啟動: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    res = supabase.table("watchlist").select("*").execute()
    items = res.data
    if not items: return

    active_symbols = [i['symbol'] for i in items if is_market_open(i['market']) or clean_val(i.get('current_price')) == 0]
    if not active_symbols:
        print("💤 市場休市中且數據已完整。")
        return

    # 批次下載歷史行情計算技術指標
    all_history = yf.download(active_symbols, period="60d", group_by='ticker', progress=False)

    for item in items:
        symbol = item['symbol']
        if symbol not in active_symbols: continue

        try:
            df = all_history[symbol].dropna(subset=['Close']) if len(active_symbols) > 1 else all_history.dropna(subset=['Close'])
            if df.empty: continue
            
            # 1. 基礎行情與指標 (High Frequency)
            last = df.iloc[-1]
            prev = df.iloc[-2]
            payload = {
                "current_price": clean_val(last['Close']),
                "prev_close": clean_val(prev['Close']),
                "change_percent": ((last['Close'] - prev['Close']) / prev['Close'] * 100),
                "volume": int(last['Volume']),
                "updated_at": datetime.datetime.now(pytz.utc).isoformat()
            }

            # 2. 判斷是否更新靜態基本面 (Low Frequency - 24H Cache)
            last_update = datetime.datetime.fromisoformat(item.get('updated_at').replace('Z', '+00:00')) if item.get('updated_at') else None
            needs_static = not last_update or (datetime.datetime.now(pytz.utc) - last_update).total_seconds() > 86400 or clean_val(item.get('pe_ratio')) == 0

            if needs_static:
                print(f"📈 {symbol} 緩存過期，執行完整更新...")
                
                # 分流獲取動態基本面
                region_data = {}
                if symbol.endswith(('.SZ', '.SS')): region_data = get_china_data(symbol)
                elif symbol.endswith(('.TW', '.TWO')): region_data = get_taiwan_data(symbol)
                
                # yfinance 補全與靜態數據
                ticker = yf.Ticker(symbol)
                inf = ticker.info
                static_map = {
                    "market_cap": "marketCap", "pe_ratio": "trailingPE", "pb_ratio": "priceToBook",
                    "high_52w": "fiftyTwoWeekHigh", "low_52w": "fiftyTwoWeekLow", "eps": "trailingEps"
                }
                
                for db_k, yf_k in static_map.items():
                    if clean_val(region_data.get(db_k)) == 0:
                        region_data[db_k] = clean_val(inf.get(yf_k))
                
                payload.update(region_data)
            else:
                print(f"📊 {symbol} 僅更新即時行情。")

            # 3. 更新 Supabase
            supabase.table("watchlist").update(payload).eq("symbol", symbol).execute()
            print(f"✅ {symbol} 同步成功。")
            time.sleep(1)

        except Exception as e:
            print(f"❌ {symbol} 失敗: {e}")

if __name__ == "__main__":
    sync()