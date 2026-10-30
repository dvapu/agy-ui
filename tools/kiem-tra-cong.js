// Kiểm tra cấu hình: AGY có đang chạy không, có gắn được lớp phủ không.
// Chạy: node tools/kiem-tra-cong.js
//
// Đây là lệnh đầu tiên nên chạy khi có sự cố.

import { docCongDebug, moPhienAgy, trangThaiLopPhu } from "../src/agy-bridge.js";

const OK = "\x1b[32m✅\x1b[0m";
const LOI = "\x1b[31m❌\x1b[0m";
const CANH = "\x1b[33m⚠️\x1b[0m";

console.log("\n🔍 Kiểm tra Antigravitinho\n");

const port = docCongDebug();

if (!port) {
  console.log(`${LOI} Không tìm thấy DevToolsActivePort`);
  console.log("   Đường dẫn: %APPDATA%\\Antigravity\\DevToolsActivePort");
  console.log("\n   Nguyên nhân thường gặp:");
  console.log("   • Antigravity chưa chạy           -> mở AGY rồi chạy lại lệnh này");
  console.log("   • AGY bản mới đã tắt cổng debug   -> xem docs/CAP-NHAT-AGY.md");
  process.exit(1);
}

console.log(`${OK} Tìm thấy Antigravity đang chạy`);
console.log(`   Cổng debug: ${port}`);

const phien = await moPhienAgy();

if (!phien) {
  console.log(`${LOI} Kết nối CDP thất bại`);
  console.log("   Cổng mở nhưng không tìm được trang AGY.");
  console.log("   Thử: tắt hẳn Antigravity, mở lại, rồi chạy lệnh này.");
  process.exit(1);
}

console.log(`${OK} Kết nối CDP thành công`);
console.log(`   Trang: ${phien.target.url}`);
phien.phien.dong();

const tt = await trangThaiLopPhu();

if (tt.tat) {
  console.log(`${CANH} Lớp phủ: ĐÃ TẮT (bạn đã bấm ✕)`);
  console.log("   Bật lại: chuột phải icon khay -> Gắn lại ngay");
} else if (tt.co) {
  console.log(`${OK} Lớp phủ: ĐANG GẮN`);
} else {
  console.log(`${CANH} Lớp phủ: CHƯA GẮN`);
  console.log("   Bật: chuột phải icon khay Antigravitinho -> Gắn lại ngay");
}

console.log("");
process.exit(tt.co ? 0 : 2);
