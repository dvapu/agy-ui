// ═══════════════════════════════════════════════════════════════════════════
// MascotA — chữ A Antigravity sống động (cơ chế di chuyển như Clawd của Claude)
//
// Canvas phủ TOÀN BỘ cửa sổ, trong suốt, pointer-events: none.
// Việc bắt chuột do lớp ngoài làm (hit-test thủ công), nhờ vậy mascot đi lại /
// bị kéo / bị ném được khắp cửa sổ mà phần còn lại vẫn xuyên xuống AGY.
//
// Hành vi:
//   · Nhấp nhô thở, nghiêng người theo con trỏ
//   · Mắt nhìn theo chuột, chớp mắt ngẫu nhiên
//   · Bấm → nhảy + bắn tia sáng + nói tiếng Việt
//   · Kéo thả → treo theo chuột, thả thì rơi, chạm đất bẹp rồi bật dậy
//   · Đi loanh quanh chỗ đậu rồi tự về
//   · Rảnh lâu → ngủ, mắt nhắm, bong bóng "z"
//   · Rung nhẹ khi AI đang chạy
// ═══════════════════════════════════════════════════════════════════════════

const GOC = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ngauNhien = (a, b) => a + Math.random() * (b - a);

export class MascotA {
  /**
   * @param {HTMLCanvasElement} canvas  canvas phủ toàn cửa sổ
   * @param {HTMLElement|null} bubble   bong bóng thoại
   * @param {{anh?: string, co?: number, le?: number}} tuyChon
   *        anh: data URI ảnh chữ A; co: cạnh mascot (CSS px); le: lề so mép
   */
  constructor(canvas, bubble, tuyChon = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.bubble = bubble || null;
    this.co = tuyChon.co || 96;
    this.le = typeof tuyChon.le === "number" ? tuyChon.le : 26;

    this.anh = new Image();
    this.anhReady = false;
    this.anh.onload = () => { this.anhReady = true; };
    if (tuyChon.anh) this.anh.src = tuyChon.anh;

    // ── Trạng thái ────────────────────────────────────────────────────────
    this.trangThai = "nghi"; // nghi | suy-nghi | vui | ngu | keo
    this.frame = 0;
    this.dangChay = false;
    this.intervalId = null;
    this.rafId = null;

    // Vị trí (CSS px, góc trên-trái của hộp mascot)
    this.px = 0;
    this.py = 0;
    this.daDatLanDau = false;

    // Chế độ chuyển động: chodau | roi | vecho | keo
    this.cheDo = "chodau";

    // Vận tốc & biến dạng
    this.vx = 0;
    this.vy = 0;
    this.tilt = 0;
    this.tiltDich = 0;
    this.sx = 1;
    this.sy = 1;

    // Mắt
    this.matX = 0;
    this.matY = 0;
    this.matDichX = 0;
    this.matDichY = 0;
    this.matNham = 0;
    this.dangChop = false;
    this.henChop = Date.now() + ngauNhien(2000, 5000);

    // Kéo thả
    this.dangKeo = false;
    this.keoGoc = { x: 0, y: 0, px: 0, py: 0 };
    this.vuotY = 0;
    this.vuotX = 0;
    this._truoc = { x: 0, y: 0, t: 0 };
    this.henVeCho = 0;

    // Đi loanh quanh
    this.dichX = 0;
    this.dichY = 0;
    this.henDi = Date.now() + ngauNhien(8000, 16000);
    this.dangDi = false;
    this.buoc = 0;

    // Ngủ
    this.henNgu = Date.now() + 45000;
    this.phaNgu = 0;

    // Hạt sáng
    this.hat = [];

    // Con trỏ chuột (toạ độ cửa sổ)
    this.chuot = { x: 0, y: 0 };

    // Khung bắt chuột (div trong suốt bám theo mascot), do lớp ngoài cấp
    this.hitEl = tuyChon.hitEl || null;

    // Đặt mascot vào chỗ đậu NGAY khi tạo, trước lần nói đầu tiên
    this.px = this.nhaX;
    this.py = this.nhaY;
    this.daDatLanDau = true;

    this.loiThoai = [
      "Antigravitinho đây! Cần gì cứ gọi nhé.",
      "Lớp này nằm gọn trên Antigravity, không đụng gì vào dữ liệu của bạn.",
      "Code của bạn vẫn nguyên vẹn — tôi chỉ vẽ lên trên thôi.",
      "Muốn đổi giao diện? Rê chuột xuống góc này nè.",
      "Kéo tôi đi đâu cũng được, thả ra là tôi tự đứng dậy.",
      "Đang bí bug à? Antigravity bên dưới lo được đó.",
      "Tôi là chữ A của Antigravity, giờ có thêm chân rồi!",
      "Nhấn Ctrl + Shift + Space để ẩn/hiện tôi bất cứ lúc nào.",
      "Tôi không ghi gì vào lịch sử chat của bạn đâu, yên tâm.",
      "Chạy mượt lắm, chỉ vẽ hình nền nên rất nhẹ.",
      "Rảnh quá... để tôi đi dạo một vòng nhé.",
    ];
  }

