// ═══════════════════════════════════════════════════════════════════════════
// Antigravitinho — Multi-Theme Live ASCII Wallpaper Engine
// Hỗ trợ 6 chủ đề sống động: Lagoon, Koi Pond, Galaxy, Matrix, Fireplace, Rain
// ═══════════════════════════════════════════════════════════════════════════

import { LagoonEngine } from "./lagoon-engine.js";

export class ThemesEngine {
  constructor(canvasElement) {
    this.cv = canvasElement;
    this.ctx = this.cv.getContext("2d");
    this.activeTheme = "lagoon";
    this.running = false;
    this.rafId = null;
    // Chế độ lớp phủ: không vẽ nền đặc, chỉ để phần tử sáng nổi lên trên app bên dưới
    this.cheDoPhu = false;

    // Sub-engine cho Lagoon (chu kỳ 24.5s chuẩn)
    this.lagoonEngine = new LagoonEngine(canvasElement);

    // Dữ liệu hạt cho các chủ đề khác
    this.particles = [];
    this.matrixColumns = [];
    this.t0 = performance.now();

    this.initThemeData();
  }

  initThemeData() {
    const W = this.cv.width;
    const H = this.cv.height;

    // 1. Matrix: Tạo các cột mã rơi
    const colWidth = 20;
    const numCols = Math.floor(W / colWidth);
    this.matrixColumns = [];
    const glyphs = "0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ";
    for (let i = 0; i < numCols; i++) {
      this.matrixColumns.push({
        x: i * colWidth,
        y: Math.random() * -H,
        speed: 3 + Math.random() * 6,
        chars: Array.from({ length: 24 }, () => glyphs[Math.floor(Math.random() * glyphs.length)]),
      });
    }

    // 2. Galaxy / Stars
    this.stars = [];
    for (let i = 0; i < 280; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * W * 1.5,
        y: (Math.random() - 0.5) * H * 1.5,
        z: Math.random() * 1000,
        size: 0.8 + Math.random() * 2,
        color: ["#ffffff", "#b3d4fc", "#e2b8ff", "#ffeaa7"][Math.floor(Math.random() * 4)],
        flicker: Math.random() * Math.PI,
      });
    }

    // 3. Koi Pond (Cá Koi bơi)
    this.kois = [
      { x: W * 0.4, y: H * 0.45, angle: 0.5, speed: 1.8, color: "#ff5e13", spotColor: "#ffffff", size: 45 },
      { x: W * 0.6, y: H * 0.6, angle: 2.2, speed: 1.5, color: "#ffffff", spotColor: "#e82a00", size: 50 },
      { x: W * 0.3, y: H * 0.7, angle: -1.2, speed: 2.0, color: "#ffa502", spotColor: "#222222", size: 40 },
    ];
    this.ripples = [];

    // 4. Fireplace (Lò sưởi)
    this.flames = [];
    for (let i = 0; i < 90; i++) {
      this.flames.push({
        x: W * 0.5 + (Math.random() - 0.5) * 450,
        y: H * 0.9,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -2 - Math.random() * 4.5,
        size: 15 + Math.random() * 25,
        life: 1,
        decay: 0.01 + Math.random() * 0.02,
        char: ["*", "•", "▲", "✦", "°"][Math.floor(Math.random() * 5)],
      });
    }

    // 5. Rain (Đêm mưa)
    this.drops = [];
    for (let i = 0; i < 180; i++) {
      this.drops.push({
        x: Math.random() * W,
        y: Math.random() * H,
        len: 12 + Math.random() * 22,
        speed: 14 + Math.random() * 12,
        alpha: 0.2 + Math.random() * 0.5,
      });
    }
  }

  // Tô nền: ở chế độ lớp phủ chỉ tô rất nhạt để không che app bên dưới
  nen(ctx, paint, alphaPhu = 0.1) {
    ctx.save();
    if (this.cheDoPhu) {
      ctx.clearRect(0, 0, this.cv.width, this.cv.height);
      ctx.globalAlpha = alphaPhu;
    }
    ctx.fillStyle = paint;
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    ctx.restore();
  }

  // Bật/tắt chế độ lớp phủ (đè lên app khác, không vẽ nền đặc)
  setCheDoPhu(bat) {
    this.cheDoPhu = !!bat;
    if (this.lagoonEngine) this.lagoonEngine.cheDoPhu = !!bat;
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
  }

  setTheme(themeName) {
    if (this.activeTheme === themeName) return;
    this.activeTheme = themeName;

    // Reset timestamp
    this.t0 = performance.now();

    // Dọn sạch canvas
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
  }

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
    // Chế độ lớp phủ: vẽ mờ để không che nội dung app bên dưới
    if (this.cheDoPhu) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.45;
    }

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

    if (this.cheDoPhu) this.ctx.restore();
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

  // ─── Theme 2: Koi Pond (Hồ Cá Koi Nhật Bản) ──────────────────────────────
  drawKoiPond(t) {
    const ctx = this.ctx;
    const W = this.cv.width;
    const H = this.cv.height;

    // Nước hồ xanh biếc ngọc lục bảo
    const grad = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, W * 0.7);
    grad.addColorStop(0, "#08413b");
    grad.addColorStop(0.7, "#032824");
    grad.addColorStop(1, "#011613");
    this.nen(ctx, grad, 0.16);

    // Gợn sóng nước ASCII
    ctx.font = '15px monospace';
    ctx.textAlign = 'center';
    for (let x = 30; x < W; x += 60) {
      for (let y = 30; y < H; y += 60) {
        const wav = Math.sin(x * 0.01 + y * 0.01 + t * 1.5);
        if (wav > 0.6) {
          ctx.fillStyle = `rgba(120, 230, 200, ${(wav - 0.6) * 0.25})`;
          ctx.fillText("~", x, y);
        }
      }
    }

    // Hoa sen & Lá sen
    const drawLotusLeaf = (lx, ly, r) => {
      ctx.fillStyle = "#1b5e4c";
      ctx.beginPath();
      ctx.arc(lx, ly, r, 0.2, Math.PI * 1.85);
      ctx.lineTo(lx, ly);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#277a64";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    drawLotusLeaf(W * 0.2, H * 0.25, 75);
    drawLotusLeaf(W * 0.8, H * 0.3, 85);
    drawLotusLeaf(W * 0.25, H * 0.8, 90);
    drawLotusLeaf(W * 0.75, H * 0.75, 70);

    // Di chuyển và vẽ các chú cá Koi
    this.kois.forEach((k, idx) => {
      k.angle += Math.sin(t * 0.8 + idx) * 0.03;
      k.x += Math.cos(k.angle) * k.speed;
      k.y += Math.sin(k.angle) * k.speed;

      // Giữ trong màn hình
      if (k.x < -100) k.x = W + 100;
      if (k.x > W + 100) k.x = -100;
      if (k.y < -100) k.y = H + 100;
      if (k.y > H + 100) k.y = -100;

      // Vẽ cá Koi
      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.rotate(k.angle);

      // Đuôi vẫy
      const tailWiggle = Math.sin(t * 8 + idx) * 0.25;
      ctx.save();
      ctx.translate(-k.size * 0.8, 0);
      ctx.rotate(tailWiggle);
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.beginPath();
      ctx.ellipse(-15, 0, 18, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Thân cá
      ctx.fillStyle = k.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, k.size, k.size * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      // Đốm màu trên lưng
      ctx.fillStyle = k.spotColor;
      ctx.beginPath();
      ctx.ellipse(k.size * 0.2, -k.size * 0.08, k.size * 0.35, k.size * 0.2, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Vây bơi 2 bên
      ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
      ctx.beginPath();
      ctx.ellipse(k.size * 0.2, -k.size * 0.38, 12, 5, 0.5, 0, Math.PI * 2);
      ctx.ellipse(k.size * 0.2, k.size * 0.38, 12, 5, -0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }

  // ─── Theme 3: Galaxy (Dải Ngân Hà Vũ Trụ) ─────────────────────────────────
  drawGalaxy(t) {
    const ctx = this.ctx;
    const W = this.cv.width;
    const H = this.cv.height;

    // Không gian vũ trụ thẳm sâu
    this.nen(ctx, "#030612", 0.08);

    // Xoáy tinh vân (Nebula glow)
    const cx = W / 2;
    const cy = H / 2;
    const neb1 = ctx.createRadialGradient(cx - 150, cy - 80, 20, cx, cy, 600);
    neb1.addColorStop(0, "rgba(112, 44, 245, 0.25)");
    neb1.addColorStop(0.5, "rgba(24, 88, 224, 0.15)");
    neb1.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = neb1;
    ctx.fillRect(0, 0, W, H);

    const neb2 = ctx.createRadialGradient(cx + 120, cy + 100, 10, cx, cy, 550);
    neb2.addColorStop(0, "rgba(245, 44, 138, 0.18)");
    neb2.addColorStop(0.6, "rgba(63, 207, 210, 0.12)");
    neb2.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = neb2;
    ctx.fillRect(0, 0, W, H);

    // Vẽ sao & bụi vũ trụ
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    this.stars.forEach((s) => {
      // Xoay nhẹ theo thời gian
      const cosA = Math.cos(t * 0.02);
      const sinA = Math.sin(t * 0.02);
      const rx = s.x * cosA - s.y * sinA + cx;
      const ry = s.x * sinA + s.y * cosA + cy;

      if (rx >= 0 && rx <= W && ry >= 0 && ry <= H) {
        const flick = 0.4 + 0.6 * Math.sin(t * 3 + s.flicker);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = flick;
        if (s.size > 2.2) {
          ctx.fillText("✦", rx, ry);
        } else if (s.size > 1.4) {
          ctx.fillText("+", rx, ry);
        } else {
          ctx.fillText("·", rx, ry);
        }
      }
    });
    ctx.globalAlpha = 1.0;
  }

  // ─── Theme 4: Matrix Code Rain (Mưa Mã Ma Trận) ──────────────────────────
  drawMatrix(t) {
    const ctx = this.ctx;
    const W = this.cv.width;
    const H = this.cv.height;

    // Phủ mờ nhẹ tạo vệt kéo dài (trail effect)
    if (this.cheDoPhu) {
      ctx.clearRect(0, 0, W, H);
    } else {
      ctx.fillStyle = "rgba(4, 14, 8, 0.18)";
      ctx.fillRect(0, 0, W, H);
    }

    ctx.font = 'bold 16px "Geist Mono", monospace';
    const glyphs = "0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ";

    this.matrixColumns.forEach((col) => {
      col.y += col.speed;
      if (col.y > H + 400) {
        col.y = -300;
        col.speed = 3 + Math.random() * 6;
      }

      // Đổi ký tự ngẫu nhiên
      if (Math.random() < 0.08) {
        const idx = Math.floor(Math.random() * col.chars.length);
        col.chars[idx] = glyphs[Math.floor(Math.random() * glyphs.length)];
      }

      // Vẽ từng ký tự trong cột
      col.chars.forEach((ch, i) => {
        const charY = col.y - i * 20;
        if (charY >= 0 && charY <= H) {
          if (i === 0) {
            // Đầu dòng phát sáng trắng
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = "#39ff14";
            ctx.shadowBlur = 8;
          } else if (i < 4) {
            // Xanh nõn chuối dạ quang
            ctx.fillStyle = "#55ff55";
            ctx.shadowBlur = 4;
          } else {
            // Xanh mờ dần
            const fade = Math.max(0.15, 1 - (i / col.chars.length));
            ctx.fillStyle = `rgba(0, 200, 60, ${fade})`;
            ctx.shadowBlur = 0;
          }
          ctx.fillText(ch, col.x, charY);
        }
      });
    });
    ctx.shadowBlur = 0;
  }

  // ─── Theme 5: Cozy Fireplace (Lò Sưởi Ấm Cúng) ───────────────────────────
  drawFireplace(t) {
    const ctx = this.ctx;
    const W = this.cv.width;
    const H = this.cv.height;

    // Nền phòng tối ấm áp
    this.nen(ctx, "#120805", 0.08);

    // Ánh lửa bập bùng trung tâm
    const flicker = 0.9 + 0.1 * Math.sin(t * 12) + 0.05 * Math.sin(t * 26);
    const fireGlow = ctx.createRadialGradient(W / 2, H * 0.88, 50, W / 2, H * 0.88, 650 * flicker);
    fireGlow.addColorStop(0, "rgba(255, 130, 20, 0.45)");
    fireGlow.addColorStop(0.4, "rgba(220, 50, 10, 0.22)");
    fireGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = fireGlow;
    ctx.fillRect(0, 0, W, H);

    // Củi gỗ đốt dưới đáy
    ctx.fillStyle = "#2d130a";
    ctx.fillRect(W * 0.35, H * 0.93, W * 0.3, 35);
    ctx.fillStyle = "#4a2113";
    ctx.fillRect(W * 0.38, H * 0.91, W * 0.24, 25);

    // Hạt tàn lửa & ngọn lửa ASCII bay lên
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';

    this.flames.forEach((f) => {
      f.x += f.vx + Math.sin(t * 4 + f.y * 0.02) * 1.2;
      f.y += f.vy;
      f.life -= f.decay;

      if (f.life <= 0 || f.y < H * 0.3) {
        // Tái tạo lại ngọn lửa
        f.x = W * 0.5 + (Math.random() - 0.5) * 380;
        f.y = H * 0.92;
        f.vy = -2.5 - Math.random() * 4.5;
        f.life = 1;
      }

      const alpha = Math.max(0, f.life);
      if (f.life > 0.6) {
        ctx.fillStyle = `rgba(255, 230, 120, ${alpha})`;
      } else if (f.life > 0.3) {
        ctx.fillStyle = `rgba(255, 100, 20, ${alpha})`;
      } else {
        ctx.fillStyle = `rgba(180, 40, 10, ${alpha * 0.7})`;
      }

      ctx.fillText(f.char, f.x, f.y);
    });
  }

  // ─── Theme 6: Cyber Rain (Đêm Mưa Thành Phố) ────────────────────────────
  drawRain(t) {
    const ctx = this.ctx;
    const W = this.cv.width;
    const H = this.cv.height;

    // Đêm mưa xanh tím than huyền ảo
    this.nen(ctx, "#060914", 0.1);

    // Ánh neon mờ ảo xa xăm (Cyberpunk skyline glow)
    const neon1 = ctx.createRadialGradient(W * 0.25, H * 0.85, 30, W * 0.25, H * 0.85, 450);
    neon1.addColorStop(0, "rgba(245, 50, 150, 0.18)");
    neon1.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = neon1;
    ctx.fillRect(0, 0, W, H);

    const neon2 = ctx.createRadialGradient(W * 0.75, H * 0.85, 30, W * 0.75, H * 0.85, 450);
    neon2.addColorStop(0, "rgba(50, 180, 255, 0.18)");
    neon2.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = neon2;
    ctx.fillRect(0, 0, W, H);

    // Hạt mưa rơi
    ctx.strokeStyle = "rgba(180, 220, 255, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    this.drops.forEach((d) => {
      d.y += d.speed;
      d.x += 1.5; // Gió thổi xiên nhẹ

      if (d.y > H) {
        d.y = -d.len;
        d.x = Math.random() * W;
      }

      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + 2, d.y + d.len);
    });
    ctx.stroke();

    // Vòng sóng nước gợn trên mặt đất (Water ripples)
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < 8; i++) {
      const rx = (W * 0.1 + i * W * 0.11) + Math.sin(t * 2 + i) * 30;
      const ry = H * 0.94 + Math.cos(t * 3 + i) * 15;
      const ripPhase = ((t * 1.5 + i * 0.4) % 1);
      ctx.fillStyle = `rgba(160, 220, 255, ${(1 - ripPhase) * 0.4})`;
      ctx.fillText("≈", rx, ry);
    }
  }
}
