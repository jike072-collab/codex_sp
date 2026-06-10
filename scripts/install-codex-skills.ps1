[CmdletBinding()]
param(
    [string]$SourceRoot,
    [string]$DestinationRoot
)

$ErrorActionPreference = "Stop"
$SourceRoot = if ($SourceRoot) { $SourceRoot } else { Join-Path $PSScriptRoot "..\\codex-skills" }
$DestinationRoot = if ($DestinationRoot) { $DestinationRoot } else { Join-Path $HOME ".codex\\skills" }
$source = [System.IO.Path]::GetFullPath($SourceRoot)
$destination = [System.IO.Path]::GetFullPath($DestinationRoot)

if (-not (Test-Path -LiteralPath $source)) {
    throw "Skill source folder not found: $source"
}

New-Item -ItemType Directory -Force -Path $destination | Out-Null

Get-ChildItem -LiteralPath $source -Directory | ForEach-Object {
    $target = Join-Path $destination $_.Name
    if (Test-Path -LiteralPath $target) {
        Remove-Item -LiteralPath $target -Recurse -Force
    }
    Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force
}

Write-Host "Copied skills from $source to $destination"
