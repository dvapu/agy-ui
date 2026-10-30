// ═══════════════════════════════════════════════════════════════════════════
// Mascot Honu (Rùa biển Antigravity) — Tương tác, phản ứng & thoại tiếng Việt
// ═══════════════════════════════════════════════════════════════════════════

export class MascotHonu {
  constructor(canvasElement, bubbleElement) {
    this.cv = canvasElement;
    this.ctx = this.cv.getContext("2d");
    this.bubble = bubbleElement;
    this.state = "parado"; // "parado" (nghỉ), "pensando" (suy nghĩ), "escrevendo" (gõ), "pulando" (mừng)
    this.speechTimer = null;

    // Tọa độ và tương tác chuột
    this.mouseX = 0;
    this.mouseY = 0;
    this.isBlinking = false;
    this.blinkTimer = null;
    this.frame = 0;

    // Câu thoại tiếng Việt ngộ nghĩnh
    this.cauThoai = [
      "Chào bạn! Hôm nay chúng ta cùng code gì nào? 🐢",
      "Lagoon nước trong xanh mát quá, code mượt như sóng biển! 🌊",
      "Tôi là Honu, trợ lý rùa biển của Antigravity nè!",
      "Nhấn Ctrl + Shift + Space để gọi tôi lên bất cứ lúc nào nha!",
      "Đang bí thuật toán à? Để tôi bơi cùng bạn gỡ bug nhé! 💡",
      "Cứ thong thả như rùa biển, code chắc từng dòng là ngon ngay! 🐢✨",
      "Bạn có biết: Vòng lặp rùa biển này chạy đúng 24.5 giây một chu kỳ?",
      "Trời xanh mây trắng, nắng vàng... và code không một cảnh báo đỏ! 🚀",
      "Hôm nay bạn nhớ uống nước và nghỉ mắt chút xíu nha!",
      "Antigravitinho sẵn sàng phục vụ bạn 24/7!",
      "Tôi bơi một vòng ngắm cá heo rồi quay lại giúp bạn nhé 🐬",
      "Có tôi ở đây, bug nào cũng phải đầu hàng thôi!",
    ];

    this.initEvents();
    this.startBlinkLoop();
    this.render();
  }

  /** Dừng mọi vòng lặp vẽ (dùng khi gỡ lớp phủ). */
  dung() {
    if (this.intervalId) clearInterval(this.intervalId);
    clearTimeout(this.blinkTimer);
    this.intervalId = null;
  }

  initEvents() {
    window.addEventListener("mousemove", (e) => {
      const rect = this.cv.getBoundingClientRect();
      this.mouseX = e.clientX - (rect.left + rect.width / 2);
      this.mouseY = e.clientY - (rect.top + rect.height / 2);
    });

    this.cv.addEventListener("click", () => {
      this.nhayMung();
      this.noiNgauNhien();
    });
  }

  startBlinkLoop() {
    const scheduleNextBlink = () => {
      const delay = 2000 + Math.random() * 4000;
      this.blinkTimer = setTimeout(() => {
        this.isBlinking = true;
        setTimeout(() => {
          this.isBlinking = false;
          scheduleNextBlink();
        }, 150);
      }, delay);
    };
    scheduleNextBlink();
  }

  setTrangThai(st) {
    this.state = st;
    if (st === "pensando") {
      this.noi("Honu đang suy nghĩ... chờ tôi xíu nha! 💭", 2500);
    } else if (st === "escrevendo") {
      this.noi("Đang gõ câu trả lời cho bạn nè! ✍️", 2000);
    } else if (st === "pulando") {
      this.nhayMung();
    }
  }

  noi(noiDung, duration = 3500) {
    if (!this.bubble) return;
    clearTimeout(this.speechTimer);
    this.bubble.textContent = noiDung;
    this.bubble.classList.add("show");
    this.speechTimer = setTimeout(() => {
      this.bubble.classList.remove("show");
    }, duration);
  }

  noiNgauNhien() {
    const text = this.cauThoai[Math.floor(Math.random() * this.cauThoai.length)];
    this.noi(text, 4000);
  }

  nhayMung() {
    this.state = "pulando";
    let count = 0;
    const interval = setInterval(() => {
      count++;
      if (count > 20) {
        clearInterval(interval);
        this.state = "parado";
      }
    }, 40);
  }

