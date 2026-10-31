// ═══════════════════════════════════════════════════════════════════════════
// Sinh icon khay từ ảnh chân dung pixel-art
//
// Ảnh nguồn là hình vuông, nền cyan đặc, không alpha. Ta cắt tròn (giống avatar)
// rồi xuất PNG nhiều kích thước + ICO cho Windows.
//
// Chạy: node tools/tao-icon-khay.mjs "duong/dan/anh.png"
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { inflateSync, deflateSync } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ASSETS = join(ROOT, "assets");
mkdirSync(ASSETS, { recursive: true });

const NGUON = process.argv[2] ||
  "C:\\Users\\b\\Downloads\\6febc2c9-16c2-4376-9e34-69ed19c5e6eb.png";

// ─── Đọc PNG ───────────────────────────────────────────────────────────────
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
  if (bd !== 8) throw new Error(`Chỉ hỗ trợ PNG 8-bit (nhận ${bd}-bit)`);

  const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct];
  if (!bpp) throw new Error(`Color type ${ct} chưa hỗ trợ`);

  const stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(h * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
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
  return { w, h, bpp, stride, data: out, coAlpha: ct === 4 || ct === 6 };
}

// ─── Ghi PNG RGBA ──────────────────────────────────────────────────────────
const CRC = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "latin1");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};
function ghiPng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
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

// ─── Xử lý ảnh ─────────────────────────────────────────────────────────────
const src = docPng(readFileSync(NGUON));
console.log(`Ảnh nguồn: ${src.w}×${src.h}, ${src.coAlpha ? "có alpha" : "không alpha"}`);

const px = (x, y) => {
  const i = y * src.stride + x * src.bpp;
  return {
    r: src.data[i],
    g: src.data[i + 1],
    b: src.data[i + 2],
    a: src.bpp >= 4 ? src.data[i + 3] : 255,
  };
};

// Nền để tách: lấy màu ở 4 góc
const goc = [px(2, 2), px(src.w - 3, 2), px(2, src.h - 3), px(src.w - 3, src.h - 3)];
const nen = {
  r: Math.round(goc.reduce((s, c) => s + c.r, 0) / 4),
  g: Math.round(goc.reduce((s, c) => s + c.g, 0) / 4),
  b: Math.round(goc.reduce((s, c) => s + c.b, 0) / 4),
};
console.log(`Màu nền: rgb(${nen.r},${nen.g},${nen.b})`);

// Bán kính cắt tròn: chừa 1px để không bị viền cứng ở mép ảnh
const R = src.w / 2 - 1;
const cx = src.w / 2;
const cy = src.h / 2;
// Khử răng cưa ở mép: vùng mờ rộng 1.5px
const MEM = 1.5;

const rgba = Buffer.alloc(src.w * src.h * 4);
for (let y = 0; y < src.h; y++) {
  for (let x = 0; x < src.w; x++) {
    const p = px(x, y);
    const o = (y * src.w + x) * 4;

    // Khoảng cách tới tâm (đo theo pixel + 0.5)
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);

    // Mặt nạ tròn có khử răng cưa
    let matNa = 1 - Math.min(1, Math.max(0, (d - (R - MEM)) / MEM));
    if (matNa <= 0) {
      rgba[o] = 0; rgba[o + 1] = 0; rgba[o + 2] = 0; rgba[o + 3] = 0;
      continue;
    }

    // Tách nền cyan: pixel gần màu nền thì giảm alpha (chỉ ở sát mép tròn)
    let alpha = matNa;
    const lechNen = Math.hypot(p.r - nen.r, p.g - nen.g, p.b - nen.b);
    if (lechNen < 40) {
      // Nằm trong vùng nền → trong suốt
      alpha *= Math.max(0, (lechNen - 12) / 28);
    }

    rgba[o] = p.r;
    rgba[o + 1] = p.g;
    rgba[o + 2] = p.b;
    rgba[o + 3] = Math.round(alpha * (p.a / 255) * 255);
  }
}

