[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$JobFile
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WorkflowScript = Join-Path $PSScriptRoot "shoe-ad-workflow.ps1"

function Save-JobStatus {
    param(
        [object]$Job,
        [string]$StatusPath
    )

    $completed = @($Job.items | Where-Object { $_.status -eq "completed" }).Count
    $failed = @($Job.items | Where-Object { $_.status -eq "failed" }).Count
    $Job.completed = $completed
    $Job.failed = $failed
    $Job.status = if (($completed + $failed) -ge $Job.total) { "completed" } else { "running" }

    $tempPath = "$StatusPath.tmp"
    $Job | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $tempPath -Encoding UTF8
    Move-Item -LiteralPath $tempPath -Destination $StatusPath -Force
}

function ConvertTo-PowerShellLiteral {
    param([string]$Value)
    return "'" + $Value.Replace("'", "''") + "'"
}

function Start-WorkflowItem {
    param(
        [object]$Item,
        [object]$Config
    )

    $command = @(
        "& $(ConvertTo-PowerShellLiteral $WorkflowScript)",
        "-Images $(ConvertTo-PowerShellLiteral ([string]$Item.imagePath))",
        "-TargetCountry $(ConvertTo-PowerShellLiteral ([string]$Config.targetCountry))",
        "-BrandName $(ConvertTo-PowerShellLiteral ([string]$Config.brandName))",
        "-Audience $(ConvertTo-PowerShellLiteral ([string]$Config.audience))",
        "-RunId $(ConvertTo-PowerShellLiteral ([string]$Item.runId))",
        "-VariantIndex $([int]$Item.variantIndex)",
        "-VariantCount $([int]$Item.variantCount)",
        "-SkipConfirm"
    ) -join " "
    if ([bool]$Config.mockText) { $command += " -MockText" }
    if ([bool]$Config.mockImages) { $command += " -MockImages" }

    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
    $startInfo = New-Object Diagnostics.ProcessStartInfo
    $startInfo.FileName = "powershell.exe"
    $startInfo.Arguments = "-NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded"
    $startInfo.WorkingDirectory = $ProjectRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true

    $process = New-Object Diagnostics.Process
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
        throw "Failed to start workflow for $($Item.image)"
    }
    return $process
}

$jobConfig = Get-Content -LiteralPath $JobFile -Raw -Encoding UTF8 | ConvertFrom-Json
$statusPath = [string]$jobConfig.statusPath
$concurrency = [Math]::Max(1, [Math]::Min(4, [int]$jobConfig.concurrency))

$jobState = [ordered]@{
    jobId = [string]$jobConfig.jobId
    status = "running"
    total = @($jobConfig.items).Count
    completed = 0
    failed = 0
    concurrency = $concurrency
    createdAt = (Get-Date).ToString("o")
    updatedAt = (Get-Date).ToString("o")
    items = @($jobConfig.items | ForEach-Object {
        [ordered]@{
            image = [string]$_.image
            imagePath = [string]$_.imagePath
            runId = [string]$_.runId
            variantIndex = [int]$_.variantIndex
            variantCount = [int]$_.variantCount
            status = "queued"
            exitCode = $null
            error = ""
        }
    })
}
Save-JobStatus -Job $jobState -StatusPath $statusPath

$active = @()
try {
    while (@($jobState.items | Where-Object { $_.status -eq "queued" }).Count -gt 0 -or $active.Count -gt 0) {
        $queued = @($jobState.items | Where-Object { $_.status -eq "queued" })
        while ($queued.Count -gt 0 -and $active.Count -lt $concurrency) {
            $item = $queued[0]
            try {
                $item.status = "running"
                $process = Start-WorkflowItem -Item $item -Config $jobConfig
                $active += [ordered]@{ process = $process; item = $item }
            } catch {
                $item.status = "failed"
                $item.error = $_.Exception.Message
            }
            $jobState.updatedAt = (Get-Date).ToString("o")
            Save-JobStatus -Job $jobState -StatusPath $statusPath
            $queued = @($jobState.items | Where-Object { $_.status -eq "queued" })
        }

        $stillActive = @()
        foreach ($entry in $active) {
            if ($entry.process.HasExited) {
                $entry.item.exitCode = $entry.process.ExitCode
                $finalPath = Join-Path (Join-Path $ProjectRoot "outputs\$($entry.item.runId)") "final-package.json"
                $entry.item.status = if ($entry.process.ExitCode -eq 0 -and (Test-Path -LiteralPath $finalPath)) { "completed" } else { "failed" }
                $entry.process.Dispose()
            } else {
                $stillActive += $entry
            }
        }
        $active = @($stillActive)
        $jobState.updatedAt = (Get-Date).ToString("o")
        Save-JobStatus -Job $jobState -StatusPath $statusPath
        if ($active.Count -gt 0) {
            Start-Sleep -Milliseconds 300
        }
    }
} catch {
    foreach ($entry in $active) {
        if (-not $entry.process.HasExited) {
            $entry.process.Kill()
        }
        $entry.process.Dispose()
        $entry.item.status = "failed"
        $entry.item.error = "Batch runner stopped: $($_.Exception.Message)"
    }
    $jobState.updatedAt = (Get-Date).ToString("o")
    Save-JobStatus -Job $jobState -StatusPath $statusPath
    throw
}
