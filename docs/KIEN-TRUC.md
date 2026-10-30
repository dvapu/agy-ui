# Kiến trúc chi tiết

Tài liệu này giải thích **luồng dữ liệu thật** trong app, để agent không phải
đoán. Đọc kèm `AGENTS.md`.

---

## 1. Sơ đồ tổng thể

```
┌─────────────────────────────────────────────────────────────────┐
│  Electron main process  (src/main.js)                           │
│                                                                 │
│  • Tạo cửa sổ chat (BrowserWindow, frameless)                   │
│  • Đọc/ghi thiết lập: %APPDATA%\Antigravitinho\data\            │
│  • Gọi Gemini API (@google/genai) — tuỳ chọn                    │
│  • Chuyển tiếp IPC tới agy-bridge                               │
└───────────────┬─────────────────────────────────────────────────┘
                │  IPC (contextBridge)
┌───────────────▼─────────────────────────────────────────────────┐
│  Renderer (src/renderer/)                                       │
│                                                                 │
│  index.html ── app.js ──┬── themes-engine.js ── lagoon-engine.js│
│                         └── mascot.js                           │
└─────────────────────────────────────────────────────────────────┘
                │  khi bấm "Gắn vào Antigravity"
┌───────────────▼─────────────────────────────────────────────────┐
│  agy-bridge.js                                                  │
│                                                                 │
│  1. Đọc %APPDATA%\Antigravity\DevToolsActivePort  → cổng (vd 1236)│
│  2. GET http://127.0.0.1:1236/json/list          → tìm target     │
│  3. Mở WebSocket tay tới webSocketDebuggerUrl                    │
│  4. Gửi Runtime.evaluate với mã từ injector.js                   │
└───────────────┬─────────────────────────────────────────────────┘
                │  CDP
┌───────────────▼─────────────────────────────────────────────────┐
│  Antigravity (Electron thật)                                    │
│                                                                 │
│  DOM nhận thêm 1 <div id="__antigravitinho">                    │
│  → chứa canvas nền + Honu + dock                                │
│  → z-index 2147483000, pointer-events: none (trừ Honu/dock)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Vì sao dùng CDP mà không phải cách khác

| Cách | Vấn đề |
|---|---|
| Cửa sổ trong suốt `alwaysOnTop` | Lệch khi AGY di chuyển/resize. Che nội dung. Không "thuộc về" AGY. |
| Patch `app.asar` của AGY | Ghi đè file cài đặt. AGY tự cập nhật → mất patch. Rủi ro cao. |
| Viết extension cho AGY | AGY dùng Electron, không có API extension cho UI. |
| **CDP `Runtime.evaluate`** ✅ | Không sửa file. AGY tự cập nhật vẫn chạy. Chèn thẳng DOM. |

CDP là giao thức debug chuẩn của Chromium. AGY bật sẵn vì nó là app Electron
dev. Ta chỉ **dùng**, không **sửa** gì của AGY.

**Rủi ro cần biết:** nếu bản AGY sau này tắt `DevToolsActivePort` thì cầu này
chết. Khi đó phải quay lại chế độ overlay nổi. Đó là lý do vẫn giữ `overlay.html`.

---

## 3. WebSocket tự viết (src/agy-bridge.js)

Không dùng thư viện `ws` vì:
- Giảm dependency (app cài sẵn cần nhẹ)
- Chỉ cần ~120 dòng

### Cấu trúc frame WebSocket (RFC 6455)

```
byte 0: FIN(1) | RSV(3) | opcode(4)
byte 1: MASK(1) | payload-len(7)
  len < 126   → đọc thẳng
  len == 126  → 2 byte tiếp là độ dài (uint16 BE)
  len == 127  → 8 byte tiếp là độ dài (uint64 BE)
  nếu MASK=1 → 4 byte mask key, payload XOR với key lặp lại
