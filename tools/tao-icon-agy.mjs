// ═══════════════════════════════════════════════════════════════════════════
// Bộ icon Antigravitinho — dùng ĐÚNG path vector chữ A chính thức của
// Antigravity (lấy từ resources/app.asar → dist/loadingOverlay.js) và
// gradient gốc lấy từ ảnh logo do người dùng cung cấp.
//
// Kết quả: icon.png (512, trong suốt), icon.ico (512→16), agy-a.svg,
//          agy-a.png (512, cho mascot).
//
// Chạy: node tools/tao-icon-agy.mjs
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { inflateSync, deflateSync } from "zlib";
import { execFileSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ASSETS = join(ROOT, "assets");
const TMP = join(process.env.LOCALAPPDATA || ROOT, "Temp", "antigravitinho-icon");
mkdirSync(ASSETS, { recursive: true });
mkdirSync(TMP, { recursive: true });

const ANH_GRADIENT =
  process.argv[2] || "C:\\Users\\b\\Downloads\\agy_pic\\1_YCV99o2CWe_txaatOclaWA.png";

// Path chính thức, viewBox 0 0 180 180
const PATH_A =
  "M144.248 149.062C151.748 154.688 162.998 150.938 152.685 140.625" +
  "C121.748 110.625 128.31 28.125 89.8727 28.125" +
  "C51.4352 28.125 57.9977 110.625 27.0602 140.625" +
  "C15.8102 151.875 27.9977 154.688 35.4977 149.062" +
  "C64.5602 129.375 62.6852 94.6875 89.8727 94.6875" +
  "C117.06 94.6875 115.185 129.375 144.248 149.062Z";

// ═══════════════════════════════════════════════════════════════════════════
// 1. Đọc PNG nguồn
// ═══════════════════════════════════════════════════════════════════════════

function docPng(buf) {
  let off = 8, w = 0, h = 0, bd = 0, ct = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("latin1", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bd = data[8]; ct = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (bd !== 8) throw new Error(`Chỉ hỗ trợ PNG 8-bit (nhận ${bd})`);
  const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct];
  if (!bpp) throw new Error(`Color type ${ct} chưa hỗ trợ`);

  const stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(h * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) v += paeth(a, b, c);
      out[y * stride + x] = v & 0xff;
    }
  }
  return { w, h, bpp, stride, data: out };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Ghi PNG RGBA
// ═══════════════════════════════════════════════════════════════════════════

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};

function ghiPng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Dựng gradient MƯỢT từ ảnh nguồn
//    Lấy mẫu màu phần NỘI SUY trên lưới (bỏ pixel viền tối), rồi bilinear
//    lên độ phân giải cao. Nhờ vậy không còn viền tối/rỗ khi scale.
// ═══════════════════════════════════════════════════════════════════════════

const src = docPng(readFileSync(ANH_GRADIENT));
const NEN = { r: 18, g: 19, b: 23 };

const cachNen = (r, g, b) =>
  Math.sqrt((r - NEN.r) ** 2 + (g - NEN.g) ** 2 + (b - NEN.b) ** 2);

const rgb = new Uint8Array(src.w * src.h * 3);
const noiThat = new Uint8Array(src.w * src.h); // 1 = pixel nằm hẳn trong chữ A
for (let y = 0; y < src.h; y++) {
  for (let x = 0; x < src.w; x++) {
    const i = y * src.stride + x * src.bpp;
    const c = (y * src.w + x) * 3;
    rgb[c] = src.data[i];
    rgb[c + 1] = src.data[i + 1];
    rgb[c + 2] = src.data[i + 2];
    noiThat[y * src.w + x] = cachNen(rgb[c], rgb[c + 1], rgb[c + 2]) > 80 ? 1 : 0;
  }
}

// Lưới mẫu: mỗi ô lấy trung bình các pixel nội thất
const LUOI = 40;
const luoiR = new Float64Array(LUOI * LUOI);
const luoiG = new Float64Array(LUOI * LUOI);
const luoiB = new Float64Array(LUOI * LUOI);
const luoiCo = new Uint8Array(LUOI * LUOI);
const oW = src.w / LUOI, oH = src.h / LUOI;

for (let gy = 0; gy < LUOI; gy++) {
  for (let gx = 0; gx < LUOI; gx++) {
    let sr = 0, sg = 0, sb = 0, n = 0;
    const x0 = Math.floor(gx * oW), x1 = Math.floor((gx + 1) * oW);
    const y0 = Math.floor(gy * oH), y1 = Math.floor((gy + 1) * oH);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const p = y * src.w + x;
        if (!noiThat[p]) continue;
        sr += rgb[p * 3]; sg += rgb[p * 3 + 1]; sb += rgb[p * 3 + 2]; n++;
      }
    }
    const k = gy * LUOI + gx;
    if (n) {
      luoiR[k] = sr / n; luoiG[k] = sg / n; luoiB[k] = sb / n; luoiCo[k] = 1;
    }
  }
}

