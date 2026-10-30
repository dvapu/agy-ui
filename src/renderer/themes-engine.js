// ═══════════════════════════════════════════════════════════════════════════
// Antigravitinho — Multi-Theme Live ASCII Wallpaper Engine
//
// 6 chủ đề, tất cả đều dùng CHUNG một kỹ thuật:
//   vẽ hình vector lên canvas phụ → lấy mẫu pixel → đổ thành KÝ TỰ ASCII
//
// Đó là lý do bản Lagoon đẹp: nó không vẽ hình, nó "dịch" hình thành chữ.
// Các theme khác trước đây vẽ vector trực tiếp nên trông như clipart. Giờ tất
// cả đều đi qua `AsciiRaster` để có cùng chất liệu ASCII.
// ═══════════════════════════════════════════════════════════════════════════

import { LagoonEngine } from "./lagoon-engine.js";

// ───────────────────────────────────────────────────────────────────────────
// Bộ chuyển vector → ASCII
// ───────────────────────────────────────────────────────────────────────────
class AsciiRaster {
  constructor(cv, cw = 16, ch = 22, ss = 3) {
    this.CW = cw;
    this.CH = ch;
    this.SS = ss;
    this.COLS = Math.ceil(cv.width / cw);
    this.ROWS = Math.ceil(cv.height / ch);

    const c = document.createElement("canvas");
    c.width = this.COLS * ss;
    c.height = this.ROWS * ss;
    this.cv = c;
    this.ctx = c.getContext("2d", { willReadFrequently: true });
  }

  /** Vẽ bằng toạ độ "pixel gốc" (0..1944), tự lo việc lấy mẫu. */
  layMau(ve) {
    const ox = this.ctx;
    ox.setTransform(1, 0, 0, 1, 0, 0);
    ox.clearRect(0, 0, this.cv.width, this.cv.height);
    ox.setTransform(
      (this.COLS * this.SS) / (this.COLS * this.CW),
      0, 0,
      (this.ROWS * this.SS) / (this.ROWS * this.CH),
      0, 0
    );
    ve(ox);

    const d = ox.getImageData(0, 0, this.cv.width, this.cv.height).data;
    const out = new Float32Array(this.COLS * this.ROWS * 4);
    const rw = this.cv.width * 4;
    const ss2 = this.SS * this.SS * 255;

    for (let j = 0; j < this.ROWS; j++) {
      for (let i = 0; i < this.COLS; i++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let v = 0; v < this.SS; v++) {
          for (let u = 0, p = (j * this.SS + v) * rw + i * this.SS * 4; u < this.SS; u++, p += 4) {
            const al = d[p + 3];
            r += d[p] * al;
            g += d[p + 1] * al;
            b += d[p + 2] * al;
            a += al;
          }
        }
        const o = (j * this.COLS + i) * 4;
        if (a > 0) {
          out[o] = r / a;
          out[o + 1] = g / a;
          out[o + 2] = b / a;
          out[o + 3] = a / ss2;
        }
      }
    }
    return out;
  }
}

export class ThemesEngine {
  constructor(canvasElement) {
    this.cv = canvasElement;
    this.ctx = this.cv.getContext("2d");
    this.activeTheme = "lagoon";
    this.running = false;
    this.rafId = null;
    this.intervalId = null;
    // Chế độ lớp phủ: không vẽ nền đặc, chỉ để phần tử sáng nổi lên trên app
    this.cheDoPhu = false;

    // Sub-engine cho Lagoon (chu kỳ 24.5s chuẩn toán học)
    this.lagoonEngine = new LagoonEngine(canvasElement);

    this.raster = new AsciiRaster(canvasElement);
    this.COLS = this.raster.COLS;
    this.ROWS = this.raster.ROWS;
    this.CW = this.raster.CW;
    this.CH = this.raster.CH;

    this.t0 = performance.now();
    this.initThemeData();
  }

