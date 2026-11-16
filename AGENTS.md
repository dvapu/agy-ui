# AGENTS.md — Đọc file này TRƯỚC KHI làm bất cứ gì

> Dành cho mọi AI agent (dù yếu đến đâu). Đọc hết file này, làm đúng thứ tự,
> không tự sáng tạo kiến trúc mới.

---

## 0. Đây là cái gì

**Antigravitinho** = app Electron cho Windows, gắn **hình nền ASCII động + linh vật
chữ A** lên cửa sổ **Antigravity (AGY)** thật.

Thư mục: `C:\Users\b\.gemini\antigravity\scratch\antigravitinho`
Repo: `https://github.com/dvapu/agy-ui`

**Không có cửa sổ chat riêng.** App nằm dưới khay hệ thống và vẽ vào chính AGY.

---

## 1. Quy tắc bất di bất dịch (đọc kỹ, đừng bỏ qua)

1. **KHÔNG BAO GIỜ đụng vào DB của Antigravity.**
   Đường dẫn cấm đọc/ghi/xoá:
   - `C:\Users\b\.gemini\antigravity\conversations\*.db`
   - `C:\Users\b\.gemini\antigravity\conversation_summaries.db`
   - `C:\Users\b\.gemini\antigravity\brain\**`
   - `C:\Users\b\AppData\Roaming\Antigravity\**`

   App chỉ **đọc** `%APPDATA%\Antigravity\DevToolsActivePort` (một dòng chứa số
   cổng) và **ghi DOM** vào trang AGY. Không có gì khác.

2. **Không được gọi API nội bộ của AGY.** Chỉ dùng Chrome DevTools Protocol
   (`Runtime.evaluate`) để chèn DOM.

3. **Không deploy lên NAS** (`192.168.1.200`) trừ khi người dùng nói rõ.

4. **Không xoá file** của người dùng khi chưa hỏi. Comment tiếng Việt, giữ
   nguyên văn phong hiện có.

5. **Chạy test trước khi báo xong.** Không được nói "đã hoạt động" khi chưa
   chạy lệnh kiểm tra.

6. **Đừng dùng PowerShell để sửa file có tiếng Việt.** `-replace` +
   `Set-Content` làm hỏng encoding thành `EF BF BD`. Dùng công cụ sửa file.

---

## 2. Kiến trúc trong 30 giây

```
Khay hệ thống (Tray)
      │
      │  src/main.js ──► src/agy-bridge.js ──CDP WebSocket──► Antigravity thật
      │                        │
      │                        └─ src/injector.js (sinh một chuỗi JS tự chứa)
      │                                 │
      │                                 └─ gộp 3 engine:
      │                                      lagoon-engine.js + themes-engine.js + mascot-a.js
      │
      └── không có cửa sổ nào. Không preload, không IPC.
```

- `src/main.js` — tiến trình chính: khay, menu, phím tắt, vòng theo dõi 3 giây,
  single-instance lock, `app.setLoginItemSettings` cho "khởi động cùng Windows".
- `src/agy-bridge.js` — **cầu CDP tự viết** (không dùng thư viện ngoài). Đọc cổng
  debug, mở WebSocket tay, gọi `Runtime.evaluate`.
- `src/injector.js` — sinh chuỗi JS tự chứa để chèn vào AGY. Đây là nơi duy nhất
  quyết định lớp phủ trông thế nào.
- `src/renderer/*` — các engine vẽ (được nhúng vào chuỗi chèn, **không** nạp bằng
  `<script>`).

### Bẫy kỹ thuật đã gặp (đừng lặp lại)

1. **`requestAnimationFrame` KHÔNG chạy khi cửa sổ bị che.**
   Chromium dừng hẳn rAF khi `document.hidden === true`. Vì vậy engine phải dùng
   `startBangInterval()` / `batDauBangInterval()`.

2. **Gỡ lớp phủ phải DỪNG vòng lặp trước khi tháo DOM.**
   Chỉ `remove()` thì `setInterval` 24fps của hình nền và 30fps của mascot vẫn
   chạy tiếp trên canvas đã rời DOM. Gắn/gỡ vài lần là chúng chồng nhau, cả
   Antigravity lag. Vì vậy có `box.__huy()` — nó gọi `engine.stop()`,
   `mv.dung()`, gỡ listener trên `window`, rồi mới tháo DOM.
   Đo thật: 8.23s CPU/5s → 0.80s CPU/5s sau khi sửa.