// Ô trống (ngoài chữ A) → lấp bằng ô đã biết gần nhất (lan dần)
for (let vong = 0; vong < LUOI * 2; vong++) {
  let doi = 0;
  for (let gy = 0; gy < LUOI; gy++) {
    for (let gx = 0; gx < LUOI; gx++) {
      const k = gy * LUOI + gx;
      if (luoiCo[k]) continue;
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = gx + dx, ny = gy + dy;
          if (nx < 0 || ny < 0 || nx >= LUOI || ny >= LUOI) continue;
          const q = ny * LUOI + nx;
          if (!luoiCo[q]) continue;
          sr += luoiR[q]; sg += luoiG[q]; sb += luoiB[q]; n++;
        }
      }
      if (n) {
        luoiR[k] = sr / n; luoiG[k] = sg / n; luoiB[k] = sb / n;
        doi = 1;
      }
    }
  }
  // chốt các ô vừa lấp
  for (let k = 0; k < LUOI * LUOI; k++) {
    if (!luoiCo[k] && (luoiR[k] || luoiG[k] || luoiB[k])) luoiCo[k] = 1;
  }
  if (!doi) break;
}

// Bilinear lấy màu tại toạ độ ảnh gốc
function mauTai(px, py) {
  const gx = Math.min(LUOI - 1, Math.max(0, (px / src.w) * LUOI - 0.5));
  const gy = Math.min(LUOI - 1, Math.max(0, (py / src.h) * LUOI - 0.5));
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const x1 = Math.min(LUOI - 1, x0 + 1), y1 = Math.min(LUOI - 1, y0 + 1);
  const fx = gx - x0, fy = gy - y0;
  const lay = (arr, x, y) => arr[y * LUOI + x];
  const tron = (arr) =>
    lay(arr, x0, y0) * (1 - fx) * (1 - fy) +
    lay(arr, x1, y0) * fx * (1 - fy) +
    lay(arr, x0, y1) * (1 - fx) * fy +
    lay(arr, x1, y1) * fx * fy;
  return [tron(luoiR), tron(luoiG), tron(luoiB)];
}

// PNG gradient 1024×1024 mượt
const GD = 1024;
const gradRgba = Buffer.alloc(GD * GD * 4);
for (let y = 0; y < GD; y++) {
  for (let x = 0; x < GD; x++) {
    const [r, g, b] = mauTai(((x + 0.5) / GD) * src.w, ((y + 0.5) / GD) * src.h);
    const o = (y * GD + x) * 4;
    gradRgba[o] = Math.round(r);
    gradRgba[o + 1] = Math.round(g);
    gradRgba[o + 2] = Math.round(b);
    gradRgba[o + 3] = 255;
  }
}
const gradPng = ghiPng(GD, GD, gradRgba);
const gradDataUri = "data:image/png;base64," + gradPng.toString("base64");

// ═══════════════════════════════════════════════════════════════════════════
// 4. Bounding box của path (giải cực trị cubic)
// ═══════════════════════════════════════════════════════════════════════════

function bboxPath(d) {
  const so = d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi).map(Number);
  let i = 0;
  let x = 0, y = 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const them = (px, py) => {
    if (px < x0) x0 = px;
    if (py < y0) y0 = py;
    if (px > x1) x1 = px;
    if (py > y1) y1 = py;
  };

  const cmds = d.match(/[MCLZ][^MCLZ]*/gi) || [];
  for (const c of cmds) {
    const lenh = c[0].toUpperCase();
    const v = (c.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
    if (lenh === "M") { x = v[0]; y = v[1]; them(x, y); }
    else if (lenh === "L") { x = v[0]; y = v[1]; them(x, y); }
    else if (lenh === "C") {
      const [c1x, c1y, c2x, c2y, ex, ey] = v;
      them(c1x, c1y); them(c2x, c2y); them(ex, ey);
      // Cực trị theo từng trục
      for (const truc of ["x", "y"]) {
        const p0 = truc === "x" ? x : y;
        const p1 = truc === "x" ? c1x : c1y;
        const p2 = truc === "x" ? c2x : c2y;
        const p3 = truc === "x" ? ex : ey;
        const a = -p0 + 3 * p1 - 3 * p2 + p3;
        const b = 2 * (p0 - 2 * p1 + p2);
        const cc = p1 - p0;
        const nghiem = [];
        if (Math.abs(a) < 1e-9) {
          if (Math.abs(b) > 1e-9) nghiem.push(-cc / b);
        } else {
          const delta = b * b - 4 * a * cc;
          if (delta >= 0) {
            const sq = Math.sqrt(delta);
            nghiem.push((-b + sq) / (2 * a), (-b - sq) / (2 * a));
          }
        }
        for (const t of nghiem) {
          if (t <= 0 || t >= 1) continue;
          const mt = 1 - t;
          const val = mt ** 3 * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t ** 3 * p3;
          if (truc === "x") them(val, y);
          else them(x, val);
        }
      }
      x = ex; y = ey; them(x, y);
    }
  }
  return { x0, y0, x1, y1 };
}

