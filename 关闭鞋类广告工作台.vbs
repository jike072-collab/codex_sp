Option Explicit

Dim shell, fso, baseDir, pidPath, pidFile, pidValue
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Stops only the studio-v2 process started by the companion launcher.
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
pidPath = baseDir & "\.studio-v2-server.pid"

If fso.FileExists(pidPath) Then
  Set pidFile = fso.OpenTextFile(pidPath, 1, False)
  pidValue = Trim(pidFile.ReadAll)
  pidFile.Close

  If IsNumeric(pidValue) Then
    shell.Run "taskkill.exe /PID " & CLng(pidValue) & " /T /F", 0, True
  End If

  On Error Resume Next
  fso.DeleteFile pidPath, True
  On Error GoTo 0
End If
