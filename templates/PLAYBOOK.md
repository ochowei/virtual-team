# Virtual Team Playbook

> **注意**：本文件是虛擬團隊的系統設定文件。
> PM 與 Coder 均**不得修改**本文件。

---

## 什麼是虛擬團隊？

虛擬團隊是一套以 AI 驅動的自動化開發框架。透過 `loop.sh` 指令碼，讓 PM（AI 專案經理）與 Coder（AI 軟體工程師）自動輪流工作，直到 `GOALS.md` 中所有任務完成為止。

整個框架只依賴：
- **Node.js** — 執行專案
- **Git** — 版本控制
- **`claude` CLI** — 驅動 AI 成員

---

## 團隊角色

### 👑 人類管理員 (Human Admin)
- 負責高階決策與專案初始化
- 定義 `.virtual-team/GOALS.md` 中的 Epic 與 Task
- 啟動與監控自動化迴圈
- 當 AI 無法自行解決問題時介入處理

### 👔 專案經理 (PM — AI Agent)
- **職責**：規劃與管理，不寫程式碼
- **行為**：讀取 `GOALS.md`，更新任務進度，挑選下一個優先任務，將完整規格寫入 `CURRENT_TASK.md`
- **產出**：`CURRENT_TASK.md`（任務規格）、`.commit_msg`（提交訊息）、`PM_DONE`（完成信號）

### 💻 軟體工程師 (Coder — AI Agent)
- **職責**：執行任務與撰寫程式碼
- **行為**：讀取 `CURRENT_TASK.md`，實作功能，執行驗證指令，回報結果
- **產出**：專案原始碼、`.commit_msg`（提交訊息）、`CODER_DONE`（完成信號）

---

## 開發迴圈流程

```
開始
  ↓
[檢查 GOALS.md] — 若無 [TODO] 或 [IN PROGRESS] → 完成，結束
  ↓
[PM 階段]
  - 讀取 GOALS.md，驗證上一個任務是否完成
  - 更新任務狀態（[DONE] / [TODO] / [IN PROGRESS]）
  - 挑選下一個 [TODO] 任務，寫入 CURRENT_TASK.md
  - 建立 PM_DONE 信號檔
  - loop.sh 自動 git commit
  ↓
[冷卻休息] — 預設 10 分鐘（避免 API Rate Limit）
  ↓
[Coder 階段]
  - 讀取 CURRENT_TASK.md，檢查前置條件
  - 實作功能，執行驗證指令（build / test / lint）
  - 在 CURRENT_TASK.md 底部寫入實作進度回報
  - 建立 CODER_DONE 信號檔
  - loop.sh 自動 git commit
  ↓
[冷卻休息] — 預設 10 分鐘
  ↓
回到開始
```

---

## 安全與中斷機制

| 機制 | 說明 |
|------|------|
| **任務完成偵測** | `GOALS.md` 中無 `[TODO]` 或 `[IN PROGRESS]` 時自動結束 |
| **截斷偵測** | 若 PM/Coder 沒有產生完成信號檔，判定被 max-turns 截斷，回滾並重試 |
| **防卡死機制** | 連續 3 次沒有任何 git diff 變更，強制中斷迴圈 |
| **人類協助請求** | AI 建立 `HUMAN_NEEDED.md` 時，迴圈暫停並通知人類介入 |
| **API 錯誤容錯** | 遇到 API 限制或網路中斷，等待後重試，不直接崩潰 |

---

## 資料夾內容說明

| 檔案 | 用途 |
|------|------|
| `PLAYBOOK.md` | 本文件，虛擬團隊操作手冊（系統文件，不得修改） |
| `GOALS.md` | 專案任務清單，由人類管理員初始化，PM 維護狀態 |
| `GOALS_TEMPLATE.md` | 建立新專案 GOALS.md 的空白模板與 AI 生成提示詞 |
| `INTENT_SPEC_TEMPLATE.md` | PM 撰寫 CURRENT_TASK.md 時的規格模板 |
| `loop.sh` | 主要自動化腳本（需複製到上層目錄執行） |
| `prompts/pm.txt` | PM 的系統提示詞 |
| `prompts/coder.txt` | Coder 的系統提示詞 |
| `CURRENT_TASK.md` | 執行期間建立，PM 寫規格、Coder 寫回報 |
| `HUMAN_NEEDED.md` | 執行期間建立，AI 請求人類協助時出現 |

---

## 如何啟動

### 前置需求

- Node.js（執行專案）
- Git
- `claude` CLI 已安裝並完成 API 驗證

### 步驟

1. **準備 GOALS.md**：參考 `GOALS_TEMPLATE.md`，為你的專案建立任務清單

2. **複製腳本到上層目錄**（避免 AI 意外修改執行中的腳本）：
   ```bash
   cp .virtual-team/loop.sh ../
   ```

3. **確認你在專案根目錄**：
   ```bash
   pwd  # 應顯示你的專案根目錄路徑
   ```

4. **啟動虛擬團隊**：
   ```bash
   ../loop.sh
   ```

5. **觀察輸出**：腳本會印出時間戳記與每個階段的進度

### 人類介入

當迴圈暫停並顯示 `HUMAN_NEEDED.md` 時：

1. 閱讀 `.virtual-team/HUMAN_NEEDED.md` 了解問題
2. 解決問題（修改設定、提供資訊、調整 GOALS.md 等）
3. 刪除 `.virtual-team/HUMAN_NEEDED.md`
4. 重新執行 `../loop.sh`

---

## 調整參數

在 `loop.sh` 頂部可調整以下變數：

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `SLEEP_TIME` | `600` | PM/Coder 工作後的冷卻秒數 |
| `ERROR_SLEEP_TIME` | `300` | API 錯誤後的等待秒數 |
| `STUCK_LIMIT` | `3` | 判定卡住前允許的連續無變更次數 |
| `PM_MAX_TURNS` | `45` | PM 的最大對話輪數 |
| `CODER_MAX_TURNS` | `65` | Coder 的最大對話輪數 |

---

## 移植到其他專案

1. 複製整個 `.virtual-team/` 資料夾到新專案根目錄
2. 根據新專案建立 `GOALS.md`（參考 `GOALS_TEMPLATE.md`）
3. 依照上方「如何啟動」步驟執行

所有其他設定（prompts、loop.sh 邏輯）均為通用設計，無需修改即可直接使用。
