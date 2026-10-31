// ═══════════════════════════════════════════════════════════════════════════
// Antigravitinho — Injector
//
// Sinh một đoạn script TỰ CHỨA để chèn thẳng vào DOM của cửa sổ Antigravity
// thật (qua CDP). Vì nằm trong chính trang AGY nên lớp phủ dính chặt cửa sổ:
// di chuyển, resize, thu nhỏ, chuyển tab đều theo — và tuyệt đối không đụng
// vào database, lịch sử hội thoại hay slash command của Antigravity.
//
// Lớp chèn gồm:
//   · canvas hình nền ASCII động (6 theme), blend "screen" để code vẫn rõ
//   · mascot chữ A sống động (đi lại, kéo thả, nhảy, ngủ)
//   · dock nhỏ tự hiện khi rê chuột vào góc dưới-phải
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const docFile = (ten) => readFileSync(join(__dirname, "renderer", ten), "utf-8");

// Bỏ import/export để gộp các module thành một IIFE duy nhất
const goModule = (src) =>
  src
    .replace(/^\s*import[^\n]*\n/gm, "")
    .replace(/^export\s+/gm, "");

/** Ảnh chữ A nhúng dạng data URI (một lần, dùng cho mascot). */
function anhMascot() {
  const p = join(__dirname, "..", "assets", "agy-a.png");
  try {
    return "data:image/png;base64," + readFileSync(p).toString("base64");
  } catch {
    return "";
  }
}

export const TEN_THEME = {
  lagoon: "🐢 Đầm Phá Hawaii",
  koi: "🎏 Hồ Cá Koi",
  galaxy: "🌌 Dải Ngân Hà",
  matrix: "💻 Ma Trận Code",
  fireplace: "🔥 Lò Sưởi Ấm",
  rain: "🌧️ Đêm Mưa",
};

/**
 * Trả về chuỗi JavaScript chèn được vào trang AGY.
 * @param {{chuDe?: string, doDam?: number, co?: number}} cauHinh
 */
