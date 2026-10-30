// ═══════════════════════════════════════════════════════════════════════════
// Antigravitinho — Main process
//
// Đây KHÔNG phải một app chat. Không có cửa sổ riêng.
// Đây là app chạy nền (tray): nó chèn hình nền ASCII + Honu THẲNG VÀO cửa sổ
// Antigravity thật, rồi tự gắn lại khi AGY đổi trang hoặc khởi động lại.
//
// Nguyên tắc: không sửa file của AGY, không đọc/ghi DB của AGY.
// Chỉ đọc DevToolsActivePort và gửi DOM qua Chrome DevTools Protocol.
// ═══════════════════════════════════════════════════════════════════════════

import { app, Tray, Menu, nativeImage, shell, dialog } from "electron";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn, execSync } from "child_process";

import { ganVaoAgy, goKhoiAgy, trangThaiLopPhu, docCongDebug, xoaCoTat } from "./agy-bridge.js";
import { taoMaInjection, TEN_THEME, PHIEN_BAN_LOP_PHU } from "./injector.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Đường dẫn ──────────────────────────────────────────────────────────────
const DATA_DIR = join(app.getPath("userData"), "data");
const SETTINGS_PATH = join(DATA_DIR, "thiet-lap.json");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// ─── Thiết lập mặc định ─────────────────────────────────────────────────────
const MAC_DINH = {
  chuDe: "lagoon",       // theme hình nền
  doDam: 0.55,           // độ đậm (0.1 – 0.95)
  tuDongGan: true,       // tự gắn khi AGY chạy
  khoiDongCung: false,   // khởi động cùng Windows
  hienThanhDieuKhien: true,  // thanh chỉnh giao diện nổi trên ô prompt
};

let thietLap = { ...MAC_DINH };
try {
  if (existsSync(SETTINGS_PATH)) {
    thietLap = { ...MAC_DINH, ...JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) };
  }
} catch { /* giữ mặc định */ }

const luuThietLap = () => {
  try { writeFileSync(SETTINGS_PATH, JSON.stringify(thietLap, null, 2)); } catch { }
};

// ─── Trạng thái runtime ─────────────────────────────────────────────────────
let tray = null;
let dongHo = null;
let dangGan = false;
let loiGanCuoi = null;
let agyDangChay = false;

// ─── Sinh mã chèn ───────────────────────────────────────────────────────────
function maHienTai() {
  return taoMaInjection({
    chuDe: thietLap.chuDe,
    doDam: thietLap.doDam,
    moThanhDieuKhien: thietLap.hienThanhDieuKhien !== false,
  });
}

async function ganNgay(imLang = true) {
  // Xoá cờ "đã tắt" trước — người dùng bấm "Gắn lại ngay" nghĩa là muốn bật
  await xoaCoTat();
  const kq = await ganVaoAgy(maHienTai());
  if (kq.ok) {
    dangGan = true;
    loiGanCuoi = null;
  } else {
    dangGan = false;
    loiGanCuoi = kq.loi || "Không rõ lỗi";
    if (!imLang && tray) {
      dialog.showMessageBox({
        type: "info",
        title: "Chưa gắn được vào Antigravity",
        message: "Không kết nối được cửa sổ Antigravity.",
        detail:
          "Hãy chắc chắn Antigravity đang mở, rồi bấm “Gắn lại ngay”.\n\n" +
          `Chi tiết: ${loiGanCuoi}`,
        buttons: ["Đã hiểu"],
      });
    }
  }
  capNhatTray();
  return kq.ok;
}

async function goNgay() {
  await goKhoiAgy();
  dangGan = false;
  capNhatTray();
}

// ─── Đồng hồ tự gắn lại ─────────────────────────────────────────────────────
// AGY là SPA: khi đổi hội thoại / tải lại, React thay toàn bộ DOM và lớp phủ
// bị xoá. Kiểm tra định kỳ rồi chèn lại. 1.5s là đủ nhanh, gần như không thấy nháy.
//
// QUAN TRỌNG: phải phân biệt "DOM bị xoá do SPA" với "người dùng bấm tắt".
// Người dùng bấm ✕ -> injector đặt window.__antigravitinhoTat = true và ghi
// sessionStorage. Đồng hồ thấy cờ đó thì KHÔNG chèn lại nữa.
function batDongHo() {
  if (dongHo) return;
  dongHo = setInterval(async () => {
    if (!thietLap.tuDongGan) return;

    agyDangChay = docCongDebug() !== null;
    if (!agyDangChay) {
      if (dangGan) { dangGan = false; capNhatTray(); }
      return;
    }

    const tt = await trangThaiLopPhu();
    if (!tt.ketNoi) return;

    // Người dùng đã chủ động tắt -> tôn trọng, không chèn lại
    if (tt.tat) {
      if (dangGan) { dangGan = false; capNhatTray(); }
      return;
    }

    if (tt.co && tt.phienBan === PHIEN_BAN_LOP_PHU) {
      if (!dangGan) { dangGan = true; capNhatTray(); }
      return;
    }

    // Không có lớp phủ, hoặc đang chạy bản code cũ -> gắn lại
    await ganNgay();
  }, 1500);
}

