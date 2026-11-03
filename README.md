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

## 🎨 15 giao diện hình nền động

Mười lăm giao diện, cùng một kỹ thuật vẽ: hình được vẽ dạng vector vào một lớp
phóng to, rồi **mỗi ô lưới ký tự** lấy trung bình màu của các mẫu bên dưới và tô
thành một viên gạch bo góc kèm ký tự. Nhờ vậy hình có khối, có bóng, có chiều
sâu — không phải vài nét vector thưa thớt.

| Giao diện | Nội dung |
| --- | --- |
| 🐢 **Đầm Phá Hawaii** | rùa Honu, cá đuối, cá heo, cá voi, hoa dâm bụt |
| 🎏 **Hồ Cá Koi** | lá sen, hoa súng, bầy Koi uốn lượn, thả thức ăn bằng cách bấm |
| 🌌 **Dải Ngân Hà** | tinh vân, phi thuyền, sao băng, hành tinh |
| 💻 **Ma Trận Code** | mưa Katakana & hex neon |
| 🔥 **Lò Sưởi Ấm** | lò sưởi gạch, lửa bập bùng, đèn, mèo cuộn |
| 🌧️ **Đêm Mưa** | cửa sổ mưa, đèn neon phản chiếu, thành phố |
| ✨ **Tia Sáng Claude** | tia sáng hình hoa, đốm sáng bay |
| ☁️ **Mây Trôi** | mây trôi trên trời xanh |
| 🪼 **Sứa Phát Lụa** | sứa phát sáng trong nước sâu |
| ⛵ **Thuyền Ra Khơi** | thuyền buồm trên biển lúc chiều |
| 🪰 **Đom Đóm Đêm** | đom đóm, đồi núi, cỏ |
| 🌙 **Đêm Trăng** | trăng khuyết, mây, sao |
| 🌸 **Vườn Anh Đào** | núi Phú Sĩ, cây anh đào, cổng torii |
| 🌠 **Cực Quang Tuyết** | cực quang, núi tuyết, cabin gỗ |
| 👾 **Arcade 8-bit** | đội hình người ngoài hành tinh, pháo đài, điểm số |

