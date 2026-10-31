// Kiểm thử chèn lớp phủ vào một trang giả lập AGY.
// Xác nhận: chèn được DOM, mascot sống, dock/hitbox có, không lỗi runtime.
// Chạy: electron tools/test-inject.mjs

import { app, BrowserWindow } from "electron";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { taoMaInjection } from "../src/injector.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP = join(process.env.LOCALAPPDATA || ".", "Temp", "antigravitinho-test");
const BAO_CAO = join(__dirname, "..", ".test-inject.txt");

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
setTimeout(() => { ghi("[FAIL] quá thời gian"); thoat(1); }, 60000);

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1100, height: 800, show: true,
    webPreferences: { backgroundThrottling: false },
  });

  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(
    "<!DOCTYPE html><html><head><meta charset='utf-8'></head>" +
    "<body style='background:#0b1c24;margin:0;font:16px sans-serif;color:#fff'>" +
    "<h1>Trang gia lap AGY</h1>" +
    "<pre style='color:#8fd'>function chao() { return 'code van doc ro'; }</pre>" +
    "</body></html>"
  ));

  const ma = taoMaInjection({ chuDe: "lagoon", doDam: 0.55, co: 88 });
  ghi(`[0] Kích thước script: ${(ma.length / 1024).toFixed(1)} KB`);
  kiemTra("script dưới 200KB (chèn nhanh)", ma.length < 200 * 1024,
    `${(ma.length / 1024).toFixed(0)}KB`);

  // ── 1. Chèn ───────────────────────────────────────────────────────────
  ghi("[1] Chèn lớp phủ");
  let ketQua;
  try {
    ketQua = await win.webContents.executeJavaScript(ma, true);
  } catch (e) {
    kiemTra("chèn không ném lỗi", false, e.message);
    thoat(1); return;
  }
  kiemTra("trả về gan-xong", ketQua === "gan-xong", String(ketQua));

  // Chèn lần 2 phải nhận diện đã có, không dựng lại
  const lan2 = await win.webContents.executeJavaScript(ma, true);
  kiemTra("chèn lần 2 nhận diện da-co", lan2 === "da-co", String(lan2));

  // ── 2. DOM ────────────────────────────────────────────────────────────
  ghi("[2] DOM đã dựng đủ");
  await cho(2000);
  const dom = await win.webContents.executeJavaScript(`(() => {
    const box = document.getElementById("__antigravitinho");
    if (!box) return { co: false };
    const mv = box.__mascot;
    const honu = box.querySelector("canvas.honu");
    return {
      co: true,
      song: !!box.__song,
      coCss: !!document.getElementById("__antigravitinho-css"),
      coSea: !!box.querySelector("canvas.sea"),
      coDock: !!box.querySelector(".dock"),
      coHit: !!box.querySelector(".hit"),
      coBubble: !!box.querySelector(".bubble"),
      coMascot: !!mv,
      coAnh: mv ? mv.anhReady : false,
      zIndex: getComputedStyle(box).zIndex,
      pointerEvents: getComputedStyle(box).pointerEvents,
      canvasTrongKhung: honu
        ? honu.width <= (window.innerWidth + 2) * (window.devicePixelRatio || 1)
        : false,
      kichThuocHonu: honu ? honu.width + "x" + honu.height : null,
    };
  })()`, true);

  kiemTra("có phần tử gốc", dom.co === true);
  kiemTra("cờ __song bật", dom.song === true);
  kiemTra("style đã chèn", dom.coCss === true);
  kiemTra("canvas hình nền", dom.coSea === true);
  kiemTra("dock điều khiển", dom.coDock === true);
  kiemTra("vùng bắt chuột", dom.coHit === true);
  kiemTra("bong bóng thoại", dom.coBubble === true);
  kiemTra("mascot khởi tạo", dom.coMascot === true);
  kiemTra("ảnh mascot đã nạp", dom.coAnh === true);
  kiemTra("nằm trên cùng (z-index lớn)", Number(dom.zIndex) > 2e9, dom.zIndex);
  kiemTra("lớp ngoài xuyên chuột", dom.pointerEvents === "none", dom.pointerEvents);
  kiemTra("canvas mascot không phình", dom.canvasTrongKhung === true, dom.kichThuocHonu);

  // ── 3. Tương tác ──────────────────────────────────────────────────────
  ghi("[3] Tương tác");
  const tt = await win.webContents.executeJavaScript(`(() => {
    const box = document.getElementById("__antigravitinho");
    const mv = box.__mascot;
    mv.nhay();
    box.__doiChuDe("galaxy");
    box.__doiDam(0.8);
    box.__doiCo(120);
    return {
      trangThai: mv.trangThai,
      soHat: mv.hat.length,
      cheDo: mv.cheDo,
      coSauDoi: mv.co,
      damSauDoi: box.querySelector("canvas.sea").style.opacity,
    };
  })()`, true);
  kiemTra("nhảy → có hạt sáng", tt.soHat > 0, `hat=${tt.soHat}`);
  kiemTra("nhảy → chế độ rơi", tt.cheDo === "roi", tt.cheDo);
  kiemTra("đổi cỡ mascot", tt.coSauDoi === 120, String(tt.coSauDoi));
  kiemTra("đổi độ đậm", Math.abs(Number(tt.damSauDoi) - 0.8) < 0.01, tt.damSauDoi);

  // ── 4. Gỡ ─────────────────────────────────────────────────────────────
  ghi("[4] Gỡ lớp phủ");
  const go = await win.webContents.executeJavaScript(`(() => {
    const box = document.getElementById("__antigravitinho");
    box.__mascot.dung();
    box.__song = false;
    box.remove();
    document.getElementById("__antigravitinho-css")?.remove();
    return {
      conBox: !!document.getElementById("__antigravitinho"),
      conCss: !!document.getElementById("__antigravitinho-css"),
    };
  })()`, true);
  kiemTra("DOM đã gỡ sạch", go.conBox === false && go.conCss === false, JSON.stringify(go));

  // Chụp lại để xem bằng mắt (trước khi gỡ thì đã gỡ mất, nên chụp trước)
  ghi("");
  ghi(soLoi === 0 ? "== TAT CA DAT ==" : `== ${soLoi} MUC LOI ==`);
  thoat(soLoi === 0 ? 0 : 1);
});

app.on("window-all-closed", () => thoat(0));
