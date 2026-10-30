// ═══════════════════════════════════════════════════════════════════════════
// Hawaiian Lagoon ASCII Engine (Honu Lagoon)
// Chu kỳ hoàn hảo 24.5s - Render các sinh vật biển bằng ký tự ASCII & Canvas
// ═══════════════════════════════════════════════════════════════════════════

export class LagoonEngine {
  constructor(canvasElement) {
    this.cv = canvasElement;
    this.ctx = this.cv.getContext("2d");
    this.W = 1944;
    this.H = 1760;
    this.T = 24.5;
    this.TAU = Math.PI * 2;
    this.w = this.TAU / this.T;
    this.CW = 16;
    this.CH = 22;
    this.COLS = Math.ceil(this.W / this.CW);
    this.ROWS = Math.ceil(this.H / this.CH);
    this.SS = 4;

    this.running = false;
    this.rafId = null;
    // Chế độ lớp phủ: bỏ nền đặc, chỉ giữ sinh vật ASCII nổi lên trên app bên dưới
    this.cheDoPhu = false;

    this.initLayers();
    this.initReef();
  }

  mk(cw, ch) {
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    return [c, c.getContext("2d", { willReadFrequently: true })];
  }

  initLayers() {
    [this.oc, this.ox] = this.mk(this.COLS * this.SS, this.ROWS * this.SS);
    [this.bgc, this.bgx] = this.mk(this.W, this.H);
    [this.blc, this.blx] = this.mk(this.W, this.H);

    this.STOPS = [
      [0, [178, 244, 232]],
      [0.42, [74, 214, 214]],
      [0.78, [26, 168, 202]],
      [1, [14, 128, 182]],
    ];

    const g = this.bgx.createLinearGradient(0, 0, this.W * 0.45, this.H * 0.9);
    this.STOPS.forEach(([k, c]) => g.addColorStop(k, this.rgb(c)));
    this.bgx.fillStyle = g;
    this.bgx.fillRect(0, 0, this.W, this.H);
    this.bgx.fillStyle = "rgba(255,255,255,0.07)";
    for (let x = 0; x < this.W; x += this.CW) this.bgx.fillRect(x, 0, 1, this.H);
    for (let y = 0; y < this.H; y += this.CH) this.bgx.fillRect(0, y, this.W, 1);

    this.RAMP = "8%XSSt%t;:";
    this.EDGE = "',.o:;";
    this.SPRINK = ["#ff5fa2", "#16c79a", "#8b6cff", "#ffb000"];

    this.P = {
      turtleA: (t) => [972 + 1080 * Math.cos(this.w * t + 0.3), 860 + 640 * Math.sin(this.w * t + 0.3) + 140 * Math.sin(2 * this.w * t)],
      turtleB: (t) => [900 + 700 * Math.sin(-this.w * t + 1), 880 - 1080 * Math.cos(-this.w * t + 1)],
      turtleC: (t) => [972 + 1150 * Math.sin(this.w * t + 4), 900 + 560 * Math.sin(2 * this.w * t + 4.6)],
      manta: (t) => [972 + 1380 * Math.cos(-this.w * t + 3.6), 820 + 900 * Math.sin(-this.w * t + 3.6)],
      dolphin: (t) => [972 + 1350 * Math.cos(2 * this.w * t + 0.8), 900 + 950 * Math.sin(2 * this.w * t + 0.8) + 160 * Math.sin(4 * this.w * t)],
      school: (t) => [972 + 1150 * Math.sin(2 * this.w * t + 5), 880 + 800 * Math.sin(3 * this.w * t + 1)],
      whale: (t) => [972 + 1900 * Math.cos(this.w * t + 2.4), 1350 + 380 * Math.sin(this.w * t + 2.4)],
    };

    this.FISH = [[0, 0], [-120, -70], [-120, 75], [-240, -10], [-230, -140], [-235, 130], [-360, -75], [-355, 70], [-470, 5], [-480, -150], [-470, 150]];
    this.FLOWERS = [["h", 0.0, 260, 1.0, 1], ["p", 0.22, 1240, 0.9, -1], ["h", 0.47, 640, 0.8, -1], ["p", 0.63, 1560, 1.1, 1], ["p", 0.86, 120, 0.8, 1]];
  }

