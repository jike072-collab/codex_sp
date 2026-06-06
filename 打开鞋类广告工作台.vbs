Option Explicit

Dim shell, fso, baseDir, serverScript, command, url

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
serverScript = baseDir & "\scripts\start-web.ps1"
url = "http://127.0.0.1:8799/?v=20260605.5"

command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " _
  & Chr(34) & serverScript & Chr(34) & " -Port 8799"

' If the service already exists, the extra process exits immediately.
shell.Run command, 0, False
WScript.Sleep 800
shell.Run url, 1, False
