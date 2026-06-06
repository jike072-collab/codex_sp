[CmdletBinding()]
param(
    [int]$Port = 8810,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$StudioRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerPath = Join-Path $StudioRoot "server.mjs"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js was not found. Install Node.js 20 or later and try again."
}

$env:PORT = [string]$Port
$url = "http://127.0.0.1:$Port"

if (-not $NoBrowser) {
    Start-Process $url
}

Write-Host "Shoe Ad Studio V2: $url"
Write-Host "Press Ctrl+C to stop."
& node $ServerPath