  hash(a, b, c) {
    let h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
    return h - Math.floor(h);
  }

  mix(a, b, k) {
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }

  rgb(c, a = 1) {
    return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  }

  lum(c) {
    return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  }

  water(x, y) {
    const k = Math.min(1, Math.max(0, (x * 0.45 + y * 0.9) / (this.W * 0.45 + this.H * 0.9)));
    for (let i = 1; i < this.STOPS.length; i++) {
      if (k <= this.STOPS[i][0]) {
        return this.mix(this.STOPS[i - 1][1], this.STOPS[i][1], (k - this.STOPS[i - 1][0]) / (this.STOPS[i][0] - this.STOPS[i - 1][0]));
      }
    }
    return this.STOPS[3][1];
  }

  ell(g, x, y, rx, ry, rot, fill) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot || 0, 0, this.TAU);
    g.fillStyle = fill;
    g.fill();
  }

  turtle(g, t, s, ph) {
    const f = Math.sin(this.TAU * 14 * t / this.T + ph);
    for (const m of [-1, 1]) {
      g.save(); g.translate(62, 58 * m); g.rotate(m * (1.15 + 0.55 * f));
      this.ell(g, 0, 78 * m, 26, 92, 0, "#9c8a5c"); this.ell(g, 0, 70 * m, 14, 70, 0, "#c2b183"); g.restore();
      g.save(); g.translate(-92, 40 * m); g.rotate(m * (2.2 - 0.3 * f));
      this.ell(g, 0, 26 * m, 15, 34, 0, "#9c8a5c"); g.restore();
    }
    this.ell(g, 118, 0, 30, 24, 0, "#a39060"); this.ell(g, 150, 0, 34, 27, 0, "#b8a573");
    this.ell(g, 146, -10, 7, 5, 0, "#4b3f22"); this.ell(g, 146, 10, 7, 5, 0, "#4b3f22");
    this.ell(g, 0, 0, 132, 100, 0, "#c9b067");
    const sh = g.createRadialGradient(-10, 0, 10, 0, 0, 125);
    sh.addColorStop(0, "#7d6a2e"); sh.addColorStop(0.7, "#5e5022"); sh.addColorStop(1, "#3f3616");
    this.ell(g, 0, 0, 120, 90, 0, sh);
    g.fillStyle = "#b39a4a";
    for (const [x, y, r] of [[60, 0, 26], [12, 0, 30], [-38, 0, 28], [-80, 0, 20], [40, -50, 22], [-8, -56, 24], [-56, -46, 20], [40, 50, 22], [-8, 56, 24], [-56, 46, 20]]) {
      g.beginPath(); for (let k = 0; k < 6; k++) g.lineTo(x + r * Math.cos(k * this.TAU / 6), y + r * 0.8 * Math.sin(k * this.TAU / 6)); g.fill();
    }
    g.fillStyle = "#e0c56a";
    for (const [x, y] of [[60, 0], [12, 0], [-38, 0], [-8, -56], [-8, 56]]) { g.beginPath(); g.arc(x, y, 8, 0, this.TAU); g.fill(); }
  }

  manta(g, t) {
    const f = Math.sin(this.TAU * 10 * t / this.T), span = 300 + 22 * f, back = -40 - 30 * f;
    g.beginPath(); g.moveTo(-110, 0); g.lineTo(-330, 4 * f); g.lineWidth = 7; g.strokeStyle = "#1c2733"; g.stroke();
    g.beginPath(); g.moveTo(96, -42);
    g.quadraticCurveTo(40, -span * 0.75, back, -span); g.quadraticCurveTo(-60, -110, -118, -26);
    g.lineTo(-118, 26); g.quadraticCurveTo(-60, 110, back, span); g.quadraticCurveTo(40, span * 0.75, 96, 42);
    g.closePath(); g.fillStyle = "#1e2b3a"; g.fill();
    for (const m of [-1, 1]) {
      this.ell(g, 120, 40 * m, 34, 12, 0.35 * m, "#26364a");
      this.ell(g, 18, 82 * m, 70, 30, -0.5 * m, "#e9eef0");
      this.ell(g, -10, 150 * m, 40, 18, -0.6 * m, "#8fa3b0");
    }
  }

  dolphin(g, t, ph) {
    const b = 0.22 * Math.sin(this.TAU * 60 * t / this.T + ph);
    g.save(); g.translate(-30, 0); g.rotate(b);
    g.beginPath(); g.moveTo(10, -44); g.quadraticCurveTo(-90, -24, -150, -9); g.lineTo(-150, 9); g.quadraticCurveTo(-90, 24, 10, 44); g.fillStyle = "#5c6d7c"; g.fill();
    g.translate(-150, 0); g.rotate(b * 1.4);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-20, -60, -52, -66); g.quadraticCurveTo(-30, -20, -40, 0); g.quadraticCurveTo(-30, 20, -52, 66); g.quadraticCurveTo(-20, 60, 0, 0); g.fillStyle = "#4b5a68"; g.fill();
    g.restore();
    for (const m of [-1, 1]) this.ell(g, 40, 48 * m, 44, 13, -0.75 * m, "#6f8190");
    g.beginPath(); g.moveTo(-40, -44); g.quadraticCurveTo(40, -58, 150, -18); g.lineTo(200, -4); g.lineTo(200, 4); g.lineTo(150, 18); g.quadraticCurveTo(40, 58, -40, 44); g.fillStyle = "#8a9cab"; g.fill();
    this.ell(g, 20, 0, 120, 22, 0, "#43515e");
  }

  tang(g, t, ph) {
    const b = 0.35 * Math.sin(this.TAU * 110 * t / this.T + ph);
    g.save(); g.translate(-30, 0); g.rotate(b);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-34, -20); g.lineTo(-28, 0); g.lineTo(-34, 20); g.closePath(); g.fillStyle = "#f2c200"; g.fill(); g.restore();
    this.ell(g, 8, 0, 46, 15, 0, "#ffd61f"); this.ell(g, 40, 0, 12, 9, 0, "#ffe46a");
  }

  whale(g, t) {
    const b = 0.16 * Math.sin(this.TAU * 8 * t / this.T);
    g.save(); g.translate(-260, 0); g.rotate(b);
    g.beginPath(); g.moveTo(40, -70); g.quadraticCurveTo(-120, -30, -260, -14); g.lineTo(-260, 14); g.quadraticCurveTo(-120, 30, 40, 70); g.fillStyle = "#2b3d52"; g.fill();
    g.translate(-260, 0); g.rotate(b * 1.5);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-30, -110, -90, -130); g.quadraticCurveTo(-60, -40, -70, 0); g.quadraticCurveTo(-60, 40, -90, 130); g.quadraticCurveTo(-30, 110, 0, 0); g.fillStyle = "#dfe7ea"; g.fill();
    g.restore();
    const fl = 0.15 * Math.sin(this.TAU * 8 * t / this.T + 1);
    for (const m of [-1, 1]) {
      g.save(); g.translate(150, 95 * m); g.rotate(m > 0 ? 0.6 + fl : Math.PI - 0.6 - fl); this.ell(g, 0, 120, 30, 125, 0, "#e6eef0"); g.restore();
    }
    g.beginPath(); g.moveTo(330, 0); g.quadraticCurveTo(300, -110, 100, -130); g.quadraticCurveTo(-120, -110, -260, -70); g.lineTo(-260, 70); g.quadraticCurveTo(-120, 110, 100, 130); g.quadraticCurveTo(300, 110, 330, 0); g.fillStyle = "#33475e"; g.fill();
    g.fillStyle = "#596f86"; for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(300 - k * 30, 0, 7, 0, this.TAU); g.fill(); }
    g.beginPath(); g.moveTo(-60, -10); g.quadraticCurveTo(-90, 0, -60, 10); g.fillStyle = "#1e2d3e"; g.fill();
  }

  hibiscus(g, s) {
    for (let k = 0; k < 5; k++) { g.save(); g.rotate(k * this.TAU / 5); this.ell(g, 52 * s, 0, 52 * s, 40 * s, 0, "#ef3b5a"); this.ell(g, 40 * s, 0, 30 * s, 22 * s, 0, "#d42448"); g.restore(); }
    this.ell(g, 0, 0, 22 * s, 22 * s, 0, "#8a0f2e");
    g.save(); g.rotate(0.6); this.ell(g, 44 * s, 0, 40 * s, 5 * s, 0, "#ffd84a"); this.ell(g, 84 * s, 0, 10 * s, 10 * s, 0, "#ffe27a"); g.restore();
  }

  plumeria(g, s) {
    for (let k = 0; k < 5; k++) { g.save(); g.rotate(k * this.TAU / 5); this.ell(g, 36 * s, 12 * s, 40 * s, 24 * s, 0.35, "#fffaf0"); g.restore(); }
    const c = g.createRadialGradient(0, 0, 2, 0, 0, 34 * s); c.addColorStop(0, "#ffb800"); c.addColorStop(1, "rgba(255,214,90,0)");
    this.ell(g, 0, 0, 34 * s, 34 * s, 0, c);
  }

  pose(fn, t) {
    const [x, y] = fn(t), [x2, y2] = fn(t + 0.02);
    return [x, y, Math.atan2(y2 - y, x2 - x)];
  }

  sample(draw) {
    this.ox.setTransform(1, 0, 0, 1, 0, 0);
    this.ox.clearRect(0, 0, this.oc.width, this.oc.height);
    this.ox.setTransform((this.COLS * this.SS) / (this.COLS * this.CW), 0, 0, (this.ROWS * this.SS) / (this.ROWS * this.CH), 0, 0);
    draw(this.ox);
    const d = this.ox.getImageData(0, 0, this.oc.width, this.oc.height).data;
    const out = new Float32Array(this.COLS * this.ROWS * 4);
    const rw = this.oc.width * 4;
    for (let j = 0; j < this.ROWS; j++) {
      for (let i = 0; i < this.COLS; i++) {
        let r = 0, gg = 0, b = 0, a = 0;
        for (let v = 0; v < this.SS; v++) {
          for (let u = 0, p = (j * this.SS + v) * rw + i * this.SS * 4; u < this.SS; u++, p += 4) {
            const al = d[p + 3];
            r += d[p] * al;
            gg += d[p + 1] * al;
            b += d[p + 2] * al;
            a += al;
          }
        }
        const o = (j * this.COLS + i) * 4;
        if (a > 0) {
          out[o] = r / a;
          out[o + 1] = gg / a;
          out[o + 2] = b / a;
          out[o + 3] = a / (255 * this.SS * this.SS);
        }
      }
    }
    return out;
  }

  put(g, fn, t, x, y, a, s, draw) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    if (s !== 1) g.scale(s, s);
    draw(g);
    g.restore();
  }

  initReef() {
    this.reef = this.sample((g) => {
      const blob = (x, y, r, c1, c2, n) => {
        for (let k = 0; k < n; k++) {
          const a = this.hash(x, y, k) * this.TAU, d = this.hash(y, x, k) * r * 0.7;
          this.ell(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.9, r * (0.35 + 0.3 * this.hash(k, x, y)), r * (0.3 + 0.3 * this.hash(k, y, x)), a, k % 2 ? c1 : c2);
        }
      };
      blob(140, 1600, 110, "#d98a6a", "#c46a5a", 10);
      blob(1800, 220, 100, "#d8b86a", "#c49c4c", 9);
      blob(80, 380, 80, "#c9a0d8", "#e2a0b8", 7);
      blob(1700, 1650, 110, "#d6b870", "#e8907a", 10);
      for (const [x, y, r, c] of [[300, 1460, 46, "#ff6a3d"], [1520, 1560, 40, "#ff8a2a"], [1900, 420, 36, "#e8483c"], [220, 300, 34, "#ff7a3a"]]) {
        g.save(); g.translate(x, y); g.rotate(this.hash(x, y, 1) * this.TAU);
        for (let k = 0; k < 5; k++) { g.save(); g.rotate(k * this.TAU / 5); this.ell(g, r * 0.6, 0, r * 0.65, r * 0.2, 0, c); g.restore(); }
        this.ell(g, 0, 0, r * 0.3, r * 0.3, 0, c); g.restore();
      }
      for (const [x, y] of [[560, 1580], [1740, 1480], [1960, 980], [40, 900]]) {
        g.save(); g.translate(x, y);
        for (let k = 0; k < 12; k++) { g.rotate(this.TAU / 12); this.ell(g, 22, 0, 22, 3, 0, "#3a1f4a"); }
        this.ell(g, 0, 0, 14, 14, 0, "#2a1438"); g.restore();
      }
    });
  }

  cells(L, depth, t, glyphs) {
    // Ở chế độ lớp phủ, KHÔNG tô kín ô và vẽ mảnh hơn hẳn — nếu tô kín,
    // lớp phủ thành một tấm ảnh đặc che hết chữ của Antigravity.
    const phu = this.cheDoPhu;
    for (let j = 0; j < this.ROWS; j++) {
      for (let i = 0; i < this.COLS; i++) {
        const o = (j * this.COLS + i) * 4, a = L[o + 3];
        if (a < 0.12) continue;
        const x = i * this.CW, y = j * this.CH;
        let c = [L[o], L[o + 1], L[o + 2]];
        if (depth) c = this.mix(c, this.water(x, y), depth);
        const flick = this.hash(i, j, Math.floor(t * 7));
        if (a > 0.5) {
          if (!phu) {
            this.ctx.fillStyle = this.rgb(c, depth ? 0.9 : 1);
            this.ctx.fillRect(x + 1, y + 1, this.CW - 2, this.CH - 2);
          }
          if (!glyphs) continue;
          const l = this.lum(c);
          const ch = this.RAMP[Math.max(0, Math.min(this.RAMP.length - 1, Math.floor(1 + l * 5 + flick * 4)))];
          if (phu) {
            this.ctx.globalAlpha = 0.32 * (depth ? 0.5 : 1);
            this.ctx.fillStyle = this.rgb(this.mix(c, [255, 255, 255], 0.45), 1);
          } else {
            this.ctx.fillStyle = flick < 0.04 ? this.SPRINK[(flick * 100) | 0] : this.rgb(l < 0.42 ? this.mix(c, [255, 255, 255], 0.62) : this.mix(c, [0, 0, 0], 0.58), depth ? 0.6 : 1);
          }
          this.ctx.fillText(ch, x + this.CW / 2, y + this.CH / 2 + 1);
          this.ctx.globalAlpha = 1;
        } else if (!phu) {
          this.ctx.fillStyle = this.rgb(c, Math.min(1, a * 1.6) * (depth ? 0.6 : 1));
          this.ctx.fillText(this.EDGE[(flick * this.EDGE.length) | 0], x + this.CW / 2, y + this.CH / 2 + 1);
        }
      }
    }
  }

  draw(t) {
    t = ((t % this.T) + this.T) % this.T;
    if (this.cheDoPhu) {
      // Trong suốt: không vẽ nền biển, chỉ vẽ sinh vật + gợn sáng
      this.ctx.clearRect(0, 0, this.W, this.H);
    } else {
      this.ctx.drawImage(this.bgc, 0, 0);
    }

    // Sun bands
    this.ctx.save();
    this.ctx.globalCompositeOperation = "screen";
    for (let k = 0; k < 4; k++) {
      const off = ((t / this.T + k / 4) % 1) * (this.W + this.H) * 1.2 - this.H * 0.6;
      const g = this.ctx.createLinearGradient(off, 0, off + 260, 160);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,240,0.10)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      this.ctx.fillStyle = g;
      this.ctx.fillRect(0, 0, this.W, this.H);
    }
    this.ctx.restore();

    this.ctx.font = '500 15px monospace';
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    // Caustics & glints
    for (let j = 0; j < this.ROWS; j++) {
      for (let i = 0; i < this.COLS; i++) {
        const x = i * this.CW, y = j * this.CH;
        const v = Math.sin(x * 0.011 + y * 0.004 + this.w * 2 * t + 1.6 * Math.sin(y * 0.007 - this.w * 3 * t))
                + Math.sin(-x * 0.006 + y * 0.012 - this.w * 3 * t + 1.6 * Math.sin(x * 0.008 + this.w * 2 * t))
                + Math.sin(x * 0.009 - y * 0.009 + this.w * 4 * t + 1.2 * Math.sin((x + y) * 0.005 + this.w * t));
        if (v > 1.55) {
          const k = Math.min(1, (v - 1.55) / 1.2);
          this.ctx.fillStyle = `rgba(255,255,255,${0.16 + 0.42 * k})`;
          this.ctx.fillText(k > 0.6 ? "~" : k > 0.3 ? "-" : "·", x + this.CW / 2, y + this.CH / 2);
        }
        const gl = this.hash(i, j, Math.floor(t * 6) % 147);
        if (gl > 0.9988) {
          const f = Math.sin(((t * 6) % 1) * Math.PI);
          this.ctx.fillStyle = `rgba(255,255,255,${0.95 * f})`;
          this.ctx.fillText(gl > 0.9995 ? "*" : "+", x + this.CW / 2, y + this.CH / 2);
        }
      }
    }

    this.cells(this.reef, 0.62, t, true);

    const deep = this.sample((g) => {
      const [x, y, a] = this.pose(this.P.whale, t);
      this.put(g, null, t, x, y, a, 1, (g) => this.whale(g, t));
    });
    this.cells(deep, 0.4, t, true);

    const main = this.sample((g) => {
      let [x, y, a] = this.pose(this.P.manta, t);
      this.put(g, null, t, x, y, a, 1.2, (g) => this.manta(g, t));
      for (const [dx, ph] of [[0, 0], [1, 1.3]]) {
        [x, y, a] = this.pose(this.P.dolphin, t - dx * 0.18);
        this.put(g, null, t, x + dx * 120 * Math.sin(a), y - dx * 120 * Math.cos(a), a, 1.25, (g) => this.dolphin(g, t, ph));
      }
      [x, y, a] = this.pose(this.P.turtleA, t); this.put(g, null, t, x, y, a, 1.55, (g) => this.turtle(g, t, 1, 0));
      [x, y, a] = this.pose(this.P.turtleB, t); this.put(g, null, t, x, y, a, 1.3, (g) => this.turtle(g, t, 1, 2));
      [x, y, a] = this.pose(this.P.turtleC, t); this.put(g, null, t, x, y, a, 1.1, (g) => this.turtle(g, t, 1, 4));
      [x, y, a] = this.pose(this.P.school, t);
      this.FISH.forEach(([fx, fy], k) => {
        const ca = Math.cos(a), sa = Math.sin(a), wob = 14 * Math.sin(this.w * 7 * t + k);
        this.put(g, null, t, x + fx * ca - (fy + wob) * sa, y + fx * sa + (fy + wob) * ca, a + 0.15 * Math.sin(this.w * 9 * t + k), 1.35, (g) => this.tang(g, t, k));
      });
      for (const [kind, p0, y0, s, dir] of this.FLOWERS) {
        const u = (p0 + t / this.T) % 1, fx = -220 + u * (this.W + 440), fy = y0 + u * 420 + 30 * Math.sin(this.w * 3 * t + p0 * 9);
        this.put(g, null, t, fx, fy, dir * this.w * t + p0 * 6, 1, (g) => (kind === "h" ? this.hibiscus : this.plumeria).call(this, g, s));
      }
    });

    // Shadows
    if (!this.cheDoPhu) {
      this.ctx.fillStyle = "rgba(4,60,84,0.16)";
      for (let j = 0; j < this.ROWS - 2; j++) {
        for (let i = 0; i < this.COLS - 2; i++) {
          const a = main[(j * this.COLS + i) * 4 + 3];
          if (a > 0.3) this.ctx.fillRect((i + 2) * this.CW, (j + 2) * this.CH, this.CW, this.CH);
        }
      }
    }

    // Wakes
    for (const [fn, len] of [[this.P.turtleA, 1.5], [this.P.turtleB, 1.3], [this.P.turtleC, 1.1], [this.P.manta, 1.6], [this.P.dolphin, 1.4]]) {
      for (let k = 1; k <= 16; k++) {
        const [x, y, a] = this.pose(fn, t - k * 0.09 - 0.35 * len), side = (this.hash(k, len, 3) - 0.5) * k * 9;
        const px = x + side * -Math.sin(a), py = y + side * Math.cos(a);
        this.ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - k / 17)})`;
        this.ctx.fillText(".·o°"[(this.hash(k, len, Math.floor(t * 5)) * 4) | 0], Math.floor(px / this.CW) * this.CW + this.CW / 2, Math.floor(py / this.CH) * this.CH + this.CH / 2);
      }
    }

    this.cells(main, 0, t, true);
  }

  start() {
    if (this.running) return;
    this.running = true;
    const t0 = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      this.draw((now - t0) / 1000);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}
