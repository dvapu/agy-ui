// Kiểm tra cú pháp + hợp đồng giữa các module.
// Chạy: npm test
//
// Đây là lưới an toàn rẻ nhất: bắt lỗi gõ và lỗi lệch tên hàm
// trước khi mở app.

import { test } from "node:test";
import assert from "node:assert";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");

function lietKeFile(thuMuc, duoi = [".js", ".cjs", ".mjs"]) {
  const ketQua = [];
  for (const ten of readdirSync(thuMuc)) {
    if (ten === "node_modules" || ten === "dist" || ten === "dist-anh" || ten === ".git") continue;
    const duong = join(thuMuc, ten);
    if (statSync(duong).isDirectory()) ketQua.push(...lietKeFile(duong, duoi));
    else if (duoi.includes(extname(ten))) ketQua.push(duong);
  }
  return ketQua;
}

test("mọi file JS trong src/ đều đúng cú pháp", () => {
  const files = lietKeFile(join(GOC, "src"));
  assert.ok(files.length > 0, "không tìm thấy file JS nào trong src/");

  for (const f of files) {
    try {
      execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
    } catch (e) {
      assert.fail(`Lỗi cú pháp trong ${f}:\n${e.stderr?.toString() || e.message}`);
    }
  }
});

test("injector sinh mã chèn hợp lệ và có đủ engine", async () => {
  const { taoMaInjection, TEN_THEME } = await import("../src/injector.js");
  const ma = taoMaInjection({ chuDe: "lagoon", doDam: 0.55 });

  assert.ok(ma.length > 20000, `mã chèn quá ngắn: ${ma.length}`);
  assert.ok(ma.includes("ThemesEngine"), "thiếu ThemesEngine");
  assert.ok(ma.includes("MascotHonu"), "thiếu MascotHonu");
  assert.ok(ma.includes("LagoonEngine"), "thiếu LagoonEngine");
  assert.ok(ma.includes("startBangInterval"), "phải dùng setInterval, không phải rAF");
  assert.ok(!/^\s*import /m.test(ma), "không được còn import trong mã chèn");
  assert.ok(!/^\s*export /m.test(ma), "không được còn export trong mã chèn");

  // Mã phải parse được như JS hợp lệ
  assert.doesNotThrow(() => new Function(ma), "mã chèn không phải JS hợp lệ");

  // Đủ 6 theme
  assert.equal(Object.keys(TEN_THEME).length, 6, "phải có đúng 6 theme");
});

test("injector chặn chuDe lạ (không cho XSS qua tham số)", async () => {
  const { taoMaInjection } = await import("../src/injector.js");
  const ma = taoMaInjection({ chuDe: 'x"]; alert(1); //', doDam: 5 });
  assert.ok(!ma.includes("alert(1)"), "tham số lạ phải bị loại bỏ");
  assert.ok(ma.includes('"lagoon"'), "phải rơi về theme mặc định");
  // doDam phải bị kẹp trong 0.1..0.95
  assert.ok(!ma.includes("String(5)"), "doDam phải bị kẹp");
});

test("mọi theme khai báo trong TEN_THEME đều có hàm vẽ", async () => {
  const { TEN_THEME } = await import("../src/injector.js");
  const src = readFileSync(join(GOC, "src", "renderer", "themes-engine.js"), "utf-8");

  const canCo = {
    galaxy: "drawGalaxy",
    matrix: "drawMatrix",
    fireplace: "drawFireplace",
    rain: "drawRain",
    koi: "drawKoiPond",
  };

  for (const theme of Object.keys(TEN_THEME)) {
    if (theme === "lagoon") {
      assert.ok(src.includes("lagoonEngine"), "lagoon phải dùng LagoonEngine");
      continue;
    }
    const ten = canCo[theme];
    assert.ok(ten, `theme "${theme}" chưa khai báo hàm vẽ trong test`);
    assert.ok(src.includes(ten + "("), `thiếu hàm ${ten} cho theme ${theme}`);
    // Phải được gọi trong veMotKhung
    assert.ok(
      new RegExp(`case "${theme}":\\s*\\n\\s*this\\.${ten}`).test(src),
      `veMotKhung chưa gọi ${ten} cho theme "${theme}"`
    );
  }
});

test("bridge có đủ hàm main.js cần, và không dùng thư viện ngoài", () => {
  const bridge = readFileSync(join(GOC, "src", "agy-bridge.js"), "utf-8");
  const main = readFileSync(join(GOC, "src", "main.js"), "utf-8");

  for (const fn of ["ganVaoAgy", "goKhoiAgy", "trangThaiLopPhu", "docCongDebug", "xoaCoTat"]) {
    assert.ok(bridge.includes(`export async function ${fn}`) || bridge.includes(`export function ${fn}`),
      `agy-bridge.js thiếu export ${fn}`);
    assert.ok(main.includes(fn), `main.js không dùng ${fn}`);
  }

  // Không được require/import thư viện ws — ta tự viết để nhẹ
  assert.ok(!/from\s+["']ws["']/.test(bridge), "không được dùng thư viện ws");
});

test("main.js không đụng vào DB của Antigravity", () => {
  const main = readFileSync(join(GOC, "src", "main.js"), "utf-8");
  const bridge = readFileSync(join(GOC, "src", "agy-bridge.js"), "utf-8");
  const toanBo = main + bridge;

  const cam = ["conversations", "conversation_summaries", "brain", ".db"];
  for (const c of cam) {
    assert.ok(!toanBo.includes(c), `KHÔNG ĐƯỢC chạm vào "${c}" (DB của Antigravity)`);
  }
});
