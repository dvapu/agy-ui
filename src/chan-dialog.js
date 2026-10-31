// ═══════════════════════════════════════════════════════════════════════════
// ChanDialog — bộ chặn spam hộp thoại
//
// Vấn đề thật đã gặp: dialog lỗi được gọi từ vòng lặp theo dõi 3 giây, nên
// khi Antigravity tắt nó bật lên liên tục, chồng lên nhau, đỏ cả màn hình.
//
// Bộ chặn này đảm bảo:
//   1. Chỉ MỘT hộp thoại mở tại một thời điểm.
//   2. Có giãn cách tối thiểu giữa hai lần hỏi (mặc định 10 phút).
//   3. Cùng một loại lỗi chỉ hỏi tối đa N lần trong một phiên.
//   4. Có thể tắt hẳn (khi người dùng chọn "Để sau").
// ═══════════════════════════════════════════════════════════════════════════

export class ChanDialog {
  /**
   * @param {{gianCachMs?: number, soLanToiDa?: number, dongHo?: () => number}} tuyChon
   */
  constructor(tuyChon = {}) {
    this.gianCachMs = tuyChon.gianCachMs ?? 10 * 60 * 1000;
    this.soLanToiDa = tuyChon.soLanToiDa ?? 3;
    this.dongHo = tuyChon.dongHo || (() => Date.now());

    this.dangMo = false;
    this.lanCuoi = -Infinity;   // chưa hỏi lần nào
    this.soLanDaHoi = 0;
    this.daTat = false;
  }

  /** Có được phép mở hộp thoại ngay bây giờ không? (không có tác dụng phụ) */
  coTheHoi() {
    if (this.daTat) return false;
    if (this.dangMo) return false;
    if (this.soLanDaHoi >= this.soLanToiDa) return false;
    if (this.dongHo() - this.lanCuoi < this.gianCachMs) return false;
    return true;
  }

  /**
   * Thử mở hộp thoại. Trả về true nếu thực sự được mở.
   * @param {() => (Promise<any>|any)} moHam  hàm mở hộp thoại
   * @param {(kq: any) => void} [khiXong]
   */
  hoi(moHam, khiXong) {
    if (!this.coTheHoi()) return false;

    this.dangMo = true;
    this.lanCuoi = this.dongHo();
    this.soLanDaHoi++;

    const xong = (kq) => {
      this.dangMo = false;
      try { khiXong?.(kq); } catch { }
    };

    try {
      const kq = moHam();
      if (kq && typeof kq.then === "function") {
        kq.then(xong).catch(() => xong(undefined));
      } else {
        xong(kq);
      }
    } catch {
      xong(undefined);
    }
    return true;
  }

  /** Người dùng chọn "Để sau" → không hỏi nữa trong phiên này. */
  tat() {
    this.daTat = true;
  }

  /** Đặt lại khi mọi thứ đã hoạt động bình thường trở lại. */
  datLai() {
    this.soLanDaHoi = 0;
    this.daTat = false;
  }
}
