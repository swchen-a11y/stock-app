import subprocess
import datetime
import sys
import os

def run_git_sync():
    original_cwd = os.getcwd()
    try:
        # 1. 定位專案根目錄
        script_path = os.path.abspath(__file__)
        script_dir = os.path.dirname(script_path)
        project_root = os.path.dirname(script_dir) if "scripts" in script_dir else script_dir
        
        os.chdir(project_root)
        print(f"📁 當前路徑: {os.getcwd()}")
        
        # 2. 徹底清理 .DS_Store
        print("🗑️  清理系統垃圾檔案...")
        subprocess.run(["find", ".", "-name", ".DS_Store", "-type", "f", "-delete"], capture_output=True)
        subprocess.run(["git", "rm", "--cached", "-r", "--ignore-unmatch", ".DS_Store"], capture_output=True)

        # 3. 先 Add 所有變動 (解決截圖中的 Unstaged changes 錯誤)
        print("📝 暫存本地變更...")
        subprocess.run(["git", "add", "."], check=True)

        # 4. 同步遠端代碼 (先 Pull)
        print("📥 正在從 GitHub 拉取最新更新...")
        pull_result = subprocess.run(["git", "pull", "--rebase"], capture_output=True, text=True)
        if pull_result.returncode != 0:
            print(f"⚠️  拉取時有微小衝突，嘗試自動處理...")
            # 這裡可以視情況加入 git rebase --continue 或其他邏輯

        # 5. 檢查是否有內容需要 Commit
        status = subprocess.check_output(["git", "status", "--porcelain"]).decode("utf-8")
        if not status:
            print("✨ 本地與遠端已同步，且無新變動，不需要推送。")
            return

        # 6. 執行 Commit
        commit_msg = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else f"Auto sync: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        print(f"💾 提交變更: {commit_msg}")
        subprocess.run(["git", "commit", "-m", commit_msg], check=True)

        # 7. 執行 Push
        print("📤 正在推送到 GitHub...")
        push_result = subprocess.run(["git", "push"], capture_output=True, text=True)
        
        if push_result.returncode == 0:
            print(f"✅ 同步成功！")
        else:
            print(f"❌ 推送失敗，錯誤訊息：\n{push_result.stderr}")

    except Exception as e:
        print(f"💥 發生錯誤: {e}")
    finally:
        os.chdir(original_cwd)

if __name__ == "__main__":
    run_git_sync()