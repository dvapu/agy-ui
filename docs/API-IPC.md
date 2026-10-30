# Hợp đồng IPC — mọi hàm renderer gọi được

Mọi thứ UI gọi đều nằm dưới `window.agy` (khai báo ở `src/preload.cjs`).
Không có cách nào khác để UI nói chuyện với tiến trình chính.

Quy ước tên:
- Kênh IPC: **gạch nối, không dấu** — `gan-vao-agy`
- Hàm JS: **camelCase, không dấu** — `ganVaoAgy`

---

## 1. Trò chuyện (app chat riêng)

| Hàm | Kiểu | Kênh | Mô tả |
|---|---|---|---|
| `guiTinNhan(noiDung)` | send | `gui-tin-nhan` | Gửi tin nhắn tới AI |
| `onPhanHoi(cb)` | on | `phan-hoi` | Nhận câu trả lời `{noiDung, xong}` |
| `onDangSuyNghi(cb)` | on | `dang-suy-nghi` | `{dang: true/false}` |
| `onLoiChat(cb)` | on | `loi-chat` | `{loi}` |
| `onHoanTat(cb)` | on | `hoan-tat` | Xong lượt |

## 2. Hội thoại

| Hàm | Kiểu | Kênh |
|---|---|---|
| `taoHoiThoai()` | invoke | `tao-hoi-thoai` |
| `layDanhSachHoiThoai()` | invoke | `lay-ds-hoi-thoai` |
| `chuyenHoiThoai(id)` | send | `chuyen-hoi-thoai` |
| `onDaChuyenHoiThoai(cb)` | on | `da-chuyen-hoi-thoai` |

`onDaChuyenHoiThoai` trả `{id, tinNhan: [{vaiTro, noiDung, thoiGian}]}` để
renderer vẽ lại toàn bộ tin nhắn.

## 3. Thư mục dự án

| Hàm | Kiểu | Kênh |
|---|---|---|
| `chonThuMuc()` | invoke | `chon-thu-muc` |
| `layThuMucHienTai()` | invoke | `lay-thu-muc` |
| `doiThuMuc(duongDan)` | send | `doi-thu-muc` |

## 4. Cài đặt

| Hàm | Kiểu | Kênh |
|---|---|---|
| `layThietLap()` | invoke | `lay-thiet-lap` |
| `luuThietLap(obj)` | send | `luu-thiet-lap` |

Khoá trong thiết lập:

```js
{
  apiKey: "",            // Gemini API key (tuỳ chọn)
  model: "gemini-2.5-flash",
  chuDe: "lagoon",       // theme cửa sổ chat
  thuMucDuAn: "",
  guiBangEnter: true,
  hienSuyNghi: true,
  luonTrenCung: false,
  mucNoLuc: "cao",
  chuDeLopPhu: "lagoon", // theme overlay nổi
  doDamLopPhu: 0.55,
  ganVaoAgy: false,      // đang gắn vào AGY hay không
  chuDeAgy: "lagoon",    // theme khi gắn vào AGY
  doDamAgy: 0.55
}
```

## 5. Cửa sổ chat

| Hàm | Kiểu | Kênh |
|---|---|---|
| `thuNho()` | send | `thu-nho` |
| `phongTo()` | send | `phong-to` |
| `dongCuaSo()` | send | `dong-cua-so` |
| `luonTrenCung(bat)` | send | `luon-tren-cung` |
| `moCuaSoChat()` | invoke | `mo-cua-so-chat` |

## 6. Lớp phủ nổi (chế độ phụ)

| Hàm | Kiểu | Kênh |
|---|---|---|
| `batOverlay()` | invoke | `bat-overlay` |
| `tatOverlay()` | invoke | `tat-overlay` |
| `overlayDangBat()` | invoke | `overlay-dang-bat` |
| `datVungTuongTac(bat)` | send | `dat-vung-tuong-tac` |
| `layThietLapOverlay()` | invoke | `lay-thiet-lap-overlay` |
| `luuChuDeOverlay(c)` | send | `luu-chu-de-overlay` |
| `luuDoDamOverlay(d)` | send | `luu-do-dam-overlay` |

## 7. Gắn thẳng vào Antigravity (chế độ chính) ⭐

| Hàm | Kiểu | Kênh | Trả về |
|---|---|---|---|
| `ganVaoAgy()` | invoke | `gan-vao-agy` | `true` nếu chèn được vào AGY |
| `goKhoiAgy()` | invoke | `go-khoi-agy` | `true` nếu gỡ được |
| `agyDangGan()` | invoke | `agy-dang-gan` | `true` nếu lớp phủ đang có trong AGY |
| `layThietLapAgy()` | invoke | `lay-thiet-lap-agy` | `{chuDe, doDam}` |
| `luuChuDeAgy(chuDe)` | send | `luu-chu-de-agy` | — |
| `luuDoDamAgy(doDam)` | send | `luu-do-dam-agy` | — |
| `moAntigravity()` | invoke | `mo-antigravity` | `true` nếu mở được |

**Lưu ý:** `ganVaoAgy()` trả `false` khi AGY chưa chạy. Không phải lỗi — chỉ
là chưa có gì để gắn vào.

## 8. Tiện ích

| Hàm | Kiểu | Kênh |
|---|---|---|
| `moLienKet(url)` | send | `mo-lien-ket` |
| `layPhienBan()` | invoke | `lay-phien-ban` |

---

## Thêm hàm mới — làm đúng 3 bước

1. `src/main.js`:

```js
ipcMain.handle("ten-viec", async (_e, thamSo) => {
  return ketQua;
});
```

2. `src/preload.cjs` (trong object `contextBridge.exposeInMainWorld("agy", {...})`):

```js
tenViec: (thamSo) => ipcRenderer.invoke("ten-viec", thamSo),
```

3. Ghi vào bảng trong file này.

**Quên bước 2 → `window.agy.tenViec` là `undefined` → UI chết im lặng.**
Đây là lỗi hay gặp nhất.
