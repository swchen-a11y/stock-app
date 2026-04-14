import subprocess
import datetime
import sys
import os

def run_git_sync():
    original_cwd = os.getcwd()
    try:
        script_path = os.path.abspath(__file__)
        script_dir = os.path.dirname(script_path)
        project_root = os.path.dirname(script_dir) if "scripts" in script_dir else script_dir
        os.chdir(project_root)
        
        # 核心檢查：檢查本地是否領先於遠端 (有 commit 但沒 push)
        unpushed = subprocess.check_output(["git", "cherry", "-v"]).decode("utf-8")
        status = subprocess.check_output(["git", "status", "--porcelain"]).decode("utf-8")
        
        if not status and not unpushed:
            print("✨ 本地與遠端已完全同步，且無新變動。")
            return

        print("🚀 發現變動或尚未推送的提交，開始同步...")

        # 先清理並添加變更
        subprocess.run(["git", "add", "."], check=True)
        
        # 執行 Commit (如果有變動的話)
        if status:
            commit_msg = f"Auto sync: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            subprocess.run(["git", "commit", "-m", commit_msg], check=True)

        # 執行強效 Push
        print("📤 正在推送到 GitHub...")
        result = subprocess.run(["git", "push", "origin", "main", "--force"], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ 強制同步成功！請刷新 GitHub 頁面確認。")
        else:
            print(f"❌ 推送依賴失敗: {result.stderr}")

    except Exception as e:
        print(f"💥 錯誤: {e}")
    finally:
        os.chdir(original_cwd)

if __name__ == "__main__":
    run_git_sync()