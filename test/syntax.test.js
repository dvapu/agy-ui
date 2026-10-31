// Kiểm tra cú pháp + hợp đồng giữa các module.
// Chạy: npm test
//
// Đây là lưới an toàn rẻ nhất: bắt lỗi gõ, lệch tên hàm, và chặn tái phát
// những lỗi đã từng làm hỏng app (rò rỉ vòng lặp, tham số rác).

import { test } from "node:test";
import assert from "node:assert";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const doc = (...p) => readFileSync(join(GOC, ...p), "utf-8");

function lietKeFile(thuMuc, duoi = [".js", ".cjs", ".mjs"]) {
  const ketQua = [];
  for (const ten of readdirSync(thuMuc)) {
    if (["node_modules", "dist", "dist-anh", ".git"].includes(ten)) continue;
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

test("injector sinh mã chèn hợp lệ và có đủ 3 engine", async () => {
  const { taoMaInjection, TEN_THEME } = await import("../src/injector.js");
  const ma = taoMaInjection({ chuDe: "lagoon", doDam: 0.55, co: 88 });

  assert.ok(ma.length > 20000, `mã chèn quá ngắn: ${ma.length}`);
  assert.ok(ma.includes("ThemesEngine"), "thiếu ThemesEngine");
  assert.ok(ma.includes("MascotA"), "thiếu MascotA");
  assert.ok(ma.includes("LagoonEngine"), "thiếu LagoonEngine");

  // Mã chèn phải tự chứa: không còn import/export
  assert.ok(!/^\s*import\s/m.test(ma), "không được còn import trong mã chèn");
  assert.ok(!/^\s*export\s/m.test(ma), "không được còn export trong mã chèn");

  // Phải parse được như JS hợp lệ
  assert.doesNotThrow(() => new Function(ma), "mã chèn không phải JS hợp lệ");

  assert.equal(Object.keys(TEN_THEME).length, 6, "phải có đúng 6 theme");
});

test("injector chặn tham số rác (XSS qua chuDe, số vô lý)", async () => {
  const { taoMaInjection } = await import("../src/injector.js");

  const ma = taoMaInjection({ chuDe: 'x"]; alert(1); //', doDam: 5, co: 99999 });
  assert.ok(!ma.includes("alert(1)"), "chuDe lạ phải bị loại bỏ");
  assert.ok(ma.includes('"lagoon"'), "phải rơi về theme mặc định");

  // doDam kẹp trong 0.1..0.95
  assert.ok(ma.includes("opacity: 0.95"), "doDam phải bị kẹp về 0.95");
  // co kẹp trong 24..400
  assert.ok(ma.includes("400px"), "cỡ mascot phải bị kẹp về 400");

  // Số 0 / NaN cũng phải về mặc định chứ không làm hỏng lớp phủ
  const ma0 = taoMaInjection({ doDam: NaN, co: 0 });
  assert.ok(ma0.includes("opacity: 0.55"), "doDam NaN phải về 0.55");
  assert.ok(ma0.includes("88px"), "co = 0 phải về 88");
});

test("mọi theme khai báo trong TEN_THEME đều có hàm vẽ", async () => {
  const { TEN_THEME } = await import("../src/injector.js");
  const src = doc("src", "renderer", "themes-engine.js");

  const canCo = {
    koi: "drawKoiPond",
    galaxy: "drawGalaxy",
    matrix: "drawMatrix",
    fireplace: "drawFireplace",
    rain: "drawRain",
  };

  // Chỉ xét thân hàm veMotKhung để chắc hàm vẽ thật sự được gọi
  const dau = src.indexOf("veMotKhung(t)");
  const cuoi = src.indexOf("stop()");
  assert.ok(dau > 0 && cuoi > dau, "không tìm thấy veMotKhung trong themes-engine.js");
  const than = src.slice(dau, cuoi);

  for (const theme of Object.keys(TEN_THEME)) {
    if (theme === "lagoon") {
      assert.ok(than.includes("lagoonEngine"), "lagoon phải do LagoonEngine vẽ");
      continue;
    }
    const ten = canCo[theme];
    assert.ok(ten, `theme "${theme}" chưa khai báo hàm vẽ trong test`);
    assert.ok(src.includes(ten + "("), `thiếu hàm ${ten} cho theme ${theme}`);
    assert.ok(than.includes(ten + "("), `veMotKhung chưa gọi ${ten}`);
  }
});

test("gỡ lớp phủ phải dừng vòng lặp trước khi tháo DOM", () => {
  const injector = doc("src", "injector.js");
  const bridge = doc("src", "agy-bridge.js");

  // Có hàm huỷ chung
  assert.ok(injector.includes("const huy = () =>"), "injector thiếu hàm huỷ");
  assert.ok(injector.includes("box.__huy = huy"), "phải gắn __huy lên box");

  // Hàm huỷ phải dừng cả hai vòng lặp
  const thanHuy = injector.slice(
    injector.indexOf("const huy = () =>"),
    injector.indexOf("box.__huy = huy")
  );
  assert.ok(thanHuy.includes("mv.dung()"), "hàm huỷ phải gọi mv.dung()");
  assert.ok(thanHuy.includes("engine.stop()"), "hàm huỷ phải gọi engine.stop()");
  assert.ok(thanHuy.includes("removeEventListener"), "hàm huỷ phải gỡ listener trên window");
  assert.ok(
    thanHuy.indexOf("mv.dung()") < thanHuy.indexOf("box.remove()"),
    "phải dừng vòng lặp TRƯỚC khi box.remove()"
  );

  // Cầu CDP phải dùng đúng mã dọn đó
  assert.ok(bridge.includes("export const MA_GO_LOP_PHU"), "thiếu MA_GO_LOP_PHU");
  assert.ok(bridge.includes("__huy?.()"), "goKhoiAgy phải gọi __huy");
  assert.ok(bridge.includes("__mascot?.dung?.()"), "phải dừng mascot cả với bản cũ");
});

test("bridge có đủ hàm main.js dùng, và không dùng thư viện ngoài", () => {
  const bridge = doc("src", "agy-bridge.js");
  const main = doc("src", "main.js");

  // Đọc đúng danh sách main.js import từ bridge
  const m = main.match(/import\s*\{([^}]+)\}\s*from\s*"\.\/agy-bridge\.js"/);
  assert.ok(m, "main.js không import gì từ agy-bridge.js");

  const ten = m[1].split(",").map((s) => s.trim()).filter(Boolean);
  assert.ok(ten.length >= 3, `main.js chỉ import ${ten.length} hàm từ bridge`);

  for (const fn of ten) {
    assert.ok(
      bridge.includes(`export async function ${fn}`) || bridge.includes(`export function ${fn}`),
      `agy-bridge.js thiếu export ${fn}`
    );
  }

  assert.ok(!/from\s+["']ws["']/.test(bridge), "không được dùng thư viện ws");
});

test("không thêm dependency ngoài", () => {
  const pkg = JSON.parse(doc("package.json"));
  const deps = Object.keys(pkg.dependencies || {});
  assert.deepEqual(deps, [], `không được thêm dependency: ${deps.join(", ")}`);
});

test("main.js không đụng vào DB của Antigravity", () => {
  const toanBo = doc("src", "main.js") + doc("src", "agy-bridge.js");

  // Chỉ được đọc đúng file cổng debug
  assert.ok(toanBo.includes("DevToolsActivePort"), "phải đọc cổng từ DevToolsActivePort");

  const cam = ["conversations", "conversation_summaries", "brain", ".db"];
  for (const c of cam) {
    assert.ok(!toanBo.includes(c), `KHÔNG ĐƯỢC chạm vào "${c}" (DB của Antigravity)`);
  }
});