  // ── Dữ liệu hạt cho từng theme ──────────────────────────────────────────
  initThemeData() {
    const W = this.cv.width;
    const H = this.cv.height;

    // Matrix: cột mã rơi. Rải đều khắp chiều cao ngay từ khung đầu,
    // nếu không khung đầu sẽ trống trơn và phải chờ vài giây mới thấy gì.
    const colW = 20;
    this.matrixCols = [];
    const numCols = Math.floor(W / colW);
    const glyphs = "0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ";
    for (let i = 0; i < numCols; i++) {
      this.matrixCols.push({
        x: i * colW + 2,
        y: Math.random() * (H + 600) - 300,   // -300 .. H+300
        speed: 2.5 + Math.random() * 7,
        len: 8 + ((Math.random() * 22) | 0),
        chars: Array.from({ length: 30 }, () => glyphs[(Math.random() * glyphs.length) | 0]),
        doDam: 0.5 + Math.random() * 0.5,
      });
    }

    // Galaxy: 3 lớp sao, mỗi lớp một tốc độ xoay
    this.sao = [];
    for (let lop = 0; lop < 3; lop++) {
      const soLuong = [420, 260, 130][lop];
      for (let i = 0; i < soLuong; i++) {
        this.sao.push({
          x: (Math.random() - 0.5) * W * 2.1,
          y: (Math.random() - 0.5) * H * 2.1,
          lop,
          to: 0.7 + Math.random() * 2.2,
          mau: ["#ffffff", "#cfe8ff", "#e6c6ff", "#ffe9b0", "#a8f0ff"][(Math.random() * 5) | 0],
          nhap: Math.random() * Math.PI * 2,
          xoay: (0.006 + lop * 0.004) * (1 + Math.random() * 0.4),
        });
      }
    }

    // Sao băng
    this.saoBang = [];
    this.saoBangChoTiep = 3 + Math.random() * 6;

    // Koi: cá + lá sen + cánh hoa
    this.koi = [
      { x: W * 0.38, y: H * 0.44, a: 0.6, v: 1.7, mau: "#ff6a1a", dom: "#fff5e8", to: 135 },
      { x: W * 0.62, y: H * 0.58, a: 2.3, v: 1.4, mau: "#f7f2e8", dom: "#e02a00", to: 150 },
      { x: W * 0.28, y: H * 0.68, a: -1.1, v: 1.9, mau: "#ffb020", dom: "#2a1a10", to: 120 },
      { x: W * 0.72, y: H * 0.34, a: 3.6, v: 1.25, mau: "#1c1c22", dom: "#ff8a3d", to: 128 },
    ];
    this.canhs = [];
    for (let i = 0; i < 26; i++) {
      this.canhs.push({
        x: Math.random() * W,
        y: Math.random() * H,
        a: Math.random() * Math.PI * 2,
        v: 0.35 + Math.random() * 0.6,
        xoay: (Math.random() - 0.5) * 0.02,
        to: 6 + Math.random() * 7,
        mau: ["#ffc9dd", "#ffd9e8", "#ffe8f0"][(Math.random() * 3) | 0],
      });
    }

    // Lò sưởi: hạt lửa + tàn
    this.hotLua = [];
    for (let i = 0; i < 120; i++) this.hotLua.push(this.taoHotLua(W, H, true));
    this.hoiNuoc = [];
    for (let i = 0; i < 18; i++) {
      this.hoiNuoc.push({
        x: W * 0.5 + (Math.random() - 0.5) * 520,
        y: H * 0.9,
        v: 0.3 + Math.random() * 0.8,
        to: 30 + Math.random() * 90,
      });
    }

    // Mưa: hạt + toà nhà + vũng
    this.mua = [];
    for (let i = 0; i < 220; i++) this.mua.push(this.taoHatMua(W, H, true));
    this.toaNha = [];
    let x = -40;
    while (x < W + 80) {
      const rong = 60 + Math.random() * 110;
      const cao = 180 + Math.random() * 620;
      this.toaNha.push({
        x,
        rong,
        cao,
        cuaSo: Array.from({ length: 40 }, () => Math.random() > 0.55),
        neon: Math.random() > 0.7 ? ["#ff3d94", "#33d6ff", "#ffb000"][(Math.random() * 3) | 0] : null,
      });
      x += rong + 10 + Math.random() * 30;
    }
    this.vungNuoc = [];
    for (let i = 0; i < 14; i++) {
      this.vungNuoc.push({
        x: Math.random() * W,
        y: H * 0.88 + Math.random() * 0.1 * H,
        r: 0,
        rMax: 40 + Math.random() * 90,
        tre: Math.random() * 2,
      });
    }
  }

  // ── Tiện ích ────────────────────────────────────────────────────────────
  nen(ctx, paint, alphaPhu = 0.12) {
    ctx.save();
    if (this.cheDoPhu) {
      ctx.clearRect(0, 0, this.cv.width, this.cv.height);
      ctx.globalAlpha = alphaPhu;
    }
    ctx.fillStyle = paint;
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    ctx.restore();
  }

  setCheDoPhu(bat) {
    this.cheDoPhu = !!bat;
    if (this.lagoonEngine) this.lagoonEngine.cheDoPhu = !!bat;
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
  }

  setTheme(themeName) {
    if (this.activeTheme === themeName) return;
    this.activeTheme = themeName;
    this.t0 = performance.now();
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
  }

