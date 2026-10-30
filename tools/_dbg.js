import { app, BrowserWindow } from "electron";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const GOC = join(__dirname, "..");
const RA = join(GOC, "dist-anh");
if (!existsSync(RA)) mkdirSync(RA, { recursive: true });
const THEME = ["lagoon","koi","galaxy","matrix","fireplace","rain"];
const html = `<!DOCTYPE html><html><body style="margin:0;background:#000">
<canvas id="c" width="1944" height="1760"></canvas>
<script type="module">
  import { ThemesEngine } from "./src/renderer/themes-engine.js";
  window.ThemesEngine = ThemesEngine;
  window.sanSang = true;
</script></body></html>`;
app.whenReady().then(async () => {
  writeFileSync(join(RA, "_test.html"), html);
  const win = new BrowserWindow({ width: 1400, height: 900, show: false,
    webPreferences: { contextIsolation: false, nodeIntegration: false } });
  win.webContents.on("console-message", (_e, lvl, msg) => console.log("  [console]", msg));
  win.webContents.on("did-fail-load", (_e, code, desc) => console.log("  [fail-load]", code, desc));
  await win.loadFile(join(RA, "_test.html"));
  for (let i = 0; i < 40; i++) {
    const ok = await win.webContents.executeJavaScript("!!window.ThemesEngine").catch(() => false);
    if (ok) break;
    await new Promise(r => setTimeout(r, 250));
  }
  console.log("Nạp module:", await win.webContents.executeJavaScript("!!window.ThemesEngine").catch(e => "ERR " + e.message));
  app.exit(0);
});
