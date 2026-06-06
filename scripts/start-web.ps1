[CmdletBinding()]
param(
    [int]$Port = 8799
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$AppVersion = "2026.06.05.5"
$InputDir = Join-Path $ProjectRoot "input_files"
$OutputDir = Join-Path $ProjectRoot "outputs"
$WorkflowScript = Join-Path $PSScriptRoot "shoe-ad-workflow.ps1"
$BatchRunnerScript = Join-Path $PSScriptRoot "batch-runner.ps1"
$listener = $null
$EnvPath = Join-Path $ProjectRoot ".env"
$PidPath = Join-Path $ProjectRoot ".web-server.pid"
$UrlPath = Join-Path $ProjectRoot ".web-server.url"
$BatchJobsDir = Join-Path $OutputDir "batch-jobs"

function Write-JsonResponse {
    param($Stream, [object]$Value, [int]$Status = 200)
    $json = $Value | ConvertTo-Json -Depth 80
    Write-Response -Stream $Stream -Status $Status -ContentType "application/json; charset=utf-8" -BodyBytes ([Text.Encoding]::UTF8.GetBytes($json))
}

function Write-TextResponse {
    param($Stream, [string]$Value, [int]$Status = 200, [string]$ContentType = "text/plain; charset=utf-8")
    Write-Response -Stream $Stream -Status $Status -ContentType $ContentType -BodyBytes ([Text.Encoding]::UTF8.GetBytes($Value))
}

function Write-FileResponse {
    param($Stream, [string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        Write-TextResponse -Stream $Stream -Value "Not found" -Status 404
        return
    }
    $contentType = Get-ContentType $Path
    Write-Response -Stream $Stream -Status 200 -ContentType $contentType -BodyBytes ([IO.File]::ReadAllBytes($Path))
}

function Write-AppShellResponse {
    param($Stream)
    $html = Get-Content -LiteralPath (Join-Path $ProjectRoot "web\index.html") -Raw -Encoding UTF8
    $css = Get-Content -LiteralPath (Join-Path $ProjectRoot "web\styles.css") -Raw -Encoding UTF8
    $js = Get-Content -LiteralPath (Join-Path $ProjectRoot "web\app.js") -Raw -Encoding UTF8
    $html = $html.Replace('<link rel="stylesheet" href="/web/styles.css">', "<style>`n$css`n</style>")
    $html = $html.Replace('<script src="/web/app.js"></script>', "<script>`n$js`n</script>")
    Write-TextResponse -Stream $Stream -Value $html -ContentType "text/html; charset=utf-8"
}

function Write-Response {
    param($Stream, [int]$Status, [string]$ContentType, [byte[]]$BodyBytes)
    $reason = switch ($Status) {
        200 { "OK" }
        201 { "Created" }
        400 { "Bad Request" }
        404 { "Not Found" }
        500 { "Internal Server Error" }
        default { "OK" }
    }
    $header = "HTTP/1.1 $Status $reason`r`nContent-Type: $ContentType`r`nContent-Length: $($BodyBytes.Length)`r`nCache-Control: no-store, no-cache, must-revalidate`r`nPragma: no-cache`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
    $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($BodyBytes.Length -gt 0) {
        $Stream.Write($BodyBytes, 0, $BodyBytes.Length)
    }
}

function Get-ContentType {
    param([string]$Path)
    $ext = [IO.Path]::GetExtension($Path).ToLowerInvariant()
    switch ($ext) {
        ".html" { "text/html; charset=utf-8" }
        ".css" { "text/css; charset=utf-8" }
        ".js" { "application/javascript; charset=utf-8" }
        ".json" { "application/json; charset=utf-8" }
        ".txt" { "text/plain; charset=utf-8" }
        ".png" { "image/png" }
        ".jpg" { "image/jpeg" }
        ".jpeg" { "image/jpeg" }
        ".webp" { "image/webp" }
        default { "application/octet-stream" }
    }
}

function Get-Request {
    param($Client)
    $Client.NoDelay = $true
    $Client.ReceiveTimeout = 100
    $stream = $Client.GetStream()
    $buffer = New-Object byte[] 8192
    $memory = New-Object IO.MemoryStream
    $headerEnd = -1

    while ($headerEnd -lt 0) {
        try {
            $read = $stream.Read($buffer, 0, $buffer.Length)
        } catch [IO.IOException] {
            if ($memory.Length -eq 0) {
                return $null
            }
            throw
        }
        if ($read -le 0) { break }
        $Client.ReceiveTimeout = 30000
        $memory.Write($buffer, 0, $read)
        $bytesNow = $memory.ToArray()
        for ($i = 0; $i -le $bytesNow.Length - 4; $i++) {
            if ($bytesNow[$i] -eq 13 -and $bytesNow[$i + 1] -eq 10 -and $bytesNow[$i + 2] -eq 13 -and $bytesNow[$i + 3] -eq 10) {
                $headerEnd = $i
                break
            }
        }
    }

    if ($headerEnd -lt 0) { return $null }
    $allBytes = $memory.ToArray()
    $headerText = [Text.Encoding]::UTF8.GetString($allBytes, 0, $headerEnd)
    $lines = $headerText -split "`r`n"
    $firstLine = $lines[0]
    if ([string]::IsNullOrWhiteSpace($firstLine)) { return $null }
    $parts = $firstLine.Split(" ")
    $headers = @{}
    if ($lines.Length -gt 1) {
        for ($lineIndex = 1; $lineIndex -lt $lines.Length; $lineIndex++) {
            $line = $lines[$lineIndex]
            if ($line.Length -eq 0) { continue }
            $idx = $line.IndexOf(":")
            if ($idx -gt 0) {
                $headers[$line.Substring(0, $idx).Trim().ToLowerInvariant()] = $line.Substring($idx + 1).Trim()
            }
        }
    }

    $bodyBytes = New-Object IO.MemoryStream
    $bodyStart = $headerEnd + 4
    if ($allBytes.Length -gt $bodyStart) {
        $bodyBytes.Write($allBytes, $bodyStart, $allBytes.Length - $bodyStart)
    }

    if ($headers.ContainsKey("content-length")) {
        $len = [int]$headers["content-length"]
        while ($bodyBytes.Length -lt $len) {
            $remaining = $len - [int]$bodyBytes.Length
            $chunkSize = [Math]::Min($buffer.Length, $remaining)
            $read = $stream.Read($buffer, 0, $chunkSize)
            if ($read -le 0) { break }
            $bodyBytes.Write($buffer, 0, $read)
        }
    }
    $body = [Text.Encoding]::UTF8.GetString($bodyBytes.ToArray())

    return [ordered]@{
        Method = $parts[0]
        RawUrl = $parts[1]
        Headers = $headers
        Body = $body
        Stream = $stream
    }
}

function Split-Url {
    param([string]$RawUrl)
    $pieces = $RawUrl.Split("?", 2)
    $path = [Net.WebUtility]::UrlDecode($pieces[0])
    $query = @{}
    if ($pieces.Count -gt 1) {
        foreach ($pair in $pieces[1].Split("&")) {
            if ($pair.Length -eq 0) { continue }
            $kv = $pair.Split("=", 2)
            $key = [Net.WebUtility]::UrlDecode($kv[0])
            $value = if ($kv.Count -gt 1) { [Net.WebUtility]::UrlDecode($kv[1]) } else { "" }
            $query[$key] = $value
        }
    }
    return [ordered]@{ Path = $path; Query = $query }
}

function Get-SafeFileName {
    param([string]$Name)
    $leaf = [IO.Path]::GetFileName($Name)
    $safe = $leaf -replace "[^A-Za-z0-9._-]", "_"
    if ([string]::IsNullOrWhiteSpace($safe)) { $safe = "upload.jpg" }
    return $safe
}

function Get-InputFiles {
    if (-not (Test-Path -LiteralPath $InputDir)) {
        New-Item -ItemType Directory -Force -Path $InputDir | Out-Null
    }
    $items = Get-ChildItem -LiteralPath $InputDir -File |
        Where-Object { $_.Extension -match "^\.(jpg|jpeg|png|webp)$" } |
        Sort-Object LastWriteTime -Descending |
        ForEach-Object {
            [ordered]@{ name = $_.Name; size = $_.Length; lastWriteTime = $_.LastWriteTime.ToString("o") }
        }
    return @($items)
}

function Read-EnvMap {
    $map = [ordered]@{}
    if (-not (Test-Path -LiteralPath $EnvPath)) { return $map }
    foreach ($line in Get-Content -LiteralPath $EnvPath -Encoding UTF8) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) { continue }
        $idx = $trimmed.IndexOf("=")
        if ($idx -lt 1) { continue }
        $key = $trimmed.Substring(0, $idx).Trim()
        $value = $trimmed.Substring($idx + 1).Trim()
        $map[$key] = $value
    }
    return $map
}