Bảy giao diện cuối (`claude` → `arcade`) chuyển từ
[Claudinho](https://github.com/Lu1sR0/claudinho) của Luis Roberto (MIT) — xem
`src/renderer/ascii-themes.js`. Sáu giao diện đầu là bản port riêng, giữ nguyên
hình đang có.

Mọi giao diện đều phản ứng với chuột: sinh vật né hoặc đuổi theo con trỏ, bấm
chuột tạo hiệu ứng riêng của từng cảnh.

### Không che chữ của Antigravity

Lớp phủ nằm **trên** nội dung AGY, nên nếu tô kín màn hình thì chữ trắng của AGY
biến mất — đúng lỗi từng gặp với `clouds`, `boats`, `sakura`. Ba quy tắc giữ cho
chữ luôn đọc được, đo trên AGY thật (1707×912):

| Quy tắc | Trước | Sau |
| --- | --- | --- |
| **Không tô nền đặc** — chỉ vẽ sinh vật, để nền tối của AGY lộ ra | vùng giữa bị phủ 100% | 4–37% |
| **Chừa thanh trên (35px) và ô nhập tin (90px)** | phủ 100% | **0%** |
| **Tự hạ độ đậm theo độ sáng chủ đề** | `clouds` alpha 255 (trắng xoá) | alpha 56 |

Hai con số 35px và 90px **không phải số cứng**: `doVungChua()` đo trực tiếp
`getBoundingClientRect()` của thanh trên và của `#antigravity.agentSidePanelInputBox`,
nên AGY đổi giao diện hay đổi kích thước cửa sổ đều theo đúng. Không tìm thấy
phần tử thì rơi về 35/90.

Độ đậm hiệu dụng = độ đậm bạn đặt × hệ số theo độ sáng chủ đề. Hệ số đo một lần
cho mỗi chủ đề (`doSangCuaTheme`), chủ đề tối giữ nguyên, chủ đề sáng bị hạ — nên
không phải chỉnh tay khi đổi giao diện.

### Thử nghiệm: nền AGY trong suốt

Menu khay → **Thử nghiệm** → *Nền AGY trong suốt*. Mặc định **tắt**.

Bật thì các panel của AGY thành trong suốt để hình nền lộ ra sau chữ. Đây là
**sửa CSS của AGY** nên tách riêng: có `<style id="__antigravitinho-css-agy">`
riêng, gỡ lớp phủ là gỡ luôn, và AGY cập nhật phiên bản có thể làm vỡ. Chỉ đụng
`background-color`, không đụng layout, chữ hay sự kiện.

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

### Đổi chủ đề xong là có hình ngay

`setTheme()` xoá canvas rồi trước đây trông vào vòng lặp 24fps để vẽ lại. Nhưng
khi cửa sổ bị che, Chromium bóp timer của trang xuống còn ~1 khung/giây (hoặc
đóng băng hẳn) — canvas trống hàng chục giây, trông như app hỏng. Vì vậy
`setTheme()` **vẽ ngay một khung** trước khi trả về. `tools/test-chu-de.mjs` mục
[5] canh đúng điều này cho cả 15 chủ đề.

### 15 chủ đề nặng bao nhiêu

Lưới càng mịn thì càng nhiều lệnh vẽ. Bản gốc Claudinho dùng ô 14×20 với siêu
mẫu 3×3: đo trên AGY thật tốn **4.1 giây CPU / 6 giây** (68% một nhân), riêng
`fillText` cho 4600 ô đã là 13.6ms mỗi khung. Đổi sang ô 18×26, siêu mẫu 2×2
(1560 ô) thì ảnh gần như không khác (`dist-anh/so-sanh/`), còn CPU **không đo
được khác biệt so với lúc không bật lớp phủ**.

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
│       ├── themes-engine.js     # bộ điều phối: chọn nhánh vẽ, kích thước canvas
│       ├── ascii-themes.js      # engine lưới ký tự + 15 chủ đề (từ Claudinho, MIT)
│       └── lagoon-engine.js     # động cơ ASCII Honu Lagoon
└── tools/
    ├── tao-icon-agy.mjs         # sinh lại bộ icon chữ A từ path vector + gradient
    ├── tao-icon-khay.mjs        # sinh icon khay từ ảnh chân dung (cắt tròn + crop)
    ├── tao-shortcut.ps1         # tạo / gỡ shortcut Desktop + Start Menu
    ├── render-themes.js         # render mọi chủ đề ra PNG để kiểm tra bằng mắt
    ├── test-chan-dialog.mjs     # test bộ chặn spam (node --test)
    ├── test-tuong-tac.mjs       # test tương tác mascot (13 mục)
    ├── test-inject.mjs          # test chèn/gỡ lớp phủ (20 mục)
    ├── test-gan-lai.mjs         # test gắn/gỡ nhiều lần không rò rỉ vòng lặp (28 mục)
    ├── test-chu-de.mjs          # test từng chủ đề vẽ ra hình thật (64 mục)
    ├── test-khong-che-chu.mjs   # test lớp phủ không che chữ AGY (67 mục)
    ├── test-menu.mjs            # test menu khay gọn, đủ 15 chủ đề (9 mục)
    ├── test-khay.mjs            # test icon khay nạp được vào Tray
    ├── preview-mascot.html      # xem mascot ở kích thước lớn
    └── preview-khay.html        # xem icon khay trên nền tối/sáng
```

---

## 🔍 Kiểm thử

```powershell
cd "C:\Users\b\.gemini\antigravity\scratch\antigravitinho"

# Cú pháp + hợp đồng module + chặn spam hộp thoại (nhanh, thuần Node) — 16 mục
npm test

# Test tương tác mascot — 13 mục
.\node_modules\electron\dist\electron.exe tools\test-tuong-tac.mjs

# Test chèn / gỡ lớp phủ — 20 mục
.\node_modules\electron\dist\electron.exe tools\test-inject.mjs

# Test icon khay — 13 mục
.\node_modules\electron\dist\electron.exe tools\test-khay.mjs

# Test gắn/gỡ nhiều lần — 28 mục (chống rò rỉ vòng lặp)
.\node_modules\electron\dist\electron.exe tools\test-gan-lai.mjs

# Test từng chủ đề vẽ ra hình thật — 64 mục
.\node_modules\electron\dist\electron.exe tools\test-chu-de.mjs

# Test lớp phủ không che chữ AGY — 67 mục
.\node_modules\electron\dist\electron.exe tools\test-khong-che-chu.mjs

# Test menu khay gọn, đủ chủ đề — 9 mục
.\node_modules\electron\dist\electron.exe tools\test-menu.mjs

# Render mọi chủ đề ra PNG để xem bằng mắt → dist-anh/
.\node_modules\electron\dist\electron.exe tools\render-themes.js

# Render đúng thứ người dùng thấy (bỏ nền, chừa 2 dải) → dist-anh/lop-phu/
.\node_modules\electron\dist\electron.exe tools\render-lop-phu.js
```

Tổng cộng **230 mục kiểm tra**. Kết quả hiện tại: tất cả đạt.

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
