// Render mỗi chủ đề ở CHẾ ĐỘ LỚP PHỦ: bỏ nền đặc + chừa 2 dải, trên nền tối
// giống AGY. Đây là thứ người dùng thật sự thấy.
import { app, BrowserWindow } from "electron";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { TEN_THEME } from "../src/injector.js";

const GOC = "C:\\Users\\b\\.gemini\\antigravity\\scratch\\antigravitinho";
const RA = join(GOC, "dist-anh", "lop-phu");
if (!existsSync(RA)) mkdirSync(RA, { recursive: true });

const tam = join(RA, "_test.html");
writeFileSync(tam, `<!DOCTYPE html><html><body style="margin:0;background:#101010">
<canvas id="c" width="1600" height="900"></canvas>
<script type="module">
  import { ThemesEngine } from "file:///${GOC.replace(/\\/g, "/")}/src/renderer/themes-engine.js";
  import { taoRenderer } from "file:///${GOC.replace(/\\/g, "/")}/src/renderer/ascii-themes.js";
  window.ThemesEngine = ThemesEngine;
  window.taoRenderer = taoRenderer;
</script></body></html>`, "utf-8");

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1600, height: 900, show: false,
    webPreferences: { contextIsolation: false, nodeIntegration: false } });
  await win.loadFile(tam);
  for (let i = 0; i < 40; i++) {
    if (await win.webContents.executeJavaScript("!!window.ThemesEngine").catch(() => false)) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  for (const ten of Object.keys(TEN_THEME)) {
    const kq = await win.webContents.executeJavaScript(`(() => {
      const cv = document.getElementById("c");
      const eng = new ThemesEngine(cv);
      // Như đang chạy trong AGY: cheDoPhu = true, vùng chừa bật
      eng.setCheDoPhu(true);
      eng.chua = { tren: 35, duoi: 90 };
      eng.setTheme(${JSON.stringify(ten)});
      eng.datKichThuoc(1600, 900);
      for (let f = 0; f < 60; f++) eng.veMotKhung(f / 24);

      // Đo: vùng giữa còn bao nhiêu, hai dải chừa có sạch không
      const g = cv.getContext("2d");
      const doVung = (y0, y1) => {
        const d = g.getImageData(0, y0, cv.width, y1 - y0).data;
        let n = 0, tong = d.length / 4;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
        return +(n / tong).toFixed(3);
      };
      return {
        phuGiua: doVung(120, 780),
        phuTren: doVung(0, 30),
        phuDuoi: doVung(820, 900),
      };
    })()`).catch((e) => ({ loi: e.message }));

    if (kq.loi) { console.log(ten, "LOI:", kq.loi); continue; }
    console.log(`${ten.padEnd(10)} giữa ${String(kq.phuGiua).padStart(5)} | dải trên ${kq.phuTren} | dải dưới ${kq.phuDuoi}`);

    const dataUrl = await win.webContents.executeJavaScript(`document.getElementById("c").toDataURL("image/png")`);
    writeFileSync(join(RA, ten + ".png"), Buffer.from(dataUrl.split(",")[1], "base64"));
  }

  app.exit(0);
});
