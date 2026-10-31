# ═══════════════════════════════════════════════════════════════════════════
#  Tạo shortcut Antigravitinho ngoài Desktop + Start Menu
#
#  Shortcut trỏ thẳng tới electron.exe với tham số là thư mục app.
#  Chạy thẳng electron.exe (không qua .bat) nên KHÔNG nháy cửa sổ đen.
#
#  Chạy:  powershell -ExecutionPolicy Bypass -File tools\tao-shortcut.ps1
#  Gỡ:    powershell -ExecutionPolicy Bypass -File tools\tao-shortcut.ps1 -Go
# ═══════════════════════════════════════════════════════════════════════════

[CmdletBinding()]
param(
  [switch]$Go,                       # gỡ shortcut
  [switch]$KhoiDongCung,             # thêm shortcut vào Startup (chạy cùng Windows)
  [string]$Ten = "Antigravitinho"
)

$ErrorActionPreference = "Stop"

$goc   = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$exe   = Join-Path $goc "node_modules\electron\dist\electron.exe"
$icon  = Join-Path $goc "assets\icon.ico"
$vbs   = Join-Path $goc "Antigravitinho.vbs"

if (-not (Test-Path $exe)) {
  Write-Host "[LOI] Khong tim thay: $exe" -ForegroundColor Red
  Write-Host "      Chay 'npm install' trong $goc truoc." -ForegroundColor Yellow
  exit 1
}

$desktop   = [Environment]::GetFolderPath("Desktop")
$startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "$Ten.lnk"
$startup   = Join-Path ([Environment]::GetFolderPath("Startup")) "$Ten.lnk"

$mucTieu = @(
  (Join-Path $desktop "$Ten.lnk"),
  $startMenu
)
if ($KhoiDongCung) { $mucTieu += $startup }

$shell = New-Object -ComObject WScript.Shell

if ($Go) {
  foreach ($p in $mucTieu) {
    if (Test-Path $p) { Remove-Item $p -Force; Write-Host "  da go: $p" }
  }
  Write-Host "Xong." -ForegroundColor Green
  exit 0
}

foreach ($p in $mucTieu) {
  $sc = $shell.CreateShortcut($p)
  $sc.TargetPath       = $exe
  $sc.Arguments        = '"' + $goc + '"'
  $sc.WorkingDirectory = $goc
  $sc.IconLocation     = "$icon,0"
  $sc.Description      = "Lop phu Antigravity - hinh nen ASCII + mascot chu A"
  $sc.WindowStyle      = 1
  $sc.Save()
  Write-Host "  da tao: $p" -ForegroundColor Green
}

Write-Host ""
Write-Host "Xong. Bam shortcut '$Ten' ngoai Desktop de chay." -ForegroundColor Cyan
Write-Host "App nam duoi khay he thong, bam icon khay de gan/go lop phu."
