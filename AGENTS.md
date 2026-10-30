# AGENTS.md — Đọc file này TRƯỚC KHI làm bất cứ gì

> Dành cho mọi AI agent (dù yếu đến đâu). Đọc hết file này, làm đúng thứ tự,
> không tự sáng tạo kiến trúc mới.

---

## 0. Đây là cái gì

**Antigravitinho** = app Electron cho Windows, gắn **hình nền ASCII động + linh vật
rùa Honu** lên cửa sổ **Antigravity (AGY)** thật.

Thư mục: `C:\Users\b\.gemini\antigravity\scratch\agy-ui`
Repo: `https://github.com/dvapu/agy-ui`

---

## 1. Quy tắc bất di bất dịch (đọc kỹ, đừng bỏ qua)

1. **KHÔNG BAO GIỜ đụng vào DB của Antigravity.**
   Đường dẫn cấm đọc/ghi/xoá:
   - `C:\Users\b\.gemini\antigravity\conversations\*.db`
   - `C:\Users\b\.gemini\antigravity\conversation_summaries.db`
   - `C:\Users\b\.gemini\antigravity\brain\**`
   - `C:\Users\b\AppData\Roaming\Antigravity\**`

   App này chỉ **đọc** `%APPDATA%\Antigravity\DevToolsActivePort` (1 dòng chứa số
   cổng) và **ghi DOM** vào trang AGY. Không có gì khác.

2. **Không được gọi API nội bộ của AGY.** Chỉ dùng Chrome DevTools Protocol
   (`Runtime.evaluate`) để chèn DOM. Đó là cách duy nhất được phép.

3. **Không deploy lên NAS** (`192.168.1.200`) trừ khi người dùng nói rõ.

4. **Không xoá file** của người dùng khi chưa hỏi. Comment tiếng Việt, giữ
   nguyên văn phong hiện có.

5. **Chạy `npm test` trước khi báo xong.** Không được nói "đã hoạt động" khi
   chưa chạy lệnh kiểm tra.

---

## 2. Kiến trúc trong 30 giây

```
Electron app (cửa sổ chat riêng)
        │
        │  src/main.js  ── IPC ──► src/agy-bridge.js ──CDP──► Antigravity thật
        │                              │
        │                              └─ src/injector.js (sinh code chèn)
        │
        └── src/renderer/index.html + app.js + themes-engine.js + lagoon-engine.js + mascot.js
```

- `src/main.js` — tiến trình chính. Tạo cửa sổ chat, xử lý IPC, gọi AI.
- `src/agy-bridge.js` — **cầu CDP tự viết** (không dùng thư viện ngoài). Đọc cổng
  debug từ `DevToolsActivePort`, mở WebSocket tay, gửi `Runtime.evaluate`.
- `src/injector.js` — sinh một chuỗi JS tự chứa (gộp `lagoon-engine.js` +
  `themes-engine.js` + `mascot.js`) để chèn vào AGY.
- `src/renderer/*` — UI của cửa sổ chat + toàn bộ engine vẽ ASCII.

### Hai chế độ hiển thị (đừng lẫn lộn)

| Chế độ | Cửa sổ | Dính vào AGY? | Dùng khi nào |
|---|---|---|---|
| **Gắn vào AGY** (chính) | Không tạo cửa sổ mới — chèn DOM vào AGY | ✅ Có. Di chuyển/resize/thu nhỏ đều theo | Dùng hàng ngày |
| **Overlay nổi** (phụ) | Cửa sổ trong suốt `alwaysOnTop` | ❌ Không | Khi muốn phủ lên app khác |

Nút trên thanh tiêu đề: **🐢 Gắn vào Antigravity** → chế độ chính.

---

## 3. Vì sao Claudinho đè lên Claude Code được mà bản cũ không đè lên AGY

Đây là câu hỏi gốc của dự án. Trả lời ngắn:

