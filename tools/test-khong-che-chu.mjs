// Kiểm thử: lớp phủ KHÔNG được che chữ của Antigravity.
//
// Đây là lỗi người dùng báo: "có theme đè lên hẳn chữ với nguyên cái giao diện
// prompting luôn, không thấy chữ hay thấy đường để dùng".
//
// Ba thứ được canh:
//   1. Không tô nền đặc (chỉ vẽ sinh vật) — nếu tô, cả màn hình thành một màu.
//   2. Hai dải ngang (thanh trên + ô nhập tin) phải sạch tuyệt đối.
//   3. Chủ đề sáng phải bị hạ alpha để chữ trắng còn đọc được.
//
// Chạy: electron tools/test-khong-che-chu.mjs

import { app, BrowserWindow } from "electron";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { TEN_THEME } from "../src/injector.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOC = join(__dirname, "..");
const RA = join(GOC, "dist-anh", "lop-phu");
if (!existsSync(RA)) mkdirSync(RA, { recursive: true });
const BAO_CAO = join(GOC, ".test-khong-che-chu.txt");

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

const tam = join(RA, "_test-khong-che.html");
writeFileSync(tam, `<!DOCTYPE html><html><body style="margin:0;background:#101010">
<canvas id="c" width="1600" height="900"></canvas>
<script type="module">
  import { ThemesEngine } from "file:///${GOC.replace(/\\/g, "/")}/src/renderer/themes-engine.js";
  import { taoRenderer } from "file:///${GOC.replace(/\\/g, "/")}/src/renderer/ascii-themes.js";
  window.ThemesEngine = ThemesEngine;
  window.taoRenderer = taoRenderer;
</script></body></html>`, "utf-8");

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1600, height: 900, show: false,
    webPreferences: { contextIsolation: false, nodeIntegration: false },
  });
  await win.loadFile(tam);
  for (let i = 0; i < 60; i++) {
    if (await win.webContents.executeJavaScript("!!window.ThemesEngine").catch(() => false)) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  const ds = Object.keys(TEN_THEME);
  ghi(`[1] Kiểm ${ds.length} chủ đề ở chế độ lớp phủ`);

  const bang = [];
  for (const ten of ds) {
    const kq = await win.webContents.executeJavaScript(`(() => {
      const cv = document.getElementById("c");
      const eng = new ThemesEngine(cv);
      eng.setCheDoPhu(true);
      // Giống layout thật: thanh trên 35px, ô nhập tin 90px
      eng.chua = { tren: 35, duoi: 90 };
      eng.setTheme(${JSON.stringify(ten)});
      eng.datKichThuoc(1600, 900);
      for (let f = 0; f < 40; f++) eng.veMotKhung(f / 24);

      // Canvas có thể cao hơn cửa sổ (lagoon vẽ 1760 rồi CSS phóng) nên phải
      // quy đổi toạ độ CSS -> toạ độ canvas trước khi đo.
      const heSo = cv.height / 900;
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;

      const dem = (yCss0, yCss1) => {
        const y0 = Math.round(yCss0 * heSo), y1 = Math.round(yCss1 * heSo);
        let n = 0, tong3 = 0, alphaMax = 0, tongSang = 0, soSang = 0;
        for (let y = y0; y < y1; y++) for (let x = 0; x < cv.width; x += 2) {
          const i = (y * cv.width + x) * 4;
          const a = d[i + 3] / 255;
          if (a > 0) { n++; if (d[i + 3] > alphaMax) alphaMax = d[i + 3]; }
          // Độ sáng THẬT khi nhìn: trộn lên nền tối #101010 của AGY.
          // Đo RGB gốc là sai — điểm ảnh trắng nhưng alpha thấp thì mắt thấy tối.
          if (a > 0.1) {
            const r = d[i] * a + 16 * (1 - a);
            const g = d[i + 1] * a + 16 * (1 - a);
            const b = d[i + 2] * a + 16 * (1 - a);
            tongSang += 0.299 * r + 0.587 * g + 0.114 * b;
            soSang++;
          }
          tong3++;
        }
        return {
          phu: +(n / tong3).toFixed(4),
          alphaMax,
          doSang: soSang ? +(tongSang / soSang).toFixed(0) : 0,
        };
      };
      return {
        giua: dem(120, 780),
        tren: dem(0, 30),
        duoi: dem(830, 900),
      };
    })()`).catch((e) => ({ loi: e.message }));

    if (kq.loi) { ghi(`  [FAIL] ${ten}: ${kq.loi}`); soLoi++; continue; }
    bang.push({ ten, ...kq });

    // 1. Không được tô kín màn hình (nền đặc)
    kiemTra(`${ten}: không phủ kín (${(kq.giua.phu * 100).toFixed(0)}% vùng giữa)`,
      kq.giua.phu < 0.6, `phủ ${kq.giua.phu}`);
    // 2. Hai dải chừa phải sạch
    kiemTra(`${ten}: dải thanh trên sạch`, kq.tren.phu === 0, `còn ${kq.tren.phu}`);
    kiemTra(`${ten}: dải ô nhập tin sạch`, kq.duoi.phu === 0, `còn ${kq.duoi.phu}`);
    // 3. Chủ đề sáng không được đè chữ trắng
    kiemTra(`${ten}: đủ trong để đọc chữ (alpha max ${kq.giua.alphaMax})`,
      kq.giua.alphaMax <= 200, `alpha ${kq.giua.alphaMax}`);
  }

  ghi("[2] Chủ đề sáng phải mờ hơn chủ đề tối");
  const lay = (t) => bang.find((x) => x.ten === t);
  const sang = ["clouds", "sakura", "boats"];
  const toi = ["matrix", "arcade", "claude"];
  for (const s of sang) {
    const a = lay(s);
    if (!a) continue;
    // Chủ đề sáng phải có độ sáng trung bình thấp hơn hẳn ngưỡng 255 (tức là
    // đã bị hạ alpha, không còn trắng xoá)
    kiemTra(`${s}: đã được hạ sáng (sáng ${a.giua.doSang}/255)`,
      a.giua.doSang < 220, `sáng ${a.giua.doSang}`);
  }
  for (const t of toi) {
    const a = lay(t);
    if (!a) continue;
    kiemTra(`${t}: vẫn giữ được hình (phủ ${(a.giua.phu * 100).toFixed(0)}%)`,
      a.giua.phu > 0.01, `phủ ${a.giua.phu}`);
  }

  ghi("[3] Chế độ render ảnh vẫn tô nền đầy đủ");
  const nenDayDu = await win.webContents.executeJavaScript(`(() => {
    const cv = document.getElementById("c");
    const eng = new ThemesEngine(cv);
    eng.setCheDoPhu(false);            // = chế độ render ảnh
    eng.tuyChon.veNen = true;
    eng.renderer = taoRenderer(cv, eng.tuyChon);
    eng.chua = { tren: 0, duoi: 0 };
    eng.setTheme("sakura");
    eng.datKichThuoc(1600, 900);
    for (let f = 0; f < 30; f++) eng.veMotKhung(f / 24);
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let n = 0, tong = 0;
    for (let i = 3; i < d.length; i += 4 * 29) { tong++; if (d[i] > 8) n++; }
    return +(n / tong).toFixed(4);
  })()`).catch((e) => ({ loi: e.message }));
  kiemTra("render ảnh: nền phủ kín", nenDayDu === 1, String(nenDayDu));

  ghi("");
  ghi("Bảng đo (100% = phủ kín):");
  ghi("  chủ đề      vùng giữa   alpha max   sáng TB");
  for (const k of bang) {
    ghi(`  ${k.ten.padEnd(11)} ${String((k.giua.phu * 100).toFixed(0) + "%").padStart(8)}   ${String(k.giua.alphaMax).padStart(7)}   ${String(k.giua.doSang).padStart(6)}`);
  }

  ghi("");
  ghi(soLoi === 0 ? "== TAT CA DAT ==" : `== ${soLoi} MUC LOI ==`);
  thoat(soLoi === 0 ? 0 : 1);
});
