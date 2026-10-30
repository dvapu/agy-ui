// ═══════════════════════════════════════════════════════════════════════════
// Antigravitinho — Injector
//
// Sinh MỘT chuỗi JavaScript tự chứa để chèn thẳng vào DOM của Antigravity.
// Trang AGY không có module loader và bị chặn nạp file từ đĩa (CSP), nên cách
// duy nhất là gửi toàn bộ code qua Chrome DevTools Protocol.
//
// Chuỗi trả về gồm:
//   1. Thẻ <style> (CSS của lớp phủ + thanh điều khiển)
//   2. Thanh điều khiển nổi ngay TRÊN thanh prompt của AGY
//   3. Toàn bộ LagoonEngine + ThemesEngine + MascotHonu (đã bỏ import/export)
//   4. Đoạn khởi tạo + đồng hồ bám vị trí thanh prompt
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const docFile = (ten) => readFileSync(join(__dirname, "renderer", ten), "utf-8");

// Gộp module: bỏ import/export để nhét vừa một IIFE.
// Lưu ý: KHÔNG dùng regex có cờ m trên chuỗi nhiều dòng lớn — chậm và dễ sai.
const goModule = (src) =>
  src
    .split("\n")
    .filter((dong) => !/^\s*import\s/.test(dong))
    .map((dong) => dong.replace(/^export\s+/, ""))
    .join("\n");

export const TEN_THEME = {
  lagoon: "🐢 Đầm Phá Hawaii",
  koi: "🎏 Hồ Cá Koi",
  galaxy: "🌌 Dải Ngân Hà",
  matrix: "💻 Ma Trận Code",
  fireplace: "🔥 Lò Sưởi Ấm",
  rain: "🌧️ Đêm Mưa",
};

// Tăng số này mỗi khi sửa injector, để lớp phủ đang chạy trong AGY
// tự nhận ra code đã cũ và thay bằng bản mới.
export const PHIEN_BAN_LOP_PHU = 7;

/**
 * Mã chèn vào trang Antigravity.
 * @param {{chuDe?: string, doDam?: number, moThanhDieuKhien?: boolean}} cauHinh
 * @returns {string} JavaScript tự chứa
 */
