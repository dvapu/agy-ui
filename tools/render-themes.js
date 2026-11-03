// Render mọi theme ra ảnh PNG để kiểm tra bằng mắt (dùng cửa sổ thật, ẩn).
//
// Chạy: npx electron tools/render-themes.js
// Ảnh ra: dist-anh/<theme>.png
import { app, BrowserWindow } from "electron";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { TEN_THEME } from "../src/injector.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOC = join(__dirname, "..");
const RA = join(GOC, "dist-anh");
if (!existsSync(RA)) mkdirSync(RA, { recursive: true });

// Lấy đúng danh sách đang có trong app — thêm theme mới là tự render theo.
const THEME = Object.keys(TEN_THEME);

const html = `<!DOCTYPE html><html><body style="margin:0;background:#000">
<canvas id="c" width="1600" height="900"></canvas>
<script type="module">
  import { ThemesEngine } from "../src/renderer/themes-engine.js";
  import { taoRenderer } from "../src/renderer/ascii-themes.js";
  window.ThemesEngine = ThemesEngine;
  window.taoRenderer = taoRenderer;
  window.sanSang = true;
</script>
</body></html>`;

app.whenReady().then(async () => {
  const tam = join(RA, "_test.html");
  writeFileSync(tam, html, "utf-8");

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: { contextIsolation: false, nodeIntegration: false },
  });

  await win.loadFile(tam);

  // Đợi module nạp xong (tối đa 10s)
  for (let i = 0; i < 40; i++) {
    const ok = await win.webContents.executeJavaScript("!!window.ThemesEngine").catch(() => false);
    if (ok) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  const napDuoc = await win.webContents
    .executeJavaScript("!!window.ThemesEngine")
    .catch((e) => e.message);
  console.log("Nạp module:", napDuoc);

  for (const theme of THEME) {
    try {
      const dataUrl = await win.webContents.executeJavaScript(`(() => {
        const cv = document.getElementById("c");
        const eng = new ThemesEngine(cv);
        eng.setCheDoPhu(false);
        // Render ảnh để xem: bật nền đặc lại (khi chạy làm lớp phủ thì tắt)
        eng.tuyChon.veNen = true;
        eng.renderer = taoRenderer(cv, eng.tuyChon);
        // Bỏ chừa dải: ảnh xem phải đủ khung
        eng.chua = { tren: 0, duoi: 0 };
        eng.setTheme(${JSON.stringify(theme)});
        // Render ở đúng tỉ lệ khung hình của cửa sổ AGY thật (16:9), không
        // phải canvas vuông — nếu không sẽ không thấy được cảnh có bị cắt không.
        eng.datKichThuoc(1600, 900);
        // 96 khung ở 24fps = 4 giây: đủ để cột mã rơi, cá bơi, lửa cháy ổn định
        for (let f = 0; f < 96; f++) eng.veMotKhung(f / 24);
        return cv.toDataURL("image/png");
      })()`);

      const buf = Buffer.from(String(dataUrl).split(",")[1], "base64");
      writeFileSync(join(RA, theme + ".png"), buf);
      console.log(`  ${theme.padEnd(10)} ${(buf.length / 1024).toFixed(0)} KB`);
    } catch (e) {
      console.log(`  ${theme.padEnd(10)} LỖI: ${e.message}`);
    }
  }

  app.exit(0);
});