function Write-EnvMap {
    param([object]$Map)
    $keys = @(
        "VISION_MODEL_PROVIDER",
        "VISION_MODEL",
        "VISION_API_URL",
        "VISION_MODEL_API_KEY",
        "TEXT_MODEL_PROVIDER",
        "TEXT_MODEL",
        "TEXT_API_URL",
        "TEXT_MODEL_API_KEY",
        "IMAGE_MODEL_PROVIDER",
        "IMAGE_MODEL",
        "IMAGE_API_URL",
        "IMAGE_MODEL_API_KEY",
        "DEFAULT_ASPECT_RATIO",
        "STORYBOARD_ASPECT_RATIO",
        "KEYFRAME_ASPECT_RATIO"
    )
    $lines = @()
    foreach ($key in $keys) {
        if ($Map.Contains($key)) {
            $lines += "$key=$($Map[$key])"
        }
    }
    Set-Content -LiteralPath $EnvPath -Value $lines -Encoding UTF8
}

function Get-Runs {
    if (-not (Test-Path -LiteralPath $OutputDir)) {
        New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    }
    $runs = Get-ChildItem -LiteralPath $OutputDir -Directory |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "final-package.json") } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 100 |
        ForEach-Object {
            [ordered]@{ id = $_.Name; path = $_.FullName; lastWriteTime = $_.LastWriteTime.ToString("o") }
        }
    return @($runs)
}

