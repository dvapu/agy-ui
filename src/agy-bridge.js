// ═══════════════════════════════════════════════════════════════════════════
// Antigravitinho — Cầu CDP tới Antigravity thật
// AGY bật DevTools protocol ở cổng nội bộ (DevToolsActivePort). Ta nói chuyện
// với nó để chèn / gỡ lớp phủ NGAY TRONG cửa sổ AGY, nên lớp phủ dính chặt
// cửa sổ: di chuyển, resize, thu nhỏ đều theo — và không đụng vào DB.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash, randomBytes } from "crypto";
import { connect } from "net";

const DUONG_DAN_DEVTOOLS = join(
  process.env.APPDATA || "",
  "Antigravity",
  "DevToolsActivePort"
);

// ─── Đọc cổng debug của AGY ────────────────────────────────────────────────
export function docCongDebug() {
  if (!existsSync(DUONG_DAN_DEVTOOLS)) return null;
  try {
    const [port] = readFileSync(DUONG_DAN_DEVTOOLS, "utf-8").trim().split(/\r?\n/);
    const n = Number(port);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}

// ─── WebSocket tối giản (không thêm dependency) ────────────────────────────
class WsToiThieu {
  constructor(socket) {
    this.socket = socket;
    this.dem = Buffer.alloc(0);
    this.dong = false;
    this.hangCho = [];
    this.xuLy = null;
    socket.on("data", (d) => this.nhan(d));
    socket.on("close", () => { this.dong = true; this.hangCho.length = 0; });
    socket.on("error", () => { this.dong = true; });
  }

  static async mo(host, port, duongDan, timeoutMs = 4000) {
    const socket = connect({ host, port });
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("Hết giờ kết nối CDP")), timeoutMs);
      socket.once("connect", () => { clearTimeout(t); res(); });
      socket.once("error", (e) => { clearTimeout(t); rej(e); });
    });

    const key = randomBytes(16).toString("base64");
    socket.write(
      `GET ${duongDan} HTTP/1.1\r\n` +
      `Host: ${host}:${port}\r\n` +
      `Upgrade: websocket\r\n` +
      `Connection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${key}\r\n` +
      `Sec-WebSocket-Version: 13\r\n\r\n`
    );

    // Đọc hết header HTTP 101
    let head = Buffer.alloc(0);
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("Hết giờ bắt tay WebSocket")), timeoutMs);
      const onData = (d) => {
        head = Buffer.concat([head, d]);
        const i = head.indexOf("\r\n\r\n");
        if (i === -1) return;
        clearTimeout(t);
        socket.removeListener("data", onData);
        if (!head.slice(0, i).toString("latin1").includes("101")) {
          rej(new Error("CDP từ chối nâng cấp WebSocket"));
          return;
        }
        const con = head.slice(i + 4);
        if (con.length) socket.emit("data", con);
        res();
      };
      socket.on("data", onData);
      socket.once("error", (e) => { clearTimeout(t); rej(e); });
    });

    return new WsToiThieu(socket);
  }

  nhan(d) {
    this.dem = Buffer.concat([this.dem, d]);
    for (;;) {
      const b = this.dem;
      if (b.length < 2) return;
      const opcode = b[0] & 0x0f;
      const coMask = !!(b[1] & 0x80);
      let len = b[1] & 0x7f;
      let off = 2;

      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }

      let mask = null;
      if (coMask) { if (b.length < off + 4) return; mask = b.slice(off, off + 4); off += 4; }
      if (b.length < off + len) return;

      let payload = b.slice(off, off + len);
      if (mask) {
        const out = Buffer.allocUnsafe(len);
        for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i % 4];
        payload = out;
      }
      this.dem = b.slice(off + len);

      if (opcode === 0x1) this.xuLy?.(payload.toString("utf-8"));
      else if (opcode === 0x8) { this.dong = true; this.socket.end(); return; }
      else if (opcode === 0x9) this.khung(0xa, payload);
    }
  }

  khung(opcode, data) {
    if (this.dong) return;
    const len = data.length;
    let head;
    if (len < 126) {
      head = Buffer.alloc(2 + 4);
      head[0] = 0x80 | opcode;
      head[1] = 0x80 | len;
      head.writeUInt32BE(0x7f3a91c5, 2);
    } else if (len < 65536) {
      head = Buffer.alloc(4 + 4);
      head[0] = 0x80 | opcode;
      head[1] = 0x80 | 126;
      head.writeUInt16BE(len, 2);
      head.writeUInt32BE(0x7f3a91c5, 4);
    } else {
      head = Buffer.alloc(10 + 4);
      head[0] = 0x80 | opcode;
      head[1] = 0x80 | 127;
      head.writeBigUInt64BE(BigInt(len), 2);
      head.writeUInt32BE(0x7f3a91c5, 10);
    }
    const mask = head.slice(head.length - 4);
    const body = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) body[i] = data[i] ^ mask[i % 4];
    this.socket.write(Buffer.concat([head, body]));
  }

  gui(text) { this.khung(0x1, Buffer.from(text, "utf-8")); }
  dongLai() { try { this.khung(0x8, Buffer.alloc(0)); this.socket.end(); } catch { } this.dong = true; }
}