3. **Listener trên `window` không tự chết khi tháo DOM.** Luôn ghi vào sổ
   (`boNghe`) và gỡ trong `__huy()`.

4. **Cổng CDP đổi mỗi lần AGY khởi động** (2555, 7634, …). Luôn đọc lại
   `DevToolsActivePort`, không hard-code.

5. **Đổi chủ đề phải vẽ ngay một khung.** `setTheme()` xoá canvas; nếu chỉ trông
   vào vòng lặp 24fps để vẽ lại thì lúc cửa sổ bị che Chromium bóp timer xuống
   ~1 khung/giây và canvas trống hàng chục giây. `setTheme()` gọi
   `veMotKhung(0)` trước khi trả về.

6. **Canvas của hai nhánh vẽ có kích thước khác nhau.** Lagoon vẽ ở toạ độ cứng
   1944×1760 rồi CSS phóng; engine lưới ký tự vẽ đúng tỉ lệ cửa sổ (nếu không
   phần chân cảnh bị cắt). `datKichThuoc()` lo việc đổi qua lại.

7. **Lưới ký tự là chỗ tốn CPU nhất.** `fillText` từng ô rất đắt: 4600 ô tốn
   13.6ms/khung. Đổi sang 18×26 + siêu mẫu 2×2 (1560 ô) là CPU về mức không đo
   được, chất lượng không đổi. Đừng tăng lại `cw`/`ch`/`ss` mà không đo.

8. **Lớp phủ nằm TRÊN chữ AGY → không được tô nền đặc.** Bản gốc engine luôn
   gọi `theme.bg()` (fillRect kín màn hình). Với lớp phủ phải tắt: `veNen: false`.
   Nếu bật, cả màn hình thành một màu và chữ trắng biến mất.

9. **`destination-out` bị nhân với `globalAlpha` hiện tại.** Xoá vùng chừa bên
   trong lớp `save()` đã hạ alpha 0.45 thì chỉ xoá được 45%. Phải đặt
   `globalAlpha = 1` trước khi xoá.

10. **Engine con không được ghi đè `globalAlpha`.** `LagoonEngine.cells()` từng
    đặt `globalAlpha = 0.42` rồi `= 1` ở cuối, phá sạch độ đậm và hệ số giảm
    sáng của lớp ngoài. Phải NHÂN vào alpha hiện có rồi khôi phục lại.

11. **Đo độ sáng phải composite lên nền.** Điểm ảnh trắng nhưng alpha 40 thì
    mắt thấy xám. Đo RGB gốc sẽ kết luận sai là "chữ bị che".

12. **Thanh trên của AGY là HAI dải, không phải một.** `0–35` là menu bar
    (`div.shrink-0`), `35–75` là thanh tab (`[class*="@container/titlebar"]`).
    Thanh tab có nền **trong suốt** (`rgba(0,0,0,0)`) nên lớp phủ đè thẳng lên
    tên tab và nút Open IDE nếu chỉ chừa 35px. Đo thật: bị phủ 14.3%.

13. **id có dấu chấm phải viết `[id="..."]`.** Ô nhập tin của AGY có id
    `antigravity.agentSidePanelInputBox`. Selector `#antigravity.agentSidePanelInputBox`
    bị hiểu thành id `antigravity` + class `agentSidePanelInputBox` nên **không
    bao giờ khớp** — phép đo chưa từng chạy, luôn rơi về số cứng 90.

14. **Đừng dùng selector rộng khi làm trong suốt nền AGY.** `[class*="bg-background"]`
    trúng cả bảng markdown, bubble chat, code block -> chữ mất nền, khó đọc.
    Danh sách đúng chỉ có 5 lớp nền: `.agy-inset-shell`,
    `[data-main-content-body="true"]`, `[data-side-panel-body="true"]`,
    `.bg-sidebar`, `[data-testid="subagent-tab-sidebar"]`. Panel nổi
    (`[data-testid="overview-panel-host-sibling"]`, `[role="dialog"]`) phải GIỮ nền.

15. **Không gọi API nội bộ của AGY.** `window.electronNative.setTitleBarOverlay`,
    `wcvBrowser.*` (WebContentsView) đều tồn tại nhưng thuộc AGY — dùng là vi
    phạm quy tắc 2. Chỉ đọc DOM, ghi CSS/canvas qua `Runtime.evaluate`.

