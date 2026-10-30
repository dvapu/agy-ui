# Cách cấu hình để gắn vào Antigravity

Hướng dẫn từng bước, kể cả khi bạn chưa từng dùng Electron.

---

## 1. Điều kiện

| Thứ | Bắt buộc? | Ghi chú |
|---|---|---|
| Windows 10/11 | ✅ | App dùng Tray + registry |
| Node.js 18+ | ✅ chỉ khi build từ source | Bản cài sẵn không cần |
| Antigravity đã cài | ✅ | Bản mặc định ở `%LOCALAPPDATA%\Programs\antigravity` |
| Antigravity đang chạy | ✅ khi muốn gắn | App không tự bật AGY (có nút mở) |

---

## 2. Cài từ source (3 lệnh)

```powershell
cd C:\Users\b\.gemini\antigravity\scratch\agy-ui
npm install
npm start
```

`npm start` **không mở cửa sổ nào**. Nó chỉ hiện một icon ở khay hệ thống
(góc dưới phải màn hình, có thể trong mũi tên `^`).

> Nếu không thấy icon: bấm mũi tên `^` cạnh đồng hồ → kéo icon lên thanh taskbar
> để ghim.

---

## 3. Gắn vào Antigravity — 3 bước

```
Bước 1: Mở Antigravity như bình thường (để nó chạy)
Bước 2: Chuột phải icon Antigravitinho ở khay
Bước 3: Bấm "Gắn lại ngay"
```

Sau 1–2 giây, góc dưới phải cửa sổ AGY sẽ hiện **rùa Honu** và nền ASCII
bắt đầu chuyển động.

App cũng **tự gắn** khi AGY khởi động (`Tự gắn khi Antigravity chạy` mặc định bật).

---

## 4. Đổi giao diện

Chuột phải icon khay → **Giao diện** → chọn 1 trong 6:

| ID | Tên | Mô tả |
|---|---|---|
| `lagoon` | 🐢 Đầm Phá Hawaii | Rùa Honu, cá đuối, cá heo, cá voi, hoa hibiscus |
| `koi` | 🎏 Hồ Cá Koi | Hồ xanh, lá sen, cá Koi uốn lượn |
| `galaxy` | 🌌 Dải Ngân Hà | Tinh vân tím hồng, 280+ ngôi sao |
| `matrix` | 💻 Ma Trận Code | Mưa ký tự Katakana xanh neon |
| `fireplace` | 🔥 Lò Sưởi Ấm | Than hồng bập bùng, tàn lửa bay |
| `rain` | 🌧️ Đêm Mưa | Mưa xiên, vòng loang nước, neon thành phố |

Đổi xong là đổi ngay, không cần khởi động lại.

---

## 5. Độ đậm

**Độ đậm** → 25% / 40% / 55% / 70% / 85%

- 25% → chỉ là lớp gợn mờ, đọc code thoải mái nhất
- 55% → mặc định, cân bằng
- 85% → rõ nhất, nhưng nội dung AGY sẽ hơi khó đọc

Đổi xong là đổi ngay.

---

## 6. Honu tương tác

| Thao tác | Kết quả |
|---|---|
| Bấm vào rùa | Honu nhảy + nói 1 câu ngẫu nhiên (12 câu tiếng Việt) |
| Rê chuột quanh cửa sổ | Mắt rùa dõi theo con trỏ |

Lớp phủ **không chặn chuột**. Bạn vẫn bấm chọn text, kéo cửa sổ, dùng menu
của AGY bình thường — chỉ riêng vùng rùa (84×84 px góc dưới phải) là bắt chuột.

---

## 7. Tự khởi động cùng Windows

Chuột phải icon khay → ✅ **Khởi động cùng Windows**

Lần sau bật máy, app tự chạy nền, không hiện gì. Khi bạn mở Antigravity,
lớp phủ tự gắn.

**Gỡ:** bỏ tick ô đó.

---

## 8. Kiểm tra cấu hình có đúng không

Chạy lệnh này (AGY phải đang mở):

```powershell
node tools/kiem-tra-cong.js
```

Kết quả mong đợi:

```
✅ Tìm thấy Antigravity đang chạy
   Cổng debug: 1236
✅ Kết nối CDP thành công
   Trang: https://127.0.0.1:4425/
   Lớp phủ: ĐANG GẮN
```

Các lỗi hay gặp:

| Thông báo | Nguyên nhân | Cách sửa |
|---|---|---|
| `Không tìm thấy DevToolsActivePort` | AGY chưa chạy, hoặc đã tắt cổng debug | Mở AGY; nếu vẫn lỗi xem `docs/CAP-NHAT-AGY.md` |
| `Kết nối CDP thất bại` | Cổng đúng nhưng AGY vừa tắt | Mở lại AGY rồi chạy lại |
| `Lớp phủ: CHƯA GẮN` | Chưa bấm gắn | Chuột phải khay → Gắn lại ngay |

---

## 9. Vị trí file quan trọng

| Thứ | Đường dẫn |
|---|---|
| Cài đặt của app | `%APPDATA%\Antigravitinho\data\thiet-lap.json` |
| Cổng debug của AGY (chỉ đọc) | `%APPDATA%\Antigravity\DevToolsActivePort` |
| Code | `C:\Users\b\.gemini\antigravity\scratch\agy-ui` |

App **không** ghi gì vào thư mục của Antigravity.

---

## 10. Build bản cài (.exe)

```powershell
npm run dist
```

Ra file `dist\Antigravitinho-Setup.exe`.

Cài xong, app tự chạy và nằm ở khay. Không có cửa sổ nào — đó là thiết kế,
không phải lỗi.
