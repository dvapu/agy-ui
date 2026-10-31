// Kiểm thử hồi quy: gắn → gỡ → gắn nhiều lần KHÔNG được để rò rỉ vòng lặp.
//
// Đây là lỗi người dùng báo: gỡ lớp phủ rồi gắn lại thì càng lúc càng lag.
// Nguyên nhân: gỡ DOM mà không dừng setInterval của engine nền (24fps) và
// mascot (30fps) → mỗi lần gắn lại chồng thêm một bộ.
//
// Chạy: electron tools/test-gan-lai.mjs

import { app, BrowserWindow } from "electron";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { taoMaInjection } from "../src/injector.js";
import { MA_GO_LOP_PHU } from "../src/agy-bridge.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BAO_CAO = join(__dirname, "..", ".test-gan-lai.txt");

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
setTimeout(() => { ghi("[FAIL] quá thời gian"); thoat(1); }, 120000);

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

// Đếm số interval đang sống trong trang
const DEM_INTERVAL = `(() => {
  window.__demInterval = window.__demInterval || (() => {
    const ids = new Set();
    const gocDat = window.setInterval, gocXoa = window.clearInterval;
    window.setInterval = function (...a) { const id = gocDat.apply(window, a); ids.add(id); return id; };
    window.clearInterval = function (id) { ids.delete(id); return gocXoa.call(window, id); };
    return () => ids.size;
  })();
  return window.__demInterval();
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1100, height: 800, show: true,
    webPreferences: { backgroundThrottling: false },
  });

  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(
    "<!DOCTYPE html><html><head><meta charset='utf-8'></head>" +
    "<body style='background:#0b1c24;margin:0;font:16px sans-serif;color:#fff'>" +
    "<h1>Trang gia lap AGY</h1></body></html>"
  ));

  // Cài bộ đếm TRƯỚC khi chèn lớp phủ
  await win.webContents.executeJavaScript(DEM_INTERVAL, true);

  const ma = taoMaInjection({ chuDe: "lagoon", doDam: 0.55, co: 88 });
  const dem = async () => win.webContents.executeJavaScript(DEM_INTERVAL, true);
  const trangThai = async () => win.webContents.executeJavaScript(`(() => ({
    soBox: document.querySelectorAll("#__antigravitinho").length,
    soCss: document.querySelectorAll("#__antigravitinho-css").length,
    conGlobal: !!window.__antigravitinhoBox,
  }))()`, true);

  ghi("[1] Gắn / gỡ 5 lần liên tiếp");
  const soVongMoCua = [];

  for (let lan = 1; lan <= 5; lan++) {
    // ── Gắn ──
    await win.webContents.executeJavaScript(ma, true);
    await cho(900);
    const st = await trangThai();
    kiemTra(`lần ${lan}: đã gắn (1 box, 1 css)`,
      st.soBox === 1 && st.soCss === 1, JSON.stringify(st));

    const dangChay = await dem();
    soVongMoCua.push(dangChay);
    // 2 vòng lặp: engine nền + mascot. Không được tăng theo số lần gắn.
    kiemTra(`lần ${lan}: số vòng lặp đang chạy = 2`, dangChay === 2, `đo được ${dangChay}`);

    // ── Gỡ ──
    await win.webContents.executeJavaScript(MA_GO_LOP_PHU, true);
    await cho(500);
    const sau = await trangThai();
    kiemTra(`lần ${lan}: đã gỡ sạch DOM`,
      sau.soBox === 0 && sau.soCss === 0 && sau.conGlobal === false, JSON.stringify(sau));

    const conLai = await dem();
    kiemTra(`lần ${lan}: không còn vòng lặp nào chạy`, conLai === 0, `còn ${conLai}`);
  }

  ghi("[2] Số vòng lặp không được tăng dần");
  ghi(`       đo được qua 5 lần: ${soVongMoCua.join(" → ")}`);
  kiemTra("mọi lần đều đúng 2 vòng lặp (không tích luỹ)",
    soVongMoCua.every((n) => n === 2), soVongMoCua.join(","));

  ghi("[3] Nút ✕ trong dock cũng phải dọn sạch");
  await win.webContents.executeJavaScript(ma, true);
  await cho(900);
  const truoc = await dem();
  await win.webContents.executeJavaScript(
    `document.querySelector("#__antigravitinho button.off").click()`, true
  );
  await cho(500);
  const sauNut = await dem();
  const stNut = await trangThai();
  kiemTra("bấm ✕ → không còn vòng lặp", sauNut === 0, `trước ${truoc}, sau ${sauNut}`);
  kiemTra("bấm ✕ → DOM sạch", stNut.soBox === 0 && stNut.soCss === 0, JSON.stringify(stNut));

  ghi("[4] Gắn lại lần cuối vẫn bình thường");
  await win.webContents.executeJavaScript(ma, true);
  await cho(900);
  const cuoi = await dem();
  const stCuoi = await trangThai();
  kiemTra("gắn lại được sau khi bấm ✕", stCuoi.soBox === 1 && cuoi === 2,
    `box=${stCuoi.soBox}, vòng lặp=${cuoi}`);

  ghi("[5] Đúng tay nắm: engine dừng, mascot dừng sau khi gỡ");
  const tayNam = await win.webContents.executeJavaScript(`(() => {
    const box = window.__antigravitinhoBox;
    return { coHuy: typeof box?.__huy === "function", coEngine: !!box?.__engine };
  })()`, true);
  kiemTra("box có __huy và __engine", tayNam.coHuy && tayNam.coEngine, JSON.stringify(tayNam));

  const sauKhiGo = await win.webContents.executeJavaScript(`(() => {
    const box = window.__antigravitinhoBox;
    const mv = box.__mascot, eng = box.__engine;
    const truoc = { chay: eng.running, interval: mv.intervalId };
    box.__huy();
    return {
      truoc,
      sau: { chay: eng.running, interval: mv.intervalId, mascotDangChay: mv.dangChay },
    };
  })()`, true);
  kiemTra("engine.running chuyển false", sauKhiGo.sau.chay === false, JSON.stringify(sauKhiGo.sau));
  kiemTra("mascot.intervalId về null", sauKhiGo.sau.interval === null, String(sauKhiGo.sau.interval));
  kiemTra("mascot.dangChay về false", sauKhiGo.sau.mascotDangChay === false, String(sauKhiGo.sau.mascotDangChay));

  ghi("");
  ghi(soLoi === 0 ? "== TAT CA DAT ==" : `== ${soLoi} MUC LOI ==`);
  thoat(soLoi === 0 ? 0 : 1);
});

app.on("window-all-closed", () => thoat(0));