  render() {
    const loop = () => {
      this.frame++;
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // Nhịp vẽ dự phòng cho lớp phủ trong AGY: khi cửa sổ bị che khuất,
  // Chromium dừng requestAnimationFrame nên phải dùng setInterval.
  renderBangInterval(fps = 24) {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      this.frame++;
      this.draw();
    }, 1000 / fps);
  }

  draw() {
    const ctx = this.ctx;
    const w = this.cv.width;
    const h = this.cv.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    let cy = h / 2;

    // Hiệu ứng nhấp nhô / nhảy
    if (this.state === "pensando") {
      cy += Math.sin(this.frame * 0.12) * 5;
    } else if (this.state === "escrevendo") {
      cy += Math.sin(this.frame * 0.25) * 3;
    } else if (this.state === "pulando") {
      cy += -Math.abs(Math.sin(this.frame * 0.3)) * 14;
    } else {
      cy += Math.sin(this.frame * 0.05) * 2;
    }

    // Vẽ Rùa Honu phong cách Pixel / ASCII
    ctx.save();
    ctx.translate(cx, cy);

    // Bơi chèo 2 vây trước
    const vayAngle = Math.sin(this.frame * 0.08) * 0.25;
    ctx.save();
    ctx.translate(-24, -10);
    ctx.rotate(-0.4 + vayAngle);
    ctx.fillStyle = "#8ba870";
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(24, -10);
    ctx.rotate(0.4 - vayAngle);
    ctx.fillStyle = "#8ba870";
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2 vây sau
    ctx.fillStyle = "#6d8855";
    ctx.beginPath();
    ctx.ellipse(-16, 22, 10, 5, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(16, 22, 10, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Mai rùa tròn màu vàng hổ phách viền xanh
    ctx.fillStyle = "#2d5a52";
    ctx.beginPath();
    ctx.arc(0, 4, 26, 0, Math.PI * 2);
    ctx.fill();

    const maiGrad = ctx.createRadialGradient(-3, 1, 4, 0, 4, 25);
    maiGrad.addColorStop(0, "#d4af37");
    maiGrad.addColorStop(0.65, "#b38628");
    maiGrad.addColorStop(1, "#5c4014");
    ctx.fillStyle = maiGrad;
    ctx.beginPath();
    ctx.arc(0, 4, 23, 0, Math.PI * 2);
    ctx.fill();

    // Hoa văn vảy mai rùa
    ctx.strokeStyle = "rgba(255, 235, 160, 0.5)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      ctx.strokeRect(Math.cos(a) * 9 - 4, Math.sin(a) * 9 + 4 - 4, 8, 8);
    }

    // Đầu rùa
    ctx.fillStyle = "#9ec680";
    ctx.beginPath();
    ctx.arc(0, -22, 14, 0, Math.PI * 2);
    ctx.fill();

    // Mắt dõi theo con trỏ chuột
    const eyeDist = 6;
    const maxPupil = 2.2;
    const angleToMouse = Math.atan2(this.mouseY, this.mouseX);
    const pupilX = Math.cos(angleToMouse) * maxPupil;
    const pupilY = Math.sin(angleToMouse) * maxPupil;

    if (this.isBlinking) {
      ctx.strokeStyle = "#274218";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-eyeDist - 3, -23); ctx.lineTo(-eyeDist + 3, -23);
      ctx.moveTo(eyeDist - 3, -23); ctx.lineTo(eyeDist + 3, -23);
      ctx.stroke();
    } else {
      // Tròng trắng
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-eyeDist, -23, 4, 0, Math.PI * 2);
      ctx.arc(eyeDist, -23, 4, 0, Math.PI * 2);
      ctx.fill();

      // Con ngươi
      ctx.fillStyle = "#1e3314";
      ctx.beginPath();
      ctx.arc(-eyeDist + pupilX, -23 + pupilY, 2.2, 0, Math.PI * 2);
      ctx.arc(eyeDist + pupilX, -23 + pupilY, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Đốm sáng phản chiếu
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-eyeDist + pupilX - 0.8, -23 + pupilY - 0.8, 0.9, 0, Math.PI * 2);
      ctx.arc(eyeDist + pupilX - 0.8, -23 + pupilY - 0.8, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nụ cười thân thiện
    ctx.strokeStyle = "#385c25";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -17, 4, 0.1, Math.PI - 0.1);
    ctx.stroke();

    ctx.restore();
  }
}
