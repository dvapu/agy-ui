// ═══════════════════════════════════════════════════════════════════════════
// Engine lưới ký tự (ASCII cell grid) + 15 chủ đề — CHUYỂN TỪ CLAUDINHO
//
// Nguồn: https://github.com/Lu1sR0/claudinho (MIT, © 2026 Luis Roberto)
// File gốc: src/renderer/wallpapers/{engine,themes,themes2,themes3}.js
//
// Vì sao phải chép sang đây: kỹ thuật vẽ của Claudinho là vẽ hình vector vào
// một lớp phóng to gấp SS lần, rồi mỗi ô lưới lấy trung bình màu của SS×SS
// mẫu và tô thành một viên gạch bo góc kèm ký tự. Nhờ vậy hình nền có khối,
// có bóng, có chiều sâu — khác hẳn kiểu "vẽ vài hình vector lên canvas trống"
// (nhìn thưa và nhạt). Chủ đề "Đầm Phá Hawaii" của bản cũ đẹp chính vì đã
// theo đúng kỹ thuật này; các chủ đề còn lại thì không.
//
// ĐÃ SỬA so với bản gốc:
//   · canvas cố định 1944×1760 (lớp phủ co giãn bằng CSS), dpr = 1
//   · bỏ phần âm thanh / nhấp chuột của app gốc — chỉ còn phần vẽ
// ═══════════════════════════════════════════════════════════════════════════

const ASCII_ENGINE = (() => {

// ---------------------------------------------------------------------------
// Engine: each theme paints a background, then draws its subjects as vector
// shapes into a small supersampled layer; every cell of the grid averages its
// samples and is painted as a rounded tile carrying a glyph (the technique of
// the lagoon reference). On top of that, the pointer has physics: subjects are
// springs that flee, approach or follow it, and clicks spawn theme effects.

const TAU = Math.PI * 2;
const hash = (a, b, c = 0) => { const h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return h - Math.floor(h); };
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const lum = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const ell = (g, x, y, rx, ry, rot, fill) => { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); g.fillStyle = fill; g.fill(); };
const circ = (g, x, y, r, fill) => ell(g, x, y, r, r, 0, fill);
const lin = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([k, c]) => g.addColorStop(k, c)); return g; };
const rad = (ctx, x, y, r0, r1, stops) => { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([k, c]) => g.addColorStop(k, c)); return g; };
const glowAt = (ctx, x, y, r, color, a) => { ctx.fillStyle = rad(ctx, x, y, 0, r, [[0, color.replace("A", a)], [1, color.replace("A", 0)]]); ctx.fillRect(x - r, y - r, r * 2, r * 2); };
const RAMP = "8%XSSt%t;:";

