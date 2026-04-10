import subprocess
import datetime
import sys

def run_git_sync():
    try:
        # 1. 檢查是否有變動
        status = subprocess.check_output(["git", "status", "--porcelain"]).decode("utf-8")
        if not status:
            print("✨ 沒發現任何變動，不需要同步。")
            return

        print("🚀 開始同步至 GitHub...")

        # 2. git add .
        subprocess.run(["git", "add", "."], check=True)

        # 3. git commit
        # 如果運行時有帶參數，就當作 commit message，否則用預設時間
        commit_msg = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else f"Auto sync: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        subprocess.run(["git", "commit", "-m", commit_msg], check=True)

        # 4. git push
        # 這裡預設推送到當前分支
        result = subprocess.run(["git", "push"], capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ 同步成功！\n備註: {commit_msg}")
        else:
            print(f"❌ 推送失敗，錯誤訊息：\n{result.stderr}")

    except subprocess.CalledProcessError as e:
        print(f"💥 執行過程中發生 Git 錯誤: {e}")
    except Exception as e:
        print(f"⚠️ 發生未知錯誤: {e}")

if __name__ == "__main__":
    run_git_sync()