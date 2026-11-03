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

// ── Tự đo độ sáng của từng chủ đề ──────────────────────────────────────────
// Chủ đề sáng (mây trắng, tuyết, anh đào) vẽ ra những viên gạch gần như trắng.
// Lớp phủ nằm TRÊN chữ của AGY, nên gạch trắng làm chữ trắng biến mất. Đo độ
// sáng trung bình của từng chủ đề một lần rồi hạ độ đậm tương ứng — người
// dùng không phải tự chỉnh tay khi đổi chủ đề.
const DO_SANG = new Map();

// Độ sáng trung bình (0..1) của các điểm ảnh có nội dung, đo ở kích thước nhỏ.
function doSangCuaTheme(theme) {
  if (DO_SANG.has(theme.id)) return DO_SANG.get(theme.id);
  let doSang = 0.35;
  try {
    const W = 200, H = 120;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true });
    const env = {
      W, H, t: 3, dt: 0.04, mouse: null, cw: 18, ch: 26,
      k: Math.min(W, H) / 1000,
      hit: () => { }, hovered: () => -1, effects: [], lure: null,
      near: () => 0, body: (khoa, x, y) => [x, y, 0, 0],
    };
    theme.scene(g, env);
    const d = g.getImageData(0, 0, W, H).data;
    let tong = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 40) continue;
      tong += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      n++;
    }
    if (n > 50) doSang = tong / n;
  } catch (e) { }
  DO_SANG.set(theme.id, doSang);
  return doSang;
}

/**
 * Hệ số hạ độ đậm theo độ sáng: chủ đề tối giữ nguyên, chủ đề càng sáng càng
 * mờ. Mốc 0.30 là độ sáng lớn nhất còn đủ tương phản với chữ trắng của AGY.
 */
