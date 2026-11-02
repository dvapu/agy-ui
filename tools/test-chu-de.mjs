// Kiểm thử THẬT: mỗi chủ đề phải vẽ ra điểm ảnh, không chỉ khai báo suông.
//
// Đây là lỗi người dùng báo: chỉ "Đầm Phá Hawaii" đẹp, các chủ đề khác nhạt.
// Nguyên nhân bản cũ: 5 chủ đề kia vẽ hình vector trực tiếp lên canvas trống
// nên gần như không có gì. Test này đo mật độ điểm ảnh + độ đa dạng màu, đủ
// để phát hiện một chủ đề "chết" hoặc gần như trống.
//
// Chạy: electron tools/test-chu-de.mjs

import { app, BrowserWindow } from "electron";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { taoMaInjection, TEN_THEME } from "../src/injector.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BAO_CAO = join(__dirname, "..", ".test-chu-de.txt");

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
setTimeout(() => { ghi("[FAIL] quá thời gian"); thoat(1); }, 240000);

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

// Đo canvas: tỉ lệ điểm ảnh có màu, số màu khác nhau, độ sáng trung bình
const DO_CANVAS = `(() => {
  const cv = document.querySelector("#__antigravitinho canvas.sea");
  if (!cv) return { loi: "khong co canvas" };
  const g = cv.getContext("2d");
  const d = g.getImageData(0, 0, cv.width, cv.height).data;
  let co = 0, tong = 0, n = 0;
  const mau = new Set();
  // Lấy mẫu cách 7 điểm ảnh cho nhanh nhưng vẫn đủ đại diện
  for (let i = 0; i < d.length; i += 4 * 7) {
    const a = d[i + 3];
    if (a > 8) {
      co++;
      tong += (d[i] + d[i + 1] + d[i + 2]) / 3;
      n++;
      mau.add((d[i] >> 3) + "," + (d[i + 1] >> 3) + "," + (d[i + 2] >> 3));
    }
  }
  const tongMau = Math.floor(d.length / (4 * 7));
  return {
    tyLeCoMau: +(co / tongMau).toFixed(4),
    soMau: mau.size,
    sangTrungBinh: n ? +(tong / n).toFixed(1) : 0,
    rong: cv.width,
    cao: cv.height,
  };
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280, height: 800, show: true,
    webPreferences: { backgroundThrottling: false },
  });

  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(
    "<!DOCTYPE html><html><head><meta charset='utf-8'></head>" +
    "<body style='background:#0b1c24;margin:0;font:16px sans-serif;color:#fff'>" +
    "<h1>Trang gia lap AGY</h1></body></html>"
  ));

  const danhSach = Object.keys(TEN_THEME);
  ghi(`[1] Có ${danhSach.length} chủ đề trong cấu hình`);

  // Gắn lớp phủ với chủ đề đầu tiên
  await win.webContents.executeJavaScript(
    taoMaInjection({ chuDe: danhSach[0], doDam: 0.55, co: 88 }), true
  );
  await cho(1200);

  ghi("[2] Dock phải liệt kê đủ mọi chủ đề");
  const soOption = await win.webContents.executeJavaScript(
    `document.querySelectorAll("#__antigravitinho select.theme option").length`, true
  );
  kiemTra(`dock có ${danhSach.length} lựa chọn`, soOption === danhSach.length,
    `đếm được ${soOption}`);

  ghi("[3] Từng chủ đề phải vẽ ra hình thật");
  const ketQua = [];
  for (const ten of danhSach) {
    // Đổi qua API thật của lớp phủ (giống hệt bấm trong dock)
    await win.webContents.executeJavaScript(
      `window.__antigravitinhoBox.__doiChuDe(${JSON.stringify(ten)})`, true
    );
    // 30 khung ở 24fps ≈ 1.25 giây: đủ để chủ đề khởi động và có chuyển động
    await cho(1500);

    const so = await win.webContents.executeJavaScript(DO_CANVAS, true);
    ketQua.push({ ten, ...so });

    if (so.loi) { kiemTra(`${ten}: đo được canvas`, false, so.loi); continue; }

    // Ngưỡng đặt thấp có chủ đích: chỉ để bắt chủ đề "chết" hoặc gần trống.
    // Đầm phá đầy hình nền nên tỉ lệ cao; ma trận thưa nên thấp hơn nhiều.
    kiemTra(`${ten}: có hình (${(so.tyLeCoMau * 100).toFixed(0)}% điểm ảnh)`,
      so.tyLeCoMau > 0.002, `chỉ ${so.tyLeCoMau}`);
    kiemTra(`${ten}: có chiều sâu màu (${so.soMau} màu)`,
      so.soMau >= 8, `chỉ ${so.soMau} màu`);
    kiemTra(`${ten}: không phải ảnh trắng/đen tuyền (sáng ${so.sangTrungBinh})`,
      so.sangTrungBinh > 5 && so.sangTrungBinh < 250, `sáng ${so.sangTrungBinh}`);
  }

  ghi("[4] Đổi chủ đề liên tục không được rò rỉ hay treo");
  for (let lan = 0; lan < 2; lan++) {
    for (const ten of danhSach) {
      await win.webContents.executeJavaScript(
        `window.__antigravitinhoBox.__doiChuDe(${JSON.stringify(ten)})`, true
      );
    }
  }
  await cho(800);
  const conSong = await win.webContents.executeJavaScript(`(() => {
    const b = window.__antigravitinhoBox;
    return {
      soBox: document.querySelectorAll("#__antigravitinho").length,
      dangChay: !!b?.__engine?.running,
      chuDe: b?.__engine?.activeTheme ?? null,
    };
  })()`, true);
  kiemTra("vẫn đúng 1 lớp phủ sau khi đổi 30 lần", conSong.soBox === 1, JSON.stringify(conSong));
  kiemTra("engine vẫn chạy", conSong.dangChay === true, String(conSong.dangChay));
  kiemTra("chủ đề cuối đúng", conSong.chuDe === danhSach[danhSach.length - 1],
    `đang là ${conSong.chuDe}`);

  // ── Hồi quy: đổi chủ đề xong canvas KHÔNG được trống ────────────────────
  // Lỗi thật đã gặp: setTheme() xoá canvas rồi trông vào vòng lặp vẽ lại,
  // nhưng khi cửa sổ bị che Chromium bóp timer → canvas trống hàng chục giây.
  ghi("[5] Đổi chủ đề xong phải có hình NGAY (không chờ vòng lặp)");
  for (const ten of danhSach) {
    const coHinh = await win.webContents.executeJavaScript(`(() => {
      const cv = document.querySelector("#__antigravitinho canvas.sea");
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 3; i < d.length; i += 4 * 53) if (d[i] > 8) return true;
      return false;
    })()`, true);
    kiemTra(`${ten}: có hình ngay sau khi đổi`, coHinh === true, "canvas trống");

    await win.webContents.executeJavaScript(
      `window.__antigravitinhoBox.__doiChuDe(${JSON.stringify(ten)})`, true
    );
  }

  ghi("");
  ghi("Bảng đo:");
  for (const k of ketQua) {
    ghi(`  ${k.ten.padEnd(10)} ${String(k.rong) + "x" + String(k.cao)}  ` +
      `hình ${(k.tyLeCoMau * 100).toFixed(1)}%  màu ${k.soMau}  sáng ${k.sangTrungBinh}`);
  }

  ghi("");
  ghi(soLoi === 0 ? "== TAT CA DAT ==" : `== ${soLoi} MUC LOI ==`);
  thoat(soLoi === 0 ? 0 : 1);
});

app.on("window-all-closed", () => thoat(0));