// ─── Mở Antigravity bản thật ────────────────────────────────────────────────
function moAntigravity() {
  const exe = join(process.env.LOCALAPPDATA || "", "Programs", "antigravity", "Antigravity.exe");
  if (existsSync(exe)) {
    try { spawn(exe, [], { detached: true, stdio: "ignore" }).unref(); return true; } catch { }
  }
  try {
    execSync('start "" "Antigravity"', { shell: "cmd.exe", stdio: "ignore", windowsHide: true });
    return true;
  } catch { return false; }
}

// ─── Khởi động cùng Windows ─────────────────────────────────────────────────
function datKhoiDongCung(bat) {
  thietLap.khoiDongCung = !!bat;
  luuThietLap();
  try {
    app.setLoginItemSettings({ openAtLogin: !!bat, args: ["--nen"] });
  } catch { }
  capNhatTray();
}

// ─── Biểu tượng khay ────────────────────────────────────────────────────────
function bieuTuong() {
  const ungVien = [
    join(__dirname, "icon.png"),
    join(__dirname, "..", "src", "icon.png"),
  ];
  for (const p of ungVien) {
    if (existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
    }
  }
  return nativeImage.createEmpty();
}

// ─── Menu khay ──────────────────────────────────────────────────────────────
function capNhatTray() {
  if (!tray) return;

  const trangThai = !agyDangChay
    ? "⏸ Antigravity chưa chạy"
    : dangGan
      ? "✅ Đang gắn vào Antigravity"
      : "⚠️ Chưa gắn";

  const menu = Menu.buildFromTemplate([
    { label: "Antigravitinho", enabled: false },
    { label: trangThai, enabled: false },
    ...(loiGanCuoi ? [{ label: `   ${loiGanCuoi.slice(0, 60)}`, enabled: false }] : []),
    { type: "separator" },

    {
      label: "Giao diện",
      submenu: Object.entries(TEN_THEME).map(([id, ten]) => ({
        label: ten,
        type: "radio",
        checked: thietLap.chuDe === id,
        click: async () => {
          thietLap.chuDe = id;
          luuThietLap();
          if (dangGan) await ganNgay();
          capNhatTray();
        },
      })),
    },
    {
      label: "Độ đậm",
      submenu: [25, 40, 55, 70, 85].map((pt) => ({
        label: `${pt}%`,
        type: "radio",
        checked: Math.round(thietLap.doDam * 100) === pt,
        click: async () => {
          thietLap.doDam = pt / 100;
          luuThietLap();
          if (dangGan) await ganNgay();
          capNhatTray();
        },
      })),
    },
    {
      label: "Hiện thanh chỉnh giao diện",
      type: "checkbox",
      checked: thietLap.hienThanhDieuKhien !== false,
      click: async (item) => {
        thietLap.hienThanhDieuKhien = item.checked;
        luuThietLap();
        // Gỡ rồi gắn lại để áp dụng ngay
        await goNgay();
        await ganNgay();
      },
    },
    { type: "separator" },
    { label: "Gắn lại ngay", click: () => ganNgay(false) },
    {
      label: "Gỡ lớp phủ",
      enabled: dangGan,
      click: () => goNgay(),
    },
    { type: "separator" },

    { label: "Mở Antigravity", click: () => moAntigravity() },
    {
      label: "Tự gắn khi Antigravity chạy",
      type: "checkbox",
      checked: thietLap.tuDongGan,
      click: (item) => {
        thietLap.tuDongGan = item.checked;
        luuThietLap();
        capNhatTray();
      },
    },
    {
      label: "Khởi động cùng Windows",
      type: "checkbox",
      checked: thietLap.khoiDongCung,
      click: (item) => datKhoiDongCung(item.checked),
    },
    { type: "separator" },
    {
      label: "Mở thư mục dữ liệu",
      click: () => shell.openPath(app.getPath("userData")),
    },
    { label: "Thoát", click: () => { app.isQuitting = true; app.quit(); } },
  ]);

  tray.setToolTip(trangThai.replace(/^[^\s]+\s/, "Antigravitinho — "));
  tray.setContextMenu(menu);
}

// ─── Khởi động ──────────────────────────────────────────────────────────────
// Chỉ một bản chạy tại một thời điểm: bản thứ hai thoát ngay.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => capNhatTray());

  app.whenReady().then(async () => {
    // Không hiện cửa sổ nào. Chỉ khay hệ thống.
    if (app.setLoginItemSettings) {
      try {
        app.setLoginItemSettings({ openAtLogin: thietLap.khoiDongCung, args: ["--nen"] });
      } catch { }
    }

    tray = new Tray(bieuTuong());
    tray.on("click", () => tray.popUpContextMenu());
    tray.on("double-click", () => moAntigravity());
    capNhatTray();

    agyDangChay = docCongDebug() !== null;
    if (agyDangChay && thietLap.tuDongGan) {
      await ganNgay();
    }
    batDongHo();
  });
}

// Thoát bằng menu mới thoát thật; đóng cửa sổ không làm gì vì không có cửa sổ.
app.on("window-all-closed", (e) => e.preventDefault());
app.on("before-quit", () => {
  app.isQuitting = true;
  if (dongHo) clearInterval(dongHo);
  dongHo = null;
});
