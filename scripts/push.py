import subprocess
import datetime
import sys
import os

def run_git_sync():
    original_cwd = os.getcwd()
    try:
        # 1. 定位專案根目錄 (適配 scripts 資料夾)
        script_path = os.path.abspath(__file__)
        script_dir = os.path.dirname(script_path)
        project_root = os.path.dirname(script_dir) if "scripts" in script_dir else script_dir
        
        os.chdir(project_root)
        print(f"📁 當前專案路徑: {os.getcwd()}")
        
        # 2. 徹底移除 .DS_Store
        subprocess.run(["find", ".", "-name", ".DS_Store", "-type", "f", "-delete"], capture_output=True)
        subprocess.run(["git", "rm", "--cached", "-r", "--ignore-unmatch", ".DS_Store"], capture_output=True)

        # 3. 暫存所有本地變更 (包含您的 AI 邏輯修正)
        print("📝 正在暫存本地變更...")
        subprocess.run(["git", "add", "."], check=True)

        # 4. 強效同步 (解決 non-fast-forward 與無關歷史問題)
        print("📥 正在從 GitHub 強制同步數據...")
        # 使用 -X ours 策略：發生衝突時保留您的代碼修改
        pull_cmd = ["git", "pull", "origin", "main", "--rebase", "--allow-unrelated-histories", "-X", "ours"]
        pull_result = subprocess.run(pull_cmd, capture_output=True, text=True)
        
        if pull_result.returncode != 0:
            print(f"⚠️ 同步提醒: {pull_result.stderr.strip()}")

        # 5. 檢查是否有需要提交的內容
        status = subprocess.check_output(["git", "status", "--porcelain"]).decode("utf-8")
        if not status:
            print("✨ 本地與遠端已完全同步，無須更新。")
            return

        # 6. 執行 Commit
        commit_msg = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else f"Auto sync: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        print(f"💾 提交變更: {commit_msg}")
        subprocess.run(["git", "commit", "-m", commit_msg], check=True)

        # 7. 推送到 GitHub
        print("📤 正在推送至 GitHub 倉庫...")
        push_result = subprocess.run(["git", "push", "origin", "main"], capture_output=True, text=True)
        
        if push_result.returncode == 0:
            print(f"✅ 同步成功！代碼已安全上傳。")
        else:
            print(f"❌ 推送依賴失敗。錯誤訊息:\n{push_result.stderr}")
            print("💡 建議: 如果持續失敗，請嘗試執行 'git push origin main --force' (請謹慎使用)")

    except Exception as e:
        print(f"💥 腳本執行中斷: {e}")
    finally:
        os.chdir(original_cwd)

if __name__ == "__main__":
    run_git_sync()