// ═══════════════════════════════════════════════════════════════════════════
// Antigravitinho — main process
//
// Kiến trúc: KHÔNG có cửa sổ chat riêng.
// Ứng dụng chạy nền dưới khay hệ thống, tìm cổng DevTools của Antigravity
// thật rồi chèn lớp phủ (hình nền ASCII + mascot chữ A) THẲNG vào DOM của
// cửa sổ AGY qua CDP.
//
// Nhờ vậy toàn bộ database, lịch sử hội thoại, subagent và slash command
// của Antigravity được giữ nguyên 100% — app chỉ vẽ lên trên.
//
// Nguyên tắc chống lỗi đã áp dụng:
//   · Single instance lock — không bao giờ có 2 icon khay / 2 dialog
//   · Vòng theo dõi dùng đệ quy setTimeout (không dồn ứ khi CDP chậm)
//   · Dialog lỗi: chỉ một cái mở tại một thời điểm, có giãn cách 10 phút,
//     và KHÔNG BAO GIỜ mở từ vòng lặp tự động
//   · Bắt mọi unhandledRejection / uncaughtException để không crash
// ═══════════════════════════════════════════════════════════════════════════

import { app, Tray, Menu, nativeImage, shell, globalShortcut, dialog } from "electron";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn, execSync } from "child_process";
import { ganVaoAgy, goKhoiAgy, dangCoLopPhu } from "./agy-bridge.js";
import { taoMaInjection, TEN_THEME } from "./injector.js";
import { ChanDialog } from "./chan-dialog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Đường dẫn ───────────────────────────────────────────────────────────────
const DATA_DIR = join(app.getPath("userData"), "data");
const SETTINGS_PATH = join(DATA_DIR, "thiet-lap.json");
const ASSETS = join(__dirname, "..", "assets");

try { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); } catch { }