function Handle-Upload {
    param([object]$Request)
    $payload = $Request.Body | ConvertFrom-Json
    $saved = @()
    $duplicates = @()
    $knownHashes = @{}

    foreach ($existing in Get-ChildItem -LiteralPath $InputDir -File) {
        if ($existing.Extension -match "^\.(jpg|jpeg|png|webp)$") {
            $hash = (Get-FileHash -LiteralPath $existing.FullName -Algorithm SHA256).Hash
            if (-not $knownHashes.ContainsKey($hash)) {
                $knownHashes[$hash] = $existing.Name
            }
        }
    }

    foreach ($file in $payload.files) {
        $name = Get-SafeFileName $file.name
        if ($file.dataUrl -notmatch "^data:(.*?);base64,(.*)$") {
            throw "Invalid dataUrl for $name"
        }
        $bytes = [Convert]::FromBase64String($Matches[2])
        $sha = [Security.Cryptography.SHA256]::Create()
        try {
            $hash = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "")
        } finally {
            $sha.Dispose()
        }

        if ($knownHashes.ContainsKey($hash)) {
            $duplicates += [ordered]@{
                name = $name
                duplicateOf = $knownHashes[$hash]
            }
            continue
        }

        $targetName = "$(Get-Date -Format yyyyMMddHHmmssfff)-$([Guid]::NewGuid().ToString('N').Substring(0, 5))-$name"
        $targetPath = Join-Path $InputDir $targetName
        [IO.File]::WriteAllBytes($targetPath, $bytes)
        $knownHashes[$hash] = $targetName
        $saved += [ordered]@{ name = $targetName; size = (Get-Item -LiteralPath $targetPath).Length }
    }
    Write-JsonResponse -Stream $Request.Stream -Value ([ordered]@{ files = @($saved); duplicates = @($duplicates) })
}