16. **Browser pane là `WebContentsView` native.** Khi mở Browser, AGY đặt
    `body[data-has-browser-hole="true"]` và khung trên `[data-browser-hole]`.
    View native thường nằm TRÊN DOM, nhưng khi AGY hạ nó xuống thì lớp phủ che
    trang web — nên `doLoBrowser()` khoét lỗ bằng `destination-out`.

---

## 3. Cấu trúc thư mục

```
antigravitinho/
├── Antigravitinho.bat / .vbs    # chạy từ mã nguồn
├── assets/                      # icon, logo chữ A
├── src/
│   ├── main.js
│   ├── agy-bridge.js
│   ├── injector.js
│   ├── chan-dialog.js           # chặn spam hộp thoại
│   └── renderer/
│       ├── mascot-a.js
│       ├── themes-engine.js     # bộ điều phối hai nhánh vẽ
│       ├── ascii-themes.js      # engine lưới ký tự + 15 chủ đề (từ Claudinho, MIT)
│       └── lagoon-engine.js
├── tools/                       # test + script sinh icon, shortcut
├── test/syntax.test.js          # test cú pháp + hợp đồng module
├── docs/                        # tài liệu (xem docs/README.md)
└── dist/                        # sản phẩm đóng gói (không commit)
```

### Thêm một chủ đề mới

1. Thêm khoá vào `TEN_THEME` trong `src/injector.js` (nhãn tiếng Việt).
2. Thêm ánh xạ khoá → id theme trong `BANG_CHU_DE`
   (`src/renderer/themes-engine.js`).
3. Nếu dùng engine lưới ký tự: thêm object theme vào `src/renderer/ascii-themes.js`
   (phải có `bg`, `scene`, `grid`, `accent`).
4. Chạy `npm test` — test sẽ báo nếu thiếu ánh xạ hoặc theme trỏ tới id không có.
5. Chạy `tools/test-chu-de.mjs` — nó đo điểm ảnh thật, bắt theme "chết".

Dock và menu khay tự sinh từ `TEN_THEME`, không phải sửa tay ở hai nơi.

---

## 4. Cách chạy & kiểm tra

```powershell
cd C:\Users\b\.gemini\antigravity\scratch\antigravitinho
npm install          # lần đầu
npm start            # chạy app
npm test             # test nhanh (cú pháp + hợp đồng + chặn dialog)
```

Test đầy đủ (cần Electron):

```powershell
.\node_modules\electron\dist\electron.exe tools\test-inject.mjs     # 20 muc
.\node_modules\electron\dist\electron.exe tools\test-gan-lai.mjs    # 28 muc
.\node_modules\electron\dist\electron.exe tools\test-tuong-tac.mjs  # 13 muc
.\node_modules\electron\dist\electron.exe tools\test-khay.mjs       # 13 muc
.\node_modules\electron\dist\electron.exe tools\test-chu-de.mjs     # 64 muc
.\node_modules\electron\dist\electron.exe tools\test-khong-che-chu.mjs  # 73 muc
.\node_modules\electron\dist\electron.exe tools\test-menu.mjs       # 9 muc
```

Xem hình nền bằng mắt (ra `dist-anh/<chu-de>.png`):

```powershell
.\node_modules\electron\dist\electron.exe tools\render-themes.js
```

Kiểm tra kết nối tới AGY thật (cần AGY đang mở):

```powershell
node tools/kiem-tra-cong.js
```

---

## 5. Phong cách code

- Chuỗi hiển thị cho người dùng: **tiếng Việt**.
- Tên biến/hàm: tiếng Việt không dấu (`chuDe`, `doDam`, `ganVaoAgy`) hoặc
  tiếng Anh — nhưng **phải nhất quán trong một file**.
- Comment: tiếng Việt, giải thích **vì sao**, không phải "cái này làm gì".
- Không thêm thư viện ngoài nếu tự viết được < 200 dòng (xem `agy-bridge.js`).
  Hiện `dependencies` để trống.

---

## 6. Khi bị kẹt

1. Chạy `npm test` — bắt lỗi cú pháp và lệch hợp đồng module.
2. Kiểm tra AGY có đang chạy không: `Get-Process Antigravity`.
3. Kiểm tra cổng: `Get-Content "$env:APPDATA\Antigravity\DevToolsActivePort"`.
4. Nếu vẫn kẹt: **dừng lại và báo người dùng**, đừng đoán mò rồi sửa DB.
