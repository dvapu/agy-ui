// Kiểm thử bộ chặn spam dialog — thuần Node, không cần Electron
// Chạy: node --test tools/test-chan-dialog.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { ChanDialog } from "../src/chan-dialog.js";

test("chỉ mở một dialog tại một thời điểm", () => {
  const cd = new ChanDialog({ gianCachMs: 0, soLanToiDa: 99 });
  let soLanMo = 0;

  // Lần 1: mở, nhưng chưa xong (trả về promise chưa resolve)
  let giaiQuyet;
  const daMo1 = cd.hoi(() => new Promise((r) => { giaiQuyet = r; soLanMo++; }));
  assert.equal(daMo1, true);
  assert.equal(soLanMo, 1);

  // Lần 2..5: đang mở nên phải bị chặn
  for (let i = 0; i < 4; i++) {
    assert.equal(cd.hoi(() => { soLanMo++; }), false);
  }
  assert.equal(soLanMo, 1, "không được mở thêm dialog nào");

  // Xong → mở lại được
  giaiQuyet(0);
});

test("gọi 100 lần liên tiếp chỉ mở đúng 1 lần", () => {
  const cd = new ChanDialog({ gianCachMs: 10 * 60 * 1000 });
  let soLanMo = 0;
  for (let i = 0; i < 100; i++) {
    cd.hoi(() => { soLanMo++; });
  }
  assert.equal(soLanMo, 1, `mở ${soLanMo} lần — bị spam`);
});

test("tôn trọng giãn cách thời gian", () => {
  let gio = 0;
  const cd = new ChanDialog({ gianCachMs: 1000, dongHo: () => gio });
  let soLanMo = 0;
  const mo = () => { soLanMo++; };

  assert.equal(cd.hoi(mo), true);         // t=0
  gio = 500;
  assert.equal(cd.hoi(mo), false, "chưa đủ giãn cách");
  gio = 1001;
  assert.equal(cd.hoi(mo), true, "đủ giãn cách thì được mở");
  assert.equal(soLanMo, 2);
});

test("giới hạn số lần hỏi trong một phiên", () => {
  let gio = 0;
  const cd = new ChanDialog({ gianCachMs: 0, soLanToiDa: 3, dongHo: () => gio });
  let soLanMo = 0;
  for (let i = 0; i < 10; i++) {
    gio += 10_000;
    cd.hoi(() => { soLanMo++; });
  }
  assert.equal(soLanMo, 3, `mở ${soLanMo} lần, phải tối đa 3`);
});

test("tắt thì không hỏi nữa", () => {
  const cd = new ChanDialog({ gianCachMs: 0, soLanToiDa: 99 });
  let soLanMo = 0;
  cd.hoi(() => { soLanMo++; });
  cd.tat();
  for (let i = 0; i < 50; i++) cd.hoi(() => { soLanMo++; });
  assert.equal(soLanMo, 1);
});

test("hàm mở ném lỗi thì không kẹt cờ dangMo", () => {
  const cd = new ChanDialog({ gianCachMs: 0, soLanToiDa: 99 });
  const daMo = cd.hoi(() => { throw new Error("boom"); });
  assert.equal(daMo, true);
  assert.equal(cd.dangMo, false, "phải nhả cờ sau khi lỗi");
  assert.equal(cd.hoi(() => { }), true, "vẫn mở được lần sau");
});

test("datLai cho phép hỏi lại sau khi hết hạn mức", () => {
  let gio = 0;
  const cd = new ChanDialog({ gianCachMs: 0, soLanToiDa: 1, dongHo: () => gio });
  let soLanMo = 0;
  cd.hoi(() => { soLanMo++; });
  gio = 100;
  cd.hoi(() => { soLanMo++; });
  assert.equal(soLanMo, 1);
  cd.datLai();
  cd.hoi(() => { soLanMo++; });
  assert.equal(soLanMo, 2, "sau datLai phải hỏi được");
});

test("promise bị reject cũng nhả cờ", async () => {
  const cd = new ChanDialog({ gianCachMs: 0, soLanToiDa: 99 });
  cd.hoi(() => Promise.reject(new Error("no")));
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(cd.dangMo, false);
});