// ─── Thiết lập mặc định ──────────────────────────────────────────────────────
const MAC_DINH = {
  chuDe: "lagoon",      // theme hình nền
  doDam: 0.55,          // độ đậm lớp ASCII (0.1 – 0.95)
  coMascot: 88,         // cạnh mascot (px)
  tuDongGan: true,      // tự gắn lại khi AGY tải lại / khởi động
  dangGan: false,       // lớp đang gắn trong DOM AGY
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

// ─── Trạng thái ──────────────────────────────────────────────────────────────
let tray = null;
let dangTheoDoi = false;
let dangGanThat = false;
let lanLoiCuoi = "";
let lanGanLoi = 0;            // số lần gắn lỗi liên tiếp
let dangGan = false;          // chống gọi ganLopPhu chồng nhau

// Bộ chặn spam hộp thoại: 1 cái/lần, giãn cách 10 phút, tối đa 3 lần/phiên
const chanDialog = new ChanDialog({
  gianCachMs: 10 * 60 * 1000,
  soLanToiDa: 3,
});

const CHU_KY_THEO_DOI = 3000;

// Bắt lỗi toàn cục — app phải sống tiếp, không được crash
process.on("unhandledRejection", (e) => {
  console.error("[Antigravitinho] unhandledRejection:", e?.message || e);
});
process.on("uncaughtException", (e) => {
  console.error("[Antigravitinho] uncaughtException:", e?.message || e);
});

// ─── Chèn / gỡ lớp phủ ───────────────────────────────────────────────────────
async function ganLopPhu(imLang = false) {
  if (dangGan) return { ok: false, loi: "đang gắn" };
  dangGan = true;
  try {
    const ma = taoMaInjection({
      chuDe: thietLap.chuDe,
      doDam: thietLap.doDam,
      co: thietLap.coMascot,
    });

    const kq = await ganVaoAgy(ma);
    dangGanThat = !!kq.ok;
    thietLap.dangGan = dangGanThat;
    luuThietLap();
    capNhatTray();

    if (kq.ok) {
      lanGanLoi = 0;
      chanDialog.datLai();       // hoạt động lại thì cho phép hỏi lại sau này
    } else {
      lanGanLoi++;
      lanLoiCuoi = kq.loi || "Không rõ lỗi";
      // Chỉ hỏi khi người dùng CHỦ ĐỘNG bấm, không bao giờ từ vòng lặp tự động
      if (!imLang) hoiMoAntigravity();
    }
    return kq;
  } finally {
    dangGan = false;
  }
}

async function goLopPhu() {
  try {
    const ok = await goKhoiAgy();
    dangGanThat = false;
    thietLap.dangGan = false;
    luuThietLap();
    capNhatTray();
    return ok;
  } catch {
    dangGanThat = false;
    capNhatTray();
    return false;
  }
}

// ─── Theo dõi: AGY là SPA, điều hướng/tải lại sẽ xoá DOM nên phải gắn lại ───
// Dùng đệ quy setTimeout (không phải setInterval) để lượt sau chỉ chạy khi
// lượt trước đã xong — tránh dồn ứ khi CDP chậm hoặc AGY đang bận.
async function vongTheoDoi() {
  if (!dangTheoDoi) return;
  try {
    if (thietLap.tuDongGan && !dangGan) {
      const con = await dangCoLopPhu();
      if (!con) {
        dangGanThat = false;
        await ganLopPhu(true);     // im lặng: KHÔNG mở dialog từ vòng lặp
      } else if (!dangGanThat) {
        dangGanThat = true;
        lanGanLoi = 0;
        capNhatTray();
      }
    }
  } catch (e) {
    console.error("[Antigravitinho] lỗi vòng theo dõi:", e?.message || e);
  } finally {
    if (dangTheoDoi) setTimeout(vongTheoDoi, CHU_KY_THEO_DOI);
  }
}

function batDauTheoDoi() {
  if (dangTheoDoi) return;
  dangTheoDoi = true;
  setTimeout(vongTheoDoi, CHU_KY_THEO_DOI);
}

function dungTheoDoi() {
  dangTheoDoi = false;
}

// ─── Mở Antigravity thật ─────────────────────────────────────────────────────
function moAntigravity() {
  const ungVien = [
    join(process.env.LOCALAPPDATA || "", "Programs", "antigravity", "Antigravity.exe"),
    "C:\\Program Files\\Antigravity\\Antigravity.exe",
    "C:\\Program Files (x86)\\Antigravity\\Antigravity.exe",
  ];
  for (const exe of ungVien) {
    if (!existsSync(exe)) continue;
    try {
      spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
      return true;
    } catch { /* thử đường khác */ }
  }
  try {
    execSync('start "" "Antigravity"', { shell: "cmd.exe", stdio: "ignore", windowsHide: true });
    return true;
  } catch { return false; }
}

/**
 * Hỏi người dùng có mở Antigravity không.
 * Mọi việc chặn spam do ChanDialog lo: 1 hộp thoại/lần, giãn cách 10 phút,
 * tối đa 3 lần mỗi phiên, và KHÔNG BAO GIỜ được gọi từ vòng lặp tự động.
 */
function hoiMoAntigravity() {
  const chiTiet =
    "Antigravitinho cần Antigravity đang mở để gắn lớp phủ.\n\n" +
    "Hãy mở Antigravity, rồi bấm “Gắn lại ngay” trong menu khay hệ thống." +
    (lanLoiCuoi ? `\n\nChi tiết: ${lanLoiCuoi}` : "");

  chanDialog.hoi(
    () => dialog.showMessageBox({
      type: "question",
      title: "Chưa kết nối được Antigravity",
      message: "Không tìm thấy cổng gỡ lỗi của Antigravity.",
      detail: chiTiet,
      buttons: ["Mở Antigravity", "Để sau"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    }),
    (kq) => {
      if (!kq) return;
      if (kq.response === 0) moAntigravity();
      else if (kq.response === 1) chanDialog.tat();  // "Để sau" = đừng hỏi nữa
    }
  );
}

// ─── Khởi động cùng Windows ──────────────────────────────────────────────────
// Bản đóng gói (.exe): Windows chạy thẳng Antigravitinho.exe.
// Bản chạy từ mã nguồn: phải truyền thêm đường dẫn app cho electron.exe,
// nếu không Electron sẽ mở cửa sổ trống thay vì chạy app.
function dangKhoiDongCung() {
  try {
    // Phải truyền đúng path/args thì Windows mới tìm ra mục đã đăng ký.
    // Gọi không tham số sẽ luôn trả false với app chạy từ mã nguồn.
    return !!app.getLoginItemSettings({
      path: process.execPath,
      args: app.isPackaged ? [] : [app.getAppPath()],
    }).openAtLogin;
  } catch {
    return false;
  }
}

function datKhoiDongCung(bat) {
  try {
    app.setLoginItemSettings({
      openAtLogin: !!bat,
      path: process.execPath,
      args: app.isPackaged ? [] : [app.getAppPath()],
    });
    return true;
  } catch (e) {
    console.error("[Antigravitinho] lỗi đặt khởi động cùng Windows:", e?.message || e);
    return false;
  }
}

// ─── Khay hệ thống ───────────────────────────────────────────────────────────
function taoIconTray() {
  // Windows: 16px cho khay thường, 32px cho màn HiDPI.
  // Ưu tiên PNG riêng cho khay (đã crop sát mặt) thay vì icon app đầy đủ.
  const ungVien = [
    join(ASSETS, "khay-32.png"),
    join(ASSETS, "khay-16.png"),
    join(ASSETS, "icon.ico"),
    join(ASSETS, "icon.png"),
  ];

  for (const p of ungVien) {
    if (!existsSync(p)) continue;
    const img = nativeImage.createFromPath(p);
    if (img.isEmpty()) continue;
    // .ico tự chứa nhiều kích thước — không resize để Windows tự chọn
    if (p.endsWith(".ico")) return img;
    return img.resize({ width: 16, height: 16, quality: "best" });
  }

  console.warn("[Antigravitinho] không đọc được icon khay");
  return nativeImage.createEmpty();
}

function capNhatTray() {
  if (!tray) return;
  try {
    tray.setToolTip(
      `Antigravitinho — ${dangGanThat ? "đang phủ lên Antigravity" : "chưa gắn"}`
    );
    tray.setContextMenu(taoMenuTray());
  } catch { }
}

function taoMenuTray() {
  const themeItems = Object.entries(TEN_THEME).map(([khoa, nhan]) => ({
    label: nhan,
    type: "radio",
    checked: thietLap.chuDe === khoa,
    click: async () => {
      thietLap.chuDe = khoa;
      luuThietLap();
      if (dangGanThat) await ganLopPhu(true);
      capNhatTray();
    },
  }));

  return Menu.buildFromTemplate([
    {
      label: dangGanThat ? "✓ Đang phủ lên Antigravity" : "Chưa gắn vào Antigravity",
      enabled: false,
    },
    { type: "separator" },
    {
      label: dangGanThat ? "Gỡ lớp phủ" : "Gắn vào Antigravity",
      click: async () => {
        if (dangGanThat) await goLopPhu();
        else await ganLopPhu();
      },
    },
    {
      label: "Gắn lại ngay",
      click: async () => {
        lanGanLoi = 0;
        await goLopPhu();
        await ganLopPhu();
      },
    },
    {
      label: "Tự động gắn lại",
      type: "checkbox",
      checked: thietLap.tuDongGan,
      click: (mi) => {
        thietLap.tuDongGan = mi.checked;
        luuThietLap();
        if (mi.checked) batDauTheoDoi();
        else dungTheoDoi();
      },
    },
    { type: "separator" },
    { label: "Giao diện hình nền", enabled: false },
    ...themeItems,
    { type: "separator" },
    { label: "Độ đậm lớp nền", enabled: false },
    ...[25, 40, 55, 70, 85].map((pt) => ({
      label: `${pt}%`,
      type: "radio",
      checked: Math.round(thietLap.doDam * 100) === pt,
      click: async () => {
        thietLap.doDam = pt / 100;
        luuThietLap();
        if (dangGanThat) await ganLopPhu(true);
        capNhatTray();
      },
    })),
    { type: "separator" },
    { label: "Mở Antigravity", click: () => moAntigravity() },
    {
      label: "Khởi động cùng Windows",
      type: "checkbox",
      checked: dangKhoiDongCung(),
      click: (mi) => {
        datKhoiDongCung(mi.checked);
        capNhatTray();
      },
    },
    { label: "Mở thư mục dữ liệu", click: () => shell.openPath(DATA_DIR) },
    { type: "separator" },
    {
      label: "Thoát Antigravitinho",
      click: async () => {
        dungTheoDoi();
        await goLopPhu();
        app.quit();
      },
    },
  ]);
}

// ─── Phím tắt toàn cục ───────────────────────────────────────────────────────
function dangKyPhimTat() {
  try {
    const ok = globalShortcut.register("CommandOrControl+Shift+Space", async () => {
      if (dangGanThat) await goLopPhu();
      else await ganLopPhu();
    });
    if (!ok) console.warn("[Antigravitinho] không đăng ký được phím tắt");
  } catch { }
}

// ─── Khởi động ───────────────────────────────────────────────────────────────
app.setAppUserModelId("com.antigravitinho.app");

// Chỉ cho phép MỘT instance — nếu không sẽ có nhiều icon khay và nhiều dialog
const coMotInstance = app.requestSingleInstanceLock();

if (!coMotInstance) {
  // Instance thứ hai: nhường instance đầu, thoát ngay và im lặng
  app.exit(0);
} else {
  app.on("second-instance", () => {
    try { tray?.popUpContextMenu(); } catch { }
  });

  // App sống dưới khay, không thoát khi không có cửa sổ
  app.on("window-all-closed", () => { });

  app.whenReady().then(async () => {
    try { app.dock?.hide?.(); } catch { }

    tray = new Tray(taoIconTray());
    tray.setToolTip("Antigravitinho");
    tray.setContextMenu(taoMenuTray());

    tray.on("click", async () => {
      if (dangGanThat) await goLopPhu();
      else await ganLopPhu();
    });

    tray.on("double-click", async () => {
      lanGanLoi = 0;
      await goLopPhu();
      await ganLopPhu();
    });

    dangKyPhimTat();

    // Gắn ngay nếu AGY đang mở — im lặng, không làm phiền người dùng
    await ganLopPhu(true);
    batDauTheoDoi();
  }).catch((e) => {
    console.error("[Antigravitinho] lỗi khởi động:", e?.message || e);
  });

  app.on("will-quit", () => {
    dungTheoDoi();
    try { globalShortcut.unregisterAll(); } catch { }
  });
}