export function taoMaInjection(cauHinh = {}) {
  // Chỉ nhận theme có trong danh sách — theme lạ rơi về lagoon.
  // Nhờ vậy chuỗi người dùng nhập không bao giờ đi thẳng vào mã chèn.
  const tenYeuCau = String(cauHinh.chuDe ?? "");
  const chuDe = JSON.stringify(TEN_THEME[tenYeuCau] ? tenYeuCau : "lagoon");

  // Kẹp tham số số: file thiết lập có thể bị sửa tay thành số vô lý.
  const so = (v, macDinh) => {
    const n = Number(v);
    return Number.isFinite(n) && n !== 0 ? n : macDinh;
  };
  const doDam = Math.min(0.95, Math.max(0.1, so(cauHinh.doDam, 0.55)));
  const coMascot = Math.min(400, Math.max(24, Math.round(so(cauHinh.co, 88))));

  const lagoon = goModule(docFile("lagoon-engine.js"));
  const themes = goModule(docFile("themes-engine.js"));
  const mascot = goModule(docFile("mascot-a.js"));
  const anh = anhMascot();

  return `(() => {
  const ID = "__antigravitinho";
  const CU = document.getElementById(ID);

  // Đã gắn rồi → chỉ cập nhật cấu hình, không dựng lại DOM
  if (CU && CU.__song) {
    try {
      CU.__doiChuDe(${chuDe});
      CU.__doiDam(${doDam});
      CU.__doiCo(${coMascot});
    } catch (e) { }
    return "da-co";
  }

  // Dọn SẠCH lớp cũ trước khi dựng mới. Bỏ bước này thì vòng lặp 24fps của
  // hình nền và 30fps của mascot vẫn chạy tiếp trên canvas đã tháo — gắn/gỡ
  // vài lần là CPU tăng gấp bội và cả Antigravity bị lag.
  for (const cu of [CU, window.__antigravitinhoBox]) {
    if (!cu) continue;
    try { cu.__huy?.(); } catch (e) { try { cu.remove?.(); } catch (err) { } }
  }
  document.getElementById(ID + "-css")?.remove();

  // ── CSS ────────────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.id = ID + "-css";
  style.textContent = \`
    #\${ID} {
      position: fixed; inset: 0; z-index: 2147483000;
      pointer-events: none;
      contain: layout style size;
    }
    #\${ID} canvas.sea {
      position: absolute; left: 50%; top: 50%;
      width: 1944px; height: 1760px;
      transform-origin: center center;
      opacity: ${doDam};
      mix-blend-mode: screen;
      pointer-events: none;
    }
    #\${ID} canvas.honu {
      position: absolute; left: 0; top: 0;
      width: 100%; height: 100%;
      pointer-events: none;
    }

    /* Khung bắt chuột bám theo mascot — chỉ vùng này nhận chuột */
    #\${ID} .hit {
      position: absolute; left: 0; top: 0;
      width: ${coMascot}px; height: ${coMascot}px;
      pointer-events: auto;
      cursor: grab;
      touch-action: none;
      will-change: transform;
    }
    #\${ID} .bubble {
      position: absolute; left: 0; top: 0; max-width: 250px;
      padding: 9px 13px; border-radius: 13px; border-bottom-right-radius: 3px;
      background: rgba(6,26,34,.95); color: #eafcff;
      border: 1px solid rgba(63,207,210,.55);
      font: 12.5px/1.45 system-ui, "Segoe UI", sans-serif;
      box-shadow: 0 10px 26px rgba(0,0,0,.5);
      opacity: 0; transform: translateY(6px); pointer-events: none;
      transition: opacity .2s ease, transform .2s ease;
      white-space: normal;
    }
    #\${ID} .bubble.show { opacity: 1; transform: translateY(0); }

    /* Dock: tự hiện khi rê chuột vào góc dưới-phải */
    #\${ID} .dock {
      position: absolute; right: 26px; bottom: 128px;
      display: flex; align-items: center; gap: 7px;
      padding: 7px 9px; border-radius: 13px;
      background: rgba(6,26,34,.95);
      border: 1px solid rgba(63,207,210,.5);
      box-shadow: 0 10px 26px rgba(0,0,0,.5);
      opacity: 0; transform: translateY(6px);
      transition: opacity .18s ease, transform .18s ease;
      pointer-events: none;
      font: 11.5px system-ui, "Segoe UI", sans-serif;
    }
    #\${ID} .dock.show { opacity: 1; transform: translateY(0); pointer-events: auto; }
    #\${ID} .dock select, #\${ID} .dock button {
      font: 11.5px system-ui, sans-serif; color: #cbf4fb;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(63,207,210,.35); border-radius: 8px;
      padding: 4px 7px; cursor: pointer; outline: none;
    }
    #\${ID} .dock option { background: #04222c; color: #eafcff; }
    #\${ID} .dock input[type=range] { width: 70px; accent-color: #3fcfd2; cursor: pointer; }
    #\${ID} .dock .lbl { color: #7fb4c2; font-size: 10.5px; }
    #\${ID} .dock button:hover, #\${ID} .dock select:hover { background: rgba(63,207,210,.22); }
  \`;
  document.head.appendChild(style);

  // ── Khung chứa ─────────────────────────────────────────────────────────
  const box = document.createElement("div");
  box.id = ID;
  box.innerHTML = \`
    <canvas class="sea" width="1944" height="1760"></canvas>
    <canvas class="honu"></canvas>
    <div class="hit"></div>
    <div class="bubble"></div>
    <div class="dock">
      <span class="lbl">Giao diện</span>
      <select class="theme">
        <option value="lagoon">${TEN_THEME.lagoon}</option>
        <option value="koi">${TEN_THEME.koi}</option>
        <option value="galaxy">${TEN_THEME.galaxy}</option>
        <option value="matrix">${TEN_THEME.matrix}</option>
        <option value="fireplace">${TEN_THEME.fireplace}</option>
        <option value="rain">${TEN_THEME.rain}</option>
      </select>
      <span class="lbl">Đậm</span>
      <input class="alpha" type="range" min="10" max="95" value="${Math.round(doDam * 100)}" />
      <button class="off" title="Gỡ lớp phủ khỏi Antigravity">✕</button>
    </div>
  \`;
  document.documentElement.appendChild(box);

  // ── Động cơ (dùng lại mã thật của app) ──────────────────────────────────
  ${lagoon}

  ${themes}

  ${mascot}

  const sea = box.querySelector("canvas.sea");
  const honu = box.querySelector("canvas.honu");
  const hit = box.querySelector(".hit");
  const bubble = box.querySelector(".bubble");
  const dock = box.querySelector(".dock");
  const selTheme = box.querySelector("select.theme");
  const inpAlpha = box.querySelector("input.alpha");

  // ── Sổ ghi listener cấp window ─────────────────────────────────────────
  // Listener gắn trên window KHÔNG tự chết khi tháo DOM. Không gỡ thì mỗi lần
  // gắn lại sẽ chồng thêm một lớp xử lý pointermove — vừa tốn CPU vừa rò rỉ.
  const boNghe = [];
  const nghe = (dich, loai, fn, tuyChon) => {
    dich.addEventListener(loai, fn, tuyChon);
    boNghe.push([dich, loai, fn, tuyChon]);
  };

  // ── Hình nền ASCII ─────────────────────────────────────────────────────
  const engine = new ThemesEngine(sea);
  engine.setCheDoPhu(true);
  engine.startBangInterval(24);
  engine.setTheme(${chuDe});

  const fit = () => {
    const s = Math.max(window.innerWidth / 1944, window.innerHeight / 1760);
    sea.style.transform = "translate(-50%, -50%) scale(" + s + ")";
  };
  fit();
  nghe(window, "resize", fit);

  // ── Mascot chữ A ───────────────────────────────────────────────────────
  const ANH = ${JSON.stringify(anh)};
  const mv = new MascotA(honu, bubble, { anh: ANH, co: ${coMascot}, le: 26, hitEl: hit });
  mv.batDauBangInterval(30);

  // ── Chuột: chỉ vùng mascot / dock mới bắt, còn lại xuyên xuống AGY ─────
  let dangKeoChuot = false;

  hit.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dangKeoChuot = true;
    mv.batDauKeo(e.clientX, e.clientY);
    try { hit.setPointerCapture(e.pointerId); } catch (err) { }
  });

  hit.addEventListener("pointermove", (e) => {
    if (!dangKeoChuot) return;
    e.preventDefault();
    mv.capNhatKeo(e.clientX, e.clientY);
  });

  const ketThucKeo = (e) => {
    if (!dangKeoChuot) return;
    dangKeoChuot = false;
    mv.thaRa();
    try { hit.releasePointerCapture(e.pointerId); } catch (err) { }
  };
  hit.addEventListener("pointerup", ketThucKeo);
  hit.addEventListener("pointercancel", ketThucKeo);
  hit.addEventListener("lostpointercapture", () => {
    if (dangKeoChuot) { dangKeoChuot = false; mv.thaRa(); }
  });

  // Một listener duy nhất lo cả hai việc: mắt nhìn theo chuột + dock tự hiện.
  // Gộp lại để mỗi lần di chuột chỉ tốn một lượt xử lý, không phải hai.
  const khiDiChuot = (e) => {
    mv.capNhatChuot(e.clientX, e.clientY);
    const gan = e.clientX > window.innerWidth - 340 && e.clientY > window.innerHeight - 240;
    dock.classList.toggle("show", gan);
  };
  nghe(window, "pointermove", khiDiChuot, { passive: true });

  // ── Huỷ: dừng MỌI thứ rồi mới tháo DOM ─────────────────────────────────
  // Đây là chỗ then chốt chống lag: engine.stop() và mv.dung() phải chạy
  // trước khi tháo canvas, nếu không vòng lặp vẫn tiếp tục vẽ vào canvas đã
  // rời khỏi DOM và mỗi lần gắn lại sẽ chồng thêm một bộ vòng lặp nữa.
  const huy = () => {
    if (box.__daHuy) return;
    box.__daHuy = true;
    box.__song = false;
    try { mv.dung(); } catch (e) { }
    try { engine.stop(); } catch (e) { }
    for (const [dich, loai, fn, tuyChon] of boNghe) {
      try { dich.removeEventListener(loai, fn, tuyChon); } catch (e) { }
    }
    boNghe.length = 0;
    box.remove();
    style.remove();
    if (window.__antigravitinhoBox === box) window.__antigravitinhoBox = null;
  };
  box.__huy = huy;

  // ── Điều khiển ─────────────────────────────────────────────────────────
  selTheme.value = ${chuDe};
  selTheme.addEventListener("change", (e) => {
    engine.setTheme(e.target.value);
    mv.noi("Đã đổi sang " + e.target.options[e.target.selectedIndex].text + " ✨", 2400);
  });

  inpAlpha.addEventListener("input", (e) => {
    const a = Number(e.target.value) / 100;
    sea.style.opacity = String(a);
  });

  box.querySelector("button.off").addEventListener("click", () => huy());

  // ── API nội bộ ─────────────────────────────────────────────────────────
  box.__song = true;
  box.__doiChuDe = (t) => { engine.setTheme(t); selTheme.value = t; };
  box.__doiDam = (d) => { sea.style.opacity = String(d); inpAlpha.value = String(Math.round(d * 100)); };
  box.__doiCo = (c) => {
    hit.style.width = c + "px";
    hit.style.height = c + "px";
    mv.co = c;
  };
  box.__mascot = mv;
  box.__engine = engine;          // tay nắm để kiểm tra / dọn dẹp
  window.__antigravitinhoBox = box;

  mv.noi("Xin chào! Tôi là chữ A của Antigravity 🐢", 4000);

  return "gan-xong";
})()`;
}