// ─── Resize (box filter có trọng số alpha) ─────────────────────────────────
function thuNho(nguon, sw, sh, kichThuoc) {
  const out = Buffer.alloc(kichThuoc * kichThuoc * 4);
  const tx = sw / kichThuoc, ty = sh / kichThuoc;
  for (let y = 0; y < kichThuoc; y++) {
    for (let x = 0; x < kichThuoc; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const x0 = Math.floor(x * tx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * tx));
      const y0 = Math.floor(y * ty), y1 = Math.max(y0 + 1, Math.floor((y + 1) * ty));
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const s = (yy * sw + xx) * 4;
          const al = nguon[s + 3] / 255;
          r += nguon[s] * al; g += nguon[s + 1] * al; b += nguon[s + 2] * al;
          a += nguon[s + 3]; n++;
        }
      }
      const tongA = a / 255;
      const d = (y * kichThuoc + x) * 4;
      if (tongA > 0.001) {
        out[d] = Math.round(r / tongA);
        out[d + 1] = Math.round(g / tongA);
        out[d + 2] = Math.round(b / tongA);
      }
      out[d + 3] = Math.round(a / n);
    }
  }
  return out;
}

// ─── Xuất ──────────────────────────────────────────────────────────────────
writeFileSync(join(ASSETS, "khay-nguon.png"), ghiPng(src.w, src.h, rgba));

const DS = [512, 256, 128, 64, 48, 32, 16];
const ban = DS.map((s) => ({
  size: s,
  png: ghiPng(s, s, thuNho(rgba, src.w, src.h, s)),
}));

// PNG lớn cho icon app / cửa sổ
writeFileSync(join(ASSETS, "icon.png"), ban[0].png);
// ICO đa kích thước (PNG-in-ICO)
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

// Icon khay riêng: Windows dùng 16px, nhưng cần bản 32px cho màn HiDPI.
// Ở 16px mặt bị mất chi tiết, nên crop sát khuôn mặt (zoom 1.30, dịch lên 5%)
// để mắt và tóc vẫn đọc được.
function catSat(rgbaNguon, sw, sh, zoom, dX, dY, size) {
  const banKinh = (sw / 2) / zoom;
  const cx = sw / 2 + dX * sw;
  const cy = sh / 2 + dY * sh;
  const out = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = cx + ((x + 0.5) / size - 0.5) * 2 * banKinh;
      const ny = cy + ((y + 0.5) / size - 0.5) * 2 * banKinh;

      // Mặt nạ tròn, khử răng cưa
      const d = Math.hypot(nx - cx, ny - cy) / banKinh;
      let matNa = 1 - Math.min(1, Math.max(0, (d - 0.985) / 0.03));

      const o = (y * size + x) * 4;
      if (matNa <= 0) continue;

      // Lấy trung bình vùng (box filter) để 16px không bị răng cưa
      const buoc = Math.max(1, Math.floor(banKinh / size));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let dy2 = -buoc; dy2 <= buoc; dy2++) {
        for (let dx2 = -buoc; dx2 <= buoc; dx2++) {
          const sx2 = Math.min(sw - 1, Math.max(0, Math.round(nx + dx2)));
          const sy2 = Math.min(sh - 1, Math.max(0, Math.round(ny + dy2)));
          const s = (sy2 * sw + sx2) * 4;
          const al = rgbaNguon[s + 3] / 255;
          r += rgbaNguon[s] * al;
          g += rgbaNguon[s + 1] * al;
          b += rgbaNguon[s + 2] * al;
          a += al;
          n++;
        }
      }
      const tongA = a / n;
      if (tongA <= 0.004) continue;
      out[o] = Math.round(r / a);
      out[o + 1] = Math.round(g / a);
      out[o + 2] = Math.round(b / a);
      out[o + 3] = Math.round(matNa * tongA * 255);
    }
  }
  return out;
}

writeFileSync(join(ASSETS, "khay-32.png"),
  ghiPng(32, 32, catSat(rgba, src.w, src.h, 1.3, 0, -0.05, 32)));
writeFileSync(join(ASSETS, "khay-16.png"),
  ghiPng(16, 16, catSat(rgba, src.w, src.h, 1.3, 0, -0.05, 16)));

console.log("✔ assets/icon.png     (512×512, cắt tròn)");
console.log("✔ assets/icon.ico     (512 → 16)");
console.log("✔ assets/khay-32.png  (khay, màn HiDPI)");
console.log("✔ assets/khay-16.png  (khay, màn thường)");
console.log("✔ assets/khay-nguon.png (bản đầy đủ đã tách nền)");
