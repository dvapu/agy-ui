# Antigravitinho 🅰️✨

**Antigravitinho** là lớp phủ (overlay) sống động cho **Antigravity** thật trên Windows.
Nó không thay thế Antigravity — nó **vẽ lên trên** cửa sổ Antigravity đang chạy.

Nhờ vậy bạn giữ nguyên 100%: database dự án, toàn bộ lịch sử hội thoại, subagent và
mọi slash command (`/code`, `/boost`, `/browser`, …) của Antigravity.

> Cảm hứng từ [Claudinho](https://github.com/Lu1sR0/claudinho) — nhưng dành cho Antigravity.

---

## 📍 Vị trí mã nguồn

```
C:\Users\b\.gemini\antigravity\scratch\antigravitinho
```

---

## 🧠 Cách hoạt động

Antigravity là ứng dụng Electron và bật sẵn cổng gỡ lỗi nội bộ, ghi tại:

```
%APPDATA%\Antigravity\DevToolsActivePort
```

Antigravitinho đọc cổng đó, mở một phiên Chrome DevTools Protocol (CDP) bằng
WebSocket thuần Node.js (không thêm dependency), rồi **chèn thẳng một lớp DOM**
vào chính trang của Antigravity.

Vì lớp này nằm *trong* trang AGY nên nó:

- Dính chặt cửa sổ: di chuyển, đổi kích thước, thu nhỏ, chuyển workspace đều theo
- Không che code: dùng `globalCompositeOperation = "screen"` và alpha thấp
- Không bao giờ ghi vào dữ liệu của AGY

Nếu AGY điều hướng SPA làm mất DOM, app tự gắn lại sau mỗi 3 giây.

---

## 🅰️ Mascot: chữ A sống động

Logo là **chữ A chính thức của Antigravity** (vector lấy từ `app.asar` của bản cài,
gradient lấy từ ảnh logo gốc), được thổi hồn thành một nhân vật:

- **Mắt** nhìn theo con trỏ chuột, chớp mắt ngẫu nhiên
- **Thở** nhấp nhô, **nghiêng người** theo hướng chuột
- **Bấm** → nhảy lên, bắn tia sáng, nói một câu tiếng Việt
- **Kéo thả** → treo lủng lẳng theo chuột, thả ra thì rơi, chạm đất bẹp rồi bật dậy
- **Đi dạo** loanh quanh gần chỗ đậu rồi tự về
- **Rảnh lâu** → ngủ, mắt nhắm, bong bóng "z z z"
- **Rung nhẹ** khi Antigravity đang xử lý

Vật lý dùng **tích phân bước cố định** nên chạy đúng ở mọi frame rate, kể cả khi
Windows bóp nhịp cửa sổ bị che khuất.

---

## 🎨 6 giao diện hình nền động

1. 🐢 **Đầm Phá Hawaii** — rùa Honu, cá đuối, cá heo, cá voi, hoa dâm bụt
2. 🎏 **Hồ Cá Koi** — lá sen, hoa súng, bầy Koi uốn lượn
3. 🌌 **Dải Ngân Hà** — tinh vân, 280+ vì sao
4. 💻 **Ma Trận Code** — mưa Katakana & hex neon
5. 🔥 **Lò Sưởi Ấm** — lửa bập bùng, tàn tro bay
6. 🌧️ **Đêm Mưa** — mưa xiên, đèn neon phản chiếu

---

## 🚀 Chạy app

Có ba cách, chọn cách nào cũng được:

| Cách | Việc cần làm |
| --- | --- |
| **Bộ cài (khuyến nghị)** | Chạy `dist\Antigravitinho-Setup.exe`, bấm Next. Có sẵn shortcut Desktop + Start Menu. |
| **Shortcut sẵn** | Bấm `Antigravitinho` ngoài Desktop (tạo bằng `npm run shortcut`). |
| **Từ mã nguồn** | Nháy đúp `Antigravitinho.bat`, hoặc `Antigravitinho.vbs` nếu không muốn thấy cửa sổ đen. |

Bản chạy từ mã nguồn cần `node_modules` (chạy `npm install` một lần). Bản cài đặt
thì không — nó đã đóng gói sẵn mọi thứ.

Không có cửa sổ chat nào mở ra: app nằm ngay dưới khay hệ thống.

---

## ⚙️ Sử dụng

App chạy nền dưới **khay hệ thống**. Không có cửa sổ chat riêng.

**Icon khay** là ảnh chân dung pixel-art (cắt tròn), hiển thị cả khi app thu nhỏ
— bấm vào đó để gắn/gỡ lớp phủ mà không cần mở bất cứ cửa sổ nào.

| Thao tác | Tác dụng |
| --- | --- |
| **Click icon khay** | Gắn / gỡ lớp phủ |
| **Double-click icon khay** | Gắn lại ngay |
| **Chuột phải icon khay** | Menu: đổi giao diện, độ đậm, tự động gắn, khởi động cùng Windows, thoát |
| **Ctrl + Shift + Space** | Ẩn / hiện lớp phủ từ bất kỳ đâu |
| **Rê chuột góc dưới-phải** | Hiện dock nhỏ để đổi nhanh giao diện |

App **chỉ cho phép một instance**: mở lần thứ hai sẽ không tạo thêm icon khay
hay hộp thoại nào.

Muốn app tự chạy mỗi lần bật máy: chuột phải icon khay → **Khởi động cùng Windows**.

### Gỡ rồi gắn lại nhiều lần vẫn mượt

Lớp phủ chạy hai vòng lặp: hình nền 24fps và mascot 30fps. Khi gỡ, app **dừng
cả hai trước** rồi mới tháo DOM (`box.__huy()`), và gỡ luôn listener gắn trên
`window`. Nếu chỉ `remove()` phần tử, các vòng lặp vẫn vẽ tiếp vào canvas đã
rời DOM — gắn/gỡ vài lần là chúng chồng lên nhau và cả Antigravity lag.

Đo trên máy thật: trước khi sửa **8.23 giây CPU / 5 giây**, sau khi sửa
**0.80 giây CPU / 5 giây** (giảm 10 lần). Test hồi quy `tools/test-gan-lai.mjs`
gắn/gỡ 5 lần liên tiếp và đòi số vòng lặp luôn đúng bằng 2.

---

## 🛠️ Cấu trúc

```
antigravitinho/
├── Antigravitinho.bat           # chạy từ mã nguồn (có cửa sổ đen thoáng qua)
├── Antigravitinho.vbs           # chạy từ mã nguồn, ẩn hoàn toàn
├── assets/                      #
│   ├── agy-a.svg                # chữ A vector chính thức + gradient gốc (mascot)
│   ├── agy-a.png                # 256px trong suốt (dùng cho mascot)
│   ├── icon.png / icon.ico      # icon app & bộ cài (512 → 16, cắt tròn)
│   ├── khay-16.png              # icon khay hệ thống, màn thường
│   └── khay-32.png              # icon khay hệ thống, màn HiDPI
├── src/
│   ├── main.js                  # Electron main: khay, single-instance, vòng theo dõi
│   ├── agy-bridge.js            # cầu CDP tới Antigravity (WebSocket thuần)
│   ├── injector.js              # sinh script tự chứa để chèn vào DOM AGY
│   ├── chan-dialog.js           # bộ chặn spam hộp thoại
│   └── renderer/
│       ├── mascot-a.js          # mascot chữ A (vật lý, tương tác, cảm xúc)
│       ├── themes-engine.js     # 6 theme hình nền
│       └── lagoon-engine.js     # động cơ ASCII Honu Lagoon
└── tools/
    ├── tao-icon-agy.mjs         # sinh lại bộ icon chữ A từ path vector + gradient
    ├── tao-icon-khay.mjs        # sinh icon khay từ ảnh chân dung (cắt tròn + crop)
    ├── tao-shortcut.ps1         # tạo / gỡ shortcut Desktop + Start Menu
    ├── test-chan-dialog.mjs     # test bộ chặn spam (node --test)
    ├── test-tuong-tac.mjs       # test tương tác mascot (13 mục)
    ├── test-inject.mjs          # test chèn/gỡ lớp phủ (19 mục)
    ├── test-gan-lai.mjs         # test gắn/gỡ nhiều lần không rò rỉ vòng lặp (28 mục)
    ├── test-khay.mjs            # test icon khay nạp được vào Tray
    ├── preview-mascot.html      # xem mascot ở kích thước lớn
    └── preview-khay.html        # xem icon khay trên nền tối/sáng
```

---

## 🔍 Kiểm thử

```powershell
cd "C:\Users\b\.gemini\antigravity\scratch\antigravitinho"

# Test bộ chặn spam hộp thoại (nhanh, thuần Node) — 8 mục
node --test tools/test-chan-dialog.mjs

# Test tương tác mascot — 13 mục
.\node_modules\electron\dist\electron.exe tools\test-tuong-tac.mjs

# Test chèn / gỡ lớp phủ — 19 mục
.\node_modules\electron\dist\electron.exe tools\test-inject.mjs

# Test icon khay — 13 mục
.\node_modules\electron\dist\electron.exe tools\test-khay.mjs

# Test gắn/gỡ nhiều lần — 28 mục (chống rò rỉ vòng lặp)
.\node_modules\electron\dist\electron.exe tools\test-gan-lai.mjs
```

Tổng cộng **81 mục kiểm tra**. Kết quả hiện tại: tất cả đạt.

---

## 📦 Đóng gói

```powershell
npm start              # chạy trực tiếp từ mã nguồn
npm run shortcut       # tạo shortcut ngoài Desktop + Start Menu
npm run shortcut:go    # gỡ shortcut
npm run dist           # tạo bộ cài dist\Antigravitinho-Setup.exe
```

Bộ cài dùng NSIS, không cần quyền admin, cho phép chọn thư mục cài, tự tạo
shortcut Desktop + Start Menu và có mục gỡ cài trong Control Panel.

Muốn bản chạy thẳng không cần cài: dùng thư mục `dist\win-unpacked\`, chạy
`Antigravitinho.exe`.

Sinh lại bộ icon:

```powershell
node tools/tao-icon-agy.mjs     # icon chữ A (logo / bộ cài)
node tools/tao-icon-khay.mjs    # icon khay từ ảnh chân dung
```

---

## ⚠️ Yêu cầu

- Windows 10/11
- Antigravity đã cài và **đang mở** (để có cổng gỡ lỗi)
- Nếu app báo "Chưa kết nối được Antigravity": mở Antigravity rồi bấm
  **Gắn lại ngay** trong menu khay. Hộp thoại này không bao giờ tự bật lại
  liên tục — tối đa 3 lần mỗi phiên, cách nhau 10 phút.
