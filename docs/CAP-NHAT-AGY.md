# Chuyện gì xảy ra khi Antigravity cập nhật?

Câu hỏi quan trọng nhất của dự án. Trả lời ngắn: **gần như không mất gì.**

---

## 1. Vì sao an toàn

App này **không sửa một byte nào** của Antigravity. Nó chỉ:

1. Đọc file `%APPDATA%\Antigravity\DevToolsActivePort` (1 dòng chứa số cổng)
2. Gửi JavaScript qua Chrome DevTools Protocol để **thêm DOM vào trang đang chạy**
3. Lặp lại mỗi 1,5 giây nếu DOM bị xoá

Cửa sổ AGY đóng lại → DOM mất → mở lại → app tự chèn lại. Không có file nào
bị ghi đè, không có `app.asar` nào bị patch.

```
Antigravity cập nhật = thay file .exe + app.asar
                       ↓
             KHÔNG liên quan gì đến app này
                       ↓
     app vẫn chạy, vẫn đọc DevToolsActivePort, vẫn chèn được
```

---

## 2. Ba trường hợp có thể xảy ra sau khi AGY update

### ✅ Trường hợp A — Vẫn chạy bình thường (khả năng cao nhất)

AGY vẫn là Electron, vẫn bật `DevToolsActivePort` như mọi bản Electron dev.

**Bạn không cần làm gì.** Mở AGY, app tự gắn lại trong 1,5 giây.

### ⚠️ Trường hợp B — AGY đổi giao diện (class/CSS mới)

Lớp phủ vẫn hiện, nhưng có thể **chồng lên thanh công cụ mới** hoặc lệch vị trí
Honu.

**Cách sửa:** mở `src/injector.js`, chỉnh CSS trong khối `style.textContent`:

```js
#\${ID} .honu-wrap {
  right: 26px; bottom: 22px;   // ← đổi số này
  width: 84px; height: 84px;   // ← hoặc kích thước
}
```

Rồi `npm test && npm start`.

### ❌ Trường hợp C — AGY tắt DevToolsActivePort (khó xảy ra)

Electron chỉ bật cổng này khi chạy ở chế độ dev hoặc khi có flag riêng.
Nếu Google tắt hẳn, app sẽ báo:

```
⚠️ Chưa gắn — Không kết nối được Antigravity
```

**Cách kiểm tra ngay** (làm trước khi hoảng):

```powershell
Get-Content "$env:APPDATA\Antigravity\DevToolsActivePort"
```

- Ra một số (vd `1236`) → cổng còn, vấn đề ở chỗ khác
- Báo lỗi không tìm thấy file → cổng bị tắt (trường hợp C)

**Nếu đúng là trường hợp C**, có 3 đường lui:

| Cách | Độ khó | Ghi chú |
|---|---|---|
| Chạy AGY với `--remote-debugging-port=1236` | Dễ | Tạo shortcut mới với flag đó |
| Dùng cửa sổ overlay nổi | Trung bình | Phải code lại — xem git history bản 1.0 |
| Chờ bản fix | — | Mở issue trên repo |

---

## 3. Bảng kiểm tra nhanh sau mỗi lần AGY update

```
[ ] Mở Antigravity
[ ] Nhìn góc dưới phải: có rùa Honu không?
    ├─ Có  → xong, không làm gì
    └─ Không → xem tiếp
[ ] Chuột phải icon khay Antigravitinho → trạng thái là gì?
    ├─ "✅ Đang gắn" → đợi 3 giây, lớp phủ sẽ hiện
    ├─ "⏸ Antigravity chưa chạy" → AGY chưa mở xong, đợi
    └─ "⚠️ Chưa gắn" → bấm "Gắn lại ngay"
[ ] Vẫn lỗi → chạy: Get-Content "$env:APPDATA\Antigravity\DevToolsActivePort"
```

---

## 4. Điều KHÔNG BAO GIỜ bị ảnh hưởng

Kể cả khi lớp phủ hỏng hoàn toàn, những thứ này **không bao giờ** bị đụng:

- Hội thoại Antigravity (`conversations\*.db`)
- Toàn bộ tính năng `/code`, `/browser`, agent, MCP
- Cài đặt của AGY
- File cài đặt AGY (`app.asar`)
- Lịch sử chat, project, workspace

Lý do: app này **chỉ đọc** đúng 1 file text (DevToolsActivePort) và **chỉ ghi**
vào DOM của trang đang chạy trong RAM. Tắt app là mọi dấu vết biến mất.

---

## 5. Cách gỡ sạch nếu muốn bỏ hẳn

```powershell
# 1. Thoát app (chuột phải icon khay → Thoát)
# 2. Xoá dữ liệu app
Remove-Item -Recurse "$env:APPDATA\Antigravitinho"
# 3. Xoá thư mục code
Remove-Item -Recurse "C:\Users\b\.gemini\antigravity\scratch\agy-ui"
```

Antigravity không bị ảnh hưởng gì. Lớp phủ biến mất ngay khi app tắt vì nó
chỉ tồn tại trong RAM của trang.
