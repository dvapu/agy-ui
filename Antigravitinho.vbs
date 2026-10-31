' ═══════════════════════════════════════════════════════════════════════════
'  Antigravitinho — launcher không cửa sổ
'
'  WScript chạy Electron ở chế độ ẩn (window style 0) nên không nháy cửa sổ
'  đen như file .bat. Shortcut ngoài Desktop trỏ tới file này.
' ═══════════════════════════════════════════════════════════════════════════

Option Explicit

Dim fso, sh, thuMuc, exe, logFile

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

thuMuc = fso.GetParentFolderName(WScript.ScriptFullName)
exe = thuMuc & "\node_modules\electron\dist\electron.exe"

' Chuỗi trong VBScript được đọc theo bảng mã ANSI của Windows, nên để ASCII
' thuần ở đây — tránh bị lỗi dấu khi file lưu bằng UTF-8.
If Not fso.FileExists(exe) Then
  MsgBox "Khong tim thay Electron:" & vbCrLf & exe & vbCrLf & vbCrLf & _
         "Thieu thu muc node_modules. Chay: npm install", _
         vbCritical, "Antigravitinho"
  WScript.Quit 1
End If

sh.CurrentDirectory = thuMuc

' 0 = ẩn cửa sổ, False = không chờ tiến trình con kết thúc
On Error Resume Next
sh.Run """" & exe & """ """ & thuMuc & """", 0, False

If Err.Number <> 0 Then
  MsgBox "Khong khoi dong duoc Antigravitinho:" & vbCrLf & Err.Description, _
         vbCritical, "Antigravitinho"
  WScript.Quit 1
End If
