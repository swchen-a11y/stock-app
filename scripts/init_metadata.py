import os
import time
import pandas as pd
import akshare as ak
import zhconv
from FinMind.data import DataLoader
from supabase import create_client
from dotenv import load_dotenv

# ==========================================
# 1. 環境初始化
# ==========================================
current_path = os.path.abspath(__file__)
root_dir = os.path.dirname(os.path.dirname(current_path))
env_path = os.path.join(root_dir, '.env.local')

if os.path.exists(env_path):
    load_dotenv(env_path)
    print(f"✅ 成功載入配置: {env_path}")
else:
    load_dotenv()

url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    raise ValueError(f"❌ 配置缺失：URL={'OK' if url else '缺失'}, Key={'OK' if key else '缺失'}")

supabase = create_client(url, key)

# ==========================================
# 2. 轉換與過濾工具
# ==========================================
def to_traditional(text):
    if not text: return text
    return zhconv.convert(text, 'zh-tw')

def unique_stocks(data_list):
    """確保清單中的 symbol 是唯一的，防止資料庫 upsert 報錯"""
    seen = set()
    result = []
    for item in data_list:
        if item['symbol'] not in seen:
            result.append(item)
            seen.add(item['symbol'])
    return result

# ==========================================
# 3. 核心匯入邏輯
# ==========================================

def import_taiwan_stocks():
    """從 FinMind 抓取台股全清單"""
    print("🚀 啟動台股清單抓取 (FinMind)...")
    try:
        api = DataLoader()
        token = os.getenv("FINMIND_API_TOKEN")
        if token: api.login_by_token(token)
        
        df = api.taiwan_stock_info()
        if df.empty: return

        stocks = []
        for _, row in df.iterrows():
            stocks.append({
                "symbol": f"{row['stock_id']}.TW",
                "name_zh": row['stock_name'],
                "market": "TW",
                "category": row['industry_category']
            })
        
        # 先進行去重再匯入
        batch_upsert(unique_stocks(stocks), "台股")
    except Exception as e:
        print(f"❌ 台股匯入失敗: {e}")

def import_china_stocks():
    """從 AkShare 抓取 A 股清單 (加入重試與流控)"""
    print("🚀 啟動 A 股清單抓取 (AkShare)...")
    try:
        # 增加延遲避免剛啟動就被斷線
        time.sleep(1)
        df = ak.stock_zh_a_spot_em()
        if df.empty:
            print("⚠️ AkShare 未回傳數據")
            return

        stocks = []
        for _, row in df.iterrows():
            code = str(row['代碼'])
            suffix = ".SS" if code.startswith('6') or code.startswith('688') else ".SZ"
            symbol = f"{code}{suffix}"
            name_tw = to_traditional(row['名稱'])
            
            stocks.append({
                "symbol": symbol,
                "name_zh": name_tw,
                "market": "CN",
                "category": "A股主板" if not code.startswith('688') else "科創板"
            })
        
        batch_upsert(unique_stocks(stocks), "A股")
    except Exception as e:
        print(f"❌ A股匯入中斷 (可能是伺服器防火牆): {e}")
        print("💡 建議：A股可留待用戶搜尋時即時新增，不一定要一次匯入全量。")

def batch_upsert(data_list, label, batch_size=200):
    """
    批次寫入資料庫
    - batch_size 調降至 200 以降低資料庫負擔
    - 增加 time.sleep 延遲，防止 API 頻率限制
    """
    total = len(data_list)
    if total == 0: return
    
    print(f"📦 準備匯入 {total} 筆 {label} 元數據...")
    
    for i in range(0, total, batch_size):
        batch = data_list[i : i + batch_size]
        try:
            supabase.table("stock_metadata").upsert(batch, on_conflict="symbol").execute()
            if i % 1000 == 0 or i == 0:
                print(f"⏳ {label} 進度: {i}/{total}")
        except Exception as e:
            print(f"⚠️ 批次匯入錯誤 (i={i}): {e}")
            time.sleep(5) # 錯誤後進入冷卻期
        
        # 增加流控延遲
        time.sleep(0.5)

# ==========================================
# 4. 執行
# ==========================================
if __name__ == "__main__":
    print("--- 股票元數據初始化開始 ---")
    
    # 1. 執行台股
    import_taiwan_stocks()
    
    # 2. 執行 A 股
    # 如果 A 股持續失敗，可以註解掉下面這一行，讓系統保持輕量
    #import_china_stocks()
    
    print("✨ 任務完成！請到 Supabase 確認 stock_metadata 表格。")