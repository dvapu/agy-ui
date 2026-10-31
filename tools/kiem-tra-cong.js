// Kiểm tra cấu hình: AGY có đang chạy không, có gắn được lớp phủ không.
// Chạy: node tools/kiem-tra-cong.js
//
// Đây là lệnh đầu tiên nên chạy khi có sự cố.

import { docCongDebug, moPhienAgy, dangCoLopPhu, chanDoan } from "../src/agy-bridge.js";

const OK = "\x1b[32m✅\x1b[0m";
const LOI = "\x1b[31m❌\x1b[0m";
const CANH = "\x1b[33m⚠️\x1b[0m";

console.log("\n🔍 Kiểm tra Antigravitinho\n");

const port = docCongDebug();

if (!port) {
  console.log(`${LOI} Không tìm thấy DevToolsActivePort`);
  console.log("   Đường dẫn: %APPDATA%\\Antigravity\\DevToolsActivePort");
  console.log("\n   Nguyên nhân thường gặp:");
  console.log("   • Antigravity chưa chạy     -> mở AGY rồi chạy lại lệnh này");
  console.log("   • AGY đang thu nhỏ xuống khay -> mở cửa sổ lên");
  process.exit(1);
}

console.log(`${OK} Tìm thấy cổng debug của Antigravity`);
console.log(`   Cổng: ${port}`);

const phien = await moPhienAgy();

if (!phien) {
  const cd = await chanDoan();
  console.log(`${LOI} Kết nối CDP thất bại`);
  console.log(`   Chi tiết: ${cd.loi || "không rõ"}`);
  console.log("   Thử: mở cửa sổ Antigravity, rồi chạy lại lệnh này.");
  process.exit(1);
}

console.log(`${OK} Kết nối CDP thành công`);
console.log(`   Trang: ${phien.target.title}`);
console.log(`   URL  : ${phien.target.url}`);
phien.phien.dong();

const dangGan = await dangCoLopPhu();

if (dangGan) {
  console.log(`${OK} Lớp phủ: ĐANG GẮN`);
} else {
  console.log(`${CANH} Lớp phủ: CHƯA GẮN`);
  console.log("   Bật: chuột phải icon khay Antigravitinho -> Gắn vào Antigravity");
  console.log("   Hoặc: Ctrl + Shift + Space");
}

console.log("");
process.exit(dangGan ? 0 : 2);
