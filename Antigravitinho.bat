@echo off
chcp 65001 >nul
setlocal

rem ═══════════════════════════════════════════════════════════════════════════
rem  Antigravitinho — khởi chạy lớp phủ cho Antigravity
rem
rem  Chạy file này (hoặc bấm shortcut ngoài Desktop) là app nằm xuống khay.
rem  Không có cửa sổ chat riêng. Bấm icon khay để gắn/gỡ lớp phủ.
rem ═══════════════════════════════════════════════════════════════════════════

cd /d "%~dp0"

set "EXE=%~dp0node_modules\electron\dist\electron.exe"

if not exist "%EXE%" (
  echo.
  echo   [LỖI] Không tìm thấy Electron tại:
  echo         %EXE%
  echo.
  echo   Thiếu thư mục node_modules. Cách sửa:
  echo     cd /d "%~dp0"
  echo     npm install
  echo.
  pause
  exit /b 1
)

rem Đã có instance đang chạy thì Electron tự thoát (single-instance lock).
start "" "%EXE%" "%~dp0."

exit /b 0
