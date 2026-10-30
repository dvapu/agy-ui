# Danh sách việc chưa xong (TODO)

> Làm theo thứ tự. Mỗi task tự chứa đủ thông tin để làm mà không cần hỏi.
> Xong task nào thì đánh dấu `[x]` và ghi ngày.
>
> Trước khi bắt đầu bất kỳ task nào: đọc `AGENTS.md` mục 1 (quy tắc bất di bất dịch).

---

## T1 — Gắn icon .ico cho bản cài

**Trạng thái:** CHƯA XONG

**Vấn đề:** `package.json` đã trỏ `build.win.icon: "src/icon.ico"` nhưng file đó
chưa tồn tại. `npm run dist` sẽ lỗi hoặc dùng icon mặc định của Electron.

**Cần làm:**
1. Tạo `src/icon.ico` — kích thước 256×256, định dạng ICO nhiều lớp
   (16/32/48/256). Có thể lấy emoji 🐢 rồi convert.
2. Đảm bảo `src/main.js` hàm `bieuTuong()` tìm được icon (nó đã thử
   `src/icon.png` — nên tạo thêm `src/icon.png` 256×256 cùng hình).

**Kiểm tra:**
```powershell
npm run dist
# dist/Antigravitinho-Setup.exe phải tồn tại
# Cài xong, icon ở khay phải là rùa, không phải logo Electron
```

---

## T2 — Test chế độ gắn thật (cần AGY đang chạy)

**Trạng thái:** CHƯA XONG

**Vấn đề:** 6 test hiện tại chỉ kiểm tra tĩnh (cú pháp, hợp đồng, an toàn). Chưa
có test nào chạy thật vào AGY, vì AGY có thể không mở khi CI chạy.

**File cần tạo:** `test/gan-agy.test.js`

```js
import { test } from "node:test";
import assert from "node:assert";
import { docCongDebug, moPhienAgy } from "../src/agy-bridge.js";
import { taoMaInjection } from "../src/injector.js";

test("gắn và gỡ lớp phủ trong AGY thật", async (t) => {
  if (!docCongDebug()) return t.skip("AGY chưa mở");
  const p = await moPhienAgy();
  if (!p) return t.skip("không kết nối được CDP");

  const chay = async (code) => {
    const r = await p.phien.gui("Runtime.evaluate", { expression: code, returnByValue: true });
    return r?.result?.value;
  };

  // 1. Gắn
  const kq = await chay(taoMaInjection({ chuDe: "lagoon", doDam: 0.5 }));
  assert.ok(["gan-xong", "da-co"].includes(kq), `kết quả lạ: ${kq}`);

  // 2. Kiểm tra DOM
  const co = await chay(`!!document.getElementById("__antigravitinho")`);
  assert.equal(co, true, "div lớp phủ không có trong DOM AGY");

  // 3. Có vẽ thật không (đọc pixel)
  const soPixel = await chay(`(() => {
    const cv = document.querySelector("#__antigravitinho canvas.sea");
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4 * 397) if (d[i] > 5) n++;
    return n;
  })()`);
  assert.ok(soPixel > 50, `canvas gần như trống: ${soPixel} pixel`);

  // 4. Gỡ
  const go = await chay(`(() => {
    const el = document.getElementById("__antigravitinho");
    if (el) { el.__song = false; el.remove(); }
    document.getElementById("__antigravitinho-css")?.remove();
    return !document.getElementById("__antigravitinho");
  })()`);
  assert.equal(go, true, "không gỡ được lớp phủ");

  p.phien.dong();
});
```

**Lưu ý:** test này gắn rồi gỡ lớp phủ thật trong cửa sổ AGY của người dùng.
Nếu đang dùng AGY, lớp phủ sẽ nhấp nháy một lần. Thêm `T3` để tránh.

**Kiểm tra:** `npm test` → 7 test (1 có thể skip).

---

## T3 — Cờ "đang test" để test không phá trạng thái người dùng

**Trạng thái:** CHƯA XONG

**Vấn đề:** Nếu T2 chạy trong lúc người dùng đang bật lớp phủ, test sẽ gỡ mất
lớp phủ của họ.

**File:** `src/injector.js` và `test/gan-agy.test.js`