  // ═══ Vòng đời ═══════════════════════════════════════════════════════════
  //
  // Lớp phủ sống trong cửa sổ AGY, mà cửa sổ đó rất hay bị che khuất hoặc
  // thu nhỏ → Chromium đóng băng requestAnimationFrame. Vì vậy ta chạy HAI
  // nguồn nhịp song song: rAF (mượt khi hiện) và setInterval (bảo hiểm khi
  // ẩn). Hàm _tick tự chống trùng theo mốc thời gian nên không vẽ gấp đôi.
  batDau() {
    if (this.dangChay) return;
    this.dangChay = true;
    this._dungRaf();
    this._dungInterval();

    this._nhipCuoi = 0;
    this._fps = 60;

    const vong = () => {
      if (!this.dangChay) return;
      this._tick();
      this.rafId = requestAnimationFrame(vong);
    };
    this.rafId = requestAnimationFrame(vong);

    this.intervalId = setInterval(() => {
      if (!this.dangChay) return;
      this._tick();
    }, 1000 / 45);
  }

  /** Một nhịp: cập nhật + vẽ. Chống trùng và tự bắt lỗi. */
  _tick() {
    const now = performance.now();
    // Bỏ qua nếu vừa vẽ cách đây chưa tới 6ms (rAF và interval chồng nhau)
    if (now - this._nhipCuoi < 6) return;
    const truoc = this._nhipCuoi || now;
    // dt tính theo thời gian THỰC (đơn vị khung 60fps). Trần 60 khung = 1 giây
    // để khi cửa sổ bị che (Chromium bóp xuống ~1fps) vật lý vẫn chạy đúng
    // tốc độ thật thay vì chậm gấp nhiều lần.
    const dt = Math.min(60, Math.max(0.2, (now - truoc) / 16.667));
    this._nhipCuoi = now;
    this._dt = dt;

    this.frame++;
    try { this.capNhat(dt); } catch (e) { this.loiCuoi = String(e); }
    try { this.ve(); } catch (e) { this.loiCuoi = String(e); }
  }

  /** Chạy thuần setInterval (dùng cho môi trường không có rAF). */
  batDauBangInterval(fps = 30) {
    this.dung();
    this.dangChay = true;
    this._nhipCuoi = 0;
    this.intervalId = setInterval(() => {
      if (!this.dangChay) return;
      this._nhipCuoi = performance.now();
      this.frame++;
      try { this.capNhat(); } catch (e) { this.loiCuoi = String(e); }
      try { this.ve(); } catch (e) { this.loiCuoi = String(e); }
    }, 1000 / fps);
  }