function Handle-ClearImages {
    param([object]$Request)
    $deleted = @()
    foreach ($file in Get-ChildItem -LiteralPath $InputDir -File) {
        if ($file.Extension -match "^\.(jpg|jpeg|png|webp)$") {
            $deleted += $file.Name
            Remove-Item -LiteralPath $file.FullName -Force
        }
    }
    Write-JsonResponse -Stream $Request.Stream -Value ([ordered]@{ deleted = $deleted })
}

function Handle-GetSettings {
    param([object]$Request)
    $map = Read-EnvMap
    Write-JsonResponse -Stream $Request.Stream -Value ([ordered]@{
        VISION_MODEL = if ($map.Contains("VISION_MODEL")) { $map["VISION_MODEL"] } else { "gpt-5.4-mini" }
        VISION_API_URL = if ($map.Contains("VISION_API_URL")) { $map["VISION_API_URL"] } else { "https://api.openai.com/v1/chat/completions" }
        TEXT_MODEL = if ($map.Contains("TEXT_MODEL")) { $map["TEXT_MODEL"] } else { "deepseek-chat" }
        TEXT_API_URL = if ($map.Contains("TEXT_API_URL")) { $map["TEXT_API_URL"] } else { "https://api.deepseek.com/chat/completions" }
        IMAGE_MODEL = if ($map.Contains("IMAGE_MODEL")) { $map["IMAGE_MODEL"] } else { "img2" }
        IMAGE_API_URL = if ($map.Contains("IMAGE_API_URL")) { $map["IMAGE_API_URL"] } else { "" }
        hasVisionKey = $map.Contains("VISION_MODEL_API_KEY") -and $map["VISION_MODEL_API_KEY"] -and $map["VISION_MODEL_API_KEY"] -ne "replace_me"
        hasTextKey = $map.Contains("TEXT_MODEL_API_KEY") -and $map["TEXT_MODEL_API_KEY"] -and $map["TEXT_MODEL_API_KEY"] -ne "replace_me"
        hasImageKey = $map.Contains("IMAGE_MODEL_API_KEY") -and $map["IMAGE_MODEL_API_KEY"] -and $map["IMAGE_MODEL_API_KEY"] -ne "replace_me"
    })
}

function Handle-SaveSettings {
    param([object]$Request)
    $payload = $Request.Body | ConvertFrom-Json
    $map = Read-EnvMap
    if (-not $map.Contains("VISION_MODEL_PROVIDER")) { $map["VISION_MODEL_PROVIDER"] = "openai_compatible" }
    if (-not $map.Contains("TEXT_MODEL_PROVIDER")) { $map["TEXT_MODEL_PROVIDER"] = "openai_compatible" }
    if (-not $map.Contains("IMAGE_MODEL_PROVIDER")) { $map["IMAGE_MODEL_PROVIDER"] = "generic" }
    if (-not $map.Contains("VISION_MODEL")) { $map["VISION_MODEL"] = "gpt-5.4-mini" }
    if (-not $map.Contains("VISION_API_URL")) { $map["VISION_API_URL"] = "https://api.openai.com/v1/chat/completions" }
    if (-not $map.Contains("TEXT_MODEL")) { $map["TEXT_MODEL"] = "deepseek-chat" }
    if (-not $map.Contains("TEXT_API_URL")) { $map["TEXT_API_URL"] = "https://api.deepseek.com/chat/completions" }
    if (-not $map.Contains("IMAGE_MODEL")) { $map["IMAGE_MODEL"] = "img2" }
    if (-not $map.Contains("DEFAULT_ASPECT_RATIO")) { $map["DEFAULT_ASPECT_RATIO"] = "9:16" }
    if (-not $map.Contains("STORYBOARD_ASPECT_RATIO")) { $map["STORYBOARD_ASPECT_RATIO"] = "16:9" }
    if (-not $map.Contains("KEYFRAME_ASPECT_RATIO")) { $map["KEYFRAME_ASPECT_RATIO"] = "9:16" }

    foreach ($key in @("VISION_MODEL", "VISION_API_URL", "TEXT_MODEL", "TEXT_API_URL", "IMAGE_MODEL", "IMAGE_API_URL")) {
        $value = [string]$payload.$key
        if ($value.Trim().Length -gt 0) { $map[$key] = $value.Trim() }
    }
    foreach ($key in @("VISION_MODEL_API_KEY", "TEXT_MODEL_API_KEY", "IMAGE_MODEL_API_KEY")) {
        $value = [string]$payload.$key
        if ($value.Trim().Length -gt 0) { $map[$key] = $value.Trim() }
    }

    Write-EnvMap -Map $map
    Write-JsonResponse -Stream $Request.Stream -Value ([ordered]@{ ok = $true })
}

