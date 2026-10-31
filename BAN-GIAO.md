# Bàn giao — Antigravitinho

> Cập nhật: 01/11/2026 — trạng thái: **đã đóng gói được, lớp phủ chạy thật trên AGY**

## Đường dẫn

```
C:\Users\b\.gemini\antigravity\scratch\antigravitinho
```

## Kiến trúc (đã chốt)

App **không có cửa sổ chat riêng**. Nó chạy nền dưới khay hệ thống, đọc cổng
DevTools của Antigravity thật (`%APPDATA%\Antigravity\DevToolsActivePort`), mở
phiên CDP bằng WebSocket thuần Node.js rồi **chèn thẳng lớp DOM vào trang AGY**.

Nhờ vậy giữ nguyên 100% database, lịch sử hội thoại, subagent và slash command
của Antigravity. Lớp phủ dính chặt cửa sổ vì nằm trong chính trang đó.

## Ba cách chạy

| Cách | Lệnh / file |
| --- | --- |
| Bộ cài NSIS | `dist\Antigravitinho-Setup.exe` (117 MB, không cần admin) |
| Shortcut Desktop | `npm run shortcut` → bấm `Antigravitinho` ngoài Desktop |
| Từ mã nguồn | `Antigravitinho.bat` hoặc `Antigravitinho.vbs` (ẩn, không nháy cửa sổ) |

Bản chạy thẳng không cần cài: `dist\win-unpacked\Antigravitinho.exe`.

Gỡ shortcut: `npm run shortcut:go`.

## Đã kiểm chứng thật (không phải đoán)

- **Lớp phủ gắn vào AGY thật**: cửa sổ Antigravity đang mở, CDP target
  `https://127.0.0.1:7636/...`. Kiểm tra trong DOM:
  `coLop: true, dangSong: true, coCss: true, zIndex: 2147483000`.
  Ảnh chụp qua `Page.captureScreenshot` cho thấy nền ASCII rạn san hô + mascot
  chữ A gradient có mắt, nằm góc phải dưới; chữ trong app vẫn đọc rõ.
- **Bản đóng gói cũng gắn được**: gỡ sạch lớp phủ bằng tay (`coLop: false`),
  chạy `dist\win-unpacked\Antigravitinho.exe`, 14 giây sau kiểm tra lại →
  `coLop: true`. Tức là chính file .exe đã tự chèn, không phải sót từ bản dev.
- **Cổng CDP đổi theo lần chạy** (lúc thì 2555, lúc 7634) — app đọc lại file
  `DevToolsActivePort` mỗi lần nên không cần cấu hình cứng.
- **Khởi động cùng Windows**: `setLoginItemSettings` có ghi registry
  (`electron.app.Electron` khi chạy dev). Đã bật → kiểm tra → tắt, registry sạch.
  Lưu ý: `getLoginItemSettings()` **phải truyền `path` + `args`**, nếu gọi trống
  sẽ luôn trả `false` và checkbox khay không hiện đúng.

## Kiểm thử

```powershell
cd "C:\Users\b\.gemini\antigravity\scratch\antigravitinho"

node --test tools/test-chan-dialog.mjs                              # 8 muc
.\node_modules\electron\dist\electron.exe tools\test-inject.mjs     # 19 muc
.\node_modules\electron\dist\electron.exe tools\test-tuong-tac.mjs  # 13 muc
.\node_modules\electron\dist\electron.exe tools\test-khay.mjs       # 13 muc
```

Tất cả ghi báo cáo ra `.test-*.txt` (UTF-8). **Đừng dùng `Get-Content` của
PowerShell để đọc** — nó hiển thị sai tiếng Việt. Đọc bằng:
`node -e "process.stdout.write(require('fs').readFileSync('.test-inject.txt','utf8'))"`

Kết quả lần cuối: **53/53 đạt, exit code 0**.

## Việc còn lại

- Chưa cài thử bộ Setup lên máy (chỉ chạy `win-unpacked`). Người dùng tự chạy
  `dist\Antigravitinho-Setup.exe` khi muốn.
- Bộ cài **không ký số**, nên Windows SmartScreen sẽ cảnh báo lần đầu —
  bấm "More info" → "Run anyway".
- Chưa commit / push GitHub (chưa được yêu cầu).
- Chưa deploy NAS (không được phép tự làm).

## Lưu ý khi làm tiếp

- **Đừng dùng lệnh PowerShell để sửa file có tiếng Việt** — `-replace` +
  `Set-Content` sẽ làm hỏng encoding thành `EF BF BD`. Dùng tool `edit`/`write`.
- Kiểm tra encoding sau mỗi lần sửa: quét byte `EF BF BD` và BOM đầu file.
- Chạy app nhiều lần để test thì tắt hết trước:
  `Get-Process electron,Antigravitinho | Stop-Process -Force`
- Lớp phủ là DOM nằm trong trang AGY: **giết app thì lớp phủ vẫn còn** cho tới
  khi AGY tải lại trang hoặc gọi `goKhoiAgy()`. Đừng nhầm đó là app còn sống.
- Nếu cần xoá file, phải hỏi người dùng trước (quy tắc an toàn của họ).

## File nguồn dữ liệu gốc

- Ảnh logo chữ A: `C:\Users\b\Downloads\agy_pic\1_YCV99o2CWe_txaatOclaWA.png`
- Ảnh chân dung làm icon khay: `C:\Users\b\Downloads\6febc2c9-16c2-4376-9e34-69ed19c5e6eb.png`
- Bản sao lưu 21 file đã xoá:
  `%TEMP%\antigravitinho-backup-20261031-002805`
