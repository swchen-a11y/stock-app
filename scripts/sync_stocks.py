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
        raise ValueError("❌ 缺失 SUPABASE_URL 或 SUPABASE_SERVICE_KEY。")
    
    return create_client(url, key.strip()), finmind_token

supabase, FINMIND_TOKEN = init_supabase()

def clean_val(val, default=0.0):
    if val is None or pd.isna(val) or val == "" or val == "-" or val == "None": return default
    try:
        v = float(val)
        return v if not (np.isnan(v) or np.isinf(v)) else default
    except: return default

# --- 2. 數據抓取模組 (分流策略) ---

def get_china_data(symbol):
    """ 陸股優先：AkShare (修正代碼匹配) """
    try:
        pure_code = symbol.split('.')[0]
        df_all = ak.stock_zh_a_spot_em()
        # AkShare 官方代碼欄位為簡體「代码」
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
        # 獲取 PE/PB/殖利率
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

# --- 3. 市場開盤判斷 ---
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

# --- 4. 同步主程序 ---
def sync():
    print(f"🚀 同步任務啟動: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 獲取 Watchlist
    res = supabase.table("watchlist").select("*").execute()
    items = res.data
    if not items: return

    # 篩選需要更新的符號 (開盤中或初次同步)
    active_symbols = [i['symbol'] for i in items if is_market_open(i['market']) or clean_val(i.get('current_price')) == 0]
    
    if not active_symbols:
        print("💤 市場休市且數據完整，跳過同步。")
        return

    # 批次下載歷史行情 (計算 RSI/MA20)
    all_history = yf.download(active_symbols, period="60d", group_by='ticker', progress=False)

    for item in items:
        symbol = item['symbol']
        if symbol not in active_symbols: continue

        try:
            # 取得歷史數據
            df = all_history[symbol].dropna(subset=['Close']) if len(active_symbols) > 1 else all_history.dropna(subset=['Close'])
            if df.empty: continue
            
            # 1. 基礎行情 (High Frequency)
            last = df.iloc[-1]
            prev = df.iloc[-2]
            payload = {
                "current_price": clean_val(last['Close']),
                "prev_close": clean_val(prev['Close']),
                "change_percent": ((last['Close'] - prev['Close']) / prev['Close'] * 100),
                "volume": int(last['Volume']),
                "updated_at": datetime.datetime.now(pytz.utc).isoformat()
            }

            # 計算技術指標
            if len(df) >= 20:
                ma20 = df['Close'].rolling(window=20).mean().iloc[-1]
                payload["ma20_distance"] = clean_val((payload["current_price"] - ma20) / ma20 * 100)
                payload["trend_signal"] = "多頭" if payload["current_price"] > ma20 else "空頭"
                
                delta = df['Close'].diff()
                gain = (delta.where(delta > 0, 0)).rolling(window=14).mean().iloc[-1]
                loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean().iloc[-1]
                payload["rsi_14"] = clean_val(100 - (100 / (1 + (gain/loss)))) if loss != 0 else 100

            # 2. 靜態數據補全 (Low Frequency - 24H Cache)
            last_update_str = item.get('updated_at')
            needs_static = True
            if last_update_str:
                last_update = datetime.datetime.fromisoformat(last_update_str.replace('Z', '+00:00'))
                if (datetime.datetime.now(pytz.utc) - last_update).total_seconds() < 86400 and clean_val(item.get('pe_ratio')) != 0:
                    needs_static = False

            if needs_static:
                print(f"📈 {symbol} 緩存過期或數據缺失，執行完整補全...")
                
                # 分流獲取
                region_data = {}
                if symbol.endswith(('.SZ', '.SS')): region_data = get_china_data(symbol)
                elif symbol.endswith(('.TW', '.TWO')): region_data = get_taiwan_data(symbol)
                
                # yfinance 終極補位
                ticker = yf.Ticker(symbol)
                inf = ticker.info
                static_map = {
                    "market_cap": "marketCap", "pe_ratio": "trailingPE", "pb_ratio": "priceToBook",
                    "high_52w": "fiftyTwoWeekHigh", "low_52w": "fiftyTwoWeekLow", "eps": "trailingEps",
                    "dividend_yield": "dividendYield"
                }
                
                for db_k, yf_k in static_map.items():
                    if clean_val(region_data.get(db_k)) == 0:
                        val = inf.get(yf_k)
                        if db_k == "dividend_yield": val = clean_val(val) * 100
                        region_data[db_k] = clean_val(val)
                
                payload.update(region_data)

            # 3. 更新 Supabase
            supabase.table("watchlist").update(payload).eq("symbol", symbol).execute()
            print(f"✅ {symbol} 同步成功。")
            time.sleep(1) # 防禦性延遲

        except Exception as e:
            print(f"❌ {symbol} 失敗: {e}")

if __name__ == "__main__":
    sync()