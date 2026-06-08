[CmdletBinding()]
param(
    [int]$Port = 8810,
    [switch]$NoBrowser,
    [string]$PidPath
)

$ErrorActionPreference = "Stop"
$StudioRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $StudioRoot
$ServerPath = Join-Path $StudioRoot "server.mjs"
$ResolvedPidPath = if ($PidPath) {
    [System.IO.Path]::GetFullPath($PidPath)
} else {
    Join-Path $ProjectRoot ".studio-v2-server.pid"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js was not found. Install Node.js 20 or later and try again."
}

$env:PORT = [string]$Port
$url = "http://127.0.0.1:$Port"

try {
    $probe = [System.Net.Sockets.TcpClient]::new()
    $probe.Connect("127.0.0.1", $Port)
    $probe.Dispose()
    if (-not $NoBrowser) {
        Start-Process $url
    }
    Write-Host "Shoe Ad Studio V2 is already running at $url"
    return
} catch {
    if ($probe) {
        $probe.Dispose()
    }
}

if (-not $NoBrowser) {
    Start-Process $url
}

Write-Host "Shoe Ad Studio V2: $url"
Write-Host "Press Ctrl+C to stop."
[System.IO.File]::WriteAllText($ResolvedPidPath, [string]$PID)
try {
    & node $ServerPath
} finally {
    if (Test-Path -LiteralPath $ResolvedPidPath) {
        $recordedPid = (Get-Content -LiteralPath $ResolvedPidPath -Raw).Trim()
        if ($recordedPid -eq [string]$PID) {
            Remove-Item -LiteralPath $ResolvedPidPath -Force
        }
    }
}