- **Claudinho** không "đè" Claude Code. Nó **thay thế** Claude Code: nó gọi
  `@anthropic-ai/claude-agent-sdk` để chạy agent, rồi tự vẽ UI. Claude Code
  không có cửa sổ riêng để đè.
- **Antigravity** thì có cửa sổ riêng (Electron). Muốn có hình nền thì phải chèn
  **vào bên trong** cửa sổ đó, hoặc phủ một cửa sổ trong suốt lên trên.

Bản đầu tiên chỉ làm cách 2 (cửa sổ nổi) → lệch, che nội dung, mở app là mất DB
cảm giác. Cách đúng là cách 1: **chèn DOM vào chính AGY**. Đó là `agy-bridge.js`.

### Bẫy kỹ thuật đã gặp (đừng lặp lại)

**`requestAnimationFrame` KHÔNG chạy khi cửa sổ bị che.**
Khi AGY bị cửa sổ khác che, `document.hidden === true` và Chromium **dừng hẳn**
rAF → hình nền đứng im. Đã đo được: rAF = 0 tick/1.6s, còn `setInterval` = 2 tick.

→ Khi chèn vào AGY **phải dùng `startBangInterval()` / `renderBangInterval()`**,
không dùng `start()`.

---

## 4. Việc cần làm (đọc `docs/TASKS.md`)

Danh sách task chưa xong nằm ở `docs/TASKS.md`, mỗi task ghi rõ:
- File nào sửa
- Sửa cái gì (chép nguyên đoạn code mẫu)
- Cách kiểm tra đã xong

**Làm theo thứ tự T1 → T2 → ... Không nhảy cóc.**

---

## 5. Cách chạy & kiểm tra

```powershell
cd C:\Users\b\.gemini\antigravity\scratch\agy-ui
npm install          # lần đầu
npm start            # mở app
npm test             # BẮT BUỘC chạy trước khi báo xong
```

Kiểm tra chế độ gắn thật (cần AGY đang mở):

```powershell
node test/gan-agy.test.js
```

Nếu báo `Không kết nối được Antigravity`: mở app Antigravity trước, rồi chạy lại.
AGY chỉ mở cổng debug khi đang chạy.

---

## 6. Hợp đồng IPC (đừng đổi tên hàm)

Mọi thứ renderer gọi đều qua `window.agy.*`, khai báo ở `src/preload.cjs`.
Danh sách đầy đủ: `docs/API-IPC.md`.

**Nếu thêm hàm mới:**
1. Thêm `ipcMain.handle("ten-khong-dau", ...)` trong `src/main.js`
2. Thêm `tenKhongDau: () => ipcRenderer.invoke("ten-khong-dau")` trong `src/preload.cjs`
3. Ghi vào `docs/API-IPC.md`

Tên kênh: **gạch nối, không dấu**. Tên hàm JS: **camelCase, không dấu**.

---

## 7. Phong cách code

- Chuỗi hiển thị cho người dùng: **tiếng Việt**.
- Tên biến/hàm: tiếng Việt không dấu (`chuDe`, `doDam`, `ganVaoAgy`) hoặc
  tiếng Anh — nhưng **phải nhất quán trong một file**.
- Comment: tiếng Việt, giải thích **vì sao**, không phải "cái này làm gì".
- Không thêm thư viện ngoài nếu tự viết được < 200 dòng (xem `agy-bridge.js`).

---

## 8. Khi bị kẹt

1. Đọc `docs/KIEN-TRUC.md` — giải thích chi tiết luồng dữ liệu.
2. Chạy `node test/syntax.test.js` — bắt lỗi cú pháp.
3. Kiểm tra AGY có đang chạy không: `Get-Process Antigravity`.
4. Kiểm tra cổng: `Get-Content "$env:APPDATA\Antigravity\DevToolsActivePort"`.
5. Nếu vẫn kẹt: **dừng lại và báo người dùng**, đừng đoán mò rồi sửa DB.
