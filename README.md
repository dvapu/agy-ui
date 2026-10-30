# Antigravitinho

**Live ASCII wallpaper + Honu mascot, injected straight into the real Antigravity window.**
**Hình nền ASCII sống động + linh vật rùa Honu, chèn thẳng vào cửa sổ Antigravity thật.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-45-47848F?logo=electron)](https://www.electronjs.org/)
[![Windows](https://img.shields.io/badge/Windows-10%2F11-0078D4?logo=windows)](https://www.microsoft.com/windows)
[![Tests](https://img.shields.io/badge/tests-6%20passing-brightgreen)](test)

---

## What this is / Đây là gì

A tiny tray app that draws an animated ASCII landscape **inside** your
Antigravity window. No second chat app. No database access. Antigravity stays
Antigravity — your conversations, `/code`, agents and MCP servers keep working.

Một app tray nhỏ, vẽ phong cảnh ASCII động **bên trong** cửa sổ Antigravity.
Không có app chat thứ hai. Không đụng database. Antigravity vẫn là Antigravity —
hội thoại, `/code`, agent và MCP của bạn chạy y như cũ.

```
┌─────────────────────────────────────────────┐
│  Antigravity (unchanged, still fully usable)│
│  ┌───────────────────────────────────────┐  │
│  │  ← injected layer: ASCII art + Honu   │  │
│  │    (pointer-events: none)             │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
             ▲
             │ Chrome DevTools Protocol
             │ (Runtime.evaluate only)
        ┌────┴────────────────┐
        │  Antigravitinho     │  ← tray app, no window
        └─────────────────────┘
```

---

## Why not just an always-on-top window? / Sao không phủ cửa sổ nổi?

Because it lies. An always-on-top transparent window drifts out of alignment
the moment you move or resize Antigravity, and it dims the text behind it.

**This app injects DOM into Antigravity itself.** The layer is a child of AGY's
page, so it moves, resizes and minimises together with the window. Zero drift.

Bởi vì nó nói dối. Cửa sổ trong suốt luôn trên cùng sẽ lệch ngay khi bạn di
chuyển hay resize Antigravity, và nó làm tối chữ phía sau.

**App này chèn DOM vào chính Antigravity.** Lớp phủ là con của trang AGY, nên
nó di chuyển, resize, thu nhỏ cùng cửa sổ. Không bao giờ lệch.

---

## Install / Cài đặt

```powershell
git clone https://github.com/dvapu/agy-ui
cd agy-ui
npm install
npm start
```

`npm start` opens **no window**. Only a tray icon. Right-click it → **Gắn lại ngay**.

`npm start` **không mở cửa sổ nào**. Chỉ có icon ở khay. Chuột phải → **Gắn lại ngay**.

### Build installer / Đóng gói

```powershell
npm run dist
# -> dist/Antigravitinho-Setup.exe
```

---

## Themes / Giao diện

Six animated ASCII scenes. Each is drawn as vector art, then **quantised into a
character grid** — that's where the texture comes from.

Sáu cảnh ASCII động. Mỗi cảnh vẽ bằng vector rồi **lượng tử hoá thành lưới ký
tự** — đó là nguồn gốc của chất liệu.

| | Theme | Description / Mô tả |
|---|---|---|
| 🐢 | `lagoon` | Hawaiian lagoon — sea turtles, manta rays, dolphins, whales, hibiscus |
| 🎏 | `koi` | Japanese koi pond — lotus leaves, blossoms, drifting petals |
| 🌌 | `galaxy` | Spiral galaxy — two arms, three star layers, meteors |
| 💻 | `matrix` | Digital rain — katakana + hex, glowing heads |
| 🔥 | `fireplace` | Cozy hearth — separated flame tongues, embers, smoke |
| 🌧️ | `rain` | Cyber city at night — skyline, neon, water ripples |

Switch from the tray menu, or from the control bar that floats above
Antigravity's prompt box.

Đổi từ menu khay, hoặc từ thanh điều khiển nổi ngay trên ô prompt của Antigravity.

---

## Control bar / Thanh điều khiển

A slim bar sits right above Antigravity's prompt input:

Một thanh mảnh nằm ngay trên ô soạn tin của Antigravity:

```
[▾] [🐢 Đầm Phá Hawaii ▾] │ [Mờ][Vừa][Đậm] │ [🐢] [✕]
```

| Control | Action |
|---|---|
| `▾` | Collapse / expand the bar |
| Theme select | Switch scene instantly |
| Mờ / Vừa / Đậm | Opacity: 25% / 55% / 85% |
| 🐢 | Hide / show the mascot |
| ✕ | Turn the layer off — **stays off** until you re-enable from the tray |

**The ✕ is respected.** The watcher distinguishes "Antigravity wiped the DOM
because you changed conversation" from "the user turned it off". It records
intent in `window.__antigravitinhoTat` + `sessionStorage`, so it will not
fight you.

**Nút ✕ được tôn trọng.** Bộ theo dõi phân biệt "Antigravity xoá DOM do đổi
hội thoại" với "người dùng chủ động tắt". Ý định được ghi vào
`window.__antigravitinhoTat` + `sessionStorage`, nên nó không bật lại sau lưng bạn.

---

## How it works / Cách hoạt động

1. Read `%APPDATA%\Antigravity\DevToolsActivePort` → get the debug port.
2. `GET http://127.0.0.1:<port>/json/list` → find the AGY page target.
3. Hand-rolled WebSocket (no dependencies) → send one `Runtime.evaluate`.
4. The payload is a self-contained IIFE containing the whole render engine.
5. A 1.5 s watcher re-injects if AGY wiped the DOM.

Details: [`docs/KIEN-TRUC.md`](docs/KIEN-TRUC.md)

### One technical trap worth knowing / Một cái bẫy kỹ thuật

**`requestAnimationFrame` stops completely when the window is occluded.**
Measured on this machine: `rAF` = 0 ticks in 1.6 s, `setInterval` = 2 ticks.
If you use rAF, the wallpaper freezes the moment another window covers
Antigravity. This project uses `setInterval` for the injected layer — do not
"optimise" it back.

**`requestAnimationFrame` dừng hẳn khi cửa sổ bị che.** Đo thực tế: `rAF` = 0
tick trong 1.6 giây, `setInterval` = 2 tick. Dùng rAF là hình nền đứng im ngay
khi có cửa sổ khác che Antigravity. Dự án này dùng `setInterval` cho lớp phủ
đã chèn — đừng "tối ưu" ngược lại.

---

## Does an Antigravity update break it? / Antigravity cập nhật có hỏng không?

Mostly no. This app patches **nothing** — it reads one text file and writes to
RAM. If AGY keeps its debug port open (it does, it's Electron), everything keeps
working across updates.

Phần lớn là không. App này **không patch gì cả** — nó đọc 1 file text và ghi
vào RAM. Miễn AGY còn mở cổng debug (có, vì nó là Electron), mọi thứ vẫn chạy
qua các b��n cập nhật.

| Scenario | Result |
|---|---|
| AGY updates, port still open | ✅ Works, self-heals in 1.5 s |
| AGY redesigns its UI | ⚠️ Layer still shows, control bar may need repositioning |
| AGY disables the debug port | ❌ Stops. See [`docs/CAP-NHAT-AGY.md`](docs/CAP-NHAT-AGY.md) |

**Never affected / Không bao giờ bị ảnh hưởng:** conversations, `/code`,
agents, MCP servers, settings, `app.asar`.

Full checklist: [`docs/CAP-NHAT-AGY.md`](docs/CAP-NHAT-AGY.md)

---

## Development / Phát triển

```powershell
npm start                # tray app
npm test                 # 6 tests: syntax, contracts, injection safety
npm run check            # syntax only
npm run do-cong          # diagnose: is AGY running? is the layer attached?
npx electron tools/render-themes.js   # render all 6 themes to dist-anh/*.png
```

### Project layout

```
src/
├── main.js              # tray app: menu, watcher, settings
├── agy-bridge.js        # hand-rolled CDP + WebSocket (no deps)
├── injector.js          # builds the self-contained injection payload
└── renderer/
    ├── themes-engine.js # 6 themes + vector→ASCII quantiser
    ├── lagoon-engine.js # the original lagoon scene (24.5 s cycle)
    └── mascot.js        # Honu: eyes follow cursor, blinks, speaks
tools/
├── render-themes.js     # render themes to PNG for visual review
└── kiem-tra-cong.js     # connectivity / attachment diagnosis
test/
└── syntax.test.js       # contract & safety tests
docs/
├── KIEN-TRUC.md         # architecture in depth
├── CAU-HINH.md          # step-by-step configuration
├── CAP-NHAT-AGY.md      # what happens after an AGY update
├── API-IPC.md           # IPC contract (legacy window mode)
└── TASKS.md             # TODO list with self-contained instructions
```

---

## Contributing for AI agents / Dành cho AI agent

Read **[`AGENTS.md`](AGENTS.md)** first. It contains hard rules — most
importantly: **never touch Antigravity's database**. Then work through
[`docs/TASKS.md`](docs/TASKS.md) in order.

Đọc **[`AGENTS.md`](AGENTS.md)** trước. Trong đó có quy tắc cứng — quan trọng
nhất: **không bao giờ chạm database của Antigravity**. Sau đó làm theo
[`docs/TASKS.md`](docs/TASKS.md) đúng thứ tự.

---

## Credits / Ghi công

- Inspired by [**Claudinho**](https://github.com/Lu1sR0/claudinho) by
  [Luis Roberto](https://luisrobertoportifolio.com) — the idea of putting live
  ASCII art beside an AI coding agent, and the Honu Lagoon scene.
- Lagoon scene ported from that project's ASCII wallpaper engine.
- This project is an independent fan work. Not affiliated with or endorsed by
  Google. Antigravity is a Google product.

---

## License

MIT — see [LICENSE](LICENSE).
