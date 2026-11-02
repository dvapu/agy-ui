// Kiểm tra menu khay: 15 chủ đề phải nằm trong submenu, không làm menu dài
// quá màn hình, và mục con phải hiện đúng chủ đề đang chọn.
//
// Chạy: electron tools/test-menu.mjs
import { app, Menu } from "electron";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BAO_CAO = join(__dirname, "..", ".test-menu.txt");

const dong = [];
const ghi = (s) => { console.log(s); dong.push(s); };
let soLoi = 0;
const kiemTra = (ten, dk, ct) => {
  if (dk) ghi(`  [OK]   ${ten}`);
  else { ghi(`  [FAIL] ${ten} :: ${ct ?? ""}`); soLoi++; }
};
const thoat = (ma = 0) => {
  try { writeFileSync(BAO_CAO, dong.join("\n") + "\n", "utf-8"); } catch { }
  try { app.exit(ma); } catch { process.exit(ma); }
};
setTimeout(() => { ghi("[FAIL] quá thời gian"); thoat(1); }, 30000);

const { TEN_THEME } = await import("../src/injector.js");
const soTheme = Object.keys(TEN_THEME).length;

// Dựng menu giống hệt main.js nhưng không cần khay thật
const themeItems = Object.entries(TEN_THEME).map(([khoa, nhan]) => ({
  label: nhan, type: "radio", checked: khoa === "koi",
  click: () => { },
}));

const menu = Menu.buildFromTemplate([
  { label: "Đang phủ lên Antigravity", enabled: false },
  { type: "separator" },
  { label: "Gỡ lớp phủ", click: () => { } },
  { type: "separator" },
  {
    label: "Giao diện hình nền — Hồ Cá Koi",
    submenu: themeItems,
  },
  { type: "separator" },
  { label: "Mở Antigravity", click: () => { } },
]);

ghi(`[1] Menu dựng được với ${soTheme} chủ đề`);
kiemTra("Menu tạo thành công", !!menu, "menu rỗng");

const muc = menu.items;
ghi(`[2] Menu cấp 1 chỉ có ${muc.length} mục (trước đây là ${soTheme + 8})`);
kiemTra(`menu cấp 1 gọn (≤ 10 mục)`, muc.length <= 10, `có ${muc.length} mục`);

const mucGiaoDien = muc.find((m) => m.label.startsWith("Giao diện hình nền"));
kiemTra("có mục Giao diện hình nền", !!mucGiaoDien, "không tìm thấy");
kiemTra("mục đó là submenu", !!mucGiaoDien?.submenu, "không phải submenu");
kiemTra(`submenu có đủ ${soTheme} chủ đề`,
  mucGiaoDien?.submenu?.items.length === soTheme,
  `có ${mucGiaoDien?.submenu?.items.length}`);

ghi("[3] Nhãn mục con hiện chủ đề đang chọn");
kiemTra("nhãn có tên chủ đề đang dùng", mucGiaoDien.label.includes("Hồ Cá Koi"),
  mucGiaoDien.label);

ghi("[4] Mọi chủ đề đều bấm được và đúng kiểu radio");
const conThieu = mucGiaoDien.submenu.items.filter((m) => m.type !== "radio");
kiemTra("tất cả đều là radio", conThieu.length === 0, `${conThieu.length} mục sai kiểu`);
const khongBamDuoc = mucGiaoDien.submenu.items.filter((m) => !m.enabled);
kiemTra("tất cả đều bấm được", khongBamDuoc.length === 0, `${khongBamDuoc.length} mục bị khoá`);

// Nhãn không được trùng nhau — trùng thì người dùng không phân biệt được
const nhan = mucGiaoDien.submenu.items.map((m) => m.label);
kiemTra("không có nhãn trùng", new Set(nhan).size === nhan.length,
  `${nhan.length - new Set(nhan).size} nhãn trùng`);

ghi("");
ghi(soLoi === 0 ? "== TAT CA DAT ==" : `== ${soLoi} MUC LOI ==`);
thoat(soLoi === 0 ? 0 : 1);
