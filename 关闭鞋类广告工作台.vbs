Option Explicit

Dim shell, fso, baseDir, pidPath, urlPath, pidFile, pidValue
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
pidPath = baseDir & "\.web-server.pid"
urlPath = baseDir & "\.web-server.url"

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

If fso.FileExists(urlPath) Then
  On Error Resume Next
  fso.DeleteFile urlPath, True
  On Error GoTo 0
End If
