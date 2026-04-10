import subprocess
import datetime
import sys
import os

def run_git_sync():
    try:
        # 獲取當前腳本所在目錄的父目錄（專案根目錄）
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(script_dir)
        
        # 切換到專案根目錄
        original_cwd = os.getcwd()
        os.chdir(project_root)
        
        print(f"📁 切換到專案根目錄: {project_root}")
        
        # 1. 檢查是否有變動
        status = subprocess.check_output(["git", "status", "--porcelain"]).decode("utf-8")
        if not status:
            print("✨ 沒發現任何變動，不需要同步。")
            os.chdir(original_cwd)
            return

        print("🚀 開始同步至 GitHub...")
        print(f"Git 狀態:\n{status}")

        # 2. 先添加所有變更
        subprocess.run(["git", "add", "."], check=True)
        
        # 3. 檢查是否有 .DS_Store 檔案，如果有則移除
        try:
            ds_store_files = subprocess.check_output(["git", "ls-files", "--others", "--exclude-standard"]).decode("utf-8")
            if ".DS_Store" in ds_store_files or any(".DS_Store" in line for line in ds_store_files.split('\n')):
                print("🗑️  發現 .DS_Store 檔案，正在移除...")
                # 刪除 .DS_Store 檔案
                subprocess.run(["find", ".", "-name", ".DS_Store", "-type", "f", "-delete"], capture_output=True)
                # 從 Git 暫存區移除 .DS_Store
                subprocess.run(["git", "rm", "--cached", "-r", "--ignore-unmatch", "*.DS_Store"], capture_output=True)
                subprocess.run(["git", "rm", "--cached", "-r", "--ignore-unmatch", "**/.DS_Store"], capture_output=True)
        except Exception as e:
            print(f"⚠️  處理 .DS_Store 時發生錯誤: {e}")
        
        # 4. 再次檢查狀態
        status_after = subprocess.check_output(["git", "status", "--porcelain"]).decode("utf-8")
        if not status_after:
            print("ℹ️  移除 .DS_Store 後沒有其他變更需要提交。")
            os.chdir(original_cwd)
            return

        # 5. git commit
        # 如果運行時有帶參數，就當作 commit message，否則用預設時間
        commit_msg = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else f"Auto sync: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        subprocess.run(["git", "commit", "-m", commit_msg], check=True)

        # 6. git push
        # 這裡預設推送到當前分支
        result = subprocess.run(["git", "push"], capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ 同步成功！\n備註: {commit_msg}")
        else:
            print(f"❌ 推送失敗，錯誤訊息：\n{result.stderr}")
            print("💡 提示: 如果這是第一次推送，可能需要先設定遠端倉庫:")
            print("  git remote add origin <你的倉庫URL>")
            print("  git push -u origin main")

        # 切換回原始目錄
        os.chdir(original_cwd)

    except subprocess.CalledProcessError as e:
        print(f"💥 執行過程中發生 Git 錯誤: {e}")
        # 嘗試切換回原始目錄
        try:
            os.chdir(original_cwd)
        except:
            pass
    except Exception as e:
        print(f"⚠️ 發生未知錯誤: {e}")
        # 嘗試切換回原始目錄
        try:
            os.chdir(original_cwd)
        except:
            pass

if __name__ == "__main__":
    run_git_sync()