function Renderer(canvas, opt) {
  const ctx = canvas.getContext("2d");
  const oc = document.createElement("canvas"), ox = oc.getContext("2d", { willReadFrequently: true });
  const self = { canvas, ctx, cw: opt.cw, ch: opt.ch, ss: opt.ss, W: 0, H: 0, cols: 0, rows: 0, trail: null, effects: [], bodies: new Map(), hits: [], hover: new Map() };

  self.resize = (W, H) => {
    const dpr = opt.dpr ?? Math.min(2, devicePixelRatio || 1);
    self.W = W; self.H = H; self.dpr = dpr;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    self.cols = Math.ceil(W / self.cw); self.rows = Math.ceil(H / self.ch);
    oc.width = self.cols * self.ss; oc.height = self.rows * self.ss;
    self.trail = new Float32Array(self.cols * self.rows);
  };
  self.reset = () => { self.bodies.clear(); self.hover.clear(); self.effects = []; self.trail && self.trail.fill(0); };

  const sample = (draw) => {
    const { cols, rows, ss, cw, ch } = self;
    ox.setTransform(1, 0, 0, 1, 0, 0); ox.clearRect(0, 0, oc.width, oc.height);
    ox.globalCompositeOperation = "source-over"; ox.globalAlpha = 1;
    ox.setTransform(ss / cw, 0, 0, ss / ch, 0, 0);
    draw(ox);
    const d = ox.getImageData(0, 0, oc.width, oc.height).data, out = new Float32Array(cols * rows * 4), rw = oc.width * 4, n = ss * ss;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let v = 0; v < ss; v++) for (let u = 0, p = (j * ss + v) * rw + i * ss * 4; u < ss; u++, p += 4) { const al = d[p + 3]; r += d[p] * al; g += d[p + 1] * al; b += d[p + 2] * al; a += al; }
      const o = (j * cols + i) * 4;
      if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; out[o + 3] = a / (255 * n); }
    }
    return out;
  };

  const glyph = (i, j, s, fill) => { ctx.fillStyle = fill; ctx.fillText(s, i * self.cw + self.cw / 2, j * self.ch + self.ch / 2 + 1); };

  // Pointer trail: light the cells it crosses.
  self.mark = (x, y) => {
    const ci = Math.floor(x / self.cw), cj = Math.floor(y / self.ch);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= self.cols || j >= self.rows) continue;
      const k = j * self.cols + i; self.trail[k] = Math.max(self.trail[k], 1 - (Math.abs(di) + Math.abs(dj)) * 0.3);
    }
  };
  self.add = (fx) => self.effects.push(fx);

  self.frame = (theme, t, dt, mouse) => {
    const { cw, ch, cols, rows, W, H } = self;
    ctx.setTransform(self.dpr, 0, 0, self.dpr, 0, 0);
    self.effects = self.effects.filter((f) => t - f.t < f.life);
    self.hits = [];
    const ripples = self.effects.filter((f) => f.kind === "ripple");
    const lure = [...self.effects].reverse().find((f) => f.kind === "food");

    const env = {
      W, H, t, dt, mouse, cw, ch, k: opt.k ?? Math.min(W, H) / 1000,
      // A subject the pointer can touch: the page plays its sound on enter.
      hit: (key, x, y, r, kind) => self.hits.push({ key, x, y, r, kind }),
      hovered: (key) => (self.hover.has(key) ? t - self.hover.get(key) : -1), effects: self.effects, lure,
      near: (x, y, R = 220) => (mouse ? clamp(1 - Math.hypot(x - mouse.x, y - mouse.y) / R) : 0),
      // A subject on a spring: `mode` says how it answers the pointer.
      body(key, x, y, mode = "flee", R = 260, F = 1) {
        let b = self.bodies.get(key);
        if (!b) self.bodies.set(key, (b = { ox: 0, oy: 0, vx: 0, vy: 0 }));
        let tx = 0, ty = 0;
        const target = mode === "curious" && lure ? lure : mouse;
        if (target) {
          const px = x + b.ox, py = y + b.oy, dx = px - target.x, dy = py - target.y, d = Math.hypot(dx, dy) || 1, n = clamp(1 - d / R);
          const fast = mouse && mouse.speed > 380;
          if (n > 0) {
            if (mode === "flee" || (mode === "curious" && fast && target === mouse)) {
              const s = n ** 1.4 * R * 0.55 * F * (1 + clamp((mouse?.speed ?? 0) / 900));
              tx = b.ox + (dx / d) * s; ty = b.oy + (dy / d) * s;
            } else if (mode === "curious" && (target !== mouse || mouse.speed < 120)) {
              const s = Math.max(0, d - 70 * env.k) * 0.8 * n ** 0.5 * F;
              tx = b.ox - (dx / d) * s; ty = b.oy - (dy / d) * s;
            } else if (mode === "attract") {
              const s = d * 0.85 * n ** 0.4 * F;
              tx = b.ox - (dx / d) * s; ty = b.oy - (dy / d) * s;
            } else { tx = b.ox; ty = b.oy; }
          }
        }
        for (const r of ripples) {
          const age = t - r.t, rr = age * r.speed, dx = x + b.ox - r.x, dy = y + b.oy - r.y, d = Math.hypot(dx, dy) || 1;
          if (Math.abs(d - rr) < 40) { b.vx += (dx / d) * r.force * dt; b.vy += (dy / d) * r.force * dt; }
        }
        const stiff = mode === "attract" ? 5 : 3.2, damp = mode === "attract" ? 3.4 : 2.6;
        b.vx += ((tx - b.ox) * stiff - b.vx * damp) * dt * (target ? 1 : 0.6);
        b.vy += ((ty - b.oy) * stiff - b.vy * damp) * dt * (target ? 1 : 0.6);
        if (!target) { b.vx -= b.ox * 1.8 * dt; b.vy -= b.oy * 1.8 * dt; }
        b.ox += b.vx * dt; b.oy += b.vy * dt;
        return [x + b.ox, y + b.oy, b.vx, b.vy];
      },
    };

    theme.bg(ctx, env);
    ctx.fillStyle = theme.grid;
    for (let x = 0; x < W; x += cw) ctx.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += ch) ctx.fillRect(0, y, W, 1);

    ctx.font = `600 ${Math.round(ch * 0.6)}px "Geist Mono", ui-monospace, monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (theme.ambient) theme.ambient(env, glyph, self);

    // Water ripples drawn as rings of glyphs.
    for (const r of ripples) {
      const age = t - r.t, rr = age * r.speed, fade = 1 - age / r.life;
      const steps = Math.max(12, Math.floor((rr * TAU) / cw));
      for (let s = 0; s < steps; s++) {
        const a = (s / steps) * TAU, x = r.x + Math.cos(a) * rr, y = r.y + Math.sin(a) * rr * 0.92;
        glyph(Math.floor(x / cw), Math.floor(y / ch), r.chars ? r.chars[s % r.chars.length] : s % 3 ? "~" : "o", `rgba(255,255,255,${0.55 * fade * r.alpha})`);
      }
    }

    const L = sample((g) => theme.scene(g, env));
    const acc = theme.accent, lantern = mouse ? 140 : 0;

    // Shadow: the subjects' silhouette, one cell down-right.
    if (theme.shadow) {
      ctx.fillStyle = theme.shadow;
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
        if (L[(j * cols + i) * 4 + 3] > 0.4) ctx.fillRect((i + 1) * cw + 2, (j + 1) * ch + 2, cw - 4, ch - 4);
      }
    }

    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i, o = k * 4, a = L[o + 3];
      const x = i * cw, y = j * ch, cx = x + cw / 2, cy = y + ch / 2;
      const near = lantern ? clamp(1 - Math.hypot(cx - mouse.x, cy - mouse.y) / lantern) : 0;
      let ring = 0;
      for (const r of ripples) { const age = t - r.t, rr = age * r.speed, d = Math.hypot(cx - r.x, cy - r.y); ring = Math.max(ring, clamp(1 - Math.abs(d - rr) / 24) * (1 - age / r.life) * r.alpha); }
      const tr = self.trail ? (self.trail[k] *= Math.pow(0.05, dt)) : 0;

      if (a < 0.2) {
        const glow = Math.max(near * near * 0.55, tr * 0.7, ring * 0.6);
        if (glow > 0.03) {
          if (theme.trailGlyph && tr > near * near) glyph(i, j, theme.trailGlyph[(k + Math.floor(t * 4)) % theme.trailGlyph.length], rgb(acc, glow * 0.9));
          else { ctx.fillStyle = rgb(acc, glow * 0.28); ctx.beginPath(); ctx.roundRect(x + 2, y + 2, cw - 4, ch - 4, 3); ctx.fill(); }
        }
        continue;
      }
      let c = [L[o], L[o + 1], L[o + 2]];
      const lift = Math.max(near * 0.28, ring * 0.5);
      if (lift) c = mix(c, theme.liftTo || [255, 255, 255], lift);
      if (a < 0.5) {                       // soft edge: a smaller, fainter tile
        const s = 0.45 + a * 0.5;
        ctx.fillStyle = rgb(c, clamp(a * 1.8)); ctx.beginPath(); ctx.roundRect(cx - (cw - 3) * s / 2, cy - (ch - 3) * s / 2, (cw - 3) * s, (ch - 3) * s, 2); ctx.fill();
        continue;
      }
      const grow = 1 + near * 0.16, w = (cw - 3) * grow, h = (ch - 3) * grow;
      ctx.fillStyle = rgb(c); ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 3); ctx.fill();
      const flick = hash(i, j, Math.floor(t * 1.5)), l = lum(c);
      const chr = RAMP[clamp(Math.floor(1 + l * 5 + flick * 4), 0, RAMP.length - 1)];
      ctx.fillStyle = flick < 0.02 && theme.sprinkle ? theme.sprinkle[((flick * 100) | 0) % theme.sprinkle.length] : rgb(l < 0.45 ? mix(c, [255, 255, 255], 0.45) : mix(c, [0, 0, 0], 0.42), 0.6);
      ctx.fillText(chr, cx, cy + 1);
    }
    if (theme.post) theme.post(ctx, env, self);
    if (self.troca) cobre(theme, t);
  };

  // Theme change: the old picture stays on top and is eaten cell by cell by
  // a wave that starts at `x, y`, its front a line of bright tiles in the new
  // theme's accent, so the new theme surfaces from under the old one.
  self.transicao = (x, y, t, dur = 1.15) => {
    const img = document.createElement("canvas");
    img.width = canvas.width; img.height = canvas.height;
    img.getContext("2d").drawImage(canvas, 0, 0);
    self.troca = { img, x, y, t, dur };
  };
  function cobre(theme, t) {
    const { cw, ch, cols, rows, W, H, dpr } = self, tr = self.troca, p = (t - tr.t) / tr.dur;
    if (p >= 1.08) { self.troca = null; return; }
    const longe = Math.max(Math.hypot(tr.x, tr.y), Math.hypot(W - tr.x, tr.y), Math.hypot(tr.x, H - tr.y), Math.hypot(W - tr.x, H - tr.y));
    const quando = (i, j) => (Math.hypot(i * cw + cw / 2 - tr.x, j * ch + ch / 2 - tr.y) / longe) * 0.86 + hash(i, j, 9) * 0.14;
    const acc = theme.accent;
    for (let j = 0; j < rows; j++) {
      let ini = -1;
      for (let i = 0; i <= cols; i++) {
        const velho = i < cols && quando(i, j) > p;
        if (velho && ini < 0) ini = i;
        if (!velho && ini >= 0) {
          ctx.drawImage(tr.img, ini * cw * dpr, j * ch * dpr, (i - ini) * cw * dpr, ch * dpr, ini * cw, j * ch, (i - ini) * cw, ch);
          ini = -1;
        }
        if (i < cols) {
          const d = p - quando(i, j);
          if (d >= 0 && d < 0.07) {
            const a = 1 - d / 0.07, x = i * cw, y = j * ch;
            ctx.fillStyle = rgb(mix(acc, [255, 255, 255], 0.35), 0.85 * a); ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, cw - 3, ch - 3, 3); ctx.fill();
            glyph(i, j, RAMP[(hash(i, j, Math.floor(t * 20)) * RAMP.length) | 0], rgb([20, 20, 24], 0.55 * a));
          }
        }
      }
    }
  }
  return self;
}

// ---------------------------------------------------------------------------
// Subjects, drawn in local units facing +x.

// Claude spark: tapered rays around a soft core; rays reach toward `toward`.
function spark(g, R, t, cols, toward = null, reach = 0) {
  const n = 12;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + t * 0.05 + (hash(k, 3) - 0.5) * 0.12;
    const pull = toward == null ? 0 : Math.max(0, Math.cos(a - toward)) ** 3 * reach;
    const len = R * (0.72 + 0.28 * hash(k, 1)) * (1 + 0.05 * Math.sin(t * 1.6 + k * 1.7) + pull * 0.45), w = R * (0.1 + 0.04 * hash(k, 2));
    g.save(); g.rotate(a);
    g.beginPath(); g.moveTo(0, -w); g.quadraticCurveTo(len * 0.55, -w * 0.75, len, 0); g.quadraticCurveTo(len * 0.55, w * 0.75, 0, w); g.closePath();
    g.fillStyle = k % 2 ? cols[0] : cols[1]; g.fill(); g.restore();
  }
  circ(g, 0, 0, R * 0.2, cols[2]);
}

// Sea turtle from above, drawn for legibility at tile size: a dark domed
// shell with light scutes, and pale skin (head, flippers) set well apart
// from it so the silhouette reads as a turtle.
function turtle(g, t, ph) {
  const f = Math.sin(t * 3.6 + ph), pele = "#d6cf9a", peleEsc = "#a89c5e";
  for (const m of [-1, 1]) {
    g.save(); g.translate(55, 72 * m); g.rotate(m * (0.85 + 0.5 * f));
    ell(g, -6, 74 * m, 32, 100, 0.22 * m, peleEsc); ell(g, -4, 68 * m, 19, 78, 0.22 * m, pele); g.restore();
    g.save(); g.translate(-98, 52 * m); g.rotate(m * (2.4 - 0.3 * f)); ell(g, 0, 32 * m, 22, 42, 0, peleEsc); g.restore();
  }
  ell(g, -150, 0, 26, 9, 0, peleEsc);
  ell(g, 128, 0, 34, 26, 0, peleEsc); ell(g, 170, 0, 44, 35, 0, pele);
  ell(g, 186, -16, 7, 6, 0, "#231d0c"); ell(g, 186, 16, 7, 6, 0, "#231d0c");
  ell(g, 0, 0, 136, 106, 0, "#8a7634");
  const sh = g.createRadialGradient(-14, 0, 10, 0, 0, 122); sh.addColorStop(0, "#5c5020"); sh.addColorStop(1, "#332c10");
  ell(g, -2, 0, 122, 93, 0, sh);
  g.fillStyle = "#a08a40";
  for (const [x, y, r] of [[58, 0, 30], [6, 0, 34], [-50, 0, 30], [34, -54, 26], [-22, -58, 26], [34, 54, 26], [-22, 58, 26]]) {
    g.beginPath(); for (let k = 0; k < 6; k++) g.lineTo(x + r * Math.cos((k * TAU) / 6), y + r * 0.78 * Math.sin((k * TAU) / 6)); g.fill();
  }
}
function manta(g, t) {
  const f = Math.sin(t * 2.5), span = 300 + 22 * f, back = -40 - 30 * f;
  g.beginPath(); g.moveTo(-110, 0); g.lineTo(-330, 4 * f); g.lineWidth = 9; g.strokeStyle = "#1c2733"; g.stroke();
  g.beginPath(); g.moveTo(96, -42); g.quadraticCurveTo(40, -span * 0.75, back, -span); g.quadraticCurveTo(-60, -110, -118, -26);
  g.lineTo(-118, 26); g.quadraticCurveTo(-60, 110, back, span); g.quadraticCurveTo(40, span * 0.75, 96, 42); g.closePath(); g.fillStyle = "#1e2b3a"; g.fill();
  for (const m of [-1, 1]) { ell(g, 120, 40 * m, 34, 12, 0.35 * m, "#26364a"); ell(g, 18, 82 * m, 70, 30, -0.5 * m, "#e9eef0"); ell(g, -10, 150 * m, 40, 18, -0.6 * m, "#8fa3b0"); }
}
function tang(g, t, ph) {
  const b = 0.35 * Math.sin(t * 18 + ph);
  g.save(); g.translate(-30, 0); g.rotate(b); g.beginPath(); g.moveTo(0, 0); g.lineTo(-34, -22); g.lineTo(-28, 0); g.lineTo(-34, 22); g.closePath(); g.fillStyle = "#f2c200"; g.fill(); g.restore();
  ell(g, 8, 0, 46, 18, 0, "#ffd61f"); ell(g, 40, 0, 12, 10, 0, "#ffe46a");
}
function hibiscus(g, s) {
  for (let k = 0; k < 5; k++) { g.save(); g.rotate((k * TAU) / 5); ell(g, 52 * s, 0, 52 * s, 40 * s, 0, "#ef3b5a"); ell(g, 40 * s, 0, 30 * s, 22 * s, 0, "#d42448"); g.restore(); }
  circ(g, 0, 0, 22 * s, "#8a0f2e");
  g.save(); g.rotate(0.6); ell(g, 44 * s, 0, 40 * s, 6 * s, 0, "#ffd84a"); circ(g, 84 * s, 0, 11 * s, "#ffe27a"); g.restore();
}

// Koi seen from above: a tapering body on a waving spine, round head with
// eyes, pectoral fins, a fan tail, and the colour pattern clipped to the body.
function koi(g, t, pal, ph) {
  const N = 14, pts = [];
  for (let k = 0; k <= N; k++) { const u = k / N; pts.push([62 - u * 150, Math.sin(t * 4 + ph - u * 3.4) * (1.5 + u * u * 15)]); }
  const wid = (u) => (u < 0.16 ? 20 + (u / 0.16) * 13 : 33 * Math.pow(1 - (u - 0.16) / 0.84, 0.8) + 4);
  const [tx, ty] = pts[N], [px, py] = pts[N - 2];
  g.save(); g.translate(tx, ty); g.rotate(Math.atan2(ty - py, tx - px) + Math.sin(t * 4 + ph - 3.6) * 0.25);
  g.beginPath(); g.moveTo(-6, 0); g.bezierCurveTo(10, -10, 34, -42, 54, -38); g.quadraticCurveTo(34, 0, 54, 38); g.bezierCurveTo(34, 42, 10, 10, -6, 0);
  g.fillStyle = pal.fin; g.fill(); g.restore();
  const flap = Math.sin(t * 2.6 + ph) * 0.3, [fx, fy] = pts[3];
  for (const m of [-1, 1]) { g.save(); g.translate(fx, fy + m * 26); g.rotate(m * (2.2 + flap)); ell(g, 22, 0, 28, 12, 0, pal.fin); g.restore(); }
  const [bx, by] = pts[9];
  for (const m of [-1, 1]) { g.save(); g.translate(bx, by + m * 9); g.rotate(m * 2.6); ell(g, 9, 0, 11, 5, 0, pal.fin); g.restore(); }
  g.beginPath();
  for (let k = 0; k <= N; k++) g.lineTo(pts[k][0], pts[k][1] - wid(k / N));
  for (let k = N; k >= 0; k--) g.lineTo(pts[k][0], pts[k][1] + wid(k / N));
  g.closePath(); g.moveTo(pts[0][0] + 20, pts[0][1]); g.ellipse(pts[0][0], pts[0][1], 22, 21, 0, 0, TAU);
  g.fillStyle = pal.body; g.fill();
  g.save(); g.clip();
  for (const [u, side, rx, ry, c] of pal.patches) { const p = pts[Math.round(u * N)]; ell(g, p[0], p[1] + side, rx, ry, 0, c); }
  g.restore();
  for (const m of [-1, 1]) circ(g, pts[0][0] + 8, pts[0][1] + m * 12, 3.5, "#141418");
}

function jelly(g, t, c1, c2, ph, glow) {
  const p = Math.sin(t * 1.8 + ph), rx = 60 * (1 + 0.08 * p), ry = 50 * (1 - 0.1 * p);
  g.lineCap = "round";
  for (let k = 0; k < 6; k++) {
    const x0 = (k / 5 - 0.5) * rx * 1.5;
    g.beginPath(); g.moveTo(x0, 4);
    for (let s = 1; s <= 7; s++) g.lineTo(x0 + Math.sin(t * 2 + ph + k + s * 0.7) * (4 + s * 1.8), s * 22);
    g.lineWidth = k % 2 ? 9 : 6; g.strokeStyle = k % 3 ? c2 : c1; g.stroke();
  }
  for (let k = 0; k < 3; k++) {                 // frilly oral arms
    g.beginPath(); g.moveTo((k - 1) * 14, 6);
    for (let s = 1; s <= 5; s++) g.lineTo((k - 1) * 14 + Math.sin(t * 1.4 + ph + s + k) * 9, s * 18);
    g.lineWidth = 12; g.strokeStyle = c1; g.stroke();
  }
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, Math.PI, TAU);
  for (let k = 0; k <= 6; k++) { const x = rx - (k / 6) * rx * 2; g.quadraticCurveTo(x + rx / 6, 12 + 4 * p, x, 0); }
  g.fillStyle = glow ? `rgb(${mix(hx(c1), [255, 255, 255], glow * 0.4).map((v) => v | 0)})` : c1; g.fill();
  ell(g, 0, -ry * 0.38, rx * 0.55, ry * 0.4, 0, c2);
}

function boat(g, white, shade) {
  g.beginPath(); g.moveTo(-72, -8); g.lineTo(72, -8); g.lineTo(46, 24); g.lineTo(-46, 24); g.closePath(); g.fillStyle = shade; g.fill();
  g.beginPath(); g.moveTo(-72, -8); g.lineTo(72, -8); g.lineTo(60, 7); g.lineTo(-60, 7); g.closePath(); g.fillStyle = white; g.fill();
  g.beginPath(); g.moveTo(-36, -8); g.lineTo(0, -74); g.lineTo(0, -8); g.closePath(); g.fillStyle = white; g.fill();
  g.beginPath(); g.moveTo(36, -8); g.lineTo(0, -74); g.lineTo(0, -8); g.closePath(); g.fillStyle = shade; g.fill();
}

function cloud(g, s, top, bottom) {
  const lobes = [[-64, 10, 34], [-24, -16, 46], [28, -22, 52], [70, 4, 36], [10, 14, 42], [-96, 22, 22], [100, 22, 22]];
  for (const [x, y, r] of lobes) circ(g, x * s, (y + 10) * s, r * s, bottom);
  for (const [x, y, r] of lobes) circ(g, x * s, y * s, r * s, top);
  g.fillStyle = top; g.fillRect(-100 * s, 4 * s, 200 * s, 26 * s);
}

// ---------------------------------------------------------------------------
// Themes. `wake`: the pointer leaves ripples in the water. `click`: what a
// click spawns. Effects with a `draw` are drawn among the subjects, as tiles.

const KOI_ANG = [];
const ripple = (x, y, t, o = {}) => ({ kind: "ripple", x, y, t, life: o.life ?? 1.8, speed: o.speed ?? 300, force: o.force ?? 650, alpha: o.alpha ?? 1, chars: o.chars });

const THEMES = [
  {
    id: "claude", name: "Claude Code", light: false,
    grid: "rgba(255,236,220,0.035)", accent: hx("#e08a64"), sprinkle: ["#f5c4a8", "#ffffff"], trailGlyph: "·'.",
    bg(ctx, { W, H, t }) {
      ctx.fillStyle = rad(ctx, W * 0.72, H * 0.28, 0, Math.max(W, H) * 0.75, [[0, "#3b2217"], [0.4, "#1b130f"], [1, "#0b0908"]]); ctx.fillRect(0, 0, W, H);
      glowAt(ctx, W * 0.72, H * 0.28, Math.min(W, H) * 0.42, "rgba(224,128,90,A)", 0.12 + 0.03 * Math.sin(t));
    },
    ambient({ W, H, t, cw, ch }, glyph) {
      for (let k = 0; k < 40; k++) {
        const x = hash(k, 1) * W + Math.sin(t * 0.3 + k) * 20, y = ((hash(k, 2) * H - t * (6 + hash(k, 3) * 10)) % H + H) % H;
        glyph(Math.floor(x / cw), Math.floor(y / ch), "·", `rgba(224,138,100,${0.2 + 0.3 * hash(k, 5)})`);
      }
    },
    click(x, y, t, R) { R.add({ kind: "burst", x, y, t, life: 1.6 }); },
    scene(g, env) {
      const { W, H, t, k, mouse } = env;
      const pulse = env.effects.filter((f) => f.kind === "burst").reduce((m, f) => Math.max(m, 1 - (t - f.t) / f.life), 0);
      const [x, y] = env.body("spark", W * 0.72, H * 0.28, "flee", 280, 0.35);
      const R = Math.min(W, H) * 0.22 * (1 + pulse * 0.12);
      const toward = mouse ? Math.atan2(mouse.y - y, mouse.x - x) - t * 0.05 : null;
      const hs = env.hovered("spark");
      g.save(); g.translate(x, y); g.rotate(hs >= 0 ? (1 - Math.exp(-hs * 1.5)) * 1.2 : 0); spark(g, R, t, ["#d97757", "#c96846", "#eea684"], toward, env.near(x, y, 520)); g.restore();
      env.hit("spark", x, y, R * 0.75, "spark");
      const [bx, by] = env.body("mini", W * 0.16, H * 0.22, "flee", 220, 1);
      g.save(); g.translate(bx, by + Math.sin(t * 2) * 6); spark(g, Math.min(W, H) * 0.05, -t * 2 - Math.max(0, env.hovered("mini")) * 6, ["#d97757", "#b85a3c", "#f0b090"]); g.restore();
      env.hit("mini", bx, by, Math.min(W, H) * 0.06, "mini");
      for (const f of env.effects) if (f.kind === "burst") {
        const age = (t - f.t) / f.life;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU + hash(i, f.t) * 0.4, d = age * 200 * k * (0.7 + hash(i, 2) * 0.6);
          g.save(); g.translate(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d); g.globalAlpha = 1 - age; spark(g, 14 * k * (1 - age * 0.5), t * 3, ["#e08a64", "#c96846", "#f5c4a8"]); g.restore();
        }
      }
    },
  },
  {
    id: "clouds", name: "Cloud Drift", light: true,
    grid: "rgba(255,255,255,0.09)", accent: hx("#ffffff"), shadow: "rgba(40,100,160,0.08)",
    bg(ctx, { W, H }) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, "#4ea2e6"], [0.55, "#93cbf3"], [1, "#d9effc"]]); ctx.fillRect(0, 0, W, H);
      glowAt(ctx, W * 0.85, H * 0.1, Math.min(W, H) * 0.5, "rgba(255,250,225,A)", 0.45);
    },
    ambient({ W, H, t, cw, ch }, glyph) {
      for (let k = 0; k < 4; k++) {
        const x = ((hash(k, 7) * W + t * 40) % (W + 200)) - 100, y = H * (0.12 + 0.25 * hash(k, 8)) + Math.sin(t * 2 + k) * 6;
        glyph(Math.floor(x / cw), Math.floor(y / ch), Math.sin(t * 6 + k) > 0 ? "v" : "^", "rgba(30,70,110,0.55)");
      }
    },
    click(x, y, t, R) { R.add({ kind: "puff", x, y, t, life: 2.2 }); R.add(ripple(x, y, t, { chars: "·", alpha: 0.6, force: 900, speed: 380, life: 1.2 })); },
    scene(g, env) {
      const { W, H, t, k } = env;
      const specs = [[0.02, 0.14, 1.35, 12], [0.48, 0.3, 1.0, 8], [0.78, 0.1, 1.15, 10], [0.3, 0.52, 0.85, 6], [0.92, 0.48, 1.4, 14]];
      specs.forEach(([x0, y0, s, sp], i) => {
        const span = W + 600, x = ((x0 * span + t * sp * 2.2) % span) - 300;
        const [px, py] = env.body("c" + i, x, y0 * H + Math.sin(t * 0.4 + x0 * 9) * 8, "flee", 300, 0.8);
        const h = env.hovered("c" + i), puff = h >= 0 ? 1 + 0.08 * Math.sin(h * 7) * Math.exp(-h * 1.5) : 1;
        g.save(); g.translate(px, py); cloud(g, s * k * 1.7 * puff, "#ffffff", "#cfe4f6"); g.restore();
        env.hit("c" + i, px, py, 100 * s * k * 1.7, "cloud");
      });
      for (const f of env.effects) if (f.kind === "puff") {
        const age = (t - f.t) / f.life;
        for (let i = 0; i < 3; i++) {
          g.save(); g.translate(f.x + (i - 1) * 50 * k + age * 40 * k, f.y - age * 30 * k); g.globalAlpha = 1 - age;
          cloud(g, (0.25 + age * 0.35) * k * (1 + hash(i, 4) * 0.4), "#ffffff", "#dcebf8"); g.restore();
        }
      }
    },
  },
  {
    id: "lagoon", name: "Honu Lagoon", light: true, wake: true,
    grid: "rgba(255,255,255,0.07)", accent: hx("#ffffff"), shadow: "rgba(4,60,84,0.14)",
    bg(ctx, { W, H, t }) {
      ctx.fillStyle = lin(ctx, 0, 0, W * 0.45, H * 0.9, [[0, "#b2f4e8"], [0.42, "#4ad6d6"], [0.78, "#1aa8ca"], [1, "#0e80b6"]]); ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalCompositeOperation = "screen";
      for (let k = 0; k < 4; k++) {
        const off = ((t / 24.5 + k / 4) % 1) * (W + H) * 1.2 - H * 0.6;
        ctx.fillStyle = lin(ctx, off, 0, off + 260, 160, [[0, "rgba(255,255,255,0)"], [0.5, "rgba(255,255,240,0.1)"], [1, "rgba(255,255,255,0)"]]); ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    },
    ambient({ cw, ch, t }, glyph, R) {
      const w = TAU / 24.5;
      for (let j = 0; j < R.rows; j++) for (let i = 0; i < R.cols; i++) {
        const x = i * cw, y = j * ch;
        const v = Math.sin(x * 0.011 + y * 0.004 + w * 2 * t + 1.6 * Math.sin(y * 0.007 - w * 3 * t)) + Math.sin(-x * 0.006 + y * 0.012 - w * 3 * t + 1.6 * Math.sin(x * 0.008 + w * 2 * t)) + Math.sin(x * 0.009 - y * 0.009 + w * 4 * t);
        if (v > 1.7) { const k = Math.min(1, (v - 1.7) / 1.1); glyph(i, j, k > 0.6 ? "~" : k > 0.3 ? "-" : "·", `rgba(255,255,255,${0.14 + 0.36 * k})`); }
      }
    },
    click(x, y, t, R) { R.add(ripple(x, y, t)); },
    scene(g, env) {
      const { W, H, t, k } = env, w = TAU / 24.5;
      const path = (cx, cy, rx, ry, sp, ph) => (tt) => [W * cx + W * rx * Math.cos(sp * w * tt + ph), H * cy + H * ry * Math.sin(sp * w * tt + ph)];
      const put = (key, fn, s, mode, kind, r, draw) => {
        const [x0, y0] = fn(t), [x1, y1] = fn(t + 0.05), [x, y] = env.body(key, x0, y0, mode, 240, 1), a = Math.atan2(y1 - y0, x1 - x0), h = env.hovered(key);
        g.save(); g.translate(x, y); g.rotate(a); g.scale(s * k, s * k); draw(h); g.restore();
        env.hit(key, x, y, r * s * k, kind);
        return [x, y, a, h];
      };
      // A touched turtle paddles faster and lets out a string of bubbles.
      const bolhas = (x, y, h) => {
        if (h < 0 || h > 2.2) return;
        for (let i = 0; i < 6; i++) { const age = h - i * 0.16; if (age > 0) circ(g, x + Math.sin(age * 6 + i) * 7 * k, y - age * 80 * k, (3.5 + (i % 2) * 2.5) * k, `rgba(235,255,255,${clamp(1 - age / 1.8)})`); }
      };
      put("manta", path(0.5, 0.42, 0.42, 0.34, -1, 3.6), 0.44, "flee", "manta", 280, (h) => manta(g, t + Math.max(0, h) * 1.5));
      const [ax, ay, , ah] = put("t1", path(0.5, 0.45, 0.4, 0.3, 1, 0.3), 0.62, "curious", "turtle", 150, (h) => turtle(g, t + Math.max(0, h) * 2.2, 0));
      bolhas(ax, ay, ah);
      const [bx, by, , bh] = put("t2", path(0.45, 0.4, 0.3, 0.32, -1, 1.5), 0.5, "curious", "turtle", 150, (h) => turtle(g, t + Math.max(0, h) * 2.2, 2));
      bolhas(bx, by, bh);
      const [sx, sy, sa, sh] = put("school", path(0.5, 0.36, 0.38, 0.22, 2, 5), 1, "flee", "school", 130, () => {});
      const spread = 0.52 * k * (1 + (sh >= 0 ? 0.9 * Math.exp(-sh * 1.4) : 0));
      [[0, 0], [-110, -60], [-110, 65], [-220, -10], [-215, -120], [-215, 115]].forEach(([fx, fy], i) => {
        const ca = Math.cos(sa), sn = Math.sin(sa), wob = 12 * Math.sin(t * 1.8 + i);
        g.save(); g.translate(sx + (fx * ca - (fy + wob) * sn) * spread, sy + (fx * sn + (fy + wob) * ca) * spread); g.rotate(sa); g.scale(k * 0.62, k * 0.62); tang(g, t + Math.max(0, sh), i); g.restore();
      });
      [[0, 0.16, 0.48], [0.5, 0.7, 0.4]].forEach(([p0, y0, s], i) => {
        const u = (p0 + t / 49) % 1, [fx, fy] = env.body("f" + i, -100 + u * (W + 200), H * y0 + Math.sin(t * 0.5 + i) * 20, "flee", 200, 1), h = env.hovered("f" + i);
        g.save(); g.translate(fx, fy); g.rotate(w * t + i * 3 + (h >= 0 ? (1 - Math.exp(-h * 2)) * 2.4 : 0)); g.scale(k, k); hibiscus(g, s); g.restore();
        env.hit("f" + i, fx, fy, 95 * s * k, "flower");
      });
    },
  },
  {
    id: "koi", name: "Koi Pond", light: false, wake: true,
    grid: "rgba(220,255,240,0.045)", accent: hx("#d8ffe8"), shadow: "rgba(0,30,25,0.28)",
    bg(ctx, { W, H, t }) {
      ctx.fillStyle = rad(ctx, W * 0.55, H * 0.42, 0, Math.max(W, H) * 0.8, [[0, "#2a8a7f"], [0.55, "#196258"], [1, "#0c3631"]]); ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < 5; k++) glowAt(ctx, W * hash(k, 1) + Math.sin(t * 0.2 + k) * 60, H * hash(k, 2), Math.min(W, H) * 0.25, "rgba(190,255,220,A)", 0.06);
    },
    ambient({ W, H, t, cw, ch }, glyph) {
      for (let k = 0; k < 24; k++) {
        const x = hash(k, 3) * W, y = hash(k, 4) * H, b = (Math.sin(t * 1.1 + k * 2) + 1) / 2;
        if (b > 0.65) glyph(Math.floor(x / cw), Math.floor(y / ch), "o", `rgba(220,255,240,${(b - 0.65) * 0.7})`);
      }
    },
    click(x, y, t, R) { R.add({ kind: "food", x, y, t, life: 6 }); R.add(ripple(x, y, t, { alpha: 0.7, speed: 220, life: 1.4, force: 200 })); },
    scene(g, env) {
      const { W, H, t, k } = env;
      const pads = [[0.1, 0.18, 78], [0.86, 0.14, 88], [0.08, 0.7, 70], [0.9, 0.62, 64]];
      pads.forEach(([px, py, r], i) => {
        const [x, y] = env.body("p" + i, px * W, py * H, "flee", 160, 0.25);
        const rr = r * k * 1.15;
        env.hit("p" + i, x, y, rr, "pad");
        g.save(); g.translate(x, y); g.rotate(i * 1.7 + Math.sin(t * 0.1 + i) * 0.1);
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, rr, 0.32, TAU - 0.02); g.closePath(); g.fillStyle = i % 2 ? "#3f9e4c" : "#4fae55"; g.fill();
        g.lineWidth = 3 * k; g.strokeStyle = "#2f7d3b"; for (let v = 1; v < 6; v++) { const a = 0.3 + (v / 6) * (TAU - 0.3); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * rr * 0.85, Math.sin(a) * rr * 0.85); g.stroke(); }
        if (i === 1 || i === 2) {
          g.save(); g.translate(-rr * 0.25, rr * 0.2);
          for (let p = 0; p < 8; p++) { g.save(); g.rotate((p * TAU) / 8 + 0.2); ell(g, 26 * k, 0, 26 * k, 11 * k, 0, "#ff8fbf"); g.restore(); }
          for (let p = 0; p < 6; p++) { g.save(); g.rotate((p * TAU) / 6); ell(g, 15 * k, 0, 15 * k, 8 * k, 0, "#ffc4dc"); g.restore(); }
          circ(g, 0, 0, 8 * k, "#ffd84a"); g.restore();
        }
        g.restore();
      });
      const fishes = [
        { pal: { body: "#fbf7ef", fin: "rgba(255,244,236,0.9)", patches: [[0, 0, 18, 16, "#e8401c"], [0.36, -8, 30, 24, "#e8401c"], [0.64, 8, 22, 16, "#e8401c"]] }, p: [0.5, 0.36, 0.3, 0.2, 0.2, 0] },
        { pal: { body: "#ffb42a", fin: "rgba(255,214,130,0.9)", patches: [[0, 0, 20, 18, "#ffe08a"], [0.5, 0, 14, 40, "#ffc53d"]] }, p: [0.44, 0.44, 0.34, 0.24, -0.17, 2] },
        { pal: { body: "#202027", fin: "rgba(70,70,84,0.92)", patches: [[0.05, 0, 17, 16, "#e5482a"], [0.32, 10, 24, 16, "#f3f0e8"], [0.5, -10, 24, 18, "#e5482a"], [0.78, 5, 16, 10, "#f3f0e8"]] }, p: [0.56, 0.4, 0.26, 0.26, 0.23, 4] },
      ];
      fishes.forEach(({ pal, p: [cx, cy, rx, ry, sp, ph] }, i) => {
        const at = (tt) => [W * cx + W * rx * Math.cos(sp * tt + ph), H * cy + H * ry * Math.sin(sp * tt * 1.3 + ph)];
        const [x0, y0] = at(t), [x, y, vx, vy] = env.body("k" + i, x0, y0, "curious", 420, 1), [x1, y1] = at(t + 0.08);
        const ang = Math.atan2(y1 - y0 + vy * 0.08, x1 - x0 + vx * 0.08), prev = KOI_ANG[i] ?? ang, dA = Math.atan2(Math.sin(ang - prev), Math.cos(ang - prev));
        KOI_ANG[i] = prev + dA * Math.min(1, env.dt * 3);
        const h = env.hovered("k" + i);
        g.save(); g.translate(x, y); g.rotate(KOI_ANG[i]); g.scale(k * 1.55, k * 1.55); koi(g, t + Math.max(0, h) * 2.5, pal, i * 1.7); g.restore();
        env.hit("k" + i, x, y, 80 * k * 1.55, "koi");
      });
      for (const f of env.effects) if (f.kind === "food") {
        const age = (t - f.t) / f.life;
        g.save(); g.globalAlpha = 1 - age;
        for (let i = 0; i < 4; i++) circ(g, f.x + (hash(i, f.t) - 0.5) * 30 * k, f.y + (hash(f.t, i) - 0.5) * 22 * k + age * 8, 6 * k, "#b07a3a");
        g.restore();
      }
    },
  },
  {
    id: "jelly", name: "Jellyfish", light: false,
    grid: "rgba(160,200,255,0.05)", accent: hx("#9fd0ff"), sprinkle: ["#ffffff"],
    bg(ctx, { W, H, t }) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, "#0f4373"], [0.5, "#08223f"], [1, "#020a17"]]); ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalCompositeOperation = "screen";
      for (let k = 0; k < 4; k++) {
        const x = W * (0.12 + 0.25 * k) + Math.sin(t * 0.2 + k) * 60;
        ctx.fillStyle = lin(ctx, x, 0, x + 120, H, [[0, "rgba(140,200,255,0.11)"], [1, "rgba(140,200,255,0)"]]);
        ctx.beginPath(); ctx.moveTo(x - 30, 0); ctx.lineTo(x + 60, 0); ctx.lineTo(x + 260, H); ctx.lineTo(x + 120, H); ctx.fill();
      }
      ctx.restore();
    },
    ambient({ W, H, t, cw, ch }, glyph) {
      for (let k = 0; k < 70; k++) {
        const x = hash(k, 1) * W + Math.sin(t * 0.5 + k) * 10, y = ((hash(k, 2) * H - t * (5 + 8 * hash(k, 3))) % H + H) % H;
        glyph(Math.floor(x / cw), Math.floor(y / ch), "·", `rgba(170,215,255,${0.15 + 0.3 * hash(k, 5)})`);
      }
    },
    click(x, y, t, R) { R.add({ kind: "bubbles", x, y, t, life: 3 }); },
    scene(g, env) {
      const { W, H, t, k } = env;
      const js = [[0.14, 1.15, "#ff8fc8", "#ffc6e4", 12], [0.4, 0.85, "#b49cff", "#dcd0ff", 9], [0.66, 1.3, "#ff9f7a", "#ffd2bd", 14], [0.88, 0.95, "#8fe3ff", "#d0f4ff", 10]];
      js.forEach(([px, s, c1, c2, sp], i) => {
        const span = H + 600, y = span - ((t * sp + hash(i, 9) * span) % span) - 200, x = px * W + Math.sin(t * 0.3 + i * 2) * 50;
        const [qx, qy] = env.body("j" + i, x, y, "flee", 260, 0.7);
        const h = env.hovered("j" + i);
        g.save(); g.translate(qx, qy); g.rotate(Math.sin(t * 0.4 + i) * 0.12); g.scale(s * k * 1.3, s * k * 1.3); jelly(g, t + Math.max(0, h) * 1.6, c1, c2, i * 1.3, Math.max(env.near(qx, qy, 260), h >= 0 ? 0.8 : 0)); g.restore();
        env.hit("j" + i, qx, qy, 70 * s * k * 1.3, "jelly");
      });
      for (const f of env.effects) if (f.kind === "bubbles") {
        const age = t - f.t;
        for (let i = 0; i < 9; i++) circ(g, f.x + (hash(i, 1) - 0.5) * 60 * k + Math.sin(age * 3 + i) * 8, f.y - age * (60 + hash(i, 2) * 80) * k, (4 + hash(i, 3) * 6) * k, `rgba(200,235,255,${0.9 * (1 - age / f.life)})`);
      }
    },
  },
  {
    id: "boats", name: "Paper Boats", light: true, wake: true,
    grid: "rgba(255,255,255,0.07)", accent: hx("#ffffff"), shadow: "rgba(20,60,70,0.16)",
    bg(ctx, { W, H }) { ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, "#9cc9cc"], [0.5, "#6aa3ab"], [1, "#3e7681"]]); ctx.fillRect(0, 0, W, H); },
    ambient({ t }, glyph, R) {
      for (let j = 0; j < R.rows; j++) for (let i = 0; i < R.cols; i++) {
        const v = Math.sin(i * 0.35 - t * 1.2 + Math.sin(j * 0.6 + t * 0.4) * 1.5) + Math.sin(j * 0.9 + t * 0.3);
        if (v > 1.5) glyph(i, j, v > 1.78 ? "~" : "-", `rgba(255,255,255,${(v - 1.5) * 0.55})`);
      }
    },
    click(x, y, t, R) { R.add(ripple(x, y, t, { force: 900 })); },
    scene(g, env) {
      const { W, H, t, k } = env;
      const bs = [[0.08, 0.24, 1.15, 6, 0], [0.5, 0.15, 0.85, 4, 1], [0.78, 0.36, 1.3, 7, 0], [0.3, 0.6, 1.0, 5, 2]];
      bs.forEach(([px, py, s, sp, cor], i) => {
        const span = W + 400, x = ((px * span + t * sp * 3) % span) - 200, y = py * H + Math.sin(t * 1.4 + i) * 7;
        const [qx, qy, vx] = env.body("b" + i, x, y, "flee", 260, 0.9);
        const h = env.hovered("b" + i), balanco = h >= 0 ? Math.sin(h * 9) * 0.22 * Math.exp(-h * 1.3) : 0;
        env.hit("b" + i, qx, qy, 75 * s * k * 1.6, "boat");
        g.save(); g.translate(qx, qy); g.rotate(Math.sin(t * 1.1 + i) * 0.07 + clamp(vx / 600, -0.35, 0.35) + balanco); g.scale(s * k * 1.6, s * k * 1.6);
        boat(g, cor === 1 ? "#ef6a4c" : cor === 2 ? "#f6d24a" : "#fbf8f1", cor === 1 ? "#c24a30" : cor === 2 ? "#d9b02a" : "#d6cfbf"); g.restore();
      });
      for (let i = 0; i < 4; i++) {
        const x = ((hash(i, 3) * W + t * 12) % (W + 100)) - 50, [qx, qy] = env.body("l" + i, x, hash(i, 4) * H * 0.8, "flee", 180, 1);
        g.save(); g.translate(qx, qy); g.rotate(t * 0.3 + i); ell(g, 0, 0, 18 * k, 8 * k, 0, i % 2 ? "#e2893a" : "#c9b23c"); g.restore();
      }
    },
  },
  {
    id: "fireflies", name: "Fireflies", light: false,
    grid: "rgba(200,255,200,0.035)", accent: hx("#f6ff8a"), liftTo: [255, 255, 200], trailGlyph: "·.",
    flies(env) {
      const { W, H, t } = env;
      if (env._flies && env._fliesT === t) return env._flies;
      const out = [];
      for (let i = 0; i < 22; i++) {
        const x = hash(i, 1) * W + Math.sin(t * 0.25 + i) * 70, y = H * (0.12 + 0.6 * hash(i, 2)) + Math.sin(t * 0.33 + i * 2) * 40;
        const b = clamp(Math.sin(t * (0.7 + hash(i, 3) * 0.8) + i * 7) * 1.4 - 0.2);
        const [px, py] = env.body("f" + i, x, y, "attract", 300, 0.9);
        out.push([px, py, Math.max(b, env.near(px, py, 160))]);
      }
      for (const f of env.effects) if (f.kind === "swarm") {
        const age = (t - f.t) / f.life;
        for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + age * 2, d = age * 160 * env.k + 10; out.push([f.x + Math.cos(a) * d, f.y + Math.sin(a) * d - age * 40, (1 - age) * (0.6 + 0.4 * Math.sin(t * 9 + i))]); }
      }
      env._flies = out; env._fliesT = t;
      return out;
    },
    click(x, y, t, R) { R.add({ kind: "swarm", x, y, t, life: 2.5 }); },
    bg(ctx, env) {
      const { W, H } = env;
      ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, "#0c2119"], [0.6, "#07130e"], [1, "#030806"]]); ctx.fillRect(0, 0, W, H);
      glowAt(ctx, W * 0.15, H * 0.08, Math.min(W, H) * 0.5, "rgba(170,210,190,A)", 0.08);
      ctx.fillStyle = "#06100c";
      for (let x = 0; x < W; x += 6) { const h = H * (0.2 + 0.1 * Math.sin(x * 0.01) + 0.06 * Math.sin(x * 0.037)); ctx.fillRect(x, H * 0.62 - h * 0.5, 6, H); }
      for (const [x, y, b] of this.flies(env)) if (b > 0.05) glowAt(ctx, x, y, 64, "rgba(230,255,120,A)", b * 0.3);
    },
    scene(g, env) {
      const { W, H, t, k } = env;
      g.lineCap = "round";
      for (let i = 0; i < W / 14; i++) {
        const x0 = hash(i, 5) * W, h = H * (0.1 + 0.2 * hash(i, 6)), [mx] = env.body("g" + i, x0, H - h * 0.6, "flee", 140, 0.6);
        const sway = Math.sin(t * 0.9 + x0 * 0.01) * 16 + (mx - x0);
        g.beginPath(); g.moveTo(x0, H + 10); g.quadraticCurveTo(x0 + sway * 0.4, H - h * 0.5, x0 + sway, H - h);
        g.lineWidth = 7 * k + 4; g.strokeStyle = ["#2f7d3d", "#3f9a4c", "#1f5a2c", "#56b05a"][i % 4]; g.stroke();
      }
      this.flies(env).forEach(([x, y, b], i) => { if (b > 0.3) { circ(g, x, y, 7 + 4 * b, b > 0.75 ? "#fbff9a" : "#d6f04a"); if (i < 22) env.hit("f" + i, x, y, 26, "fly"); } });
    },
  },
  {
    id: "moonlit", name: "Moonlit", light: false,
    grid: "rgba(180,200,255,0.05)", accent: hx("#c9d6ff"), sprinkle: ["#ffffff", "#ffe9a8"], trailGlyph: "*+·",
    bg(ctx, { W, H }) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, "#0a1236"], [0.6, "#14275f"], [1, "#22407e"]]); ctx.fillRect(0, 0, W, H);
      glowAt(ctx, W * 0.74, H * 0.22, Math.min(W, H) * 0.4, "rgba(220,215,170,A)", 0.12);
    },
    ambient({ W, H, t, cw, ch, mouse }, glyph) {
      for (let k = 0; k < 110; k++) {
        const x = hash(k, 1) * W, y = hash(k, 2) * H * 0.8;
        const near = mouse ? clamp(1 - Math.hypot(x - mouse.x, y - mouse.y) / 200) : 0;
        const b = clamp((Math.sin(t * (0.8 + hash(k, 3) * 2) + k) + 1) / 2 + near);
        glyph(Math.floor(x / cw), Math.floor(y / ch), b > 0.85 ? "*" : b > 0.5 ? "+" : "·", `rgba(230,236,255,${0.2 + b * 0.7})`);
      }
    },
    click(x, y, t, R) { R.add({ kind: "star", x, y, t, life: 1.3 }); },
    scene(g, env) {
      const { W, H, t, k } = env;
      const [mx, my] = env.body("moon", W * 0.74, H * 0.22, "flee", 240, 0.3), r = 100 * k;
      env.hit("moon", mx, my, r, "moon");
      g.save(); g.translate(mx, my);
      circ(g, 0, 0, r, "#ddd3a6");
      circ(g, -r * 0.3, -r * 0.2, r * 0.16, "#bfb488"); circ(g, -r * 0.5, r * 0.35, r * 0.12, "#bfb488"); circ(g, -r * 0.05, r * 0.55, r * 0.09, "#c7bc90");
      g.globalCompositeOperation = "destination-out"; circ(g, r * 0.5, -r * 0.18, r * 0.9, "#000"); g.globalCompositeOperation = "source-over";
      g.restore();
      const cl = [[0.06, 0.2, 1.25, 5], [0.55, 0.38, 1.5, 3], [0.25, 0.58, 1.05, 4], [0.85, 0.66, 1.2, 6]];
      cl.forEach(([px, py, s, sp], i) => {
        const span = W + 800, x = ((px * span + t * sp * 4) % span) - 400, [qx, qy] = env.body("c" + i, x, py * H, "flee", 280, 0.7);
        env.hit("c" + i, qx, qy, 170 * s * k, "cloud");
        g.save(); g.translate(qx, qy); g.scale(s * k, s * k);
        const rr = (x, y, w, h, c) => { g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fillStyle = c; g.fill(); };
        rr(-180, 12, 360, 38, "#4a5ea0"); rr(-125, -20, 240, 38, "#5b70b4"); rr(-62, -48, 136, 32, "#7286c8"); rr(-210, 34, 170, 22, "#3e5190");
        g.restore();
      });
      for (const f of env.effects) if (f.kind === "star") {
        const age = (t - f.t) / f.life, hx0 = f.x - age * 420 * k, hy0 = f.y + age * 200 * k;
        for (let s = 0; s < 12; s++) circ(g, hx0 + s * 16 * k, hy0 - s * 7.6 * k, (13 - s * 0.8) * k, `rgba(255,250,230,${Math.min(1, (1 - age) * 1.4) * (1 - s / 12)})`);
      }
    },
  },
];

// ---------------------------------------------------------------------------
// Cozy and geek themes: a fireplace, a lo-fi rainy window and a space opera.
// The geek one is original art in the spirit of that world, with no logos,
// names or official designs.

const rr = (g, x, y, w, h, r, fill) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill(); };
const poly = (g, pts, fill) => { g.beginPath(); pts.forEach(([x, y]) => g.lineTo(x, y)); g.closePath(); g.fillStyle = fill; g.fill(); };

// Flames: a noise field shaped like a tongue of fire, base at y = 0.
function chamas(g, t, largura, altura, seed = 7) {
  const nucleo = g.createRadialGradient(0, -altura * 0.25, 4, 0, -altura * 0.3, altura * 0.62);
  nucleo.addColorStop(0, "rgba(255,236,150,1)"); nucleo.addColorStop(0.35, "rgba(255,150,40,0.95)"); nucleo.addColorStop(1, "rgba(255,80,10,0)");
  ell(g, 0, -altura * 0.3, largura * 0.42, altura * 0.62, 0, nucleo);
  for (let y = -altura; y <= 0; y += 4) {
    const rel = -y / altura, meia = (1 - rel) * largura * 0.5 + 4;
    for (let x = -meia - 6; x <= meia + 6; x += 4) {
      const n = ruido((x * 0.04), (y * 0.035) + t * 1.6, seed);
      const v = n * (1.2 - rel) * 1.5 - (Math.abs(x) / (meia + 6)) * 0.7;
      if (v > 0.12) { g.fillStyle = "#" + degrade(["#b52200", "#ff5a00", "#ffb21a", "#fff6c0"], (v - 0.08) * 1.25).toString(16).padStart(6, "0"); g.fillRect(x - 2.5, y - 2.5, 5, 5); }
    }
  }
}
const degrade = (stops, t) => { const s = clamp(t) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(s)); const c = mix(hx(stops[i]), hx(stops[i + 1]), s - i); return ((c[0] | 0) << 16) | ((c[1] | 0) << 8) | (c[2] | 0); };
const ruido = (x, y, s = 0) => {
  const xi = Math.floor(x), yi = Math.floor(y), u = (x - xi) ** 2 * (3 - 2 * (x - xi)), v = (y - yi) ** 2 * (3 - 2 * (y - yi));
  const a = hash(xi + s * 13, yi), b = hash(xi + 1 + s * 13, yi), c = hash(xi + s * 13, yi + 1), d = hash(xi + 1 + s * 13, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

// A ginger cat curled up asleep, seen from above-front.
function gato(g, t, h) {
  const resp = 1 + 0.035 * Math.sin(t * 1.6), orelha = h >= 0 ? Math.sin(h * 14) * 0.25 * Math.exp(-h * 2) : 0;
  g.save(); g.scale(1, resp);
  const rabo = h >= 0 ? Math.sin(h * 6) * 0.18 * Math.exp(-h * 0.6) : Math.sin(t * 0.7) * 0.03;
  g.lineCap = "round"; g.lineWidth = 22; g.strokeStyle = "#d98a42";
  g.beginPath(); g.arc(0, 4, 78, (0.2 + rabo) * Math.PI, (0.95 + rabo * 0.4) * Math.PI); g.stroke();
  ell(g, 0, 0, 92, 56, 0, "#e9a058");
  for (let i = -2; i <= 2; i++) ell(g, i * 26, -18, 7, 26, 0.15 * i, "#c9772f");
  ell(g, 0, 18, 60, 22, 0, "#f6d2a2");
  g.restore();
  g.save(); g.translate(58, -16);
  for (const m of [-1, 1]) { g.save(); g.translate(m * 20, -24); g.rotate(m * (0.25 + orelha)); poly(g, [[-16, 8], [0, -32], [16, 8]], "#d98a42"); poly(g, [[-8, 5], [0, -18], [8, 5]], "#f5b8a8"); g.restore(); }
  circ(g, 0, 0, 36, "#eda75e");
  ell(g, 0, 14, 20, 12, 0, "#f8dcb2");
  for (const m of [-1, 1]) { g.lineWidth = 3.5; g.strokeStyle = "#5b3216"; g.beginPath(); g.arc(m * 13, -2, 7, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  circ(g, 0, 8, 4, "#d06a62");
  g.restore();
}

THEMES.push(
  {
    id: "lareira", name: "Lareira", light: false,
    grid: "rgba(255,220,180,0.03)", accent: hx("#ffb066"), shadow: "rgba(0,0,0,0.3)", sprinkle: ["#ffe2a8"],
    fogo(env) { const { W, H, k } = env; return [W * 0.7, H * 0.84, k]; },
    bg(ctx, env) {
      const { W, H, t } = env, [fx, fy, k] = this.fogo(env), chao = H * 0.84;
      ctx.fillStyle = lin(ctx, 0, 0, 0, chao, [[0, "#1d120c"], [1, "#2a180e"]]); ctx.fillRect(0, 0, W, chao);
      for (let x = 0; x < W; x += 46) { ctx.fillStyle = "rgba(255,200,150,0.018)"; ctx.fillRect(x, 0, 18, chao); }
      ctx.fillStyle = lin(ctx, 0, chao, 0, H, [[0, "#3a2414"], [1, "#24160c"]]); ctx.fillRect(0, chao, W, H - chao);
      for (let y = chao + 14; y < H; y += 18) { ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(0, y, W, 2); }
      const pulso = 0.85 + 0.15 * Math.sin(t * 7) * Math.sin(t * 2.3) + (env.effects.some((f) => f.kind === "atica") ? 0.25 : 0);
      glowAt(ctx, fx, fy - 120 * k, Math.max(W, H) * 0.55, "rgba(255,130,50,A)", 0.22 * pulso);
      glowAt(ctx, W * 0.52, chao - 330 * k, 260 * k, "rgba(255,200,120,A)", 0.22);
      // brick surround, painted smooth so the fire stands out
      ctx.save(); ctx.translate(fx, fy); ctx.scale(k, k);
      const fw = 470, fh = 420;
      ctx.fillStyle = "#4e2a1f"; ctx.fillRect(-fw / 2, -fh, fw, fh);
      for (let row = 0, y = -fh; y < 0; y += 36, row++) for (let x = -fw / 2 - (row % 2) * 40; x < fw / 2; x += 80) {
        const x0 = Math.max(-fw / 2, x), x1 = Math.min(fw / 2, x + 76);
        ctx.fillStyle = (row + Math.floor(x / 80)) % 3 ? "#6e3a2a" : "#633325"; ctx.fillRect(x0, y + 2, x1 - x0, 32);
      }
      ctx.fillStyle = `rgba(255,140,60,${0.12 * pulso})`; ctx.fillRect(-fw / 2, -fh, fw, fh);
      ctx.restore();
    },
    click(x, y, t, R) { R.add({ kind: "atica", x, y, t, life: 1.8 }); },
    scene(g, env) {
      const { W, H, t, k } = env, [fx, fy] = this.fogo(env);
      const atica = env.effects.filter((f) => f.kind === "atica").reduce((m, f) => Math.max(m, 1 - (t - f.t) / f.life), 0);
      // window with snow, on the left wall
      const wx = W * 0.1, wy = H * 0.12, ww = 250 * k, wh = 300 * k;
      rr(g, wx - 14 * k, wy - 14 * k, ww + 28 * k, wh + 28 * k, 6, "#4a2e1c");
      rr(g, wx, wy, ww, wh, 2, "#1d2f52");
      for (let i = 0; i < 22; i++) {
        const x = wx + hash(i, 1) * ww + Math.sin(t * 0.8 + i) * 6 * k, y = wy + ((hash(i, 2) * wh + t * (14 + hash(i, 3) * 16) * k) % wh);
        circ(g, x, y, (4 + hash(i, 4) * 3) * k, "#eef3ff");
      }
      g.fillStyle = "#4a2e1c"; g.fillRect(wx + ww / 2 - 6 * k, wy, 12 * k, wh); g.fillRect(wx, wy + wh / 2 - 6 * k, ww, 12 * k);
      rr(g, wx - 24 * k, wy + wh + 10 * k, ww + 48 * k, 16 * k, 4, "#5c3a24");
      // fireplace
      g.save(); g.translate(fx, fy); g.scale(k, k);
      const fw = 470, fh = 420;
      rr(g, -fw / 2 - 36, -fh - 30, fw + 72, 30, 4, "#4a2c1c"); rr(g, -fw / 2 - 36, -fh - 30, fw + 72, 8, 4, "#62402a");
      g.beginPath(); g.moveTo(-150, 0); g.lineTo(-150, -210); g.arc(0, -210, 150, Math.PI, 0); g.lineTo(150, 0); g.closePath(); g.fillStyle = "#170905"; g.fill();
      g.save(); g.clip();
      const brilho = g.createRadialGradient(0, -40, 10, 0, -40, 230); brilho.addColorStop(0, `rgba(255,120,30,${0.55 + atica * 0.3})`); brilho.addColorStop(1, "rgba(255,90,20,0)");
      g.fillStyle = brilho; g.fillRect(-160, -380, 320, 380);
      const hf = env.hovered("fogo"), alto = 1 + atica * 0.5 + (hf >= 0 ? 0.35 * Math.exp(-hf * 0.8) : 0);
      chamas(g, t, 210, 210 * alto, 7);
      g.restore();
      g.save(); g.translate(0, -26); g.rotate(-0.12); rr(g, -120, -16, 240, 32, 14, "#4a2a14"); g.restore();
      g.save(); g.translate(0, -26); g.rotate(0.12); rr(g, -115, -14, 230, 28, 13, "#5c3418"); g.restore();
      g.fillStyle = "#1d1612"; for (let x = -130; x <= 130; x += 26) g.fillRect(x - 3, -60, 6, 60);
      rr(g, -fw / 2 - 50, 0, fw + 100, 24, 3, "#3d2b22");
      // candles on the mantel
      for (const [x, h, i] of [[-170, 46, 0], [-128, 64, 1], [160, 38, 2]]) {
        rr(g, x - 9, -fh - 30 - h, 18, h, 3, "#efe4cc");
        const fl = Math.sin(t * 9 + i * 2) * 2;
        ell(g, x + fl * 0.3, -fh - 30 - h - 13, 6, 12 + fl, 0, "#ffce5a"); ell(g, x, -fh - 30 - h - 9, 3, 6, 0, "#fff6d0");
      }
      g.restore();
      env.hit("fogo", fx, fy - 140 * k, 170 * k, "fogo");
      // sparks
      for (let i = 0; i < 16; i++) {
        const vida = 2.4, age = (t * (0.5 + hash(i, 2) * 0.5) + hash(i, 3) * vida) % vida;
        circ(g, fx + (hash(i, 1) - 0.5) * 160 * k + Math.sin(t * 2 + i) * 12 * k, fy - 150 * k - age * 110 * k, 3.5 * k, `rgba(255,${150 + 80 * hash(i, 4) | 0},60,${clamp(1 - age / vida)})`);
      }
      for (const f of env.effects) if (f.kind === "atica") {
        const age = (t - f.t) / f.life;
        for (let i = 0; i < 22; i++) { const a = -Math.PI / 2 + (hash(i, f.t) - 0.5) * 1.6, d = age * 260 * k * (0.5 + hash(i, 2)); circ(g, fx + Math.cos(a) * d, fy - 160 * k + Math.sin(a) * d + age * age * 80 * k, 4 * k, `rgba(255,190,80,${1 - age})`); }
      }
      // floor lamp
      g.save(); g.translate(W * 0.52, H * 0.84); g.scale(k, k);
      rr(g, -40, -8, 80, 10, 4, "#2a1c14"); g.fillStyle = "#3a2a1e"; g.fillRect(-4, -300, 8, 294);
      poly(g, [[-62, -300], [62, -300], [42, -380], [-42, -380]], "#e8c98a"); poly(g, [[-62, -300], [62, -300], [56, -312], [-56, -312]], "#f6dfa6");
      g.restore();
      env.hit("abajur", W * 0.52, H * 0.84 - 340 * k, 70 * k, "abajur");
      // rug and the cat asleep on it
      const [cx, cy] = env.body("gato", W * 0.34, H * 0.88, "flee", 120, 0.15), hg = env.hovered("gato");
      ell(g, cx, cy + 10 * k, 260 * k, 56 * k, 0, "#7d2a36"); ell(g, cx, cy + 10 * k, 205 * k, 40 * k, 0, "#9c3a46");
      g.save(); g.translate(cx, cy - 40 * k); g.scale(k * 1.3, k * 1.3); gato(g, t, hg); g.restore();
      env.hit("gato", cx, cy - 40 * k, 130 * k, "gato");
      if (hg >= 0 && hg < 3) for (let i = 0; i < 3; i++) { const age = hg - i * 0.5; if (age > 0) { g.save(); g.globalAlpha = clamp(1 - age / 2.2); g.font = `700 ${(22 + i * 6) * k}px Manrope`; g.fillStyle = "#ffffff"; g.fillText("z", cx + (60 + age * 30) * k, cy - (90 + age * 50 + i * 10) * k); g.restore(); } }
    },
  },
  {
    id: "chuva", name: "Chuva Lo-fi", light: false,
    grid: "rgba(200,210,255,0.035)", accent: hx("#cfd8ff"), shadow: "rgba(0,0,0,0.25)",
    bg(ctx, env) {
      const { W, H, t } = env, raio = env.effects.find((f) => f.kind === "raio"), flash = raio ? Math.max(0, 1 - (t - raio.t) / 0.35) * (Math.sin((t - raio.t) * 60) > 0 ? 1 : 0.4) : 0;
      ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, "#141a33"], [0.6, "#2a2346"], [1, "#3a2a44"]]); ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 22; i++) {
        const x = ((hash(i, 1) * W * 1.2 + t * (4 + hash(i, 5) * 6)) % (W * 1.2)) - W * 0.1, y = H * (0.35 + 0.45 * hash(i, 2)), r = (30 + 70 * hash(i, 3));
        const c = ["rgba(255,190,110,A)", "rgba(255,120,150,A)", "rgba(120,190,255,A)", "rgba(255,230,160,A)"][i % 4];
        glowAt(ctx, x, y, r, c, 0.16 + 0.1 * Math.sin(t * 0.7 + i));
      }
      if (flash) { ctx.fillStyle = `rgba(220,230,255,${0.45 * flash})`; ctx.fillRect(0, 0, W, H); }
      const k = env.k, peitoril = H * 0.8;
      ctx.fillStyle = "#231b2a";
      ctx.fillRect(0, 0, W, 16 * k); ctx.fillRect(0, 0, 16 * k, peitoril); ctx.fillRect(W - 16 * k, 0, 16 * k, peitoril);
      ctx.fillRect(W * 0.5 - 8 * k, 0, 16 * k, peitoril); ctx.fillRect(0, H * 0.42 - 8 * k, W, 16 * k);
      ctx.fillStyle = lin(ctx, 0, peitoril, 0, H, [[0, "#3e3140"], [0.12, "#2e2432"], [1, "#1c1620"]]); ctx.fillRect(0, peitoril, W, H - peitoril);
      ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fillRect(0, peitoril, W, 3);
      glowAt(ctx, W * 0.42, peitoril - 140 * k, 180 * k, "rgba(255,190,100,A)", 0.25 + 0.05 * Math.sin(t * 8));
    },
    ambient({ W, H, t, cw, ch }, glyph, R) {
      // Condensation on the glass: the pointer's trail wipes it clear and it
      // fogs back over as the trail fades.
      for (let j = 0; j < Math.floor((H * 0.8) / ch); j++) for (let i = 0; i < R.cols; i++) {
        const k = j * R.cols + i, limpo = R.trail[k];
        if (limpo > 0.25 || hash(i, j, 4) > 0.42) continue;
        glyph(i, j, hash(i, j, 5) < 0.5 ? "·" : ".", `rgba(220,226,255,${0.16 * (1 - limpo)})`);
      }
    },
    click(x, y, t, R) { R.add({ kind: "raio", x, y, t, life: 1.2 }); },
    scene(g, env) {
      const { W, H, t, k } = env, peitoril = H * 0.8;
      // fairy lights along the top
      for (let i = 0; i < W / (46 * k); i++) {
        const x = i * 46 * k + 20 * k, y = 34 * k + Math.sin(i * 0.9) * 10 * k, b = 0.6 + 0.4 * Math.sin(t * 2 + i * 1.7);
        circ(g, x, y, 7 * k, `rgba(${["255,200,120", "255,150,170", "180,220,255", "255,235,150"][i % 4]},${b})`);
      }
      // drops sliding down the glass
      for (let i = 0; i < 30; i++) {
        const lento = 0.4 + hash(i, 2) * 0.6, ciclo = 9 + hash(i, 3) * 8, fase = ((t * lento + hash(i, 4) * ciclo) % ciclo) / ciclo;
        const desce = fase < 0.5 ? fase * 0.15 : 0.075 + (fase - 0.5) * 2 * 0.95;
        const x = hash(i, 1) * W, y = desce * peitoril;
        if (y > peitoril - 10) continue;
        for (let s = 1; s < 5; s++) circ(g, x + Math.sin(s + i) * 1.5, y - s * 12 * k, (2.5 - s * 0.4) * k, "rgba(200,215,255,0.55)");
        circ(g, x, y, 5.5 * k, "rgba(225,235,255,0.95)");
      }
      // plant
      const [px, py] = env.body("planta", W * 0.16, peitoril, "flee", 160, 0.2), hp = env.hovered("planta"), sway = hp >= 0 ? Math.sin(hp * 8) * 0.18 * Math.exp(-hp) : 0;
      g.save(); g.translate(px, py); g.scale(k, k);
      for (let i = 0; i < 7; i++) { g.save(); g.translate(0, -70); g.rotate(-1.3 + i * 0.43 + Math.sin(t * 0.6 + i) * 0.04 + sway); ell(g, 0, -62, 26, 58, 0, i % 2 ? "#3f8a4e" : "#4fa35c"); g.restore(); }
      poly(g, [[-46, -76], [46, -76], [34, 0], [-34, 0]], "#b5583b"); rr(g, -52, -86, 104, 14, 4, "#c96a4a");
      g.restore();
      env.hit("planta", px, py - 90 * k, 90 * k, "planta");
      // books and a candle on the sill
      g.save(); g.translate(W * 0.42, peitoril); g.scale(k, k);
      rr(g, -70, -28, 140, 28, 3, "#3f6a8a"); rr(g, -60, -52, 124, 24, 3, "#a8574a"); rr(g, -66, -72, 130, 20, 3, "#d9b56a");
      rr(g, -16, -128, 32, 56, 4, "#efe6d6");
      const fl = Math.sin(t * 8) * 2;
      ell(g, fl * 0.3, -142, 7, 14 + fl, 0, "#ffc95a"); ell(g, 0, -138, 3, 7, 0, "#fff3cc");
      g.restore();
      // mug with steam
      const [mx, my] = env.body("caneca", W * 0.8, peitoril, "flee", 140, 0.15), hm = env.hovered("caneca");
      g.save(); g.translate(mx, my); g.scale(k, k);
      g.lineWidth = 12; g.strokeStyle = "#e9e2d6"; g.beginPath(); g.arc(46, -44, 20, -Math.PI / 2, Math.PI / 2); g.stroke();
      rr(g, -44, -96, 88, 96, 12, "#e9e2d6"); rr(g, -44, -60, 88, 18, 0, "#c8553d");
      g.lineCap = "round";
      for (let s = 0; s < 3; s++) {
        g.beginPath(); for (let y = 0; y < 90; y += 6) g.lineTo(-16 + s * 16 + Math.sin(y * 0.08 - t * 2 + s) * 9, -106 - y);
        g.lineWidth = 7; g.strokeStyle = `rgba(240,240,255,${0.35 + (hm >= 0 ? 0.3 * Math.exp(-hm * 0.6) : 0)})`; g.stroke();
      }
      g.restore();
      env.hit("caneca", mx, my - 60 * k, 70 * k, "caneca");
      const raio = env.effects.find((f) => f.kind === "raio");
      if (raio && t - raio.t < 0.3) { g.lineWidth = 5; g.strokeStyle = "#f2f4ff"; g.beginPath(); let x = raio.x, y = 0; g.moveTo(x, y); while (y < H * 0.4) { x += (hash(y, raio.t) - 0.5) * 60; y += 30; g.lineTo(x, y); } g.stroke(); }
    },
  },
  {
    id: "galaxia", name: "Galáxia Distante", light: false,
    grid: "rgba(160,190,255,0.035)", accent: hx("#9fd4ff"), sprinkle: ["#ffffff", "#ff5a5a"], trailGlyph: "·*",
    salto(env) { const f = env.effects.find((e) => e.kind === "salto"); return f ? clamp((env.t - f.t) / f.life) : -1; },
    bg(ctx, env) {
      const { W, H, t } = env;
      ctx.fillStyle = lin(ctx, 0, 0, W, H, [[0, "#02030a"], [0.6, "#060a1c"], [1, "#0d0a24"]]); ctx.fillRect(0, 0, W, H);
      glowAt(ctx, W * 0.75 + Math.sin(t * 0.03) * 40, H * 0.3, Math.min(W, H) * 0.6, "rgba(120,60,200,A)", 0.16);
      glowAt(ctx, W * 0.2, H * 0.75, Math.min(W, H) * 0.5, "rgba(40,110,220,A)", 0.12);
      const s = this.salto(env);
      if (s >= 0) {
        const cx = W / 2, cy = H / 2, forca = Math.sin(s * Math.PI);
        ctx.lineCap = "round";
        for (let i = 0; i < 260; i++) {
          const a = hash(i, 1) * TAU, d0 = 40 + hash(i, 2) * Math.max(W, H) * 0.6, len = forca * (120 + hash(i, 3) * 380);
          ctx.strokeStyle = `rgba(${hash(i, 4) < 0.3 ? "160,200,255" : "235,240,255"},${0.25 + 0.6 * forca})`; ctx.lineWidth = 1 + hash(i, 5) * 2;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0); ctx.lineTo(cx + Math.cos(a) * (d0 + len), cy + Math.sin(a) * (d0 + len)); ctx.stroke();
        }
        if (s > 0.45 && s < 0.6) { ctx.fillStyle = `rgba(220,235,255,${(1 - Math.abs(s - 0.52) / 0.08) * 0.7})`; ctx.fillRect(0, 0, W, H); }
      }
    },
    ambient({ W, H, t, cw, ch }, glyph) {
      for (let i = 0; i < 160; i++) {
        const prof = 0.2 + hash(i, 3) * 0.8, x = ((hash(i, 1) * W - t * 8 * prof) % W + W) % W, y = hash(i, 2) * H;
        const b = 0.3 + 0.7 * prof * (0.7 + 0.3 * Math.sin(t * 2 + i));
        glyph(Math.floor(x / cw), Math.floor(y / ch), prof > 0.85 ? "*" : prof > 0.5 ? "+" : "·", `rgba(230,236,255,${b * 0.8})`);
      }
    },
    click(x, y, t, R) { R.add({ kind: "salto", x, y, t, life: 1.6 }); },
    scene(g, env) {
      const { W, H, t, k } = env, s = this.salto(env), fuga = s >= 0 ? Math.sin(s * Math.PI) : 0;
      // desert planet rising from the bottom left
      const pr = Math.min(W, H) * 0.45;
      g.save(); g.beginPath(); g.arc(W * 0.12, H + pr * 0.45, pr, 0, TAU); g.clip();
      g.fillStyle = "#c98a4c"; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? "#b4743c" : "#dca066"; g.fillRect(0, H + pr * 0.45 - pr + i * pr * 0.11 + Math.sin(i * 3) * 6, W, pr * 0.05); }
      g.restore();
      // asteroids tumbling slowly
      for (let i = 0; i < 5; i++) {
        const x = ((hash(i, 21) * W * 1.3 - t * (6 + hash(i, 22) * 10) * k) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15, y = H * (0.15 + 0.7 * hash(i, 23)), r = (26 + hash(i, 24) * 40) * k;
        const [ax, ay] = env.body("a" + i, x, y, "flee", 200, 0.6);
        g.save(); g.translate(ax, ay); g.rotate(t * (0.1 + hash(i, 25) * 0.3));
        poly(g, Array.from({ length: 8 }, (_, j) => { const a = (j / 8) * TAU, rj = r * (0.75 + hash(i, j + 30) * 0.35); return [Math.cos(a) * rj, Math.sin(a) * rj]; }), "#6b6f78");
        circ(g, -r * 0.25, -r * 0.2, r * 0.22, "#575b63"); circ(g, r * 0.3, r * 0.25, r * 0.15, "#7c808a");
        g.restore();
      }
      // capital ship drifting across the top
      const ciclo = 70, u = (t % ciclo) / ciclo, [sx, sy] = env.body("nave", W * 1.3 - u * W * 1.8, H * 0.2, "flee", 260, 0.1), hn = env.hovered("nave");
      g.save(); g.translate(sx - fuga * W * 0.6, sy); g.scale(k * 1.7, k * 1.7);
      poly(g, [[-260, 0], [240, -64], [250, 64]], "#a3abb6");
      poly(g, [[-260, 0], [240, -64], [240, -18], [-120, 0]], "#c0c7d0");
      rr(g, 60, -40, 120, 26, 4, "#7d858f"); rr(g, 120, -64, 60, 30, 4, "#8f98a3");
      for (let i = 0; i < 3; i++) circ(g, 252, -36 + i * 36, 14, hn >= 0 ? "#d6f2ff" : "#8fd6ff");
      for (let i = 0; i < 9; i++) if (Math.sin(t * 2 + i * 1.3) > -0.3) circ(g, -120 + i * 38, -10 + (i % 3) * 8, 3.5, i % 4 ? "#fff3c4" : "#ff6a5a");
      g.restore();
      env.hit("nave", sx, sy, 280 * k, "nave");
      // small explosions now and then
      const ce = Math.floor(t / 4.5), ue = (t % 4.5) / 0.9;
      if (ue < 1) { const ex = W * (0.25 + 0.5 * hash(ce, 41)), ey = H * (0.25 + 0.45 * hash(ce, 42)); circ(g, ex, ey, (20 + ue * 50) * k, `rgba(255,${180 - ue * 80 | 0},60,${1 - ue})`); circ(g, ex, ey, (10 + ue * 26) * k, `rgba(255,245,200,${1 - ue})`); }
      // starfighters in a dogfight
      const cacas = [[0.0, 1, "#d9dde2", "#c8423b"], [1.7, -1, "#d9dde2", "#3b7bc8"], [3.3, 1, "#b8bec6", "#e0a030"]];
      cacas.forEach(([ph, dir, corpo, faixa], i) => {
        const at = (tt) => [W * 0.5 + W * 0.36 * Math.sin(dir * tt * 0.23 + ph), H * 0.5 + H * 0.26 * Math.sin(tt * 0.37 + ph * 1.7)];
        const [x0, y0] = at(t), [x1, y1] = at(t + 0.05), [x, y] = env.body("c" + i, x0, y0, "flee", 240, 1.2), a = Math.atan2(y1 - y0, x1 - x0), hc = env.hovered("c" + i);
        g.save(); g.translate(x + fuga * Math.cos(a) * W, y + fuga * Math.sin(a) * W); g.rotate(a); g.scale(k * 1.45, k * 1.45);
        poly(g, [[-30, -48], [10, -10], [10, 10], [-30, 48], [-18, 10], [-18, -10]], corpo);
        poly(g, [[-26, -40], [-6, -16], [-14, -16]], faixa); poly(g, [[-26, 40], [-6, 16], [-14, 16]], faixa);
        rr(g, -40, -9, 90, 18, 8, corpo); ell(g, 22, 0, 12, 7, 0, "#2b3a52"); circ(g, -44, 0, 8, "#ffb35a");
        const rajada = (t + i * 0.9) % 2.6 < 0.45 ? (t + i * 0.9) % 2.6 : -1;
        if (rajada >= 0) for (let b = 0; b < 2; b++) { const d = (rajada * 1100 + b * 160) % 600; rr(g, 60 + d, -3, 46, 6, 3, faixa === "#3b7bc8" ? "#7dff8a" : "#ff4d4d"); }
        if (hc >= 0 && hc < 1.2) for (let b = 0; b < 3; b++) { const d = (hc * 900 + b * 140) % 700; rr(g, 60 + d, -3, 46, 6, 3, faixa === "#3b7bc8" ? "#7dff8a" : "#ff4d4d"); }
        g.restore();
        env.hit("c" + i, x, y, 90 * k, "caca");
      });
    },
  },
);

// ---------------------------------------------------------------------------
// More themes: a sakura garden, an aurora over a snowy cabin, falling code and
// a retro arcade. The arcade's aliens are original sprites, not taken from any
// game.

// A pixel sprite: each "X" is one block of size `p`; colours by letter.
function bitmap(g, linhas, p, cores) {
  const w = linhas[0].length, h = linhas.length;
  linhas.forEach((l, y) => { for (let x = 0; x < w; x++) { const c = cores[l[x]]; if (c) { g.fillStyle = c; g.fillRect((x - w / 2) * p, (y - h / 2) * p, p * 0.92, p * 0.92); } } });
}

// A fox sitting, seen from the side, tail curled at its feet.
function raposa(g, t, h) {
  const cauda = h >= 0 ? Math.sin(h * 9) * 0.35 * Math.exp(-h * 0.8) : Math.sin(t * 0.8) * 0.06;
  g.save(); g.translate(-46, 30); g.rotate(-0.4 + cauda);
  ell(g, -40, 0, 60, 24, -0.2, "#e2702a"); ell(g, -86, -8, 18, 14, -0.2, "#fbf3ea"); g.restore();
  ell(g, 0, 10, 46, 50, 0, "#e9782f");
  ell(g, 10, 26, 22, 30, 0, "#fbf3ea");
  ell(g, 22, -52, 30, 26, 0, "#ee8236");
  poly(g, [[46, -50], [76, -44], [46, -38]], "#ee8236"); circ(g, 76, -44, 5, "#2a1a10");
  ell(g, 34, -40, 18, 10, 0.2, "#fbf3ea");
  for (const dx of [-2, 22]) { poly(g, [[dx - 10, -72], [dx, -100], [dx + 10, -72]], "#d9632a"); poly(g, [[dx - 5, -74], [dx, -90], [dx + 5, -74]], "#2a1a10"); }
  circ(g, 34, -58, 4, "#2a1a10");
  for (const dx of [-10, 18]) rr(g, dx - 6, 52, 12, 18, 4, "#3a2416");
}

const ALIENS = [
  ["...XX...", "..XXXX..", ".XXXXXX.", "XX.XX.XX", "XXXXXXXX", "..X..X..", ".X.XX.X.", "X.X..X.X"],
  ["..X.....X..", "...X...X...", "..XXXXXXX..", ".XX.XXX.XX.", "XXXXXXXXXXX", "X.XXXXXXX.X", "X.X.....X.X", "...XX.XX..."],
  [".XXXXXXX.", "XXXXXXXXX", "XX.XXX.XX", "XXXXXXXXX", ".XX...XX.", "XX.X.X.XX", "X.......X"],
];

THEMES.push(
  {
    id: "sakura", name: "Jardim Sakura", light: true,
    grid: "rgba(255,255,255,0.1)", accent: hx("#ff8fbf"), shadow: "rgba(150,60,90,0.1)", liftTo: [255, 240, 248],
    bg(ctx, { W, H, t, k }) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, "#ffd3e3"], [0.55, "#ffeaf1"], [1, "#fff6f2"]]); ctx.fillRect(0, 0, W, H);
      glowAt(ctx, W * 0.62, H * 0.24, Math.min(W, H) * 0.4, "rgba(255,250,235,A)", 0.7);
      ctx.fillStyle = lin(ctx, 0, H * 0.78, 0, H, [[0, "#cfe6e9"], [1, "#b3d6dc"]]); ctx.fillRect(0, H * 0.78, W, H * 0.22);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(((hash(i, 3) * W + t * 10) % W), H * (0.8 + 0.18 * hash(i, 4)), 40 * k, 2); }
    },
    ambient({ W, H, t, cw, ch }, glyph) {
      for (let i = 0; i < 4; i++) {
        const x = ((hash(i, 9) * W - t * 30) % (W + 100) + W + 100) % (W + 100) - 50, y = H * (0.1 + 0.15 * hash(i, 8)) + Math.sin(t * 3 + i) * 5;
        glyph(Math.floor(x / cw), Math.floor(y / ch), Math.sin(t * 7 + i) > 0 ? "v" : "^", "rgba(120,70,90,0.5)");
      }
    },
    click(x, y, t, R) { R.add({ kind: "rajada", x, y, t, life: 2.4 }); },
    scene(g, env) {
      const { W, H, t, k, mouse } = env, ht = env.hovered("arvore"), treme = ht >= 0 ? Math.sin(ht * 18) * 0.03 * Math.exp(-ht * 1.5) : 0;
      // a low ridge far away, then Fuji: concave slopes, a flat crater, a snow
      // cap with a ragged edge (clipped to the mountain so it follows the slopes)
      const base = H * 0.79;
      g.fillStyle = "#f4dbe8"; g.beginPath(); g.moveTo(0, base);
      for (let x = 0; x <= W; x += W / 24) g.lineTo(x, base - H * (0.04 + 0.025 * Math.sin(x / W * 7 + 1) + 0.015 * Math.sin(x / W * 19)));
      g.lineTo(W, base); g.fill();
      const cx = W * 0.58, topo = H * 0.22, meia = W * 0.4, crat = W * 0.035;
      const fuji = () => { g.beginPath(); g.moveTo(cx - meia, base); g.quadraticCurveTo(cx - meia * 0.2, H * 0.64, cx - crat, topo); g.lineTo(cx - crat * 0.3, topo + H * 0.012); g.lineTo(cx + crat * 0.4, topo - H * 0.004); g.lineTo(cx + crat, topo + H * 0.006); g.quadraticCurveTo(cx + meia * 0.2, H * 0.64, cx + meia, base); g.closePath(); };
      fuji(); g.fillStyle = "#c79ec0"; g.fill();
      g.save(); fuji(); g.clip();
      g.fillStyle = "#b48aae"; g.beginPath(); g.moveTo(cx, topo); g.quadraticCurveTo(cx + meia * 0.25, H * 0.62, cx + meia, base); g.lineTo(cx + meia, topo); g.fill();
      g.fillStyle = "#e9ebf8"; g.beginPath(); g.moveTo(cx - meia, topo - H * 0.05);
      for (let i = 0; i <= 16; i++) { const x = cx - meia * 0.5 + (i / 16) * meia; g.lineTo(x, topo + H * (i % 2 ? 0.17 : 0.11) + H * 0.025 * hash(i, 7)); }
      g.lineTo(cx + meia, topo - H * 0.05); g.fill();
      g.restore();
      // torii gate on the right, a stone lantern by the water
      g.save(); g.translate(W * 0.83, H * 0.8); g.scale(k, k);
      rr(g, -150, -330, 300, 26, 8, "#2a1a1a"); rr(g, -132, -304, 264, 22, 4, "#d23a2e"); rr(g, -112, -250, 224, 18, 3, "#d23a2e");
      rr(g, -104, -300, 26, 300, 4, "#d23a2e"); rr(g, 78, -300, 26, 300, 4, "#d23a2e"); rr(g, -14, -268, 28, 30, 3, "#2a1a1a");
      g.restore();
      env.hit("torii", W * 0.83, H * 0.8 - 160 * k, 140 * k, "torii");
      g.save(); g.translate(W * 0.6, H * 0.82); g.scale(k, k);
      rr(g, -26, -40, 52, 40, 4, "#9a979c"); rr(g, -40, -96, 80, 56, 6, "#b6b2b8"); rr(g, -14, -84, 28, 30, 3, `rgba(255,200,110,${0.8 + 0.2 * Math.sin(t * 5)})`); poly(g, [[-60, -96], [0, -136], [60, -96]], "#8e8a92");
      g.restore();
      // the cherry tree, trunk from the left, a crown of blossom clusters
      g.save(); g.translate(W * 0.2, H * 0.84); g.rotate(treme); g.scale(k, k);
      g.lineCap = "round"; g.strokeStyle = "#5a3a3a";
      const galho = (x0, y0, x1, y1, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 20, (y0 + y1) / 2 - 30, x1, y1); g.stroke(); };
      galho(0, 0, 10, -300, 44); galho(10, -280, -150, -420, 22); galho(10, -280, 190, -440, 24); galho(100, -380, 280, -380, 14); galho(-60, -350, -230, -330, 12); galho(30, -300, 60, -520, 16);
      const flores = [[-170, -440, 90], [-60, -480, 100], [60, -540, 110], [180, -470, 105], [280, -400, 80], [-250, -350, 70], [120, -380, 80], [-20, -380, 70]];
      flores.forEach(([x, y, r], i) => {
        for (let j = 0; j < 9; j++) { const a = hash(i, j) * TAU, d = hash(j, i) * r * 0.75; circ(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, r * (0.32 + 0.18 * hash(i + 3, j)), j % 3 ? "#ffa8c8" : j % 2 ? "#ff86b4" : "#ffd0e2"); }
      });
      g.restore();
      env.hit("arvore", W * 0.2, H * 0.84 - 440 * k, 300 * k, "arvore");
      // petals in the wind; the pointer's speed is a gust, a click a burst
      const vento = mouse ? clamp(mouse.vx / 900, -1.5, 1.5) : 0;
      const rajadas = env.effects.filter((f) => f.kind === "rajada");
      for (let i = 0; i < 70; i++) {
        const sp = 18 + hash(i, 2) * 26, x0 = ((hash(i, 1) * W * 1.3 + t * sp * k) % (W * 1.3)) - W * 0.15, y0 = ((hash(i, 3) * H + t * (20 + hash(i, 4) * 20) * k) % H);
        let x = x0 + Math.sin(t * 1.5 + i) * 18 * k, y = y0;
        if (mouse) { const d = Math.hypot(x - mouse.x, y - mouse.y); if (d < 200) { x += vento * (200 - d) * 0.6; y -= Math.abs(vento) * (200 - d) * 0.15; } }
        for (const r of rajadas) { const age = t - r.t, d = Math.hypot(x - r.x, y - r.y) || 1; if (d < 320) { const f = (1 - d / 320) * 180 * Math.sin(Math.min(1, age / r.life) * Math.PI) * k; x += ((x - r.x) / d) * f; y += ((y - r.y) / d) * f; } }
        if (ht >= 0 && ht < 2 && i < 30) y += ht * 60 * k;
        g.save(); g.translate(x, y); g.rotate(t * (1 + hash(i, 5)) + i); ell(g, 0, 0, 7 * k, 4.5 * k, 0, i % 3 ? "#ff9ec4" : "#ffc4dc"); g.restore();
      }
    },
  },
  {
    id: "aurora", name: "Aurora", light: false,
    grid: "rgba(180,255,220,0.035)", accent: hx("#8affc8"), sprinkle: ["#ffffff", "#c9a8ff"], trailGlyph: "*+·",
    bg(ctx, { W, H }) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, "#030614"], [0.55, "#0b1838"], [1, "#16294a"]]); ctx.fillRect(0, 0, W, H);
    },
    ambient({ W, H, t, cw, ch }, glyph) {
      for (let i = 0; i < 110; i++) {
        const b = (Math.sin(t * (0.6 + hash(i, 3) * 2) + i) + 1) / 2;
        glyph(Math.floor((hash(i, 1) * W) / cw), Math.floor((hash(i, 2) * H * 0.6) / ch), b > 0.85 ? "*" : b > 0.5 ? "+" : "·", `rgba(235,240,255,${0.2 + b * 0.6})`);
      }
    },
    click(x, y, t, R) { R.add({ kind: "surto", x, y, t, life: 3 }); },
    scene(g, env) {
      const { W, H, t, k } = env;
      const surto = env.effects.filter((f) => f.kind === "surto").reduce((m, f) => Math.max(m, Math.sin(clamp((t - f.t) / f.life) * Math.PI)), 0);
      // ribbons of aurora: vertical streaks along a wavy curtain
      for (let r = 0; r < 3; r++) {
        for (let x = -20; x < W + 20; x += 10) {
          const yc = H * (0.16 + r * 0.07) + Math.sin(x * 0.004 + t * 0.25 + r * 2) * H * 0.06 + Math.sin(x * 0.011 - t * 0.4 + r) * H * 0.02;
          const forca = (0.45 + 0.55 * Math.sin(x * 0.006 - t * 0.3 + r * 1.7)) * (0.75 + surto * 0.6);
          if (forca < 0.15) continue;
          const alto = (90 + 70 * Math.sin(x * 0.02 + t + r)) * k * (1 + surto * 0.4);
          const gr = g.createLinearGradient(0, yc - alto, 0, yc + alto * 0.4);
          const topo = r === 1 ? "rgba(190,120,255," : "rgba(80,255,170,", base = r === 2 ? "rgba(255,110,200," : "rgba(60,220,160,";
          gr.addColorStop(0, topo + "0)"); gr.addColorStop(0.5, topo + 0.85 * forca + ")"); gr.addColorStop(1, base + "0)");
          g.fillStyle = gr; g.fillRect(x, yc - alto, 11, alto * 1.4);
        }
      }
      // snowy mountains, pines, the cabin
      const cume = (x0, base, alt, larg, cor, neve) => { poly(g, [[x0 - larg, base], [x0, base - alt], [x0 + larg, base]], cor); poly(g, [[x0 - larg * 0.28, base - alt * 0.72], [x0, base - alt], [x0 + larg * 0.28, base - alt * 0.72], [x0 + larg * 0.1, base - alt * 0.66], [x0 - larg * 0.08, base - alt * 0.7]], neve); };
      cume(W * 0.15, H * 0.82, H * 0.34, W * 0.24, "#2a3a5c", "#e8f0fb"); cume(W * 0.48, H * 0.82, H * 0.42, W * 0.28, "#33456a", "#f2f7ff"); cume(W * 0.82, H * 0.82, H * 0.3, W * 0.25, "#2a3a5c", "#e8f0fb");
      g.fillStyle = "#e9f1fb"; g.fillRect(0, H * 0.8, W, H * 0.2);
      for (let i = 0; i < W / (36 * k); i++) {
        const x = i * 36 * k + hash(i, 5) * 20 * k, h = (60 + hash(i, 6) * 80) * k;
        poly(g, [[x - h * 0.3, H * 0.84], [x, H * 0.84 - h], [x + h * 0.3, H * 0.84]], "#14304a");
        poly(g, [[x - h * 0.12, H * 0.84 - h * 0.6], [x, H * 0.84 - h], [x + h * 0.12, H * 0.84 - h * 0.6]], "#dfe9f6");
      }
      g.save(); g.translate(W * 0.68, H * 0.86); g.scale(k, k);
      rr(g, -90, -90, 180, 90, 4, "#5c3a26"); poly(g, [[-110, -86], [0, -160], [110, -86]], "#e9f1fb"); rr(g, 40, -150, 22, 46, 2, "#4a3020");
      rr(g, -62, -64, 44, 36, 3, `rgba(255,${190 + 20 * Math.sin(t * 3) | 0},110,1)`); rr(g, 20, -70, 34, 70, 3, "#3a2416");
      for (let i = 0; i < 4; i++) { const age = (t * 0.4 + i * 0.25) % 1; circ(g, 52 + Math.sin(age * 6 + i) * 8, -160 - age * 120, (10 + age * 16), `rgba(220,226,240,${0.6 * (1 - age)})`); }
      g.restore();
      env.hit("cabana", W * 0.68, H * 0.86 - 80 * k, 120 * k, "cabana");
      // the fox on a rock in the foreground
      const [fx, fy] = env.body("raposa", W * 0.3, H * 0.9, "flee", 140, 0.2), hf = env.hovered("raposa");
      ell(g, fx, fy + 30 * k, 110 * k, 34 * k, 0, "#8a93a6"); ell(g, fx - 20 * k, fy + 20 * k, 80 * k, 22 * k, 0, "#a3acbe");
      g.save(); g.translate(fx, fy - 40 * k); g.scale(k * 1.1, k * 1.1); raposa(g, t, hf); g.restore();
      env.hit("raposa", fx, fy - 50 * k, 90 * k, "raposa");
    },
  },
  {
    id: "codigo", name: "Chuva de Código", light: false,
    grid: "rgba(80,255,140,0.035)", accent: hx("#5dff8a"), sprinkle: ["#ffffff"], trailGlyph: "01",
    bg(ctx, { W, H }) { ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, "#000402"], [1, "#001208"]]); ctx.fillRect(0, 0, W, H); },
    ambient(env, glyph, R) {
      const { t, mouse, cw, ch } = env, rows = R.rows, glifos = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789<>{}[]=+*/;:";
      for (let c = 0; c < R.cols; c++) {
        if (hash(c, 9) > 0.62) continue;
        const sp = 6 + hash(c, 1) * 10, len = 6 + Math.floor(hash(c, 2) * 16), per = rows + len + Math.floor(hash(c, 3) * rows), head = Math.floor((t * sp + hash(c, 4) * per) % per);
        const perto = mouse ? clamp(1 - Math.abs(c * cw - mouse.x) / 120) : 0;
        for (let d = 0; d < len; d++) {
          const r = head - d; if (r < 0 || r >= rows) continue;
          if (mouse && Math.hypot(c * cw - mouse.x, r * ch - mouse.y) < 70) continue;
          const ch2 = glifos[Math.floor(hash(c * 7 + r, Math.floor(t * 3) + d) * glifos.length)];
          const a = (1 - d / len), cor = d === 0 ? `rgba(230,255,235,${0.95})` : `rgba(${60 + 120 * perto | 0},${200 + 55 * a | 0},${110 + 80 * perto | 0},${0.15 + 0.7 * a})`;
          glyph(c, r, ch2, cor);
        }
      }
    },
    click(x, y, t, R) { R.add(ripple(x, y, t, { chars: "01", speed: 380, force: 700, alpha: 0.9 })); R.add({ kind: "decod", x, y, t, life: 1.4 }); },
    scene(g, env) {
      const { W, H, t, k } = env, hc = env.hovered("cubo"), giro = t * 0.5 + (hc >= 0 ? (1 - Math.exp(-hc)) * 3 : 0);
      // a wireframe cube turning in the middle of the rain
      const [cx, cy] = env.body("cubo", W * 0.72, H * 0.38, "flee", 260, 0.3), s = 150 * k;
      const v = [];
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
        const x1 = x * Math.cos(giro) - z * Math.sin(giro), z1 = x * Math.sin(giro) + z * Math.cos(giro);
        const y1 = y * Math.cos(giro * 0.6) - z1 * Math.sin(giro * 0.6), z2 = y * Math.sin(giro * 0.6) + z1 * Math.cos(giro * 0.6), p = 3 / (3 + z2);
        v.push([cx + x1 * s * p, cy + y1 * s * p]);
      }
      g.lineCap = "round"; g.lineWidth = 10 * k; g.strokeStyle = hc >= 0 ? "#c8ffd8" : "#3dff7a";
      for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) { g.beginPath(); g.moveTo(...v[a]); g.lineTo(...v[b]); g.stroke(); }
      env.hit("cubo", cx, cy, s * 1.2, "cubo");
      // a terminal window with a blinking prompt
      g.save(); g.translate(W * 0.2, H * 0.62); g.scale(k, k);
      rr(g, -170, -110, 340, 220, 10, "#04170b"); rr(g, -170, -110, 340, 28, 10, "#0d3a1c");
      for (let i = 0; i < 3; i++) circ(g, -150 + i * 18, -96, 5, ["#ff5f57", "#febc2e", "#28c840"][i]);
      for (let l = 0; l < 5; l++) rr(g, -150, -66 + l * 30, 60 + hash(l, Math.floor(t / 2)) * 200, 12, 3, "#2bd36a");
      if (Math.floor(t * 2) % 2) rr(g, -150 + 70, 84, 14, 18, 2, "#c8ffd8");
      g.restore();
      env.hit("terminal", W * 0.2, H * 0.62, 170 * k, "terminal");
    },
  },
  {
    id: "arcade", name: "Arcade", light: false,
    grid: "rgba(120,140,255,0.04)", accent: hx("#7dff6a"), sprinkle: ["#ffffff"],
    bg(ctx, { W, H, t }) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, "#04020c"], [1, "#0c0620"]]); ctx.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += 4) { ctx.fillStyle = "rgba(255,255,255,0.018)"; ctx.fillRect(0, y, W, 1); }
    },
    ambient({ W, H, t, cw, ch }, glyph) {
      for (let i = 0; i < 70; i++) { const y = ((hash(i, 2) * H + t * (20 + hash(i, 3) * 40)) % H); glyph(Math.floor((hash(i, 1) * W) / cw), Math.floor(y / ch), "·", `rgba(200,210,255,${0.2 + 0.4 * hash(i, 4)})`); }
      const pontos = String(1000 + Math.floor(t * 37) * 10).padStart(6, "0");
      [..."SCORE " + pontos].forEach((c, i) => glyph(3 + i, 1, c, "rgba(255,255,255,0.75)"));
      [..."HI 099990"].forEach((c, i) => glyph(Math.floor(W / cw) - 13 + i, 1, c, "rgba(255,255,255,0.75)"));
    },
    click(x, y, t, R) { R.add({ kind: "tiro", x, y, t, life: 0.9 }); },
    scene(g, env) {
      const { W, H, t, k, mouse } = env, p = 9 * k;
      // the fleet marches side to side in steps and slowly descends, looping
      const ciclo = 36, u = (t % ciclo) / ciclo, passo = Math.floor(t * 2), lado = Math.sin(passo * 0.35) * W * 0.12, desce = u * H * 0.18;
      const cores = ["#ff5fd2", "#5ff2ff", "#7dff6a"], anima = passo % 2;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
        const key = "a" + r + "_" + c, x0 = W * 0.5 + (c - 3.5) * 120 * k + lado, y0 = H * 0.16 + r * 95 * k + desce;
        const [x, y] = env.body(key, x0, y0, "flee", 120, 0.6), h = env.hovered(key);
        const morto = hash(r * 8 + c, Math.floor(t / ciclo)) < u * 0.8;
        if (morto) continue;
        let spr = ALIENS[r].map((l) => (anima && h < 0 ? l : l.split("").reverse().join("")));
        g.save(); g.translate(x, y + (h >= 0 ? Math.sin(h * 20) * 6 * k : 0)); bitmap(g, spr, p, { X: cores[r] }); g.restore();
        env.hit(key, x, y, 50 * k, "alien");
      }
      // a saucer crossing the top every so often
      const ufo = (t % 14) / 14;
      if (ufo < 0.5) { g.save(); g.translate(-100 + ufo * 2 * (W + 200), H * 0.08); bitmap(g, ["...XXXX...", ".XXXXXXXX.", "XX.XX.XX.X", "XXXXXXXXXX", "..X....X.."], p, { X: "#ff4d4d" }); g.restore(); env.hit("ufo", -100 + ufo * 2 * (W + 200), H * 0.08, 50 * k, "ufo"); }
      // bunkers
      for (let b = 0; b < 4; b++) { g.save(); g.translate(W * (0.2 + b * 0.2), H * 0.78); bitmap(g, ["..XXXXXX..", ".XXXXXXXX.", "XXXXXXXXXX", "XXXXXXXXXX", "XXX....XXX", "XX......XX"], p, { X: "#3dbb4a" }); g.restore(); }
      // the cannon follows the pointer
      const alvo = mouse ? mouse.x : W * 0.5 + Math.sin(t * 0.7) * W * 0.3;
      const cx = alvo;
      g.save(); g.translate(cx, H * 0.9); bitmap(g, ["....X....", "...XXX...", ".XXXXXXX.", "XXXXXXXXX", "XXXXXXXXX"], p, { X: "#7dff6a" }); g.restore();
      // automatic shots, and the player's click shots with a burst on arrival
      for (let s = 0; s < 3; s++) { const v = ((t + s * 0.4) % 1.2) / 1.2; rr(g, cx - p * 0.4 + (s - 1) * 2, H * 0.9 - 30 * k - v * H * 0.7, p * 0.8, p * 2.2, 2, "#ffffff"); }
      for (const f of env.effects) if (f.kind === "tiro") {
        const v = (t - f.t) / f.life, y = H * 0.9 - (H * 0.9 - f.y) * Math.min(1, v * 1.6);
        if (v < 0.62) rr(g, f.x - p * 0.5, y, p, p * 2.4, 2, "#fcee0a");
        else { const e = (v - 0.62) / 0.38; g.save(); g.translate(f.x, f.y); bitmap(g, ["X..X..X", ".X.X.X.", "..XXX..", "XXX.XXX", "..XXX..", ".X.X.X.", "X..X..X"], p * (1 + e), { X: `rgba(255,${220 - e * 120 | 0},80,${1 - e})` }); g.restore(); }
      }
    },
  },
);

return { THEMES, Renderer };
})();

// ── Xuất ra cho themes-engine dùng ────────────────────────────────────────
export const ASCII_THEMES = ASCII_ENGINE.THEMES;
export function taoRenderer(canvas, opt) {
  return ASCII_ENGINE.Renderer(canvas, opt);
}