const bb = bboxPath(PATH_A);
console.log(`BBox path (viewBox 180): x ${bb.x0.toFixed(2)}–${bb.x1.toFixed(2)}, ` +
  `y ${bb.y0.toFixed(2)}–${bb.y1.toFixed(2)}`);

// BBox chữ A trong ảnh gradient (đo từ ảnh nguồn)
const ANH_BB = { x0: 82, y0: 92, x1: 315, y1: 307 };

// Ánh xạ ảnh → hệ toạ độ path
const sx = (bb.x1 - bb.x0) / (ANH_BB.x1 - ANH_BB.x0);
const sy = (bb.y1 - bb.y0) / (ANH_BB.y1 - ANH_BB.y0);
const imgX = bb.x0 - ANH_BB.x0 * sx;
const imgY = bb.y0 - ANH_BB.y0 * sy;
const imgW = src.w * sx;
const imgH = src.h * sy;

// ═══════════════════════════════════════════════════════════════════════════
// 5. SVG: clip path chính thức + gradient gốc
// ═══════════════════════════════════════════════════════════════════════════

const svgA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="Antigravity">
  <defs>
    <clipPath id="khoetA"><path d="${PATH_A}"/></clipPath>
  </defs>
  <g clip-path="url(#khoetA)">
    <image href="${gradDataUri}" x="${imgX.toFixed(4)}" y="${imgY.toFixed(4)}"
           width="${imgW.toFixed(4)}" height="${imgH.toFixed(4)}"
           preserveAspectRatio="none"/>
  </g>
</svg>
`;

writeFileSync(join(ASSETS, "agy-a.svg"), svgA, "utf-8");

// ═══════════════════════════════════════════════════════════════════════════
// 6. Rasterize bằng Edge headless
// ═══════════════════════════════════════════════════════════════════════════

const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].find((p) => existsSync(p));

if (!EDGE) throw new Error("Không tìm thấy Edge/Chrome để rasterize");

function renderPng(size, svgNoiDung, tiLeDem = 0.04) {
  const pad = Math.round(size * tiLeDem);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:transparent;overflow:hidden}
    svg{display:block;position:absolute;left:${pad}px;top:${pad}px;
        width:${size - pad * 2}px;height:${size - pad * 2}px}
  </style></head><body>${svgNoiDung}</body></html>`;

  const htmlPath = join(TMP, `a-${size}-${pad}.html`);
  const outPath = join(TMP, `a-${size}-${pad}.png`);
  writeFileSync(htmlPath, html, "utf-8");
  if (existsSync(outPath)) unlinkSync(outPath);

  execFileSync(EDGE, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${size},${size}`,
    "--default-background-color=00000000",
    `--screenshot=${outPath}`,
    `file:///${htmlPath.replace(/\\/g, "/")}`,
  ], { stdio: "ignore" });

  const hetGio = Date.now() + 15000;
  while ((!existsSync(outPath) || statSync(outPath).size === 0) && Date.now() < hetGio) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120);
  }
  if (!existsSync(outPath) || statSync(outPath).size === 0) {
    throw new Error(`Rasterize thất bại ở ${size}px`);
  }
  return readFileSync(outPath);
}

const KICH_THUOC = [512, 256, 128, 64, 48, 32, 16];
const ban = [];
for (const size of KICH_THUOC) {
  process.stdout.write(`  · ${size}×${size} … `);
  const png = renderPng(size, svgA);
  ban.push({ size, png });
  console.log(`${(png.length / 1024).toFixed(1)} KB`);
}

writeFileSync(join(ASSETS, "icon.png"), ban[0].png);

// ICO nhiều kích thước
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(ban.length, 4);
let offset = 6 + ban.length * 16;
const entries = [];
for (const { size, png } of ban) {
  const e = Buffer.alloc(16);
  e.writeUInt8(size >= 256 ? 0 : size, 0);
  e.writeUInt8(size >= 256 ? 0 : size, 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(png.length, 8);
  e.writeUInt32LE(offset, 12);
  entries.push(e);
  offset += png.length;
}
writeFileSync(join(ASSETS, "icon.ico"),
  Buffer.concat([header, ...entries, ...ban.map((b) => b.png)]));

// PNG trong suốt cho mascot: KHÔNG đệm, để mascot tự canh khít chữ A
writeFileSync(join(ASSETS, "agy-a.png"), renderPng(256, svgA, 0));

console.log("✔ assets/agy-a.svg   — vector chính thức + gradient gốc");
console.log("✔ assets/agy-a.png   — 256px trong suốt, không đệm (mascot)");
console.log("✔ assets/icon.png    — 512×512");
console.log("✔ assets/icon.ico    — 512→16");
