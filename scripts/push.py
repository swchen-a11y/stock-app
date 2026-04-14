import subprocess
import datetime
import sys
import os

def run_git_sync():
    original_cwd = os.getcwd()
    try:
        # 1. 自動定位專案根目錄 (假設 push.py 位於 scripts/ 資料夾下)
        script_path = os.path.abspath(__file__)
        script_dir = os.path.dirname(script_path)
        # 如果腳本在 scripts 子目錄，父目錄就是專案根目錄
        project_root = os.path.dirname(script_dir) if "scripts" in script_dir else script_dir
        
        os.chdir(project_root)
        print(f"📁 當前路徑: {os.getcwd()}")
        print(f"🚀 開始檢查變動...")

        # 2. 檢查是否有變動
        status = subprocess.check_output(["git", "status", "--porcelain"]).decode("utf-8")
        
        # 3. 先進行同步 (解決截圖中的 non-fast-forward 衝突)
        print("📥 正在從 GitHub 拉取最新代碼 (Pull)...")
        subprocess.run(["git", "pull", "--rebase"], check=False)

        if not status:
            print("✨ 沒發現任何本地變動，同步完成。")
            return

        print(f"📝 發現變動:\n{status}")

        # 4. 移除討厭的 .DS_Store
        subprocess.run(["find", ".", "-name", ".DS_Store", "-type", "f", "-delete"], capture_output=True)
        subprocess.run(["git", "rm", "--cached", "-r", "--ignore-unmatch", "*.DS_Store"], capture_output=True)

        # 5. Git Add & Commit
        subprocess.run(["git", "add", "."], check=True)
        
        commit_msg = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else f"Auto sync: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        subprocess.run(["git", "commit", "-m", commit_msg], check=True)

        # 6. Git Push
        print("📤 正在推送到 GitHub...")
        result = subprocess.run(["git", "push"], capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ 同步成功！\n備註: {commit_msg}")
        else:
            if "non-fast-forward" in result.stderr or "fetch first" in result.stderr:
                print("❌ 推送失敗：遠端有更新。請嘗試執行 'git pull' 後再執行此腳本。")
            else:
                print(f"❌ 推送失敗：\n{result.stderr}")

    except subprocess.CalledProcessError as e:
        print(f"💥 Git 執行錯誤: {e}")
    except Exception as e:
        print(f"⚠️ 未知錯誤: {e}")
    finally:
        os.chdir(original_cwd)

if __name__ == "__main__":
    run_git_sync()