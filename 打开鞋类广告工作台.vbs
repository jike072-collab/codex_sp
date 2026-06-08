Option Explicit

Dim shell, fso, baseDir, serverScript, pidPath, command

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Active launcher for studio-v2. Legacy scripts/start-web.ps1 is not used.
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
serverScript = baseDir & "\studio-v2\start.ps1"
pidPath = baseDir & "\.studio-v2-server.pid"

command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " _
  & Chr(34) & serverScript & Chr(34) & " -Port 8810 -PidPath " _
  & Chr(34) & pidPath & Chr(34)

' start.ps1 opens the browser and exits cleanly when port 8810 is already active.
shell.Run command, 0, False