**Sửa:** Cho `taoMaInjection` nhận thêm `id` tuỳ chọn, mặc định là
`"__antigravitinho"`. Test truyền `id: "__antigravitinho_test"` để gắn một lớp
riêng, không đụng lớp thật.

```js
export function taoMaInjection(cauHinh = {}) {
  const ID_JS = JSON.stringify(cauHinh.id || "__antigravitinho");
  // ... trong chuỗi sinh ra: const ID = ${ID_JS};
}
```

Trong test: `taoMaInjection({ id: "__antigravitinho_test" })`.

**Kiểm tra:** chạy test khi lớp phủ thật đang bật → lớp thật vẫn còn.

---

## T4 — Thanh điều khiển: bám vị trí theo cuộn, không chỉ theo resize

**Trạng thái:** CHƯA XONG

**Vấn đề:** `bamPrompt()` trong `injector.js` chỉ chạy mỗi 400 ms và khi resize.
Khi AGY cuộn nội dung dài, ô prompt đứng yên nên không sao. Nhưng khi AGY **đổi
chiều cao ô prompt** (gõ nhiều dòng), thanh có thể lệch tới 400 ms.

**Đã đo:** 400 ms là mức trễ chấp nhận được, không thấy nháy trong thực tế.
Task này chỉ cần làm nếu có người báo lệch.

**Nếu cần sửa:** thêm `ResizeObserver` lên ô prompt:

```js
let obs = null;
const theoDoiPrompt = () => {
  const p = timPrompt();
  if (!p) return;
  obs?.disconnect();
  obs = new ResizeObserver(() => { viTriCu = ""; bamPrompt(); });
  obs.observe(p);
};
theoDoiPrompt();
setInterval(theoDoiPrompt, 2000);   // AGY đổi DOM -> gắn lại observer
```

**Kiểm tra:** gõ 8 dòng vào prompt AGY → thanh phải nhảy lên ngay, không trễ.

---

## T5 — Lưu vị trí Honu và trạng thái ẩn

**Trạng thái:** CHƯA XONG

**Vấn đề:** Bấm 🐢 để ẩn Honu, rồi AGY chuyển trang → lớp phủ được chèn lại
→ Honu hiện lại. Người dùng phải bấm ẩn lại.

**File:** `src/injector.js`

**Sửa:** Lưu vào `window` + `sessionStorage`, giống cách xử lý nút ✕:

```js
// Đọc trạng thái khi khởi tạo
const anHonu = sessionStorage.getItem("__antigravitinhoAnHonu") === "1";
if (anHonu) wrapHonu.style.display = "none";

// Khi bấm nút
thanh.querySelector("[data-viec='an-honu']").addEventListener("click", (e) => {
  const dangAn = wrapHonu.style.display === "none";
  wrapHonu.style.display = dangAn ? "" : "none";
  try {
    sessionStorage.setItem("__antigravitinhoAnHonu", dangAn ? "0" : "1");
  } catch { }
  e.currentTarget.classList.toggle("chon", !dangAn);
});
```

**Kiểm tra:** ẩn Honu → đổi hội thoại trong AGY → Honu phải vẫn ẩn.

---

## T6 — Đồng bộ theme giữa thanh điều khiển và menu khay

**Trạng thái:** CHƯA XONG

**Vấn đề:** Đổi theme từ thanh điều khiển trong AGY thì menu khay vẫn hiện
theme cũ (và ngược lại thì đúng, vì menu khay gọi `ganNgay()`).

**Nguyên nhân:** `main.js` không biết thanh điều khiển đã đổi theme.

**File:** `src/injector.js` + `src/main.js`

**Sửa:** Thanh điều khiển đã phát CustomEvent (`__antigravitinhoDoiTheme`) nhưng
không ai nghe. Cách gọn nhất: **bỏ CustomEvent**, thay bằng đồng hồ đọc trạng
thái. Trong `main.js`, hàm kiểm tra 1.5 s đọc thêm theme hiện tại:

```js
// Trong injector: lưu theme đang dùng lên window
window.__antigravitinhoTheme = e.target.value;

// Trong agy-bridge.js, thêm:
export async function layThemeTrongAgy() {
  const r = await ganVaoAgy(`window.__antigravitinhoTheme || ""`);
  return r.ok ? (r.ketQua || "") : "";
}

// Trong main.js, trong batDongHo(), sau khi biết tt.co:
const themeAgy = await layThemeTrongAgy();
if (themeAgy && themeAgy !== thietLap.chuDe) {
  thietLap.chuDe = themeAgy;
  luuThietLap();
  capNhatTray();
}
```