// ─── Phiên CDP ─────────────────────────────────────────────────────────────
class PhienCdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.cho = new Map();
    ws.xuLy = (txt) => {
      let msg;
      try { msg = JSON.parse(txt); } catch { return; }
      if (msg.id && this.cho.has(msg.id)) {
        const { res, rej, timer } = this.cho.get(msg.id);
        clearTimeout(timer);
        this.cho.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message || "CDP lỗi"));
        else res(msg.result);
      }
    };
  }

  gui(method, params = {}, timeoutMs = 15000) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      const timer = setTimeout(() => {
        this.cho.delete(id);
        rej(new Error(`CDP ${method} quá thời gian`));
      }, timeoutMs);
      this.cho.set(id, { res, rej, timer });
      this.ws.gui(JSON.stringify({ id, method, params }));
    });
  }

  dong() { this.ws.dongLai(); }
}

// ─── Lấy danh sách target HTTP ─────────────────────────────────────────────
async function layDanhSachTarget(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`CDP HTTP ${res.status}`);
  return res.json();
}

function laTrangAgy(t) {
  return t.type === "page" && typeof t.url === "string" && t.url.startsWith("https://127.0.0.1:");
}

/**
 * Mở phiên CDP tới cửa sổ Antigravity thật.
 * @returns {Promise<{phien: PhienCdp, target: object} | null>}
 */
export async function moPhienAgy() {
  const port = docCongDebug();
  if (!port) return null;
  try {
    const ds = await layDanhSachTarget(port);
    const target = ds.find(laTrangAgy);
    if (!target?.webSocketDebuggerUrl) return null;

    const u = new URL(target.webSocketDebuggerUrl);
    const ws = await WsToiThieu.mo(u.hostname, Number(u.port), u.pathname + u.search);
    return { phien: new PhienCdp(ws), target };
  } catch { return null; }
}

/** Chèn lớp phủ vào AGY. Trả về true nếu thành công. */
export async function ganVaoAgy(ma) {
  const phien = await moPhienAgy();
  if (!phien) return { ok: false, loi: "Không kết nối được Antigravity (chưa bật hoặc chưa mở)" };
  try {
    const r = await phien.phien.gui("Runtime.evaluate", {
      expression: ma,
      awaitPromise: true,
      returnByValue: true,
    });
    phien.phien.dong();
    if (r?.exceptionDetails) {
      return { ok: false, loi: r.exceptionDetails.exception?.description || "Lỗi thực thi" };
    }
    return { ok: true, ketQua: r?.result?.value };
  } catch (e) {
    phien.phien.dong();
    return { ok: false, loi: e.message };
  }
}

/** Gỡ lớp phủ khỏi AGY (không đặt cờ "đã tắt" — lần sau vẫn gắn lại được). */
export async function goKhoiAgy() {
  const ma = `(() => {
    const el = document.getElementById("__antigravitinho");
    if (el) { el.__song = false; el.remove(); }
    document.getElementById("__antigravitinho-css")?.remove();
    document.getElementById("__antigravitinho-thanh")?.remove();
    return "da-go";
  })()`;
  const r = await ganVaoAgy(ma);
  return r.ok;
}

/** Xoá cờ "người dùng đã tắt" để lần gắn sau không bị chặn. */
export async function xoaCoTat() {
  const ma = `(() => {
    delete window.__antigravitinhoTat;
    try { sessionStorage.removeItem("__antigravitinhoTat"); } catch { }
    return "da-xoa-co";
  })()`;
  const r = await ganVaoAgy(ma);
  return r.ok;
}

/**
 * Trạng thái lớp phủ trong AGY.
 * Trả về { co, tat, ketNoi, phienBan }
 *   co       — lớp phủ đang có trong DOM
 *   tat      — người dùng đã chủ động tắt (đừng tự chèn lại)
 *   phienBan — số phiên bản code đang chạy trong AGY (0 = không rõ)
 */
export async function trangThaiLopPhu() {
  const ma = `(() => {
    const el = document.getElementById("__antigravitinho");
    const co = !!(el && el.__song);
    let tat = !!window.__antigravitinhoTat;
    try { if (sessionStorage.getItem("__antigravitinhoTat") === "1") tat = true; } catch { }
    return JSON.stringify({ co, tat, pb: (el && el.__phienBan) || 0 });
  })()`;
  const r = await ganVaoAgy(ma);
  if (!r.ok) return { co: false, tat: false, ketNoi: false, phienBan: 0 };
  try {
    const d = JSON.parse(r.ketQua);
    return { co: !!d.co, tat: !!d.tat, ketNoi: true, phienBan: Number(d.pb) || 0 };
  } catch {
    return { co: false, tat: false, ketNoi: true, phienBan: 0 };
  }
}

/** Kiểm tra lớp phủ còn tồn tại trong DOM của AGY không. */
export async function dangCoLopPhu() {
  const tt = await trangThaiLopPhu();
  return tt.co;
}
