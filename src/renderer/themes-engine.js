// ═══════════════════════════════════════════════════════════════════════════
// Antigravitinho — Bộ điều phối hình nền ASCII
//
// Hai nhánh vẽ:
//   · "lagoon"  → LagoonEngine (bản port riêng, giữ nguyên hình đang có)
//   · còn lại   → engine lưới ký tự chuyển từ Claudinho (ascii-themes.js)
//
// Lý do tồn tại hai nhánh: bản cũ chỉ có "lagoon" được vẽ đúng kỹ thuật lưới
// ký tự (vẽ vector vào lớp phóng to rồi lấy trung bình từng ô), 5 chủ đề kia
// là hình vector vẽ tay nên nhìn thưa và nhạt. Nay 14 chủ đề còn lại dùng
// chung engine của Claudinho nên tất cả cùng một chất lượng.
//
// Kích thước canvas: mỗi nhánh có một chế độ riêng.
//   · lagoon  cần đúng 1944×1760 (toạ độ cứng trong LagoonEngine) rồi CSS
//             phóng to phủ kín cửa sổ — cắt bớt rìa là chấp nhận được.
//   · engine mới vẽ theo BỐ CỤC (núi, lò sưởi, sân khấu) nên phải khớp đúng
//     tỉ lệ cửa sổ, nếu không phần chân cảnh bị cắt mất.
// ═══════════════════════════════════════════════════════════════════════════

import { ASCII_THEMES, taoRenderer } from "./ascii-themes.js";
import { LagoonEngine } from "./lagoon-engine.js";

// Khoá trong cấu hình -> id theme của engine
export const BANG_CHU_DE = {
  lagoon: "lagoon",
  koi: "koi",
  galaxy: "galaxia",
  matrix: "codigo",
  fireplace: "lareira",
  rain: "chuva",
  claude: "claude",
  clouds: "clouds",
  jelly: "jelly",
  boats: "boats",
  fireflies: "fireflies",
  moonlit: "moonlit",
  sakura: "sakura",
  aurora: "aurora",
  arcade: "arcade",
};

const ID_SANG_TAO = new Set(ASCII_THEMES.map((t) => t.id));

/** Khoá cấu hình có thật sự vẽ được bằng engine mới không. */
function coEngineMoi(khoa) {
  // Lagoon giữ nguyên LagoonEngine riêng: đó là hình đang dùng và đã được
  // kiểm chứng. Đẩy nó sang engine mới chỉ đổi hình mà không thêm gì.
  if (khoa === "lagoon") return false;
  const id = BANG_CHU_DE[khoa];
  return !!id && ID_SANG_TAO.has(id);
}

// Toạ độ cứng của LagoonEngine
const LAGOON_W = 1944;
const LAGOON_H = 1760;

export class ThemesEngine {
  constructor(canvasElement) {
    this.cv = canvasElement;
    this.ctx = this.cv.getContext("2d");

    this.activeTheme = "lagoon";
    this.running = false;
    this.rafId = null;
    this.intervalId = null;
    this.truoc = 0;

    // Chế độ lớp phủ: nền không đặc, chỉ để phần tử sáng nổi lên trên AGY
    this.cheDoPhu = false;

    // Thông số lưới: 18×26, siêu mẫu 2×2.
    //
    // Bản gốc dùng 14×20 + ss 3 và đo trên AGY thật tốn tới 4.1s CPU / 6s
    // (68% một nhân) — riêng fillText cho 4600 ô đã là 13.6ms/khung. Lưới
    // 18×26 + ss 2 giảm còn 1560 ô (3 lần ít lệnh vẽ hơn) mà mắt gần như
    // không phân biệt được: ảnh so sánh ở dist-anh/so-sanh/ giống hệt nhau.
    //
    // KHÔNG truyền k — engine tự tính min(W,H)/1000 mỗi khung, nhờ vậy hình
    // to nhỏ theo cửa sổ đúng như app gốc.
    //
    // dpr cố định 1: hình là các ô ký tự to, phóng 2x chỉ tốn gấp 4 lần điểm
    // ảnh mà mắt không thấy khác.
    this.tuyChon = { cw: 18, ch: 26, ss: 2, dpr: 1 };
    this.renderer = taoRenderer(this.cv, this.tuyChon);

    // Sub-engine riêng cho Lagoon (giữ nguyên hình đang có)
    this.lagoonEngine = new LagoonEngine(canvasElement);

    this.rong = LAGOON_W;
    this.cao = LAGOON_H;
    this.chuot = null;
    this._moc = 0;
    this.datKichThuoc(LAGOON_W, LAGOON_H);
  }

  // Chủ đề hiện tại có dùng engine lưới ký tự không.
  get dungEngineMoi() {
    return coEngineMoi(this.activeTheme);
  }