```

Opcode dùng: `0x1` text, `0x8` close, `0x9` ping, `0xA` pong.

**Bẫy:** bắt tay HTTP 101 có thể trả kèm data frame trong cùng gói TCP. Phải
tách phần sau `\r\n\r\n` và đẩy lại vào bộ đệm, không được bỏ.

---

## 4. injector.js — sinh mã chèn

`taoMaInjection({ chuDe, doDam })` trả về **một chuỗi** (khoảng 47.000 ký tự).

Nó đọc 3 file engine, bỏ `import`/`export`, nhét vào trong một IIFE:

```js
(() => {
  const ID = "__antigravitinho";
  // ... tạo <style>, <div>, canvas
  // ... dán nguyên văn LagoonEngine, ThemesEngine, MascotHonu
  // ... khởi tạo: setCheDoPhu(true), startBangInterval(24)
})()
```

**Tại sao phải gộp?** Trang AGY không có module loader, cũng không được phép
nạp file từ đĩa (CSP). Cách duy nhất là gửi **toàn bộ code** qua
`Runtime.evaluate`.

**Tại sao `setCheDoPhu(true)`?** Chế độ phủ không vẽ nền đặc, chỉ vẽ các điểm
sáng ASCII. Nếu vẽ nền đặc thì nội dung AGY bị che → không đọc được.

**Tại sao `startBangInterval(24)`?** Xem mục 5.

---

## 5. Bẫy lớn nhất: rAF dừng khi cửa sổ bị che

Chromium tối ưu pin: khi `document.hidden === true` (cửa sổ bị che / thu nhỏ),
`requestAnimationFrame` **không gọi callback nữa**. Không phải chậm — mà là
**dừng hẳn**.

Số đo thật trên máy này:

| Cơ chế | Tick trong 1.6 giây |
|---|---|
| `requestAnimationFrame` | **0** |
| `setInterval(…, 50)` | 2 |

→ Trong AGY phải dùng `setInterval`. Đó là lý do có:
- `ThemesEngine.startBangInterval(fps)`
- `MascotHonu.renderBangInterval(fps)`

Còn `start()` / `render()` (dùng rAF) chỉ dùng cho **cửa sổ chat** của app,
vì cửa sổ đó luôn hiển thị.

**Đừng "tối ưu" bằng cách đổi về rAF.** Nó sẽ làm hình nền đứng im.

---

## 6. Vì sao phải có đồng hồ gắn lại (watcher)

AGY là SPA. Khi chuyển trang / mở hội thoại khác, React **thay toàn bộ DOM** →
`<div id="__antigravitinho">` bị xoá.

`main.js` chạy `batDongHoGanLai()` mỗi 3 giây:

```js
setInterval(async () => {
  if (!thietLap.ganVaoAgy) return;
  const con = await dangCoLopPhu();   // kiểm tra trong DOM AGY
  if (!con) await ganVaoAgyNgay();    // gắn lại
}, 3000);
```

Tốn ~1 lần `Runtime.evaluate` mỗi 3 giây — không đáng kể.

**Cải tiến có thể làm (T4 trong TASKS.md):** dùng `MutationObserver` trong trang
AGY để gắn lại tức thì, thay vì chờ 3 giây.

---

## 7. Hai cổng debug khác nhau — đừng lẫn

| Cổng | Của ai | Ghi chú |
|---|---|---|
| `DevToolsActivePort` (vd 1236) | Antigravity | Cổng ta dùng |
| 9333 | App Antigravitinho | Chỉ bật khi chạy với `--remote-debugging-port=9333`, dùng để test |

---

## 8. Lưu trữ dữ liệu của app (an toàn, không liên quan AGY)

```
%APPDATA%\Antigravitinho\
├── data\
│   ├── thiet-lap.json          # cài đặt
│   └── hoi-thoai\*.json        # hội thoại của app chat riêng
├── Cache\, GPUCache\, ...      # Chromium tự tạo
```

Xoá thư mục này chỉ mất cài đặt + hội thoại **của app chat riêng**.
**Không** ảnh hưởng Antigravity.