  // ── Đổ ASCII từ mẫu màu ─────────────────────────────────────────────────
  /**
   * Bí quyết tạo chất "mosaic ASCII" của bản Lagoon:
   *   alpha cao  → TÔ KÍN ô bằng màu, rồi đè ký tự lên trên
   *   alpha thấp → chỉ vẽ ký tự rìa
   * Nếu chỉ vẽ chữ mà không tô ô, hình sẽ thưa như đám bụi.
   *
   * @param {Float32Array} L mẫu từ AsciiRaster.layMau()
   * @param {object} o
   *   ramp    — dải ký tự tăng dần độ sáng
   *   toMau   — hàm (r,g,b,doSang,alpha,cot,hang) => css color
   *   nguong  — ngưỡng alpha tối thiểu
   *   doDuc   — nhân alpha chung
   *   toO     — có tô kín ô không (mặc định có)
   */
  doAscii(L, o = {}) {
    const ctx = this.ctx;
    const ramp = o.ramp || " .·:-=+*✦#%@";
    const nguong = o.nguong ?? 0.12;
    const doDuc = o.doDuc ?? 1;
    const toMau = o.toMau || ((r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`);
    const toO = o.toO !== false;
    const doDacO = o.doDacO ?? 0.85;

    ctx.font = o.font || '500 15px "Cascadia Mono", "Consolas", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let j = 0; j < this.ROWS; j++) {
      for (let i = 0; i < this.COLS; i++) {
        const p = (j * this.COLS + i) * 4;
        const a = L[p + 3];
        if (a < nguong) continue;

        const x = i * this.CW + this.CW / 2;
        const y = j * this.CH + this.CH / 2;
        const r = L[p], g = L[p + 1], b = L[p + 2];
        const doSang = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

        if (a > 0.45) {
          // Tô kín ô: đây là thứ tạo cảm giác "khảm ASCII" đặc.
          // Ở chế độ phủ thì KHÔNG tô — sẽ che chữ của app bên dưới.
          if (toO && !this.cheDoPhu) {
            ctx.fillStyle = toMau(r, g, b, doSang, a, i, j);
            ctx.globalAlpha = Math.min(1, a) * doDuc * doDacO;
            ctx.fillRect(i * this.CW + 1, j * this.CH + 1, this.CW - 2, this.CH - 2);
          }
          const chi = Math.max(0, Math.min(ramp.length - 1, (doSang * (ramp.length - 1)) | 0));
          ctx.fillStyle = this.mauChu(r, g, b, doSang);
          ctx.globalAlpha = Math.min(1, a) * doDuc * (this.cheDoPhu ? 0.85 : 1);
          ctx.fillText(ramp[chi] || "#", x, y);
        } else {
          ctx.fillStyle = toMau(r, g, b, doSang, a * 0.6, i, j);
          ctx.globalAlpha = Math.min(1, a * 2) * doDuc;
          ctx.fillText("·", x, y);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  /** Màu chữ tương phản với nền ô: nền tối -> chữ sáng, nền sáng -> chữ tối. */
  mauChu(r, g, b, doSang) {
    if (doSang < 0.42) {
      // nền tối: kéo chữ về phía trắng
      return `rgb(${Math.min(255, r + (255 - r) * 0.62) | 0},${Math.min(255, g + (255 - g) * 0.62) | 0},${Math.min(255, b + (255 - b) * 0.62) | 0})`;
    }
    // nền sáng: kéo chữ về phía đen
    return `rgb(${(r * 0.45) | 0},${(g * 0.45) | 0},${(b * 0.45) | 0})`;
  }

  // ── Sóng ánh sáng dưới nước (caustics) dùng chung ───────────────────────
  veCaustics(t, mau = "120,235,215", matDo = 1, nguong = 1.55) {
    const ctx = this.ctx;
    const w = (Math.PI * 2) / 24.5;
    ctx.font = '500 15px "Cascadia Mono", "Consolas", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let j = 0; j < this.ROWS; j += 1) {
      for (let i = 0; i < this.COLS; i += 1) {
        const x = i * this.CW, y = j * this.CH;
        const v =
          Math.sin(x * 0.011 + y * 0.004 + w * 2 * t + 1.6 * Math.sin(y * 0.007 - w * 3 * t)) +
          Math.sin(-x * 0.006 + y * 0.012 - w * 3 * t + 1.6 * Math.sin(x * 0.008 + w * 2 * t)) +
          Math.sin(x * 0.009 - y * 0.009 + w * 4 * t + 1.2 * Math.sin((x + y) * 0.005 + w * t));

        if (v > nguong) {
          const k = Math.min(1, (v - nguong) / 1.2) * matDo;
          ctx.fillStyle = `rgba(${mau},${(0.13 + 0.42 * k).toFixed(3)})`;
          ctx.fillText(k > 0.62 ? "~" : k > 0.3 ? "-" : "·", x + this.CW / 2, y + this.CH / 2);
        }
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Theme 2: Hồ Cá Koi Nhật Bản
  // ───────────────────────────────────────────────────────────────────────
  drawKoiPond(t) {
    const ctx = this.ctx;
    const W = this.cv.width, H = this.cv.height;

    // Nước hồ: ngọc lục bảo sáng, có lưới kẻ như bản Lagoon
    if (this.cheDoPhu) {
      ctx.clearRect(0, 0, W, H);
    } else {
      const nen = ctx.createLinearGradient(0, 0, W * 0.5, H);
      nen.addColorStop(0, "#7fe8c8");
      nen.addColorStop(0.35, "#3ecfae");
      nen.addColorStop(0.72, "#1a9d8c");
      nen.addColorStop(1, "#0d6b62");
      ctx.fillStyle = nen;
      ctx.fillRect(0, 0, W, H);

      // Lưới kẻ mảnh — tạo chất "giấy ô ly" đặc trưng của ASCII art
      ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
      for (let x = 0; x < W; x += this.CW) ctx.fillRect(x, 0, 1, H);
      for (let y = 0; y < H; y += this.CH) ctx.fillRect(0, y, W, 1);
    }

    // Gợn sóng đồng tâm lan ra từ vài điểm
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.4;
    for (let k = 0; k < 5; k++) {
      const cxp = W * (0.2 + k * 0.17);
      const cyp = H * (0.35 + ((k * 37) % 50) / 100);
      for (let v = 0; v < 3; v++) {
        const ph = ((t * 0.35 + k * 0.21 + v * 0.33) % 1);
        ctx.globalAlpha = (1 - ph) * 0.4;
        ctx.beginPath();
        ctx.arc(cxp, cyp, 30 + ph * 520, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // Sóng ánh sáng ASCII — dày như Lagoon
    this.veCaustics(t, "255, 255, 245", 1.15, 1.35);
    this.veCaustics(t * 0.62 + 3.1, "190, 255, 240", 0.75, 1.75);

    // ── Chủ thể: lá sen, hoa sen, cá Koi, cánh hoa → ASCII ──
    const L = this.raster.layMau((g) => {
      // Lá sen: hình tròn khuyết
      const laSen = (lx, ly, r, xoay) => {
        g.save();
        g.translate(lx, ly);
        g.rotate(xoay);
        g.beginPath();
        g.arc(0, 0, r, 0.18, Math.PI * 1.92);
        g.lineTo(0, 0);
        g.closePath();
        const gr = g.createRadialGradient(-r * 0.15, -r * 0.15, r * 0.05, 0, 0, r);
        gr.addColorStop(0, "#2f8f6e");
        gr.addColorStop(1, "#14513c");
        g.fillStyle = gr;
        g.fill();
        g.strokeStyle = "#5fd0a4";
        g.lineWidth = 2;
        g.stroke();
        // gân lá
        g.strokeStyle = "rgba(120, 220, 175, 0.45)";
        g.lineWidth = 1.3;
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2;
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88);
          g.stroke();
        }
        g.restore();
      };
      laSen(W * 0.16, H * 0.22, 190, 0.4 + Math.sin(t * 0.2) * 0.05);
      laSen(W * 0.85, H * 0.28, 210, -0.9 + Math.sin(t * 0.17) * 0.05);
      laSen(W * 0.22, H * 0.82, 215, 2.1 + Math.sin(t * 0.15) * 0.05);
      laSen(W * 0.8, H * 0.76, 180, 1.2 + Math.sin(t * 0.19) * 0.05);

      // Hoa sen: 8 cánh
      const hoaSen = (hx, hy, r, ph) => {
        g.save();
        g.translate(hx, hy);
        g.rotate(Math.sin(t * 0.25 + ph) * 0.08);
        for (let k = 0; k < 8; k++) {
          g.save();
          g.rotate((k / 8) * Math.PI * 2 + ph);
          const gr = g.createLinearGradient(0, 0, 0, -r);
          gr.addColorStop(0, "#ff8fb8");
          gr.addColorStop(1, "#ffe4f0");
          g.fillStyle = gr;
          g.beginPath();
          g.ellipse(0, -r * 0.5, r * 0.22, r * 0.55, 0, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
        g.fillStyle = "#ffd94a";
        g.beginPath();
        g.arc(0, 0, r * 0.2, 0, Math.PI * 2);
        g.fill();
        g.restore();
      };
      hoaSen(W * 0.68, H * 0.16, 96, 0);
      hoaSen(W * 0.13, H * 0.6, 78, 1.7);
      hoaSen(W * 0.9, H * 0.55, 82, 3.1);

      // Cá Koi
      this.koi.forEach((k, idx) => {
        k.a += Math.sin(t * 0.55 + idx * 1.9) * 0.028;
        k.x += Math.cos(k.a) * k.v;
        k.y += Math.sin(k.a) * k.v;
        if (k.x < -160) k.x = W + 160;
        if (k.x > W + 160) k.x = -160;
        if (k.y < -160) k.y = H + 160;
        if (k.y > H + 160) k.y = -160;

        g.save();
        g.translate(k.x, k.y);
        g.rotate(k.a);

        // đuôi vẫy
        const vay = Math.sin(t * 5.5 + idx) * 0.35;
        g.save();
        g.translate(-k.to * 0.85, 0);
        g.rotate(vay);
        g.fillStyle = "rgba(255, 255, 255, 0.72)";
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(-k.to * 0.5, -k.to * 0.45, -k.to * 0.72, 0);
        g.quadraticCurveTo(-k.to * 0.5, k.to * 0.45, 0, 0);
        g.fill();
        g.restore();

        // vây bên
        g.fillStyle = "rgba(255, 255, 255, 0.5)";
        g.beginPath();
        g.ellipse(k.to * 0.12, -k.to * 0.34, k.to * 0.24, k.to * 0.1, 0.45, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.ellipse(k.to * 0.12, k.to * 0.34, k.to * 0.24, k.to * 0.1, -0.45, 0, Math.PI * 2);
        g.fill();

        // thân
        const gr = g.createLinearGradient(-k.to, 0, k.to, 0);
        gr.addColorStop(0, k.mau);
        gr.addColorStop(0.62, k.mau);
        gr.addColorStop(1, k.dom);
        g.fillStyle = gr;
        g.beginPath();
        g.ellipse(0, 0, k.to, k.to * 0.36, 0, 0, Math.PI * 2);
        g.fill();

        // đốm
        g.fillStyle = k.dom;
        g.beginPath();
        g.ellipse(k.to * 0.22, -k.to * 0.09, k.to * 0.32, k.to * 0.17, 0.3, 0, Math.PI * 2);
        g.fill();

        // mắt
        g.fillStyle = "#05070a";
        g.beginPath();
        g.arc(k.to * 0.62, -k.to * 0.14, k.to * 0.07, 0, Math.PI * 2);
        g.fill();

        g.restore();
      });

      // Cánh hoa anh đào trôi
      this.canhs.forEach((c) => {
        c.x += Math.cos(c.a) * c.v + Math.sin(t * 0.7 + c.y * 0.01) * 0.5;
        c.y += Math.sin(c.a) * c.v + 0.25;
        c.a += c.xoay;
        if (c.y > H + 40) { c.y = -40; c.x = Math.random() * W; }
        if (c.x < -40) c.x = W + 40;
        if (c.x > W + 40) c.x = -40;

        g.save();
        g.translate(c.x, c.y);
        g.rotate(c.a);
        g.fillStyle = c.mau;
        g.beginPath();
        g.ellipse(0, 0, c.to, c.to * 0.55, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      });
    });

    this.doAscii(L, {
      ramp: "8%XSSt%t;:",
      doDuc: 1,
      doDacO: 0.9,
      toMau: (r, gg, b, sang) => {
        const k = 0.85 + sang * 0.5;
        return `rgb(${Math.min(255, r * k) | 0},${Math.min(255, gg * k) | 0},${Math.min(255, b * k) | 0})`;
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Theme 3: Dải Ngân Hà
  // ───────────────────────────────────────────────────────────────────────
  drawGalaxy(t) {
    const ctx = this.ctx;
    const W = this.cv.width, H = this.cv.height;
    const cx = W / 2, cy = H / 2;

    // Nền vũ trụ
    this.nen(ctx, "#04040e", 0.09);

    // Tinh vân
    const neb = (ox, oy, banKinh, c1, c2, c3) => {
      const g = ctx.createRadialGradient(cx + ox, cy + oy, 10, cx + ox, cy + oy, banKinh);
      g.addColorStop(0, c1);
      g.addColorStop(0.45, c2);
      g.addColorStop(1, c3);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    };
    const nhip = 0.5 + 0.5 * Math.sin(t * 0.18);
    neb(-180, -90, 700, `rgba(126, 58, 255, ${0.05 + nhip * 0.06})`, "rgba(52, 90, 240, 0.1)", "rgba(0,0,0,0)");
    neb(200, 130, 640, `rgba(255, 60, 150, ${0.045 + (1 - nhip) * 0.055})`, "rgba(60, 210, 220, 0.09)", "rgba(0,0,0,0)");
    neb(40, -220, 420, "rgba(90, 200, 255, 0.07)", "rgba(0,0,0,0)", "rgba(0,0,0,0)");

    // ── Sao + nhánh xoắn ốc → ASCII ──
    const L = this.raster.layMau((g) => {
      // Nhánh xoắn ốc: vẽ theo kiểu "cọ vẽ" dày, mỗi bước là 1 đĩa mờ lớn.
      // Chấm nhỏ 2-4px sẽ bị lưới lấy mẫu 16x22 nuốt mất -> phải lớn hơn ô.
      for (let nhanh = 0; nhanh < 2; nhanh++) {
        const lech = nhanh * Math.PI;
        for (let s = 0; s < 520; s++) {
          const u = s / 520;
          const r = 55 + u * 1080;
          const goc = lech + u * 4.9 + t * 0.05;
          const tan = 0.3 * r;

          // 3 đốm mỗi bước để nhánh dày, có hạt
          for (let k = 0; k < 3; k++) {
            const px = cx + Math.cos(goc) * r + (Math.random() - 0.5) * tan;
            const py = cy + Math.sin(goc) * r * 0.4 + (Math.random() - 0.5) * tan * 0.45;
            const doSang = Math.max(0.12, 1 - u * 0.8);
            // Bán kính PHẢI > nửa đường chéo ô (16,22 -> ~13px)
            const to = 16 + Math.random() * 30 * (1 - u * 0.5);

            const gr = g.createRadialGradient(px, py, 0, px, py, to);
            gr.addColorStop(0, `rgba(255, 252, 245, ${0.5 * doSang})`);
            gr.addColorStop(0.35, `rgba(185, 165, 255, ${0.3 * doSang})`);
            gr.addColorStop(0.7, `rgba(110, 80, 230, ${0.12 * doSang})`);
            gr.addColorStop(1, "rgba(60, 30, 160, 0)");
            g.fillStyle = gr;
            g.beginPath();
            g.arc(px, py, to, 0, Math.PI * 2);
            g.fill();
          }
        }
      }

      // Lõi thiên hà: sáng, đặc, to
      const loi = g.createRadialGradient(cx, cy, 6, cx, cy, 230);
      loi.addColorStop(0, "rgba(255, 255, 252, 1)");
      loi.addColorStop(0.2, "rgba(255, 240, 195, 0.8)");
      loi.addColorStop(0.5, "rgba(215, 170, 255, 0.4)");
      loi.addColorStop(1, "rgba(90, 45, 170, 0)");
      g.fillStyle = loi;
      g.beginPath();
      g.arc(cx, cy, 230, 0, Math.PI * 2);
      g.fill();

      // Sao nền: xoay theo lớp. Bán kính phải đủ lớn để sống sót qua lưới.
      this.sao.forEach((s) => {
        const a = t * s.xoay;
        const rx = s.x * Math.cos(a) - s.y * Math.sin(a);
        const ry = s.x * Math.sin(a) + s.y * Math.cos(a);
        const px = cx + rx, py = cy + ry;
        if (px < -30 || px > W + 30 || py < -30 || py > H + 30) return;
        const nhap = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.2 + s.nhap));
        const to = 7 + s.to * 5;
        const gr = g.createRadialGradient(px, py, 0, px, py, to);
        gr.addColorStop(0, s.mau);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr;
        g.globalAlpha = nhap;
        g.beginPath();
        g.arc(px, py, to, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      });

      // Sao băng
      if (t > this.saoBangChoTiep) {
        this.saoBang.push({
          x: Math.random() * W * 0.8,
          y: Math.random() * H * 0.4,
          vx: 12 + Math.random() * 9,
          vy: 5 + Math.random() * 4,
          song: 70 + Math.random() * 50,
        });
        this.saoBangChoTiep = t + 3 + Math.random() * 6;
      }
      this.saoBang = this.saoBang.filter((sb) => {
        sb.x += sb.vx;
        sb.y += sb.vy;
        sb.song--;
        if (sb.song <= 0) return false;
        const gr = g.createLinearGradient(sb.x, sb.y, sb.x - sb.vx * 5, sb.y - sb.vy * 5);
        gr.addColorStop(0, "rgba(255, 255, 255, 0.9)");
        gr.addColorStop(1, "rgba(160, 210, 255, 0)");
        g.strokeStyle = gr;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(sb.x, sb.y);
        g.lineTo(sb.x - sb.vx * 5, sb.y - sb.vy * 5);
        g.stroke();
        return true;
      });
    });

    this.doAscii(L, {
      ramp: " ·:;+=xX✦★",
      doDuc: 1,
      doDacO: 0.9,
      nguong: 0.05,
      toMau: (r, g, b, sang) => {
        if (sang > 0.78) return "#ffffff";
        if (sang > 0.45) return `rgb(${Math.min(255, r * 1.15) | 0},${Math.min(255, g * 1.1) | 0},${Math.min(255, b * 1.15) | 0})`;
        return `rgba(${r | 0},${g | 0},${b | 0},${0.6 + sang * 0.5})`;
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Theme 4: Mưa Mã Ma Trận
  // ───────────────────────────────────────────────────────────────────────
  drawMatrix(t) {
    const ctx = this.ctx;
    const W = this.cv.width, H = this.cv.height;

    // Nền tối, ở chế độ phủ thì xoá sạch để thấy app bên dưới
    if (this.cheDoPhu) ctx.clearRect(0, 0, W, H);
    else {
      ctx.fillStyle = "rgba(2, 8, 5, 0.30)";
      ctx.fillRect(0, 0, W, H);
    }

    ctx.font = 'bold 15px "Cascadia Mono", "Consolas", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const glyphs = "0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ";
    const bw = 20;

    this.matrixCols.forEach((c) => {
      c.y += c.speed;
      if (c.y - c.len * bw > H) {
        c.y = -Math.random() * 400;
        c.speed = 2.5 + Math.random() * 7;
        c.len = 8 + ((Math.random() * 22) | 0);
      }
      if (Math.random() < 0.09) {
        const i = (Math.random() * c.chars.length) | 0;
        c.chars[i] = glyphs[(Math.random() * glyphs.length) | 0];
      }

      for (let k = 0; k < c.len; k++) {
        const y = c.y - k * bw;
        if (y < -20 || y > H + 20) continue;

        if (k === 0) {
          ctx.fillStyle = "#eafff0";
          ctx.shadowColor = "#4dff88";
          ctx.shadowBlur = 10;
          ctx.globalAlpha = 1;
        } else if (k < 3) {
          ctx.fillStyle = "#7dffa8";
          ctx.shadowColor = "#39ff70";
          ctx.shadowBlur = 5;
          ctx.globalAlpha = 1;
        } else {
          ctx.shadowBlur = 0;
          const phai = 1 - k / c.len;
          ctx.fillStyle = `rgb(20, ${(150 + 90 * phai) | 0}, 60)`;
          ctx.globalAlpha = Math.max(0.06, phai * 0.92) * c.doDam;
        }
        ctx.fillText(c.chars[k % c.chars.length], c.x, y);
      }
      ctx.globalAlpha = 1;
    });

    ctx.shadowBlur = 0;

    // Vệt quét ngang thỉnh thoảng (glitch)
    const chuKy = 9;
    const pha = (t % chuKy) / chuKy;
    if (pha < 0.06) {
      const y = (pha / 0.06) * H;
      ctx.fillStyle = "rgba(120, 255, 170, 0.07)";
      ctx.fillRect(0, y, W, 22);
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Theme 5: Lò Sưởi Ấm Cúng
  // ───────────────────────────────────────────────────────────────────────
  taoHotLua(W, H, dauTien) {
    return {
      x: W * 0.5 + (Math.random() - 0.5) * 460,
      y: dauTien ? H * 0.9 + Math.random() * 60 : H * 0.92,
      vx: (Math.random() - 0.5) * 1.6,
      vy: -(1.6 + Math.random() * 4.2),
      to: 1 + Math.random() * 3,
      doi: 1,
      giam: 0.004 + Math.random() * 0.012,
    };
  }

  drawFireplace(t) {
    const ctx = this.ctx;
    const W = this.cv.width, H = this.cv.height;

    this.nen(ctx, "#0d0603", 0.09);

    // ── Quầng sáng + ngọn lửa → ASCII ──
    const L = this.raster.layMau((g) => {
      const loX = W * 0.5, miengY = H * 0.86;

      // Quầng sáng ấm — toả rộng, không tạo đĩa đặc ở đáy
      const nhap = 0.88 + 0.12 * Math.sin(t * 9.3) + 0.05 * Math.sin(t * 21.7);
      const glow = g.createRadialGradient(loX, miengY - 60, 40, loX, miengY - 40, 1050 * nhap);
      glow.addColorStop(0, "rgba(255, 190, 90, 0.42)");
      glow.addColorStop(0.22, "rgba(255, 120, 22, 0.24)");
      glow.addColorStop(0.55, "rgba(170, 42, 6, 0.1)");
      glow.addColorStop(1, "rgba(40, 6, 0, 0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, W, H);

      // Nền lò tối (đè lên phần dưới của quầng sáng để không thành đĩa be)
      const san = g.createLinearGradient(0, miengY, 0, H);
      san.addColorStop(0, "rgba(10, 4, 2, 0.55)");
      san.addColorStop(1, "rgba(4, 2, 1, 0.95)");
      g.fillStyle = san;
      g.fillRect(0, miengY, W, H - miengY);

      // ── Ngọn lửa: các lưỡi TÁCH RỜI, hẹp và cao, có khe tối giữa ──
      // Khe tối là mấu chốt: nếu các lưỡi dính nhau, ASCII gộp thành 1 khối.
      const soLop = 3;
      for (let lop = 0; lop < soLop; lop++) {
        const tiLe = 1 - lop * 0.3;
        const soLoi = [7, 5, 3][lop];
        for (let i = 0; i < soLoi; i++) {
          const giua = (soLoi - 1) / 2;
          const lech = soLoi === 1 ? 0 : (i - giua) / giua;

          const nhip =
            0.5 * Math.sin(t * 2.7 + i * 2.1 + lop * 1.3) +
            0.32 * Math.sin(t * 6.9 + i * 4.3) +
            0.18 * Math.sin(t * 12.6 + i * 6.7);

          // Lưỡi giữa cao nhất
          const caoGoc = 1 - Math.abs(lech) * 0.5;
          const cao = (430 + 190 * nhip) * caoGoc * tiLe;
          const rong = (22 + 8 * nhip) * tiLe;   // hẹp -> ASCII phân biệt được
          const bx = loX + lech * 330 * tiLe + Math.sin(t * 1.9 + i * 1.4) * 16;

          const gr = g.createLinearGradient(bx, miengY + 10, bx, miengY - cao);
          if (lop === 0) {
            gr.addColorStop(0, "rgba(215, 70, 6, 0.9)");
            gr.addColorStop(0.45, "rgba(160, 35, 4, 0.55)");
            gr.addColorStop(1, "rgba(90, 12, 0, 0)");
          } else if (lop === 1) {
            gr.addColorStop(0, "rgba(255, 155, 25, 0.95)");
            gr.addColorStop(0.5, "rgba(240, 85, 8, 0.62)");
            gr.addColorStop(1, "rgba(150, 25, 0, 0)");
          } else {
            gr.addColorStop(0, "rgba(255, 248, 205, 1)");
            gr.addColorStop(0.42, "rgba(255, 196, 70, 0.9)");
            gr.addColorStop(1, "rgba(200, 60, 0, 0)");
          }
          g.fillStyle = gr;

          g.beginPath();
          g.moveTo(bx - rong, miengY + 10);
          g.bezierCurveTo(
            bx - rong * 1.15, miengY - cao * 0.45,
            bx - rong * 0.55, miengY - cao * 0.82,
            bx + Math.sin(t * 3.6 + i * 2.2) * 20, miengY - cao
          );
          g.bezierCurveTo(
            bx + rong * 0.55, miengY - cao * 0.82,
            bx + rong * 1.15, miengY - cao * 0.45,
            bx + rong, miengY + 10
          );
          g.closePath();
          g.fill();
        }
      }

      // ── Củi cháy (vẽ SAU lửa để không bị lưỡi lửa che mất) ──
      g.fillStyle = "#1e0c05";
      g.beginPath();
      g.ellipse(loX - 130, miengY + 34, 185, 24, -0.08, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(loX + 140, miengY + 38, 170, 22, 0.1, 0, Math.PI * 2);
      g.fill();

      // Than hồng: chấm sáng rải rác, nhấp nháy
      for (let i = 0; i < 46; i++) {
        const px = loX + (Math.sin(i * 12.9) * 0.5) * 340;
        const py = miengY + 26 + (Math.sin(i * 41.3) * 0.5 + 0.5) * 24;
        const nhapThan = 0.45 + 0.55 * Math.sin(t * 3.4 + i * 1.9);
        g.fillStyle = `rgba(255, ${(70 + nhapThan * 110) | 0}, 15, ${0.35 + nhapThan * 0.55})`;
        g.beginPath();
        g.arc(px, py, 2.5 + nhapThan * 5, 0, Math.PI * 2);
        g.fill();
      }

      // ── Tàn lửa bay ──
      this.hotLua.forEach((p, i) => {
        p.x += p.vx + Math.sin(t * 3 + i) * 1.1;
        p.y += p.vy;
        p.doi -= p.giam;
        p.vy -= 0.006;
        if (p.doi <= 0 || p.y < H * 0.14) {
          this.hotLua[i] = this.taoHotLua(W, H, false);
          return;
        }
        const a = Math.max(0, p.doi);
        g.fillStyle = p.doi > 0.65
          ? `rgba(255, 235, 150, ${a})`
          : p.doi > 0.32
            ? `rgba(255, 130, 30, ${a})`
            : `rgba(180, 45, 8, ${a * 0.8})`;
        g.beginPath();
        g.arc(p.x, p.y, p.to, 0, Math.PI * 2);
        g.fill();
      });
    });

    this.doAscii(L, {
      ramp: " .·:-=+*#%@",
      doDuc: 1,
      doDacO: 0.92,
      nguong: 0.08,
      toMau: (r, g, b, sang) => {
        // Lửa: sáng thì trắng-vàng, tối thì đỏ sẫm
        if (sang > 0.86) return "#fffdf0";
        if (sang > 0.66) return "#ffd45e";
        if (sang > 0.46) return "#ff8c22";
        if (sang > 0.26) return "#d13a06";
        return `rgba(${r | 0},${g | 0},${b | 0},0.85)`;
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Theme 6: Đêm Mưa Thành Phố
  // ───────────────────────────────────────────────────────────────────────
  taoHatMua(W, H, dauTien) {
    return {
      x: Math.random() * W * 1.25 - W * 0.15,
      y: dauTien ? Math.random() * H : -30,
      dai: 14 + Math.random() * 30,
      nhanh: 15 + Math.random() * 13,
      day: 1 + Math.random() * 1.6,
      doDuc: 0.18 + Math.random() * 0.5,
    };
  }

  drawRain(t) {
    const ctx = this.ctx;
    const W = this.cv.width, H = this.cv.height;

    const nen = ctx.createLinearGradient(0, 0, 0, H);
    nen.addColorStop(0, "#05060f");
    nen.addColorStop(0.6, "#080d1c");
    nen.addColorStop(1, "#0b1226");
    this.nen(ctx, nen, 0.1);

    // Neon nền
    const neon = (nx, ny, bk, mau) => {
      const g = ctx.createRadialGradient(nx, ny, 10, nx, ny, bk);
      g.addColorStop(0, mau);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    };
    const nhip = 0.5 + 0.5 * Math.sin(t * 0.7);
    neon(W * 0.22, H * 0.86, 500, `rgba(255, 55, 150, ${0.1 + nhip * 0.05})`);
    neon(W * 0.78, H * 0.86, 480, `rgba(50, 190, 255, ${0.1 + (1 - nhip) * 0.05})`);
    neon(W * 0.5, H * 0.7, 620, "rgba(120, 90, 255, 0.06)");

    // ── Toà nhà + vũng nước → ASCII ──
    const L = this.raster.layMau((g) => {
      const duongChan = H * 0.885;

      // Bóng toà nhà
      this.toaNha.forEach((tn) => {
        const top = duongChan - tn.cao;
        g.fillStyle = "#0a1020";
        g.fillRect(tn.x, top, tn.rong, tn.cao);
        g.strokeStyle = "rgba(70, 110, 170, 0.35)";
        g.lineWidth = 1.5;
        g.strokeRect(tn.x, top, tn.rong, tn.cao);

        // Cửa sổ sáng
        const cot = Math.max(2, Math.floor(tn.rong / 26));
        const hang = Math.max(2, Math.floor(tn.cao / 34));
        for (let c = 0; c < cot; c++) {
          for (let r = 0; r < hang; r++) {
            const idx = c * hang + r;
            if (!tn.cuaSo[idx % tn.cuaSo.length]) continue;
            // một số cửa sổ tắt/bật theo thời gian
            if ((c * 7 + r * 13) % 11 === 0 && Math.sin(t * 2 + idx) > 0.4) continue;
            const wx = tn.x + 8 + c * 26;
            const wy = top + 12 + r * 34;
            g.fillStyle = "rgba(255, 214, 130, 0.85)";
            g.fillRect(wx, wy, 11, 15);
          }
        }

        // Bảng neon
        if (tn.neon) {
          const nhap = 0.55 + 0.45 * Math.sin(t * 5 + tn.x);
          g.fillStyle = tn.neon;
          g.globalAlpha = 0.85 * nhap;
          g.fillRect(tn.x + 10, top + 24, Math.min(tn.rong - 20, 70), 12);
          g.beginPath();
          g.arc(tn.x + tn.rong * 0.5, top + 24, 26, 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 1;
        }
      });

      // Mặt đường ướt
      g.fillStyle = "#070b16";
      g.fillRect(0, duongChan, W, H - duongChan);

      // Vũng nước lan
      this.vungNuoc.forEach((v) => {
        v.tre -= 0.016;
        if (v.tre <= 0) {
          v.r += 2.6;
          if (v.r > v.rMax) { v.r = 0; v.tre = 0.3 + Math.random() * 1.4; }
        }
        if (v.r > 0) {
          g.strokeStyle = `rgba(150, 215, 255, ${Math.max(0, 0.5 - v.r / v.rMax / 2)})`;
          g.lineWidth = 1.6;
          g.beginPath();
          g.ellipse(v.x, v.y, v.r, v.r * 0.32, 0, 0, Math.PI * 2);
          g.stroke();
        }
      });
    });

    this.doAscii(L, {
      ramp: " .·:-=+*#",
      doDuc: 0.95,
      nguong: 0.1,
      toMau: (r, g, b, sang) => {
        if (sang > 0.6) return "#ffe9b0";
        if (sang > 0.35) return `rgb(${Math.min(255, r) | 0},${Math.min(255, g) | 0},${Math.min(255, b) | 0})`;
        return `rgba(${r | 0},${g | 0},${b | 0},0.8)`;
      },
    });

    // ── Mưa rơi (vẽ sau để nằm trên cùng) ──
    ctx.strokeStyle = "rgba(175, 220, 255, 0.42)";
    ctx.lineCap = "round";
    this.mua.forEach((d, i) => {
      d.y += d.nhanh;
      d.x += d.nhanh * 0.24;   // gió thổi xiên
      if (d.y > H + 40) this.mua[i] = this.taoHatMua(W, H, false);
      if (d.x > W + 40) d.x = -40;

      ctx.globalAlpha = d.doDuc;
      ctx.lineWidth = d.day;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.dai * 0.24, d.y - d.dai);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Chớp giật thỉnh thoảng
    const chuKy = 13;
    const pha = (t % chuKy) / chuKy;
    if (pha > 0.5 && pha < 0.515) {
      ctx.fillStyle = `rgba(200, 225, 255, ${0.09 * (1 - (pha - 0.5) / 0.015)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Vòng đời
  // ───────────────────────────────────────────────────────────────────────
  start() {
    if (this.running) return;
    this.running = true;
    this.t0 = performance.now();

    const renderLoop = (now) => {
      if (!this.running) return;
      this.veMotKhung((now - this.t0) / 1000);
      this.rafId = requestAnimationFrame(renderLoop);
    };

    this.rafId = requestAnimationFrame(renderLoop);
  }

  // Vẽ đúng một khung hình tại thời điểm t (giây).
  // Tách riêng để lớp phủ trong AGY có thể tự điều nhịp vẽ:
  // khi cửa sổ bị che khuất, Chromium dừng requestAnimationFrame.
  veMotKhung(t) {
    switch (this.activeTheme) {
      case "lagoon":
        this.lagoonEngine.draw(t);
        break;
      case "koi":
        this.drawKoiPond(t);
        break;
      case "galaxy":
        this.drawGalaxy(t);
        break;
      case "matrix":
        this.drawMatrix(t);
        break;
      case "fireplace":
        this.drawFireplace(t);
        break;
      case "rain":
        this.drawRain(t);
        break;
      default:
        this.lagoonEngine.draw(t);
    }
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.intervalId) clearInterval(this.intervalId);
  }

  /**
   * Nhịp vẽ dự phòng: dùng setInterval thay requestAnimationFrame.
   * Cần thiết khi app bị che khuất (document.hidden = true) — Chromium
   * dừng hẳn rAF nên lớp phủ trong AGY sẽ đứng hình nếu chỉ dựa vào rAF.
   * @param {number} fps
   */
  startBangInterval(fps = 24) {
    if (this.intervalId) clearInterval(this.intervalId);
    this.running = true;
    this.t0 = performance.now();
    const buoc = 1000 / fps;
    this.intervalId = setInterval(() => {
      if (!this.running) return;
      this.veMotKhung((performance.now() - this.t0) / 1000);
    }, buoc);
  }
}