  _dungRaf() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
  _dungInterval() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }

  dung() {
    this.dangChay = false;
    this._dungRaf();
    this._dungInterval();
  }

  // ═══ Hình học ═══════════════════════════════════════════════════════════
  get rong() { return window.innerWidth; }
  get cao() { return window.innerHeight; }

  get nhaX() { return this.rong - this.co - this.le; }
  get nhaY() { return this.cao - this.co - this.le; }

  /** Điểm có nằm trong vùng bấm của mascot không (CSS px). */
  trungDiem(x, y) {
    if (this.trangThai === "ngu") return false;
    const bien = 8;
    const trongHop =
      x >= this.px - bien && x <= this.px + this.co + bien &&
      y >= this.py - bien && y <= this.py + this.co + bien;
    if (!trongHop) return false;

    // Bỏ phần vòm rỗng giữa chân chữ A để bấm không bị "dính" khoảng trống
    const px = (x - this.px) / this.co;
    const py = (y - this.py) / this.co;
    const trongVom =
      py > 0.55 && py < 0.9 &&
      px > 0.33 && px < 0.67 &&
      Math.abs(px - 0.5) < (py - 0.55) * 0.62 + 0.04;
    return !trongVom;
  }

  // ═══ Chuột ══════════════════════════════════════════════════════════════
  capNhatChuot(x, y) {
    this.chuot = { x, y };
    if (this.dangKeo) {
      this.px = this.keoGoc.px + (x - this.keoGoc.x);
      this.py = this.keoGoc.py + (y - this.keoGoc.y);
      return;
    }
    const cx = this.px + this.co / 2;
    const cy = this.py + this.co * 0.55;
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy) || 1;
    this.matDichX = (dx / d) * Math.min(3.4, d / 40);
    this.matDichY = (dy / d) * Math.min(3.4, d / 40);
    this.tiltDich = clamp(dx / 300, -0.2, 0.2);
  }

  batDauKeo(x, y) {
    this.dangKeo = true;
    this.cheDo = "keo";
    this.dangDi = false;
    this.trangThai = "keo";
    this.thucDay();
    this.keoGoc = { x, y, px: this.px, py: this.py };
    this.vx = 0;
    this.vy = 0;
    this.henVeCho = 0;
    this._truoc = { x, y, t: performance.now() };
    this.vuotX = 0;
    this.vuotY = 0;
  }

  capNhatKeo(x, y) {
    if (!this.dangKeo) return;
    const now = performance.now();
    if (this._truoc.t) {
      const dt = Math.max(1, now - this._truoc.t);
      this.vuotY = ((y - this._truoc.y) / dt) * 16;
      this.vuotX = ((x - this._truoc.x) / dt) * 16;
    }
    this._truoc = { x, y, t: now };
    this.px = this.keoGoc.px + (x - this.keoGoc.x);
    this.py = this.keoGoc.py + (y - this.keoGoc.y);
    this.tiltDich = clamp((x - this.keoGoc.x) / 110, -0.55, 0.55);
  }

  thaRa() {
    if (!this.dangKeo) return;
    const daDiChuyen = Math.hypot(
      this.px - this.keoGoc.px,
      this.py - this.keoGoc.py
    );
    this.dangKeo = false;
    this.trangThai = "nghi";
    this.vy = clamp(this.vuotY / 3, -26, 26);
    this.vx = clamp(this.vuotX / 3, -18, 18);
    this.lucThaRa = performance.now();

    // Bấm nhẹ (không kéo) = nhảy mừng
    if (daDiChuyen < 5) {
      this.cheDo = "roi";
      this.nhay();
    } else {
      this.cheDo = "roi";
    }
  }

  // ═══ Hành động ══════════════════════════════════════════════════════════
  nhay() {
    this.vy = -13;
    this.sx = 1.16;
    this.sy = 0.86;
    this.trangThai = "vui";
    this.cheDo = "roi";
    this.banSang(22);
    this.noiNgauNhien();
    this.thucDay();
    setTimeout(() => { if (this.trangThai === "vui") this.trangThai = "nghi"; }, 850);
  }

  banSang(soLuong = 16) {
    const cx = this.px + this.co / 2;
    const cy = this.py + this.co * 0.6;
    for (let i = 0; i < soLuong; i++) {
      const a = Math.random() * GOC;
      const v = ngauNhien(1.4, 5.4);
      this.hat.push({
        x: cx, y: cy,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 1.8,
        song: 1,
        r: ngauNhien(1.2, 3.2),
        mau: Math.random() < 0.5 ? "#3FCFD2" : Math.random() < 0.65 ? "#ffd479" : "#ffffff",
      });
    }
  }

  noi(text, ms = 3600) {
    if (!this.bubble) return;
    clearTimeout(this.henNoi);
    this.bubble.textContent = text;
    this.bubble.classList.add("show");
    this._datBongBong();

    // Mascot có thể chưa canh vị trí ở lần nói đầu tiên
    if (!this.daDatLanDau) {
      setTimeout(() => this._datBongBong(), 60);
    }

    this.henNoi = setTimeout(() => this.bubble.classList.remove("show"), ms);
  }

  /** Canh bong bóng thoại ngay trên đầu mascot, không tràn khỏi cửa sổ. */
  _datBongBong() {
    if (!this.bubble) return;
    const r = this.bubble.getBoundingClientRect();
    const bw = r.width || 240;
    const bh = r.height || 46;
    let left = this.px + this.co / 2 - bw + this.co * 0.55;
    let top = this.py - bh - 8;
    left = clamp(left, 8, Math.max(8, this.rong - bw - 8));
    if (top < 8) top = this.py + this.co + 8;
    this.bubble.style.left = `${Math.round(left)}px`;
    this.bubble.style.top = `${Math.round(top)}px`;
  }

  noiNgauNhien() {
    this.noi(this.loiThoai[Math.floor(Math.random() * this.loiThoai.length)], 4200);
  }

  setTrangThai(st) {
    this.trangThai = st;
    if (st === "suy-nghi") this.thucDay();
  }

  thucDay() {
    this.henNgu = Date.now() + 45000;
    if (this.trangThai === "ngu") this.trangThai = "nghi";
  }

  // ═══ Cập nhật ═══════════════════════════════════════════════════════════
  capNhat(dt = 1) {
    const now = Date.now();
    const W = this.rong;
    const H = this.cao;

    if (!this.daDatLanDau) {
      this.px = this.nhaX;
      this.py = this.nhaY;
      this.daDatLanDau = true;
    }

    // Cửa sổ đổi kích thước → giữ mascot trong khung
    if (this.py > H - this.co - 4) this.py = H - this.co - 4;
    if (this.px > W - this.co - 4) this.px = W - this.co - 4;

    // Ngủ khi rảnh lâu
    if (now > this.henNgu && !this.dangKeo && this.trangThai !== "suy-nghi") {
      this.trangThai = "ngu";
    }

    // ── Vật lý: chia dt thành các bước ≤ 1 khung ─────────────────────────
    // Khi cửa sổ bị che, Chromium bóp nhịp xuống ~1fps nên dt có thể tới 60.
    // Tích phân một bước lớn sẽ làm vật thể nhảy cóc qua sàn / văng ra ngoài.
    // Chia nhỏ thành nhiều bước cố định giữ vật lý đúng ở MỌI frame rate.
    let con = Math.min(dt, 120);
    let buoc = 0;
    while (con > 0.0005 && buoc < 130) {
      const b = Math.min(1, con);
      this._vatLy(b, now);
      con -= b;
      buoc++;
    }

    // ── Làm mượt (dùng dt đầy đủ) ────────────────────────────────────────
    const kDanHoi = 1 - Math.pow(1 - 0.16, dt);
    this.sx = lerp(this.sx, 1, kDanHoi);
    this.sy = lerp(this.sy, 1, kDanHoi);

    const kNghieng = 1 - Math.pow(1 - 0.09, dt);
    this.tilt = lerp(this.tilt, this.tiltDich, kNghieng);
    if (!this.dangKeo && !this.dangDi) {
      this.tiltDich = lerp(this.tiltDich, 0, 1 - Math.pow(1 - 0.02, dt));
    }
    const kMat = 1 - Math.pow(1 - 0.14, dt);
    this.matX = lerp(this.matX, this.matDichX, kMat);
    this.matY = lerp(this.matY, this.matDichY, kMat);

    if (this.trangThai === "ngu") {
      this.matNham = lerp(this.matNham, 1, kDanHoi);
    } else if (this.dangChop) {
      this.matNham = lerp(this.matNham, 1, 1 - Math.pow(1 - 0.55, dt));
    } else {
      this.matNham = lerp(this.matNham, 0, 1 - Math.pow(1 - 0.35, dt));
      if (now > this.henChop) {
        this.dangChop = true;
        setTimeout(() => {
          this.dangChop = false;
          this.henChop = Date.now() + ngauNhien(2200, 6000);
        }, 120);
      }
    }

    // Hạt sáng
    for (let i = this.hat.length - 1; i >= 0; i--) {
      const h = this.hat[i];
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.vy += 0.17 * dt;
      h.song -= 0.026 * dt;
      if (h.song <= 0) this.hat.splice(i, 1);
    }

    this.phaNgu = (this.phaNgu + 0.012 * dt) % 1;

    this.capNhatHitBox();
  }

  /** Một bước vật lý cố định (b ≤ 1 khung). */
  _vatLy(b, now) {
    const W = this.rong;
    const H = this.cao;

    // ── Máy trạng thái chuyển động ──────────────────────────────────────
    //   "chodau"  → đứng ở chỗ đậu (có thể đi dạo)
    //   "roi"     → đang rơi / vừa bị ném, chịu trọng lực
    //   "vecho"   → bay mượt về chỗ đậu (KHÔNG chịu trọng lực)
    //   "keo"     → đang bị giữ bằng chuột
    const san = H - this.co - this.le;
    const maxX = Math.max(4, W - this.co - 4);

    // Đi dạo — chỉ khi đang đứng ở chỗ đậu
    if (this.cheDo === "chodau" && !this.dangKeo &&
        this.trangThai !== "ngu" && this.trangThai !== "suy-nghi") {
      if (!this.dangDi && now > this.henDi) {
        this.dangDi = true;
        const bien = W * 0.14;
        this.dichX = clamp(this.nhaX + ngauNhien(-bien, bien), 8, Math.max(8, maxX));
        this.dichY = clamp(this.nhaY + ngauNhien(-H * 0.18, 0), 8,
          Math.max(8, H - this.co - 8));
      }
      if (this.dangDi) {
        const k = 1 - Math.pow(1 - 0.045, b);
        this.px = lerp(this.px, this.dichX, k);
        this.py = lerp(this.py, this.dichY, k);
        this.buoc += 0.19 * b;
        this.tiltDich = clamp((this.dichX - this.px) / 70, -0.2, 0.2);
        if (Math.hypot(this.px - this.dichX, this.py - this.dichY) < 1.2) {
          this.dangDi = false;
          this.henDi = now + ngauNhien(9000, 20000);
        }
      }
    }

    // Rơi tự do
    if (this.cheDo === "roi" && !this.dangKeo) {
      this.vy += 0.62 * b;
      this.py += this.vy * b;
      this.px += this.vx * b;
      this.vx *= Math.pow(0.985, b);

      // Chạm biên
      if (this.px < 4) { this.px = 4; if (this.vx < 0) this.vx = 0; }
      else if (this.px > maxX) { this.px = maxX; if (this.vx > 0) this.vx = 0; }
      if (this.py < 4) { this.py = 4; if (this.vy < 0) this.vy = 0; }

      // Chạm sàn
      if (this.py >= san) {
        if (this.vy > 2.2) {
          this.sx = 1 + Math.min(0.3, this.vy * 0.022);
          this.sy = 1 - Math.min(0.26, this.vy * 0.02);
          if (this.vy > 9) this.banSang(6);
        }
        this.py = san;
        this.vy = 0;
        this.vx = 0;
        this.cheDo = "chodau";
        this.dangDi = false;
        if (this.trangThai === "keo") this.trangThai = "nghi";

        // Rơi xong mà đang xa chỗ đậu → bay về
        if (Math.hypot(this.px - this.nhaX, this.py - this.nhaY) > 24) {
          this.cheDo = "vecho";
          this.henVeCho = now + 700;
        }
      }
    }

    // Bay về chỗ đậu
    if (this.cheDo === "vecho" && !this.dangKeo && now > this.henVeCho) {
      const k = 1 - Math.pow(1 - 0.055, b);
      this.px = lerp(this.px, this.nhaX, k);
      this.py = lerp(this.py, this.nhaY, k);
      this.buoc += 0.12 * b;
      this.tiltDich = clamp((this.nhaX - this.px) / 90, -0.14, 0.14);
      if (Math.hypot(this.px - this.nhaX, this.py - this.nhaY) < 1) {
        this.px = this.nhaX;
        this.py = this.nhaY;
        this.cheDo = "chodau";
        this.henVeCho = 0;
        this.henDi = now + ngauNhien(8000, 16000);
      }
    }
  }

  // ═══ Vẽ ═════════════════════════════════════════════════════════════════
  ve() {
    const ctx = this.ctx;
    const W = this.rong;
    const H = this.cao;
    const dpr = window.devicePixelRatio || 1;

    // Đồng bộ kích thước backing store
    const bw = Math.round(W * dpr);
    const bh = Math.round(H * dpr);
    if (this.cv.width !== bw) this.cv.width = bw;
    if (this.cv.height !== bh) this.cv.height = bh;
    // Khoá kích thước CSS để canvas không phình theo thuộc tính width/height
    this.cv.style.width = W + "px";
    this.cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const co = this.co;

    // Nhấp nhô
    let noi = 0;
    if (this.trangThai === "nghi") noi = Math.sin(this.frame * 0.045) * 2.4;
    else if (this.trangThai === "suy-nghi") noi = Math.sin(this.frame * 0.16) * 3.2;
    else if (this.trangThai === "ngu") noi = Math.sin(this.frame * 0.02) * 1.2;
    else if (this.dangDi) noi = -Math.abs(Math.sin(this.buoc)) * 3.4;
    else if (this.dangKeo) noi = Math.sin(this.frame * 0.22) * 1.6;

    const cx = this.px + co / 2;
    const cy = this.py + co / 2 + noi;

    // Bóng đổ dưới mascot
    const cachDat = clamp((this.nhaY - this.py) / 140, 0, 1);
    ctx.save();
    ctx.globalAlpha = (1 - cachDat) * 0.28;
    ctx.fillStyle = "#00161d";
    ctx.beginPath();
    ctx.ellipse(
      this.px + co / 2, this.nhaY + co * 0.94,
      co * 0.34 * (1 - cachDat * 0.35), co * 0.075,
      0, 0, GOC
    );
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.tilt + (this.dangKeo ? Math.sin(this.frame * 0.09) * 0.06 : 0));

    const tho = 1 + Math.sin(this.frame * 0.05) * 0.014;
    const rung = this.trangThai === "suy-nghi" ? Math.sin(this.frame * 0.9) * 0.012 : 0;
    ctx.scale(this.sx * tho + rung, this.sy / tho);

    // ── Chữ A ──────────────────────────────────────────────────────────
    if (this.anhReady) {
      if (this.trangThai === "ngu") ctx.globalAlpha = 0.68;
      if (this.dangKeo) {
        ctx.shadowColor = "rgba(63,207,210,.6)";
        ctx.shadowBlur = 26;
      } else if (this.trangThai === "suy-nghi") {
        ctx.shadowColor = "rgba(63,207,210,.45)";
        ctx.shadowBlur = 14 + Math.sin(this.frame * 0.3) * 8;
      }
      ctx.drawImage(this.anh, -co / 2, -co / 2, co, co);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    this.veMat(ctx, co);

    ctx.restore();

    // ── Hạt sáng ───────────────────────────────────────────────────────
    for (const ht of this.hat) {
      ctx.save();
      ctx.globalAlpha = clamp(ht.song, 0, 1);
      ctx.fillStyle = ht.mau;
      ctx.beginPath();
      ctx.arc(ht.x, ht.y, ht.r, 0, GOC);
      ctx.fill();
      ctx.restore();
    }

    // ── Bong bóng ngủ ──────────────────────────────────────────────────
    if (this.trangThai === "ngu") this.veNgu(ctx, cx, cy, co);
  }

  /** Đồng bộ khung bắt chuột bám theo mascot. */
  capNhatHitBox() {
    if (!this.hitEl) return;
    this.hitEl.style.transform =
      `translate(${Math.round(this.px)}px, ${Math.round(this.py)}px)`;
    this.hitEl.style.cursor = this.dangKeo ? "grabbing" : "grab";
  }

  /** Khuôn mặt nằm trong vòm chữ A (toạ độ tương đối tâm mascot). */
  veMat(ctx, co) {
    // Toạ độ theo viewBox 180 của path chữ A chính thức:
    //   vòm rỗng giữa hai chân bắt đầu từ y≈94.7, tâm x≈90
    const quy = (v) => (v / 180 - 0.5) * co;
    const ex1 = quy(78), ey1 = quy(115.5);
    const ex2 = quy(102), ey2 = quy(115.5);
    const mx = quy(90), my = quy(136);

    const r = co * 0.058;
    const rongMat = r * 0.58;

    // Mắt nhắm → hai đường cong rõ nét
    if (this.matNham > 0.5) {
      ctx.strokeStyle = "#0b2530";
      ctx.lineWidth = Math.max(1.8, co * 0.016);
      ctx.lineCap = "round";
      for (const [bx, by] of [[ex1, ey1], [ex2, ey2]]) {
        ctx.beginPath();
        ctx.arc(bx, by + r * 0.2, r * 0.9, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
      }
    } else {
      for (const [bx, by] of [[ex1, ey1], [ex2, ey2]]) {
        // Viền tối giúp mắt nổi trên nền gradient
        ctx.fillStyle = "rgba(6,26,34,.28)";
        ctx.beginPath();
        ctx.ellipse(bx, by, r * 1.16, r * 1.16, 0, 0, GOC);
        ctx.fill();

        // Lòng trắng
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(bx, by, r, r * (1 - this.matNham), 0, 0, GOC);
        ctx.fill();

        // Con ngươi
        ctx.fillStyle = "#0b2530";
        ctx.beginPath();
        ctx.ellipse(
          bx + this.matX * (r * 0.4),
          by + this.matY * (r * 0.4),
          rongMat, rongMat * (1 - this.matNham * 0.9), 0, 0, GOC
        );
        ctx.fill();

        // Đốm sáng
        ctx.fillStyle = "rgba(255,255,255,.95)";
        ctx.beginPath();
        ctx.arc(
          bx + this.matX * 0.4 - rongMat * 0.34,
          by + this.matY * 0.4 - rongMat * 0.44,
          rongMat * 0.42, 0, GOC
        );
        ctx.fill();
      }
    }

    // Miệng: cười nhẹ, mở rộng khi vui
    const doRong = this.trangThai === "vui" ? 1 : 0.58;
    ctx.strokeStyle = "rgba(11,37,48,.9)";
    ctx.lineWidth = Math.max(1.4, co * 0.013);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(mx, my - r * 0.9, r * 0.66, Math.PI * 0.16, Math.PI * (0.16 + doRong * 0.68));
    ctx.stroke();

    // Má ửng khi vui
    if (this.trangThai === "vui") {
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = "#ff8f9c";
      for (const [bx, by] of [
        [ex1 - r * 1.45, ey1 + r * 0.9],
        [ex2 + r * 1.45, ey2 + r * 0.9],
      ]) {
        ctx.beginPath();
        ctx.ellipse(bx, by, r * 0.62, r * 0.4, 0, 0, GOC);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  veNgu(ctx, cx, cy, co) {
    for (let i = 0; i < 3; i++) {
      const t = (this.phaNgu + i / 3) % 1;
      const x = cx + co * 0.26 + Math.sin(t * 6 + i) * co * 0.05;
      const y = cy - co * 0.3 - t * co * 0.46;
      ctx.save();
      ctx.globalAlpha = Math.sin(t * Math.PI) * 0.85;
      ctx.fillStyle = "#bfeffa";
      ctx.font = `600 ${Math.round(co * 0.1 + i * 1.5)}px system-ui, sans-serif`;
      ctx.fillText("z", x, y);
      ctx.restore();
    }
  }
}
