// Kiểm thử tương tác mascot: mắt nhìn theo, click nhảy, kéo thả, tự về chỗ đậu
// Chạy: electron tools/test-tuong-tac.mjs
// Ghi báo cáo ra tools/../.test-mascot.txt (UTF-8) để đọc lại chắc chắn.

import { app, BrowserWindow } from "electron";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP = join(process.env.LOCALAPPDATA || ".", "Temp", "antigravitinho-test");
const BAO_CAO = join(__dirname, "..", ".test-mascot.txt");

const dong = [];
const ghi = (s) => { console.log(s); dong.push(s); };

let soLoi = 0;
const kiemTra = (ten, dieuKien, chiTiet) => {
  if (dieuKien) ghi(`  [OK]   ${ten}`);
  else { ghi(`  [FAIL] ${ten} :: ${chiTiet ?? ""}`); soLoi++; }
};

const thoat = (ma = 0) => {
  try { writeFileSync(BAO_CAO, dong.join("\n") + "\n", "utf-8"); } catch { }
  try { app.exit(ma); } catch { process.exit(ma); }
};

setTimeout(() => { ghi("[FAIL] Quá thời gian chạy"); thoat(1); }, 90000);
const cho = (ms) => new Promise((r) => setTimeout(r, ms));

async function chup(win, ten) {
  try {
    const anh = await win.webContents.capturePage();
    if (!anh || anh.isEmpty()) return null;
    writeFileSync(join(TMP, ten + ".png"), anh.toPNG());
    return ten;
  } catch { return null; }
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 760, height: 620, show: true,
    webPreferences: { backgroundThrottling: false },
  });
  await win.loadFile(join(__dirname, "preview-mascot.html"));
  await cho(1500);

  const ok = await win.webContents.executeJavaScript("!!window.__mv", true);
  if (!ok) { ghi("[FAIL] Mascot không khởi tạo"); thoat(1); return; }

  const js = (code) => win.webContents.executeJavaScript(code, true);

  // ── 1. Mắt nhìn theo chuột ───────────────────────────────────────────
  ghi("[1] Mắt nhìn theo chuột");
  await js(`(() => {
    const mv = window.__mv;
    mv.capNhatChuot(mv.px + mv.co + 250, mv.py - 250);
    return 1;
  })()`);
  await cho(700);
  const mat = await js(`({ x: +window.__mv.matX.toFixed(2), y: +window.__mv.matY.toFixed(2),
                          tilt: +window.__mv.tilt.toFixed(3) })`);
  kiemTra("mắt lệch sang phải-trên", mat.x > 0.2 && mat.y < -0.2, JSON.stringify(mat));
  kiemTra("người nghiêng theo chuột", Math.abs(mat.tilt) > 0.005, `tilt=${mat.tilt}`);
  await chup(win, "tuong-tac-nhin");

  // ── 2. Click → nhảy ─────────────────────────────────────────────────
  ghi("[2] Click để nhảy");
  await js(`(() => { const mv = window.__mv;
    mv.px = mv.nhaX; mv.py = mv.nhaY; mv.vy = 0; mv.cheDo = "chodau"; return 1; })()`);

  const sau = await js(`(() => { const mv = window.__mv;
    mv.batDauKeo(mv.px + 40, mv.py + 40);
    mv.thaRa();
    return { tt: mv.trangThai, hat: mv.hat.length, vy: +mv.vy.toFixed(1), cheDo: mv.cheDo }; })()`);
  kiemTra("có vận tốc bật lên", sau.vy < 0, `vy=${sau.vy}`);
  kiemTra("chuyển sang chế độ rơi", sau.cheDo === "roi", sau.cheDo);
  kiemTra("bắn hạt sáng", sau.hat > 0, `hat=${sau.hat}`);
  kiemTra("trạng thái vui", sau.tt === "vui", sau.tt);
  await chup(win, "tuong-tac-nhay");
  await cho(1400);

  // ── 3. Kéo thả ──────────────────────────────────────────────────────
  ghi("[3] Kéo thả");
  const gocY = await js(`Math.round(window.__mv.py)`);
  const keo = await js(`(() => {
    const mv = window.__mv;
    const x = mv.px + 40, y = mv.py + 40;
    mv.batDauKeo(x, y);
    mv.capNhatKeo(x - 340, y - 300);
    return { px: Math.round(mv.px), py: Math.round(mv.py), keo: mv.dangKeo }; })()`);
  kiemTra("đang giữ chuột", keo.keo === true, String(keo.keo));
  kiemTra("mascot đi theo chuột", keo.py < gocY - 100, `py=${keo.py} (gốc ${gocY})`);
  await chup(win, "tuong-tac-keo");

  await js(`window.__mv.thaRa()`);
  await cho(1500);
  const sauTha = await js(`({ keo: window.__mv.dangKeo, cheDo: window.__mv.cheDo })`);
  kiemTra("đã thả", sauTha.keo === false, String(sauTha.keo));

  // ── 4. Tự về chỗ đậu ───────────────────────────────────────────────
  ghi("[4] Tự về chỗ đậu");
  await cho(9000);
  const veCho = await js(`(() => { const mv = window.__mv;
    return { px: Math.round(mv.px), py: Math.round(mv.py),
             nhaX: Math.round(mv.nhaX), nhaY: Math.round(mv.nhaY),
             cach: Math.round(Math.hypot(mv.px - mv.nhaX, mv.py - mv.nhaY)),
             cheDo: mv.cheDo }; })()`);
  kiemTra("đã về gần chỗ đậu", veCho.cach < 30, `cách ${veCho.cach}px, chế độ ${veCho.cheDo}`);
  ghi("       vị trí: " + JSON.stringify(veCho));

  // ── 5. Đổi kích thước cửa sổ ───────────────────────────────────────
  ghi("[5] Thu nhỏ cửa sổ — mascot phải nằm trong khung");
  win.setSize(520, 420);
  await cho(1500);
  const sauResize = await js(`(() => { const mv = window.__mv;
    return { px: Math.round(mv.px), py: Math.round(mv.py), co: mv.co,
             rong: window.innerWidth, cao: window.innerHeight,
             trongKhung: mv.px + mv.co <= window.innerWidth + 4 &&
                         mv.py + mv.co <= window.innerHeight + 4 }; })()`);
  kiemTra("vẫn nằm trong khung", sauResize.trongKhung, JSON.stringify(sauResize));

  // ── 6. Không có lỗi runtime trong vòng lặp ─────────────────────────
  ghi("[6] Không lỗi runtime");
  const chanDoan = await js(`(() => { const mv = window.__mv;
    return { loiCuoi: mv.loiCuoi || null, frame: mv.frame, dangChay: mv.dangChay }; })()`);
  kiemTra("vòng lặp còn sống", chanDoan.dangChay === true, String(chanDoan.dangChay));
  kiemTra("không lỗi trong capNhat/ve", !chanDoan.loiCuoi, chanDoan.loiCuoi);
  ghi("       " + JSON.stringify(chanDoan));

  ghi("");
  ghi(soLoi === 0 ? "== TAT CA DAT ==" : `== ${soLoi} MUC LOI ==`);
  thoat(soLoi === 0 ? 0 : 1);
});

app.on("window-all-closed", () => thoat(0));