function ConvertTo-PowerShellLiteral {
    param([string]$Value)
    return "'" + $Value.Replace("'", "''") + "'"
}

function Handle-RunBatch {
    param([object]$Request)
    $payload = $Request.Body | ConvertFrom-Json
    $imageNames = @($payload.images)
    if ($imageNames.Count -eq 0) { throw "No images selected." }

    $concurrency = 2
    if ($null -ne $payload.concurrency) {
        $concurrency = [Math]::Max(1, [Math]::Min(4, [int]$payload.concurrency))
    }
    $variantCount = 1
    if ($null -ne $payload.variantCount) {
        $variantCount = [Math]::Max(1, [Math]::Min(4, [int]$payload.variantCount))
    }

    if (-not (Test-Path -LiteralPath $BatchJobsDir)) {
        New-Item -ItemType Directory -Force -Path $BatchJobsDir | Out-Null
    }

    $jobId = "batch-$(Get-Date -Format 'yyyyMMdd-HHmmss-fff')-$([Guid]::NewGuid().ToString('N').Substring(0, 6))"
    $statusPath = Join-Path $BatchJobsDir "$jobId.status.json"
    $jobFile = Join-Path $BatchJobsDir "$jobId.input.json"
    $items = @()
    $itemIndex = 0
    foreach ($name in $imageNames) {
        $safeName = Get-SafeFileName ([string]$name)
        $path = Join-Path $InputDir $safeName
        if (-not (Test-Path -LiteralPath $path)) { throw "Missing image: $safeName" }
        for ($variantIndex = 1; $variantIndex -le $variantCount; $variantIndex++) {
            $itemIndex++
            $runId = "$(Get-Date -Format 'yyyyMMdd-HHmmss-fff')-$('{0:d2}' -f $itemIndex)-v$variantIndex-$([Guid]::NewGuid().ToString('N').Substring(0, 5))"
            $items += [ordered]@{
                imagePath = $path
                image = $safeName
                runId = $runId
                variantIndex = $variantIndex
                variantCount = $variantCount
                status = "queued"
            }
        }
    }

    $jobConfig = [ordered]@{
        jobId = $jobId
        statusPath = $statusPath
        concurrency = $concurrency
        variantCount = $variantCount
        targetCountry = [string]$payload.targetCountry
        brandName = [string]$payload.brandName
        audience = [string]$payload.audience
        mockText = [bool]$payload.mockText
        mockImages = [bool]$payload.mockImages
        items = $items
    }
    $jobConfig | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $jobFile -Encoding UTF8

    $command = "& $(ConvertTo-PowerShellLiteral $BatchRunnerScript) -JobFile $(ConvertTo-PowerShellLiteral $jobFile)"
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
    $startInfo = New-Object Diagnostics.ProcessStartInfo
    $startInfo.FileName = "powershell.exe"
    $startInfo.Arguments = "-NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded"
    $startInfo.WorkingDirectory = $ProjectRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $startInfo
    if (-not $process.Start()) { throw "Failed to start batch runner." }
    $process.Dispose()

    Write-JsonResponse -Stream $Request.Stream -Value ([ordered]@{
        jobId = $jobId
        status = "running"
        total = $items.Count
        concurrency = $concurrency
        items = $items
    })
}