function heSoTheoDoSang(doSang) {
  return Math.min(1, Math.max(0.20, 0.30 / Math.max(0.25, doSang)));
}

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
    //
    // veNen: false — chạy như lớp phủ thì KHÔNG tô nền đặc. Lớp phủ nằm trên
    // chữ của AGY; tô kín màn hình là chữ biến mất. Chỉ khi render ảnh
    // (tools/render-themes.js) mới bật lại để xem đủ cảnh.
    this.tuyChon = { cw: 18, ch: 26, ss: 2, dpr: 1, veNen: false };
    this.renderer = taoRenderer(this.cv, this.tuyChon);

    // Sub-engine riêng cho Lagoon (giữ nguyên hình đang có)
    this.lagoonEngine = new LagoonEngine(canvasElement);

    this.rong = LAGOON_W;
    this.cao = LAGOON_H;
    this.chuot = null;
    this._moc = 0;

    // ── Vùng CHỪA: không vẽ gì lên đây ────────────────────────────────────
    // Thanh trên (0..35px) và ô nhập tin (đáy, cao ~90px) là chỗ người dùng
    // đọc và gõ. Hình nền tràn vào đó thì chữ trắng mất hút dù độ đậm thấp.
    // Đơn vị là px CSS của cửa sổ, tính lại mỗi lần đổi kích thước.
    this.chua = { tren: 35, duoi: 90 };

    this.datKichThuoc(LAGOON_W, LAGOON_H);
  }

  // Chủ đề hiện tại có dùng engine lưới ký tự không.
  get dungEngineMoi() {
    return coEngineMoi(this.activeTheme);
  }

  /**
   * Đo hai dải ngang phải chừa trống, dựa trên layout thật của AGY.
   *
   * Thanh trên và ô nhập tin là chỗ người dùng đọc/ gõ; hình nền tràn vào đó
   * thì chữ trắng mất hút. Đo bằng getBoundingClientRect của chính các phần
   * tử đó nên AGY đổi kích thước hay đổi giao diện đều theo đúng.
   *
   * Không tìm thấy phần tử nào (AGY đang tải, hoặc bản AGY khác) thì dùng giá
   * trị mặc định — thà chừa hơi nhiều còn hơn để chữ bị che.
   */
  doVungChua() {
    let tren = 0;
    let duoi = 0;

    // Thanh trên cùng: phần tử con đầu tiên của .agy-shell có chiều cao nhỏ
    try {
      const top = document.querySelector(".agy-shell > div:first-child, .agy-shell > div");
      const r = top?.getBoundingClientRect?.();
      if (r && r.height > 10 && r.height < 80 && r.top < 10) {
        tren = Math.round(r.bottom);
      } else {
        tren = 35;
      }
    } catch (e) {
      tren = 35;
    }

    // Ô nhập tin: AGY đặt id cố định cho nó
    try {
      const hop = document.querySelector("#antigravity.agentSidePanelInputBox");
      const r = hop?.getBoundingClientRect?.();
      if (r && r.height > 20) {
        duoi = Math.round(window.innerHeight - r.top);
      } else {
        duoi = 90;
      }
    } catch (e) {
      duoi = 90;
    }

    // Chốt an toàn: không chừa quá 40% chiều cao màn hình, nếu không hình nền
    // sẽ biến mất trên cửa sổ thấp.
    const toiDa = Math.floor((this.cuaSoCao || window.innerHeight || 800) * 0.4);
    tren = Math.min(Math.max(0, tren), toiDa);
    duoi = Math.min(Math.max(0, duoi), toiDa);

    this.chua = { tren, duoi };
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

    // Đo lại hai dải cần chừa theo layout THẬT của AGY. Đoán bằng số cứng thì
    // AGY đổi giao diện là hỏng; đo bằng DOM thì luôn đúng.
    this.doVungChua();

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
    // Độ đậm hiệu dụng = độ đậm người dùng đặt × hệ số theo độ sáng chủ đề.
    // Chủ đề tối (ma trận, arcade) không bị hạ; chủ đề sáng (mây, tuyết, anh
    // đào) bị hạ mạnh để chữ trắng của AGY vẫn đọc được.
    let heSo = 1;
    if (this.cheDoPhu) {
      const theme = coEngineMoi(this.activeTheme)
        ? ASCII_THEMES.find((x) => x.id === BANG_CHU_DE[this.activeTheme])
        : null;
      if (theme) heSo = heSoTheoDoSang(doSangCuaTheme(theme));
      else heSo = this.lagoonEngine?.cheDoPhu ? 0.9 : 1;
      this.ctx.save();
      this.ctx.globalAlpha = 0.45 * heSo;
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

    // Xoá hai dải chừa (thanh trên + ô nhập tin) — làm ở đây để áp cho CẢ HAI
    // nhánh vẽ, không phải sửa từng engine.
    this.xoaVungChua();

    if (this.cheDoPhu) this.ctx.restore();
  }

  /** Cắt bỏ hai dải chừa khỏi canvas (dùng destination-out, không đụng DOM AGY). */
  xoaVungChua() {
    const v = this.vungVe();
    if (!v) return;
    const { width: W, height: H } = this.cv;
    if (W < 2 || H < 2) return;
    // Landing: vungVe trả px CSS của cửa sổ; canvas có thể cao khác (lagoon vẽ
    // ở 1760 rồi CSS phóng lên) nên quy đổi theo CHIỀU CAO.
    const heSo = H / Math.max(1, this.cuaSoCao || H);
    const tren = v.tren * heSo;
    const duoi = v.duoi * heSo;
    if (tren <= 0 && duoi >= H) return;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalCompositeOperation = "destination-out";
    // PHẢI đặt alpha = 1: xoaVungChua chạy bên trong lớp save() đã hạ
    // globalAlpha của chế độ lớp phủ (0.45). destination-out nhân với alpha
    // đó nên chỉ xoá được 45%, phần còn lại vẫn đè lên chữ.
    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = "#000";
    if (tren > 0) this.ctx.fillRect(0, 0, W, tren);
    if (duoi < H) this.ctx.fillRect(0, duoi, W, H - duoi);
    this.ctx.restore();
  }

  /**
   * Hai dải cần chừa, tính bằng px CSS của cửa sổ.
   * Trả về null nghĩa là không chừa gì (đang không ở chế độ lớp phủ).
   */
  vungVe() {
    if (!this.cheDoPhu) return null;
    const coChua = (this.chua?.tren || 0) + (this.chua?.duoi || 0) > 0;
    if (!coChua) return null;
    return { tren: this.chua.tren || 0, duoi: this.cuaSoCao - (this.chua.duoi || 0) };
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