  /**
   * Đặt kích thước vẽ.
   *
   * Hai nhánh cần hai hệ toạ độ khác nhau, và canvas chỉ có MỘT bộ thuộc tính
   * width/height, nên phải đổi cả hai mỗi lần chuyển nhánh:
   *   · lagoon  vẽ bằng toạ độ cứng 1944×1760 → canvas phải đúng cỡ đó rồi
   *             CSS phóng to phủ kín cửa sổ (cắt rìa là chấp nhận được).
   *   · engine mới vẽ theo bố cục nên canvas phải đúng tỉ lệ cửa sổ, nếu không
   *             phần chân cảnh (núi, lò sưởi, sân khấu) bị cắt mất.
   */
  datKichThuoc(rong, cao) {
    // Nhớ kích thước cửa sổ để setTheme() tự dựng lại canvas đúng cỡ.
    this.cuaSoRong = Math.max(320, Math.round(rong));
    this.cuaSoCao = Math.max(240, Math.round(cao));

    if (coEngineMoi(this.activeTheme)) {
      const w = this.cuaSoRong, h = this.cuaSoCao;
      if (this._nhanh === "moi" && this.rong === w && this.cao === h) return;
      this._nhanh = "moi";
      this.rong = w;
      this.cao = h;
      this.renderer.resize(w, h);
    } else {
      if (this._nhanh === "lagoon" && this.cv.width === LAGOON_W && this.cv.height === LAGOON_H) return;
      this._nhanh = "lagoon";
      this.rong = LAGOON_W;
      this.cao = LAGOON_H;
      this.cv.width = LAGOON_W;
      this.cv.height = LAGOON_H;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    // Đổi hệ toạ độ thì con trỏ cũ không còn nghĩa
    this.chuot = null;
    this._moc = 0;
  }

  setCheDoPhu(bat) {
    this.cheDoPhu = !!bat;
    if (this.lagoonEngine) this.lagoonEngine.cheDoPhu = !!bat;
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
  }

  setTheme(themeName) {
    if (this.activeTheme === themeName) return;
    this.activeTheme = themeName;
    this.truoc = 0;
    // Đổi chủ đề thì bỏ lực đẩy còn sót của chủ đề trước
    try { this.renderer.reset(); } catch (e) { }
    // Đổi nhánh vẽ là phải đổi luôn kích thước canvas (xem datKichThuoc)
    this.rong = 0;
    this.cao = 0;
    if (this.cuaSoRong) this.datKichThuoc(this.cuaSoRong, this.cuaSoCao);
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    // Vẽ NGAY một khung. Nếu để vòng lặp tự vẽ, gặp lúc cửa sổ bị che thì
    // Chromium bóp timer của trang xuống 1 khung/giây (hoặc đóng băng hẳn),
    // canvas vừa bị xoá sẽ trống cho tới khi cửa sổ hiện lại.
    try { this.veMotKhung(0); } catch (e) { }
  }

  /**
   * Chuột trong toạ độ canvas để vật thể trong hình nền biết né/đuổi theo con
   * trỏ như bản gốc.
   */
  datChuot(xManHinh, yManHinh) {
    if (!this.dungEngineMoi) return;
    const r = this.cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = ((xManHinh - r.left) * this.rong) / r.width;
    const y = ((yManHinh - r.top) * this.cao) / r.height;
    const nay = performance.now();
    const dt = this._moc ? Math.max(0.001, (nay - this._moc) / 1000) : 0.016;
    const truoc = this.chuot;
    const tocDo = truoc ? Math.hypot(x - truoc.x, y - truoc.y) / dt : 0;
    this.chuot = { x, y, speed: tocDo };
    this._moc = nay;
    try { this.renderer.mark(x, y); } catch (e) { }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.truoc = 0;
    const vong = () => {
      if (!this.running) return;
      this.veMotKhung(performance.now() / 1000);
      this.rafId = requestAnimationFrame(vong);
    };
    this.rafId = requestAnimationFrame(vong);
  }

  /** Vẽ đúng một khung tại thời điểm t (giây). */
  veMotKhung(t) {
    if (this.cheDoPhu) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.45;
    }

    if (coEngineMoi(this.activeTheme)) {
      const theme = ASCII_THEMES.find((x) => x.id === BANG_CHU_DE[this.activeTheme]);
      const dt = this.truoc ? Math.min(0.12, Math.max(0.001, t - this.truoc)) : 0.016;
      this.truoc = t;
      if (theme) {
        try {
          this.renderer.frame(theme, t, dt, this.chuot);
        } catch (e) {
          // Một chủ đề lỗi không được làm đứng cả hình nền
          this.ctx.restore();
          return;
        }
      }
    } else {
      this.lagoonEngine.draw(t);
    }

    if (this.cheDoPhu) this.ctx.restore();
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.intervalId) clearInterval(this.intervalId);
    this.rafId = null;
    this.intervalId = null;
  }

  /**
   * Nhịp vẽ dự phòng bằng setInterval: Chromium dừng hẳn requestAnimationFrame
   * khi cửa sổ bị che, nên lớp phủ trong AGY sẽ đứng hình nếu chỉ dựa vào rAF.
   * @param {number} fps
   */
  startBangInterval(fps = 24) {
    if (this.intervalId) clearInterval(this.intervalId);
    this.running = true;
    this.truoc = 0;
    const t0 = performance.now();
    this.intervalId = setInterval(() => {
      if (!this.running) return;
      this.veMotKhung((performance.now() - t0) / 1000);
    }, 1000 / fps);
  }
}