function Handle-BatchStatus {
    param([object]$Request, [hashtable]$Query)
    $jobId = Get-SafeFileName ([string]$Query["jobId"])
    if ([string]::IsNullOrWhiteSpace($jobId)) { throw "Missing jobId." }
    $statusPath = Join-Path $BatchJobsDir "$jobId.status.json"
    if (-not (Test-Path -LiteralPath $statusPath)) {
        Write-JsonResponse -Stream $Request.Stream -Value ([ordered]@{ jobId = $jobId; status = "starting"; items = @() })
        return
    }
    for ($attempt = 1; $attempt -le 8; $attempt++) {
        try {
            $statusData = Get-Content -LiteralPath $statusPath -Raw -Encoding UTF8 | ConvertFrom-Json
            Write-JsonResponse -Stream $Request.Stream -Value $statusData
            return
        } catch {
            if ($attempt -eq 8) { throw }
            Start-Sleep -Milliseconds 35
        }
    }
}

function Handle-Run {
    param([object]$Request)
    $payload = $Request.Body | ConvertFrom-Json
    $imageNames = @($payload.images)
    if ($imageNames.Count -eq 0) { throw "No images selected." }

    $imagePaths = @()
    foreach ($name in $imageNames) {
        $safeName = Get-SafeFileName $name
        $path = Join-Path $InputDir $safeName
        if (-not (Test-Path -LiteralPath $path)) { throw "Missing image: $safeName" }
        $imagePaths += $path
    }

    $args = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", $WorkflowScript,
        "-Images", ($imagePaths -join ","),
        "-TargetCountry", [string]$payload.targetCountry,
        "-BrandName", [string]$payload.brandName,
        "-Audience", [string]$payload.audience,
        "-SkipConfirm"
    )
    if ([bool]$payload.mockText) { $args += "-MockText" }
    if ([bool]$payload.mockImages) { $args += "-MockImages" }

    $stdout = & powershell @args 2>&1 | Out-String
    $latest = Get-ChildItem -LiteralPath $OutputDir -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($null -eq $latest) { throw "Workflow completed but no output run was found." }

    Write-JsonResponse -Stream $Request.Stream -Value ([ordered]@{
        runId = $latest.Name
        runDir = $latest.FullName
        stdout = $stdout
    })
}

function Handle-RunData {
    param([object]$Request, [hashtable]$Query)
    $runId = Get-SafeFileName $Query["runId"]
    $file = Get-SafeFileName $Query["file"]
    $allowed = @("vision-analysis.json", "planning-package.json", "image-package.json", "image-results.json", "manual-omni-package.json", "final-package.json", "input-manifest.json")
    if ($allowed -notcontains $file) { throw "File is not allowed." }
    $path = Join-Path (Join-Path $OutputDir $runId) $file
    Write-FileResponse -Stream $Request.Stream -Path $path
}

