// Render 6 theme ra ảnh PNG để kiểm tra bằng mắt (dùng cửa sổ ẩn thật).
//
// Chạy: npx electron tools/render-themes.js
// Ảnh ra: dist-anh/<theme>.png
import { app, BrowserWindow } from "electron";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOC = join(__dirname, "..");
const RA = join(GOC, "dist-anh");
if (!existsSync(RA)) mkdirSync(RA, { recursive: true });

const THEME = ["lagoon", "koi", "galaxy", "matrix", "fireplace", "rain"];

const html = `<!DOCTYPE html><html><body style="margin:0;background:#000">
<canvas id="c" width="1944" height="1760"></canvas>
<script type="module">
  import { ThemesEngine } from "../src/renderer/themes-engine.js";
  window.ThemesEngine = ThemesEngine;
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
        eng.setTheme(${JSON.stringify(theme)});
        const ten = ${JSON.stringify(theme)};
        if (ten === "matrix") {
          // Matrix cần thời gian để cột mã rơi xuống — mô phỏng 3 giây ở 24fps
          for (let f = 0; f < 72; f++) eng.veMotKhung(f / 24);
        } else {
          eng.veMotKhung(3.0);
          eng.veMotKhung(6.0);
          eng.veMotKhung(9.5);
        }
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