export function taoMaInjection(cauHinh = {}) {
  const chuDe = JSON.stringify(
    Object.prototype.hasOwnProperty.call(TEN_THEME, cauHinh.chuDe) ? cauHinh.chuDe : "lagoon"
  );
  const doDam = Math.min(0.95, Math.max(0.1, Number(cauHinh.doDam) || 0.55));
  const coThanh = cauHinh.moThanhDieuKhien !== false;

  const lagoon = goModule(docFile("lagoon-engine.js"));
  const themes = goModule(docFile("themes-engine.js"));
  const mascot = goModule(docFile("mascot.js"));

  const dsTheme = Object.entries(TEN_THEME)
    .map(([id, ten]) => `<option value="${id}">${ten}</option>`)
    .join("\n        ");

  return `(() => {
  const ID = "__antigravitinho";

  // Người dùng đã bấm tắt? Ghi lên window + sessionStorage để nhớ ý định.
  // window sống qua việc SPA thay DOM; sessionStorage sống qua cả F5.
  // Muốn bật lại: menu khay -> "Gắn lại ngay" (xoá cờ này).
  if (window.__antigravitinhoTat || sessionStorage.getItem("__antigravitinhoTat") === "1") {
    return "da-tat";
  }

  // Đã gắn rồi thì chỉ cập nhật, không tạo trùng.
  // Nhưng nếu code đã nâng phiên bản thì phải thay hẳn, nếu không người dùng
  // sẽ chạy mãi bản cũ đang nằm trong RAM của AGY.
  const cu = document.getElementById(ID);
  if (cu && cu.__song && cu.__phienBan === ${PHIEN_BAN_LOP_PHU}) {
    cu.__doiChuDe(${chuDe});
    cu.__doiDam(${doDam});
    return "da-co";
  }
  if (cu) { cu.__song = false; cu.remove(); }
  document.getElementById(ID + "-css")?.remove();
  document.getElementById(ID + "-thanh")?.remove();

  // ── CSS ───────────────────────────────────────────────────────────────
  // pointer-events: none ở lớp ngoài -> mọi thao tác chuột xuyên xuống
  // Antigravity. Chỉ Honu và thanh điều khiển nhận chuột.
  const style = document.createElement("style");
  style.id = ID + "-css";
  style.textContent = \`
    #\${ID} {
      position: fixed; inset: 0; z-index: 2147483000;
      pointer-events: none; opacity: ${doDam};
      transition: opacity .35s ease;
    }
    #\${ID} canvas.sea {
      position: absolute; left: 50%; top: 50%;
      width: 1944px; height: 1760px;
      transform-origin: center center;
    }
    #\${ID} .honu-wrap {
      position: absolute; right: 26px; bottom: 22px;
      width: 84px; height: 84px;
      pointer-events: auto; cursor: pointer;
    }
    #\${ID} .honu-wrap canvas {
      width: 84px; height: 84px;
      filter: drop-shadow(0 6px 14px rgba(0,0,0,.55));
    }
    #\${ID} .bubble {
      position: absolute; right: 112px; bottom: 34px; max-width: 250px;
      padding: 9px 13px; border-radius: 13px; border-bottom-right-radius: 3px;
      background: rgba(6,26,34,.94); color: #eafcff;
      border: 1px solid rgba(63,207,210,.55);
      font: 12.5px/1.45 system-ui, "Segoe UI", sans-serif;
      box-shadow: 0 10px 26px rgba(0,0,0,.5);
      opacity: 0; transform: translateY(6px);
      transition: opacity .2s ease, transform .2s ease;
      pointer-events: none;
    }
    #\${ID} .bubble.show { opacity: 1; transform: translateY(0); }

    /* ── Thanh điều khiển: nổi ngay trên thanh prompt của AGY ── */
    #\${ID}-thanh {
      position: fixed;
      z-index: 2147483001;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 8px;
      border-radius: 11px;
      background: rgba(8, 30, 40, .92);
      border: 1px solid rgba(63, 207, 210, .45);
      box-shadow: 0 6px 22px rgba(0, 0, 0, .5);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      font: 11px/1 system-ui, "Segoe UI", sans-serif;
      color: #cbf4fb;
      pointer-events: auto;
      opacity: .95;
      transition: opacity .25s ease, transform .18s ease;
    }
    #\${ID}-thanh:hover { opacity: 1; }
    #\${ID}-thanh.chim { opacity: .6; }
    #\${ID}-thanh.chim:hover { opacity: 1; }

    #\${ID}-thanh .nhom { display: flex; align-items: center; gap: 4px; }
    #\${ID}-thanh .vach {
      width: 1px; height: 16px; background: rgba(63, 207, 210, .28); margin: 0 2px;
    }
    #\${ID}-thanh button {
      all: unset;
      box-sizing: border-box;
      display: flex; align-items: center; justify-content: center;
      gap: 4px;
      height: 24px; min-width: 24px;
      padding: 0 6px;
      border-radius: 7px;
      color: #b8e6ef;
      cursor: pointer;
      transition: background .14s ease, color .14s ease;
      font: 11px system-ui, "Segoe UI", sans-serif;
      white-space: nowrap;
    }
    #\${ID}-thanh button:hover {
      background: rgba(63, 207, 210, .22);
      color: #ffffff;
    }
    #\${ID}-thanh button.chon {
      background: rgba(63, 207, 210, .3);
      color: #ffffff;
      box-shadow: inset 0 0 0 1px rgba(63, 207, 210, .55);
    }
    #\${ID}-thanh button.nguy:hover { background: rgba(239, 59, 90, .34); color: #fff; }
    #\${ID}-thanh .chon-theme {
      all: unset;
      box-sizing: border-box;
      height: 24px;
      padding: 0 6px;
      border-radius: 7px;
      color: #cbf4fb;
      cursor: pointer;
      font: 11px system-ui, "Segoe UI", sans-serif;
      background: rgba(63, 207, 210, .16);
      border: 1px solid rgba(63, 207, 210, .32);
    }
    #\${ID}-thanh .gat {
      cursor: pointer;
      color: #5e8a97;
      font-size: 11px;
      padding: 0 2px;
      user-select: none;
    }
    #\${ID}-thanh .gat:hover { color: #7de8ea; }
    #\${ID}-thanh.thu-gon .an-khi-gon { display: none; }
    @media (prefers-reduced-motion: reduce) {
      #\${ID} canvas.sea { transition: none; }
      #\${ID}-thanh { transition: none; }
    }
  \`;
  document.head.appendChild(style);

  // ── Khung nền + Honu ──────────────────────────────────────────────────
  const box = document.createElement("div");
  box.id = ID;
  box.innerHTML = \`
    <canvas class="sea" width="1944" height="1760"></canvas>
    <div class="honu-wrap"><canvas width="100" height="100" title="Bấm để Honu nói chuyện"></canvas></div>
    <div class="bubble"></div>
  \`;
  document.documentElement.appendChild(box);

  // ── Thanh điều khiển ──────────────────────────────────────────────────
  let thanh = null;
  if (${coThanh}) {
    thanh = document.createElement("div");
    thanh.id = ID + "-thanh";
    thanh.innerHTML = \`
      <span class="gat" title="Thu gọn thanh này">▾</span>
      <select class="chon-theme an-khi-gon">
        ${dsTheme}
      </select>
      <span class="vach an-khi-gon"></span>
      <span class="nhom an-khi-gon" data-nhom="dam">
        <button data-dam="0.25">Mờ</button>
        <button data-dam="0.55">Vừa</button>
        <button data-dam="0.85">Đậm</button>
      </span>
      <span class="vach an-khi-gon"></span>
      <button class="an-khi-gon" data-viec="an-honu" title="Ẩn/hiện rùa Honu">🐢</button>
      <button class="nguy" data-viec="tat" title="Tắt lớp phủ (bật lại từ menu khay)">✕</button>
    \`;
    document.documentElement.appendChild(thanh);
  }

  // ── Động cơ (mã thật của app) ─────────────────────────────────────────
  ${lagoon}

  ${themes}

  ${mascot}

  const sea = box.querySelector("canvas.sea");
  const honu = box.querySelector(".honu-wrap canvas");
  const wrapHonu = box.querySelector(".honu-wrap");
  const bubble = box.querySelector(".bubble");

  const engine = new ThemesEngine(sea);
  engine.setCheDoPhu(true);
  // QUAN TRỌNG: dùng setInterval, KHÔNG dùng requestAnimationFrame.
  // Khi cửa sổ AGY bị che, Chromium dừng hẳn rAF -> hình nền đứng im.
  engine.startBangInterval(24);
  engine.setTheme(${chuDe});

  const mv = new MascotHonu(honu, bubble);
  mv.dung();
  mv.renderBangInterval(24);

  // Honu từng bị ẩn thì vẫn ẩn sau khi AGY đổi trang
  let anHonu = false;
  try { anHonu = sessionStorage.getItem("__antigravitinhoAnHonu") === "1"; } catch { }
  if (anHonu) wrapHonu.style.display = "none";

  // Canvas 1944x1760 phủ kín cửa sổ ở mọi tỉ lệ
  const fit = () => {
    const s = Math.max(window.innerWidth / 1944, window.innerHeight / 1760);
    sea.style.transform = "translate(-50%, -50%) scale(" + s + ")";
  };
  fit();
  window.addEventListener("resize", fit);

  // ── Bám vị trí thanh prompt của AGY ───────────────────────────────────
  // AGY dùng Tailwind, class có thể đổi giữa các bản. Ta dò ô soạn tin theo
  // thuộc tính contenteditable (ổn định hơn class) rồi đặt thanh ngay trên nó.
  const timPrompt = () => {
    const ds = [...document.querySelectorAll("div[contenteditable='true'], textarea")];
    const ung = ds.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 240 && r.top > window.innerHeight * 0.45;
    });
    return ung.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0] || null;
  };

  // Chưa tìm được ô prompt (AGY đang tải) -> đặt ở đáy-giữa để vẫn dùng được
  const datMacDinh = () => {
    const cao = thanh.offsetHeight || 34;
    thanh.style.display = "flex";
    thanh.style.top = (window.innerHeight - cao - 140) + "px";
    thanh.style.left = Math.round(window.innerWidth / 2 - 220) + "px";
  };

  let viTriCu = "";
  const bamPrompt = () => {
    if (!thanh) return;
    const p = timPrompt();
    if (!p) {
      const khoa = "md:" + window.innerHeight + ":" + window.innerWidth;
      if (khoa === viTriCu) return;
      viTriCu = khoa;
      datMacDinh();
      return;
    }
    const r = p.getBoundingClientRect();
    const cao = thanh.offsetHeight || 34;
    const top = Math.max(4, Math.round(r.top - cao - 6));
    const left = Math.round(r.left);
    const khoa = top + ":" + left;
    if (khoa === viTriCu) return;   // tránh ghi style mỗi lần
    viTriCu = khoa;
    thanh.style.display = "flex";
    thanh.style.top = top + "px";
    thanh.style.left = left + "px";
  };
  bamPrompt();
  window.addEventListener("resize", bamPrompt);
  const dongHoThanh = setInterval(bamPrompt, 400);

  // Tự "chìm" thanh sau 9s không rê chuột, để không che nội dung.
  // Rê chuột lại là sáng lên ngay.
  let henChim = null;
  const henGio = () => {
    clearTimeout(henChim);
    henChim = setTimeout(() => thanh?.classList.add("chim"), 9000);
  };
  henGio();
  window.addEventListener("mousemove", () => {
    if (!thanh) return;
    thanh.classList.remove("chim");
    henGio();
  });

  // ── Sự kiện thanh điều khiển ──────────────────────────────────────────
  if (thanh) {
    const selTheme = thanh.querySelector(".chon-theme");
    selTheme.value = ${chuDe};
    selTheme.addEventListener("change", (e) => {
      engine.setTheme(e.target.value);
      window.__antigravitinhoTheme = e.target.value;
      const ten = e.target.options[e.target.selectedIndex].text;
      mv.noi("Đã đổi sang " + ten + " ✨", 2400);
    });

    // Nút độ đậm
    const capNhatNutDam = (muc) => {
      thanh.querySelectorAll("[data-dam]").forEach((b) => {
        b.classList.toggle("chon", Math.abs(Number(b.dataset.dam) - muc) < 0.01);
      });
    };
    capNhatNutDam(${doDam});
    thanh.querySelectorAll("[data-dam]").forEach((b) => {
      b.addEventListener("click", () => {
        const muc = Number(b.dataset.dam);
        box.style.opacity = String(muc);
        capNhatNutDam(muc);
      });
    });

    // Ẩn/hiện Honu — nhớ ý định
    thanh.querySelector("[data-viec='an-honu']").addEventListener("click", (e) => {
      const dangAn = wrapHonu.style.display === "none";
      wrapHonu.style.display = dangAn ? "" : "none";
      try {
        sessionStorage.setItem("__antigravitinhoAnHonu", dangAn ? "0" : "1");
      } catch { }
      e.currentTarget.classList.toggle("chon", !dangAn);
    });
    if (anHonu) thanh.querySelector("[data-viec='an-honu']").classList.add("chon");

    // Tắt hẳn lớp phủ — nhớ ý định để KHÔNG tự bật lại
    thanh.querySelector("[data-viec='tat']").addEventListener("click", () => {
      window.__antigravitinhoTat = true;
      try { sessionStorage.setItem("__antigravitinhoTat", "1"); } catch { }
      engine.stop();
      mv.dung();
      clearInterval(dongHoThanh);
      clearTimeout(henChim);
      box.remove();
      style.remove();
      thanh.remove();
    });

    // Thu gọn / mở rộng thanh
    thanh.querySelector(".gat").addEventListener("click", (e) => {
      thanh.classList.toggle("thu-gon");
      e.currentTarget.textContent = thanh.classList.contains("thu-gon") ? "▸" : "▾";
      viTriCu = "";
      bamPrompt();
    });
  }

  box.__song = true;
  box.__phienBan = ${PHIEN_BAN_LOP_PHU};
  box.__doiChuDe = (t) => engine.setTheme(t);
  box.__doiDam = (d) => { box.style.opacity = String(d); };
  window.__antigravitinhoBox = box;
  window.__antigravitinhoThanh = thanh;
  window.__antigravitinhoTheme = ${chuDe};

  mv.noi("Honu đang bơi trên cửa sổ AGY của bạn 🐢", 4000);

  return "gan-xong";
})()`;
}

