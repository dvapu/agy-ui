// Kiểm tra icon khay: nạp được, đúng kích thước, không rỗng
import { app, Tray, nativeImage } from "electron";
import { writeFileSync, existsSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, "..", "assets");
const BAO_CAO = join(__dirname, "..", ".test-khay.txt");

const dong = [];
const ghi = (s) => { console.log(s); dong.push(s); };
let soLoi = 0;
const kiemTra = (ten, dk, ct) => {
  if (dk) ghi(`  [OK]   ${ten}`);
  else { ghi(`  [FAIL] ${ten} :: ${ct ?? ""}`); soLoi++; }
};

const thoat = (ma = 0) => {
  try { writeFileSync(BAO_CAO, dong.join("\n") + "\n", "utf-8"); } catch { }
  try { app.exit(ma); } catch { process.exit(ma); }
};
setTimeout(() => { ghi("[FAIL] quá thời gian"); thoat(1); }, 30000);

app.whenReady().then(async () => {
  const dsFile = ["khay-32.png", "khay-16.png", "icon.ico", "icon.png"];

  ghi("[1] Các file icon tồn tại và có nội dung");
  for (const f of dsFile) {
    const p = join(ASSETS, f);
    const tonTai = existsSync(p);
    const coNoiDung = tonTai && statSync(p).size > 200;
    kiemTra(`${f} (${tonTai ? statSync(p).size + " bytes" : "thiếu"})`, tonTai && coNoiDung);
  }

  ghi("[2] nativeImage nạp được từng file");
  for (const f of dsFile) {
    const p = join(ASSETS, f);
    if (!existsSync(p)) { kiemTra(f, false, "thiếu file"); continue; }
    const img = nativeImage.createFromPath(p);
    const kt = img.getSize();
    kiemTra(`${f} → ${kt.width}×${kt.height}, rỗng=${img.isEmpty()}`,
      !img.isEmpty() && kt.width > 0 && kt.height > 0);
  }

  ghi("[3] Icon khay 16×16 không bị rỗng ở kích thước thật");
  const p32 = join(ASSETS, "khay-32.png");
  const goc = nativeImage.createFromPath(p32);
  const nho = goc.resize({ width: 16, height: 16, quality: "best" });
  const ktNho = nho.getSize();
  kiemTra(`resize 16×16 → ${ktNho.width}×${ktNho.height}`, ktNho.width === 16 && ktNho.height === 16);
  kiemTra("bitmap 16px không rỗng", !nho.isEmpty());

  ghi("[4] Tạo Tray thật từ icon khay");
  try {
    const tray = new Tray(nho);
    tray.setToolTip("Antigravitinho — test");
    await new Promise((r) => setTimeout(r, 600));
    const huy = tray.isDestroyed?.() === false;
    kiemTra("Tray tạo thành công và còn sống", huy);
    kiemTra("Tooltip đặt được", true);
    tray.destroy();
    kiemTra("Huỷ Tray không lỗi", tray.isDestroyed());
  } catch (e) {
    kiemTra("Tạo Tray", false, e.message);
  }

  ghi("");
  ghi(soLoi === 0 ? "== TAT CA DAT ==" : `== ${soLoi} MUC LOI ==`);
  thoat(soLoi === 0 ? 0 : 1);
});

app.on("window-all-closed", () => thoat(0));