function Handle-Request {
    param([object]$Request)
    $url = Split-Url $Request.RawUrl
    $path = $url.Path

    if ($Request.Method -eq "OPTIONS") {
        Write-TextResponse -Stream $Request.Stream -Value ""
        return
    }

    if ($Request.Method -eq "GET" -and $path -eq "/") {
        Write-AppShellResponse -Stream $Request.Stream
        return
    }
    if ($Request.Method -eq "GET" -and $path -eq "/api/version") {
        Write-JsonResponse -Stream $Request.Stream -Value ([ordered]@{ version = $AppVersion; port = $Port })
        return
    }
    if ($Request.Method -eq "GET" -and $path.StartsWith("/web/")) {
        $relative = $path.TrimStart("/") -replace "/", "\"
        Write-FileResponse -Stream $Request.Stream -Path (Join-Path $ProjectRoot $relative)
        return
    }
    if ($Request.Method -eq "GET" -and $path.StartsWith("/input_files/")) {
        $name = Get-SafeFileName ([Net.WebUtility]::UrlDecode($path.Substring("/input_files/".Length)))
        Write-FileResponse -Stream $Request.Stream -Path (Join-Path $InputDir $name)
        return
    }
    if ($Request.Method -eq "GET" -and $path -eq "/api/files") {
        Write-JsonResponse -Stream $Request.Stream -Value ([ordered]@{ files = @(Get-InputFiles) })
        return
    }
    if ($Request.Method -eq "GET" -and $path -eq "/api/settings") {
        Handle-GetSettings -Request $Request
        return
    }
    if ($Request.Method -eq "GET" -and $path -eq "/api/runs") {
        Write-JsonResponse -Stream $Request.Stream -Value ([ordered]@{ runs = @(Get-Runs) })
        return
    }
    if ($Request.Method -eq "GET" -and $path -eq "/api/run-data") {
        Handle-RunData -Request $Request -Query $url.Query
        return
    }
    if ($Request.Method -eq "GET" -and $path -eq "/api/batch-status") {
        Handle-BatchStatus -Request $Request -Query $url.Query
        return
    }
    if ($Request.Method -eq "POST" -and $path -eq "/api/upload") {
        Handle-Upload -Request $Request
        return
    }
    if ($Request.Method -eq "POST" -and $path -eq "/api/clear-images") {
        Handle-ClearImages -Request $Request
        return
    }
    if ($Request.Method -eq "POST" -and $path -eq "/api/settings") {
        Handle-SaveSettings -Request $Request
        return
    }
    if ($Request.Method -eq "POST" -and $path -eq "/api/run") {
        Handle-Run -Request $Request
        return
    }
    if ($Request.Method -eq "POST" -and $path -eq "/api/run-batch") {
        Handle-RunBatch -Request $Request
        return
    }

    Write-TextResponse -Stream $Request.Stream -Value "Not found" -Status 404
}

try {
    $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Parse("127.0.0.1"), $Port)
    $listener.Start()
    Set-Content -LiteralPath $PidPath -Value ([Diagnostics.Process]::GetCurrentProcess().Id) -Encoding ASCII
    Set-Content -LiteralPath $UrlPath -Value "http://127.0.0.1:$Port/" -Encoding ASCII
    Write-Host "Shoe ad web UI is running at http://127.0.0.1:$Port/"
    Write-Host "Press Ctrl+C to stop."

    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $request = Get-Request $client
            if ($null -ne $request) {
                try {
                    Handle-Request $request
                } catch {
                    Write-TextResponse -Stream $request.Stream -Value $_.Exception.Message -Status 500
                }
            }
        } finally {
            $client.Close()
        }
    }
} catch {
    Write-Host "Server error: $($_.Exception.Message)"
    Write-Host $_.ScriptStackTrace
    exit 1
} finally {
    if ($null -ne $listener) {
        $listener.Stop()
    }
    if (Test-Path -LiteralPath $PidPath) {
        $savedPid = Get-Content -LiteralPath $PidPath -ErrorAction SilentlyContinue
        if ($savedPid -eq [string]([Diagnostics.Process]::GetCurrentProcess().Id)) {
            Remove-Item -LiteralPath $PidPath -Force -ErrorAction SilentlyContinue
        }
    }
    if (Test-Path -LiteralPath $UrlPath) {
        $savedUrl = Get-Content -LiteralPath $UrlPath -ErrorAction SilentlyContinue
        if ($savedUrl -eq "http://127.0.0.1:$Port/") {
            Remove-Item -LiteralPath $UrlPath -Force -ErrorAction SilentlyContinue
        }
    }
}