**Kiểm tra:** đổi theme từ thanh trong AGY → mở menu khay → radio phải đúng theme.

---

## T7 — README có ảnh chụp màn hình thật

**Trạng thái:** CHƯA XONG

**Vấn đề:** README chưa có ảnh. Repo trông thiếu tin cậy.

**Cần làm:**
1. Chạy `npx electron tools/render-themes.js` → có ảnh trong `dist-anh/`
2. Chọn 1–2 ảnh đẹp nhất (lagoon, galaxy), copy vào `docs/anh/`
3. Chụp thêm 1 ảnh cửa sổ AGY đang có lớp phủ (thấy cả UI AGY + rùa)
4. Chèn vào README ở mục "Themes":

```markdown
![Lagoon](docs/anh/lagoon.png)
![Running inside Antigravity](docs/anh/trong-agy.png)
```

**Kiểm tra:** mở README trên GitHub, ảnh hiện đúng.

---

## T8 — Thêm theme thứ 7: "Aurora" (cực quang)

**Trạng thái:** CHƯA XONG (mới là ý tưởng)

**Vấn đề:** 6 theme hiện tại thiếu một cái gì đó **lạnh và yên tĩnh**. Lagoon và
Koi đều là nước ấm; Galaxy thì quá nhiều chi tiết.

**Cần làm:**
1. Thêm `aurora: "🌠 Cực Quang"` vào `TEN_THEME` trong `src/injector.js`
2. Viết `drawAurora(t)` trong `src/renderer/themes-engine.js`, dùng `this.raster.layMau()`
3. Thêm `case "aurora": this.drawAurora(t); break;` vào `veMotKhung`
4. Thêm vào menu khay (tự động, vì menu đọc `TEN_THEME`)

**Gợi ý kỹ thuật** (đã kiểm chứng là đúng hướng):
- Nền trời đêm tuyết: gradient `#02040f` → `#071b2e`
- Cực quang: 3 dải dọc, mỗi dải là đường cong bezier dày, màu chuyển
  `#4dffb8` → `#4dd2ff` → `#b84dff`, alpha 0.3–0.6
- Dải phải **dày ít nhất 40px** để không bị lưới 16×22 nuốt mất
- Thêm 200 ngôi sao nhỏ (bán kính ≥ 8px) và mặt đất tuyết trắng ở 15% dưới

**Kiểm tra:** `npx electron tools/render-themes.js` → mở `dist-anh/aurora.png`,
phải thấy ít nhất 3 dải màu khác nhau, không phải một khối xanh.

---

## Đã xong

- `[x]` Bỏ app chat thứ hai — chỉ còn app tray chèn vào AGY (2026-10-30)
- `[x]` Cầu CDP tự viết, không thư viện ngoài (2026-10-30)
- `[x]` `setInterval` thay rAF cho lớp phủ — sửa lỗi đứng hình (2026-10-30)
- `[x]` Watcher 1.5 s gắn lại khi AGY đổi trang (2026-10-30)
- `[x]` Thanh điều khiển nổi trên ô prompt của AGY (2026-10-30)
- `[x]` **Sửa lỗi bấm ✕ rồi vẫn tự bật lại** — ghi ý định vào window +
  sessionStorage, watcher tôn trọng cờ (2026-10-30)
- `[x]` 5 theme kia viết lại theo kỹ thuật vector→ASCII, đạt chất Lagoon;
  kiểm chứng bằng ảnh render thật (2026-10-30)
- `[x]` Menu khay đầy đủ: theme, độ đậm, gắn/gỡ, khởi động cùng Windows (2026-10-30)
- `[x]` Tài liệu: AGENTS.md, KIEN-TRUC, CÂU-HINH, CAP-NHAT-AGY, TASKS (2026-10-30)
- `[x]` 6 test: cú pháp, hợp đồng injector, chống XSS tham số, không chạm DB (2026-10-30)
- `[x]` Công cụ chẩn đoán `tools/kiem-tra-cong.js` (2026-10-30)
- `[x]` Công cụ render theme ra PNG `tools/render-themes.js` (2026-10-30)
