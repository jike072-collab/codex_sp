[CmdletBinding()]
param(
    [string[]]$Images = @(),
    [string]$TargetCountry = "",
    [string]$BrandName = "",
    [string]$Audience = "TikTok SEA ecommerce shoppers",
    [string]$RunId = "",
    [ValidateRange(1, 4)]
    [int]$VariantIndex = 1,
    [ValidateRange(1, 4)]
    [int]$VariantCount = 1,
    [string]$EnvFile = ".env",
    [string]$OutputRoot = "outputs",
    [switch]$SkipConfirm,
    [switch]$MockText,
    [switch]$MockImages
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot

function Join-ProjectPath {
    param([string]$ChildPath)
    if ([System.IO.Path]::IsPathRooted($ChildPath)) { return $ChildPath }
    return (Join-Path $ProjectRoot $ChildPath)
}

function Import-DotEnv {
    param([string]$Path)
    $resolved = Join-ProjectPath $Path
    if (-not (Test-Path -LiteralPath $resolved)) { return }

    foreach ($line in Get-Content -LiteralPath $resolved -Encoding UTF8) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) { continue }
        $idx = $trimmed.IndexOf("=")
        if ($idx -lt 1) { continue }

        $key = $trimmed.Substring(0, $idx).Trim()
        $value = $trimmed.Substring($idx + 1).Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        if (-not [Environment]::GetEnvironmentVariable($key, "Process")) {
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

function Save-Json {
    param(
        [string]$Path,
        [object]$Value
    )
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Value | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Save-Text {
    param(
        [string]$Path,
        [string]$Value
    )
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    Set-Content -LiteralPath $Path -Value $Value -Encoding UTF8
}

function Get-EnvValue {
    param(
        [string]$Name,
        [string]$Default = ""
    )
    $value = [Environment]::GetEnvironmentVariable($Name, "Process")
    if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
    return $value
}

function Get-LocaleProfile {
    param([string]$Country)
    $key = $Country.Trim().ToLowerInvariant()

    if ($key -match "indonesia|indo") {
        return [ordered]@{
            target_country = "Indonesia"
            language = "Bahasa Indonesia"
            subtitle_style = "Short, friendly, direct ecommerce captions."
            voiceover_style = "Casual, energetic, natural Indonesian."
            cta_style = "Simple shopping CTA such as Cek sekarang or Siap dipakai harian."
            caption_samples = @("Siap lari", "Ringan dipakai", "Grip mantap", "Nyaman seharian")
        }
    }
    if ($key -match "thailand|thai") {
        return [ordered]@{
            target_country = "Thailand"
            language = "Thai"
            subtitle_style = "Short Thai phrases, natural for TikTok shopping."
            voiceover_style = "Friendly, upbeat Thai, not formal."
            cta_style = "Soft local Thai CTA; use natural short Thai lines in real model output."
            caption_samples = @("Thai: ready to go", "Thai: light and easy", "Thai: confident grip", "Thai: soft every step")
        }
    }
    if ($key -match "vietnam|viet") {
        return [ordered]@{
            target_country = "Vietnam"
            language = "Vietnamese"
            subtitle_style = "Short Vietnamese captions with direct product benefit."
            voiceover_style = "Young, energetic Vietnamese."
            cta_style = "Natural Vietnamese CTA; use natural short Vietnamese lines in real model output."
            caption_samples = @("Vietnamese: ready to run", "Vietnamese: light and soft", "Vietnamese: good grip", "Vietnamese: soft every step")
        }
    }
    if ($key -match "philippines|filipino|tagalog") {
        return [ordered]@{
            target_country = "Philippines"
            language = "English with Tagalog-friendly phrasing"
            subtitle_style = "Simple English, casual SEA shopping tone."
            voiceover_style = "Warm, upbeat, not too formal."
            cta_style = "Short CTA such as Ready for every run or All-day comfort."
            caption_samples = @("Ready to run", "Light all day", "Grip every step", "Soft landing")
        }
    }
    if ($key -match "malaysia|malay") {
        return [ordered]@{
            target_country = "Malaysia"
            language = "Bahasa Malaysia with simple English allowed"
            subtitle_style = "Short BM captions, easy shopping language."
            voiceover_style = "Casual, confident, energetic."
            cta_style = "Natural Bahasa Malaysia CTA; use short BM lines in real model output."
            caption_samples = @("BM: ready to run", "BM: light and comfortable", "BM: strong grip", "BM: soft every step")
        }
    }
    if ($key -match "singapore") {
        return [ordered]@{
            target_country = "Singapore"
            language = "English"
            subtitle_style = "Clean, short, direct English."
            voiceover_style = "Modern, concise, urban."
            cta_style = "Direct CTA such as Ready for city runs."
            caption_samples = @("City run ready", "Light and stable", "Strong grip", "Soft landing")
        }
    }

    return [ordered]@{
        target_country = $Country
        language = "Local language of $Country"
        subtitle_style = "Short local ecommerce captions."
        voiceover_style = "Natural, energetic local voice."
        cta_style = "Local shopping CTA."
        caption_samples = @("Ready to run", "Light feel", "Strong grip", "Soft landing")
    }
}

function Resolve-InputImages {
    param([string[]]$InputImages)
    $resolved = New-Object System.Collections.Generic.List[string]

    if ($InputImages.Count -eq 0) {
        $inputDir = Join-ProjectPath "input_files"
        if (Test-Path -LiteralPath $inputDir) {
            Get-ChildItem -LiteralPath $inputDir -File |
                Where-Object { $_.Extension -match "^\.(jpg|jpeg|png|webp)$" } |
                ForEach-Object { $resolved.Add($_.FullName) }
        }
    } else {
        $expandedImages = New-Object System.Collections.Generic.List[string]
        foreach ($imageValue in $InputImages) {
            foreach ($piece in ($imageValue -split ",")) {
                $trimmedPiece = $piece.Trim()
                if ($trimmedPiece.Length -gt 0) {
                    $expandedImages.Add($trimmedPiece)
                }
            }
        }

        foreach ($image in $expandedImages) {
            $candidate = $image
            if (-not [System.IO.Path]::IsPathRooted($candidate)) {
                $candidate = Join-Path (Get-Location) $candidate
            }
            $item = Resolve-Path -LiteralPath $candidate
            $resolved.Add($item.Path)
        }
    }

    if ($resolved.Count -eq 0) {
        throw "No image files were provided and no images were found in input_files."
    }
    return @($resolved)
}

function ConvertTo-DataUrl {
    param([string]$Path)
    $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    $mime = switch ($ext) {
        ".png" { "image/png" }
        ".webp" { "image/webp" }
        ".jpg" { "image/jpeg" }
        ".jpeg" { "image/jpeg" }
        default { "application/octet-stream" }
    }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    return "data:${mime};base64,$([Convert]::ToBase64String($bytes))"
}

function ConvertFrom-JsonLoose {
    param([string]$Text)
    try {
        return ($Text | ConvertFrom-Json)
    } catch {
        $start = $Text.IndexOf("{")
        $end = $Text.LastIndexOf("}")
        if ($start -ge 0 -and $end -gt $start) {
            return ($Text.Substring($start, $end - $start + 1) | ConvertFrom-Json)
        }
        throw
    }
}

function Get-ObjectProperty {
    param(
        [object]$Object,
        [string]$Name
    )
    if ($null -eq $Object) { return $null }
    if ($Object -is [System.Collections.IDictionary]) {
        if ($Object.Contains($Name)) { return $Object[$Name] }
        return $null
    }
    $prop = $Object.PSObject.Properties[$Name]
    if ($null -eq $prop) { return $null }
    return $prop.Value
}

function New-MockVisionPackage {
    param([string[]]$ImagePaths)

    return [ordered]@{
        product_summary = [ordered]@{
            shoe_type = "running / training shoe (mock vision result)"
            likely_usage = [ordered]@{
                value = "daily running and light training"
                evidence = "inferred"
            }
            overall_style = "sporty ecommerce running shoe"
        }
        product_lock_manifest = [ordered]@{
            main_colors = @("read from product image")
            supporting_colors = @("read from product image")
            upper_material_visible = "visible upper texture from reference image"
            toe_shape = "lock exact toe shape from reference image"
            lace_system = "lock exact lace and eyelet layout from reference image"
            midsole_shape = "lock exact midsole height and contour from reference image"
            outsole_color = "lock outsole color from reference image"
            outsole_pattern = "lock visible tread pattern from reference image"
            side_pattern_or_logo = "do not invent or alter side logo/pattern"
            heel_structure = "lock heel counter and pull-tab shape from reference image"
            must_keep = @(
                "exact shoe silhouette",
                "main color blocking",
                "midsole shape and thickness",
                "outsole color and tread structure",
                "side pattern or logo exactly as shown"
            )
            must_not_change = @(
                "do not change shoe color",
                "do not change shoe type",
                "do not add a fake logo",
                "do not redesign the sole",
                "do not turn the shoe into another brand"
            )
        }
        visible_selling_point_candidates = @(
            [ordered]@{
                feature = "recognizable color blocking"
                evidence = "visible"
                visual_proof = "color layout is visible in the product image"
                safe_claim_boundary = "describe appearance only"
            },
            [ordered]@{
                feature = "cushioned-looking midsole"
                evidence = "inferred"
                visual_proof = "midsole volume is visible"
                safe_claim_boundary = "do not claim a named foam technology"
            },
            [ordered]@{
                feature = "textured outsole"
                evidence = "visible"
                visual_proof = "tread pattern is visible when the outsole view exists"
                safe_claim_boundary = "do not claim certified slip resistance"
            }
        )
        image_quality = [ordered]@{
            usable = $true
            views_detected = @("combined product views")
            missing_or_unclear = @()
            notes = @("Mock mode does not truly inspect pixels.")
        }
        source_images = @($ImagePaths | ForEach-Object { Split-Path -Leaf $_ })
    }
}

function New-MockPlanningPackage {
    param(
        [hashtable]$Locale,
        [string[]]$ImagePaths,
        [string]$Brand,
        [string]$AudienceValue,
        [int]$CreativeVariant = 1
    )
    $sample = $Locale.caption_samples
    $themes = @("RUN READY", "CITY FLOW", "LIGHT STRIDE", "GRIP & GO")
    $openingVisuals = @(
        "Low-angle shoe landing, strong product-first hook.",
        "City crosswalk transition from walking to running, with the shoe held clearly in frame.",
        "Top-down lace-up action flowing into a light first stride.",
        "Outsole contact and a controlled quick stop, preserving the exact sole pattern."
    )
    $variantOffset = [Math]::Max(0, [Math]::Min($themes.Count - 1, $CreativeVariant - 1))
    $variantTheme = $themes[$variantOffset]
    $openingVisual = $openingVisuals[$variantOffset]

    return [ordered]@{
        locale_profile = $Locale
        product_lock_manifest = [ordered]@{
            shoe_type = "running / training shoe (mock; replace with vision model analysis)"
            main_colors = @("read from product images")
            supporting_colors = @("read from product images")
            upper_material_visible = "visible upper texture from reference images"
            midsole_shape = "lock the exact midsole height and contour from references"
            outsole_color = "lock outsole color from references"
            outsole_pattern = "lock visible tread pattern from references"
            side_pattern_or_logo = "do not invent or alter side logo/pattern"
            heel_structure = "lock heel counter shape from references"
            must_keep = @(
                "exact shoe silhouette",
                "main color blocking",
                "midsole shape and thickness",
                "outsole color and tread structure",
                "side pattern/logo exactly as shown"
            )
            must_not_change = @(
                "do not change shoe color",
                "do not change shoe type",
                "do not add fake logo",
                "do not redesign sole structure",
                "do not turn the shoe into another brand"
            )
            source_images = @($ImagePaths | ForEach-Object { Split-Path -Leaf $_ })
        }
        selling_points = @(
            [ordered]@{ point = "high-recognition colorway"; evidence = "visible"; visual_proof = "color blocking is visible in product references"; ad_expression = "make color the first memory point" },
            [ordered]@{ point = "cushioned midsole look"; evidence = "inferred"; visual_proof = "midsole shape suggests comfort; do not claim technical foam"; ad_expression = "show soft landing visually" },
            [ordered]@{ point = "grip-oriented outsole"; evidence = "visible"; visual_proof = "outsole/tread is visible if reference includes sole"; ad_expression = "show road grip and quick stop" }
        )
        creative_direction = [ordered]@{
            video_positioning = "standard ecommerce performance shoe ad for $AudienceValue"
            core_emotion = @("ready", "light", "stable", "energetic")
            visual_style = @("clean product hero", "city run energy", "fast ecommerce cuts")
            recommended_theme = $variantTheme
            theme_reason = "Creative variant $CreativeVariant uses a distinct hook and selling-point emphasis for batch testing."
        }
        hooks = @(
            [ordered]@{ hook = "low-angle landing impact"; time_hint = "1-3s"; selling_point = "soft landing"; emotion = "instant energy" },
            [ordered]@{ hook = "quick lace lock-in before running"; time_hint = "1-3s"; selling_point = "secure fit"; emotion = "ready to move" },
            [ordered]@{ hook = "outsole quick stop on road"; time_hint = "1-3s"; selling_point = "grip"; emotion = "confidence" }
        )
        script_20s = [ordered]@{
            total_duration_sec = 20
            segment_a_0_10s = [ordered]@{
                segment_id = "0-10s"
                theme = "Hook and product identity"
                duration_sec = 10
                shots = @(
                    [ordered]@{ start_sec = 0; end_sec = 2.5; visual = $openingVisual; action = "The product enters cleanly and holds long enough to remain recognizable."; camera = "Dynamic ecommerce close-up matched to the creative theme."; selling_point = $variantTheme; localized_caption_or_vo = $sample[0]; sound = "heavy beat + whoosh"; transition = "fast push-in" },
                    [ordered]@{ start_sec = 2.5; end_sec = 5.5; visual = "Macro upper and lace area, product details stay exact."; action = "Light sweeps across upper texture."; camera = "Macro side detail."; selling_point = "upper / fit"; localized_caption_or_vo = $sample[1]; sound = "soft snap + beat"; transition = "match cut" },
                    [ordered]@{ start_sec = 5.5; end_sec = 10; visual = "Runner starts moving, shoe remains hero in frame."; action = "Foot drives forward into short run."; camera = "Tracking low angle."; selling_point = "ready for movement"; localized_caption_or_vo = $sample[2]; sound = "footstep rhythm"; transition = "motion blur to next segment" }
                )
            }
            segment_b_10_20s = [ordered]@{
                segment_id = "10-20s"
                theme = "Proof and hero close"
                duration_sec = 10
                shots = @(
                    [ordered]@{ start_sec = 10; end_sec = 13; visual = "Outsole grip moment on road or training surface."; action = "Quick stop, sole visible briefly without distortion."; camera = "Low side angle."; selling_point = "grip"; localized_caption_or_vo = $sample[2]; sound = "rubber grip sound"; transition = "whoosh" },
                    [ordered]@{ start_sec = 13; end_sec = 17; visual = "Comfort stride sequence, shoe color and shape consistent."; action = "Runner takes two smooth steps."; camera = "Side tracking shot."; selling_point = "soft landing"; localized_caption_or_vo = $sample[3]; sound = "music lift"; transition = "clean cut" },
                    [ordered]@{ start_sec = 17; end_sec = 20; visual = "Final clean product hero, full shoe visible."; action = "Shoe rotates slightly or rests in hero light."; camera = "Product hero close-up."; selling_point = "clear ecommerce close"; localized_caption_or_vo = "Shop now"; sound = "final beat hit"; transition = "end hold" }
                )
            }
        }
        localized_copy = [ordered]@{
            caption_lines = $sample
            cta_options = @($Locale.cta_style)
            do_not_use = @("long technical claims", "fake brand slogans", "unreadable generated text")
        }
        confirmation_summary = [ordered]@{
            what_to_confirm = @("target country and language", "visible selling points", "20-second script rhythm", "product lock rules")
            risk_notes = @("Mock mode cannot truly inspect images; connect a multimodal text model for real product analysis.")
        }
    }
}

function New-MockImagePackage {
    param(
        [object]$Planning,
        [string[]]$ImagePaths
    )
    $lockJson = (Get-ObjectProperty $Planning "product_lock_manifest") | ConvertTo-Json -Depth 20
    $segmentA = (Get-ObjectProperty (Get-ObjectProperty $Planning "script_20s") "segment_a_0_10s")
    $segmentB = (Get-ObjectProperty (Get-ObjectProperty $Planning "script_20s") "segment_b_10_20s")
    $locale = Get-ObjectProperty $Planning "locale_profile"
    $language = Get-ObjectProperty $locale "language"

    $storyA = "Create a 16:9 commercial storyboard production board for the 0-10s segment. Include title, product lock area, color chips, timing, camera, action, selling point, local captions in $language, and sound notes. Keep shoe identity exactly from references. Product lock: $lockJson"
    $keyA = "Create a clean 9:16 cinematic video keyframe for the 0-10s segment. No table, no storyboard text, no poster typography. Show the shoe as the hero in an energetic ecommerce running scene. Keep exact color, silhouette, sole, outsole, and side pattern from references."
    $storyB = "Create a 16:9 commercial storyboard production board for the 10-20s segment. Include proof shots and final product hero. Include local captions in $language, sound notes, product lock, and QC area. Keep shoe identity exactly from references. Product lock: $lockJson"
    $keyB = "Create a clean 9:16 cinematic video keyframe for the 10-20s segment. No table, no captions, no layout text. Show the final proof/hero moment with the full shoe clearly visible. Keep exact color, silhouette, sole, outsole, and side pattern from references."

    return [ordered]@{
        storyboard_plan = [ordered]@{
            total_images = 4
            segments = @(
                [ordered]@{ segment_id = "0-10s"; storyboard_goal = "Hook, product identity, first selling points."; keyframe_goal = "Clean product-first running hook frame." },
                [ordered]@{ segment_id = "10-20s"; storyboard_goal = "Proof, movement, final product hero."; keyframe_goal = "Clean final proof/hero frame." }
            )
        }
        image_generation = @(
            [ordered]@{ asset_id = "0-10s_storyboard_board"; segment_id = "0-10s"; type = "storyboard_board"; aspect_ratio = "16:9"; prompt = $storyA; negative_prompt = "wrong shoe, changed color, fake logo, distorted sole, unreadable clutter, random brand marks"; reference_policy = "Use all shoe product views as strict product identity references." },
            [ordered]@{ asset_id = "0-10s_video_keyframe"; segment_id = "0-10s"; type = "video_keyframe"; aspect_ratio = "9:16"; prompt = $keyA; negative_prompt = "text, captions, tables, poster layout, wrong shoe, changed color, fake logo"; reference_policy = "Use all shoe product views as strict product identity references." },
            [ordered]@{ asset_id = "10-20s_storyboard_board"; segment_id = "10-20s"; type = "storyboard_board"; aspect_ratio = "16:9"; prompt = $storyB; negative_prompt = "wrong shoe, changed color, fake logo, distorted sole, unreadable clutter, random brand marks"; reference_policy = "Use all shoe product views as strict product identity references." },
            [ordered]@{ asset_id = "10-20s_video_keyframe"; segment_id = "10-20s"; type = "video_keyframe"; aspect_ratio = "9:16"; prompt = $keyB; negative_prompt = "text, captions, tables, poster layout, wrong shoe, changed color, fake logo"; reference_policy = "Use all shoe product views as strict product identity references." }
        )
        manual_omni_packages = @(
            [ordered]@{
                segment_id = "0-10s"
                upload_references = @("segment_a_0_10s script", "0-10s_storyboard_board image", "0-10s_video_keyframe image", "shoe product reference images")
                script = $segmentA
                flow_omni_prompt = "Generate a 10-second 9:16 ecommerce shoe ad video from the 0-10s script, using the storyboard board for shot sequence and the clean keyframe for visual style. Keep the shoe exactly consistent with product references. Do not change colors, silhouette, midsole, outsole, side pattern, or logo. Do not generate readable captions inside video frames; captions will be added in post-production."
                caption_note = "Add localized captions in post-production, not inside generated frames."
            },
            [ordered]@{
                segment_id = "10-20s"
                upload_references = @("segment_b_10_20s script", "10-20s_storyboard_board image", "10-20s_video_keyframe image", "shoe product reference images")
                script = $segmentB
                flow_omni_prompt = "Generate a 10-second 9:16 ecommerce shoe ad video from the 10-20s script, using the storyboard board for proof/final sequence and the clean keyframe for visual style. Keep the shoe exactly consistent with product references. Do not change colors, silhouette, midsole, outsole, side pattern, or logo. End with a clear full-shoe hero frame. Do not generate readable captions inside video frames; captions will be added in post-production."
                caption_note = "Add localized captions in post-production, not inside generated frames."
            }
        )
        qc_checklist = @(
            "Shoe colors stay consistent.",
            "Shoe silhouette and sole structure stay consistent.",
            "No fake logo or changed side pattern.",
            "Storyboard and keyframe match the 10-second script.",
            "Localized captions are short and natural for the target country."
        )
        source_images = @($ImagePaths | ForEach-Object { Split-Path -Leaf $_ })
    }
}

function Invoke-ChatModel {
    param(
        [string]$ConfigPrefix,
        [string]$DefaultModel,
        [string]$DefaultUrl,
        [string]$StageName,
        [string]$SystemPrompt,
        [string]$UserPrompt,
        [string[]]$ImagePaths,
        [string]$RunDir
    )

    $provider = Get-EnvValue "${ConfigPrefix}_MODEL_PROVIDER" "manual"
    $apiKey = Get-EnvValue "${ConfigPrefix}_MODEL_API_KEY" ""
    $model = Get-EnvValue "${ConfigPrefix}_MODEL" $DefaultModel
    $url = Get-EnvValue "${ConfigPrefix}_API_URL" $DefaultUrl

    if ($MockText -or $provider -eq "manual" -or $provider -eq "mock" -or [string]::IsNullOrWhiteSpace($apiKey) -or $apiKey -eq "replace_me") {
        Save-Text (Join-Path $RunDir "api_payloads\$StageName.user-prompt.txt") $UserPrompt
        return $null
    }

    $userContent = $UserPrompt
    if ($ImagePaths.Count -gt 0) {
        $content = New-Object System.Collections.Generic.List[object]
        $content.Add([ordered]@{ type = "text"; text = $UserPrompt })
        foreach ($image in $ImagePaths) {
            $content.Add([ordered]@{ type = "image_url"; image_url = [ordered]@{ url = (ConvertTo-DataUrl $image) } })
        }
        $userContent = @($content)
    }

    $body = [ordered]@{
        model = $model
        messages = @(
            [ordered]@{ role = "system"; content = $SystemPrompt },
            [ordered]@{ role = "user"; content = $userContent }
        )
        temperature = 0.4
        response_format = [ordered]@{ type = "json_object" }
    }

    Save-Json (Join-Path $RunDir "api_payloads\$StageName.text.request.json") $body

    $headers = @{
        Authorization = "Bearer $apiKey"
    }
    $response = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 80)
    Save-Json (Join-Path $RunDir "api_payloads\$StageName.text.response.json") $response

    $choices = Get-ObjectProperty $response "choices"
    if ($choices -and $choices.Count -gt 0) {
        $message = Get-ObjectProperty $choices[0] "message"
        $text = Get-ObjectProperty $message "content"
        if ($text) { return (ConvertFrom-JsonLoose $text) }
    }

    throw "Text model response did not include choices[0].message.content."
}

function Save-ImageResponse {
    param(
        [object]$Response,
        [string]$AssetId,
        [string]$ImagesDir,
        [string]$RawDir
    )

    Save-Json (Join-Path $RawDir "$AssetId.image.response.json") $Response

    $data = Get-ObjectProperty $Response "data"
    if ($data -and $data.Count -gt 0) {
        $b64 = Get-ObjectProperty $data[0] "b64_json"
        if ($b64) {
            $outPath = Join-Path $ImagesDir "$AssetId.png"
            [System.IO.File]::WriteAllBytes($outPath, [Convert]::FromBase64String($b64))
            return [ordered]@{ asset_id = $AssetId; status = "generated"; path = $outPath }
        }
        $url = Get-ObjectProperty $data[0] "url"
        if ($url) {
            return [ordered]@{ asset_id = $AssetId; status = "url"; url = $url }
        }
    }

    $images = Get-ObjectProperty $Response "images"
    if ($images -and $images.Count -gt 0) {
        $b64Image = Get-ObjectProperty $images[0] "b64"
        if ($b64Image) {
            $outPath2 = Join-Path $ImagesDir "$AssetId.png"
            [System.IO.File]::WriteAllBytes($outPath2, [Convert]::FromBase64String($b64Image))
            return [ordered]@{ asset_id = $AssetId; status = "generated"; path = $outPath2 }
        }
        $imageUrl = Get-ObjectProperty $images[0] "url"
        if ($imageUrl) {
            return [ordered]@{ asset_id = $AssetId; status = "url"; url = $imageUrl }
        }
    }

    $topUrl = Get-ObjectProperty $Response "url"
    if ($topUrl) {
        return [ordered]@{ asset_id = $AssetId; status = "url"; url = $topUrl }
    }

    return [ordered]@{ asset_id = $AssetId; status = "raw_response_saved"; raw_response = (Join-Path $RawDir "$AssetId.image.response.json") }
}

function Invoke-ImageModel {
    param(
        [object]$ImageAsset,
        [string[]]$ReferenceImagePaths,
        [string]$RunDir
    )

    $assetId = Get-ObjectProperty $ImageAsset "asset_id"
    $prompt = Get-ObjectProperty $ImageAsset "prompt"
    $negativePrompt = Get-ObjectProperty $ImageAsset "negative_prompt"
    $aspectRatio = Get-ObjectProperty $ImageAsset "aspect_ratio"

    $requestDir = Join-Path $RunDir "image_requests"
    $imagesDir = Join-Path $RunDir "generated_images"
    $rawDir = Join-Path $RunDir "api_payloads"
    New-Item -ItemType Directory -Force -Path $requestDir, $imagesDir, $rawDir | Out-Null

    $provider = Get-EnvValue "IMAGE_MODEL_PROVIDER" "manual"
    $apiKey = Get-EnvValue "IMAGE_MODEL_API_KEY" ""
    $model = Get-EnvValue "IMAGE_MODEL" "img2"
    $url = Get-EnvValue "IMAGE_API_URL" ""

    if ($MockImages -or $provider -eq "manual" -or [string]::IsNullOrWhiteSpace($apiKey) -or $apiKey -eq "replace_me" -or [string]::IsNullOrWhiteSpace($url)) {
        $promptPath = Join-Path $requestDir "$assetId.prompt.txt"
        $request = @"
ASSET: $assetId
ASPECT_RATIO: $aspectRatio

PROMPT:
$prompt

NEGATIVE_PROMPT:
$negativePrompt

REFERENCE_IMAGES:
$($ReferenceImagePaths -join "`n")
"@
        Save-Text $promptPath $request
        return [ordered]@{ asset_id = $assetId; status = "manual_prompt_saved"; prompt_file = $promptPath; aspect_ratio = $aspectRatio }
    }

    $refs = @($ReferenceImagePaths | ForEach-Object {
        [ordered]@{
            filename = Split-Path -Leaf $_
            data_url = ConvertTo-DataUrl $_
        }
    })

    $body = [ordered]@{
        model = $model
        prompt = $prompt
        negative_prompt = $negativePrompt
        aspect_ratio = $aspectRatio
        reference_images = $refs
    }

    Save-Json (Join-Path $rawDir "$assetId.image.request.json") $body

    $headers = @{
        Authorization = "Bearer $apiKey"
    }
    $response = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 80)
    return (Save-ImageResponse -Response $response -AssetId $assetId -ImagesDir $imagesDir -RawDir $rawDir)
}

Import-DotEnv $EnvFile

if ([string]::IsNullOrWhiteSpace($TargetCountry)) {
    $TargetCountry = Read-Host "Enter target country, for example Indonesia / Thailand / Vietnam / Philippines / Malaysia / Singapore"
}

$imagePaths = Resolve-InputImages $Images
$locale = Get-LocaleProfile $TargetCountry
$outputRootPath = Join-ProjectPath $OutputRoot
if ([string]::IsNullOrWhiteSpace($RunId)) {
    $RunId = "$(Get-Date -Format 'yyyyMMdd-HHmmss-fff')-$([Guid]::NewGuid().ToString('N').Substring(0, 6))"
}
$runId = $RunId
$runDir = Join-Path $outputRootPath $runId
New-Item -ItemType Directory -Force -Path $runDir, (Join-Path $runDir "api_payloads") | Out-Null

$inputManifest = [ordered]@{
    run_id = $runId
    created_at = (Get-Date).ToString("o")
    target_country = $TargetCountry
    locale_profile = $locale
    brand_name = $BrandName
    audience = $Audience
    creative_variant = [ordered]@{
        index = $VariantIndex
        total = $VariantCount
    }
    images = @($imagePaths | ForEach-Object { [ordered]@{ path = $_; filename = Split-Path -Leaf $_ } })
}
Save-Json (Join-Path $runDir "input-manifest.json") $inputManifest

$systemVision = Get-Content -LiteralPath (Join-ProjectPath "prompts\00_vision_analysis.system.md") -Raw -Encoding UTF8
$imageList = ($imagePaths | ForEach-Object { "- $(Split-Path -Leaf $_)" }) -join "`n"
$userPromptVision = @"
Shoe product image files:
$imageList

Inspect the shoe product images and produce the strict visual product analysis JSON required by the system prompt.
"@

$visionAnalysis = Invoke-ChatModel `
    -ConfigPrefix "VISION" `
    -DefaultModel "gpt-5.4-mini" `
    -DefaultUrl "https://api.openai.com/v1/chat/completions" `
    -StageName "00_vision_analysis" `
    -SystemPrompt $systemVision `
    -UserPrompt $userPromptVision `
    -ImagePaths $imagePaths `
    -RunDir $runDir

if ($null -eq $visionAnalysis) {
    $visionAnalysis = New-MockVisionPackage -ImagePaths $imagePaths
}
Save-Json (Join-Path $runDir "vision-analysis.json") $visionAnalysis

$systemA = Get-Content -LiteralPath (Join-ProjectPath "prompts\01_planning_and_script.system.md") -Raw -Encoding UTF8
$visionJson = $visionAnalysis | ConvertTo-Json -Depth 80
$userPromptA = @"
Target country: $TargetCountry
Locale profile:
$($locale | ConvertTo-Json -Depth 20)

Brand name: $BrandName
Audience: $Audience
Creative variant: $VariantIndex of $VariantCount

When more than one creative variant is requested, make this version materially different from the others in its opening hook, visual theme, shot rhythm, and primary selling-point emphasis. Keep all product facts and product-lock rules unchanged.

Upstream vision_analysis:
$visionJson

Use the upstream vision analysis as the only source of product facts. Create the localized 20-second ecommerce ad planning package. Output strictly valid JSON matching the system prompt shape.
"@

$planning = Invoke-ChatModel `
    -ConfigPrefix "TEXT" `
    -DefaultModel "deepseek-chat" `
    -DefaultUrl "https://api.deepseek.com/chat/completions" `
    -StageName "01_planning" `
    -SystemPrompt $systemA `
    -UserPrompt $userPromptA `
    -ImagePaths @() `
    -RunDir $runDir
if ($null -eq $planning) {
    $planning = New-MockPlanningPackage -Locale $locale -ImagePaths $imagePaths -Brand $BrandName -AudienceValue $Audience -CreativeVariant $VariantIndex
}
Save-Json (Join-Path $runDir "planning-package.json") $planning

Write-Host ""
Write-Host "Planning package saved:" (Join-Path $runDir "planning-package.json")
Write-Host "Target country:" (Get-ObjectProperty (Get-ObjectProperty $planning "locale_profile") "target_country")
Write-Host "Language:" (Get-ObjectProperty (Get-ObjectProperty $planning "locale_profile") "language")
Write-Host ""

if (-not $SkipConfirm) {
    $answer = Read-Host "After reviewing selling points, script, and localized copy, type CONFIRM to continue to image prompts"
    if ($answer -notmatch "confirm|ok|yes|continue|generate") {
        Write-Host "Stopped before image generation. You can rerun with -SkipConfirm after reviewing planning-package.json."
        exit 0
    }
}

$systemB = Get-Content -LiteralPath (Join-ProjectPath "prompts\02_image_package.system.md") -Raw -Encoding UTF8
$planningJson = $planning | ConvertTo-Json -Depth 80
$userPromptB = @"
This is the confirmed planning-package.json:

$planningJson

Generate storyboard board prompts, clean keyframe prompts, and manual Flow Omni handoff packages. Output strictly valid JSON matching the system prompt shape.
"@

$imagePackage = Invoke-ChatModel `
    -ConfigPrefix "TEXT" `
    -DefaultModel "deepseek-chat" `
    -DefaultUrl "https://api.deepseek.com/chat/completions" `
    -StageName "02_image_package" `
    -SystemPrompt $systemB `
    -UserPrompt $userPromptB `
    -ImagePaths @() `
    -RunDir $runDir
if ($null -eq $imagePackage) {
    $imagePackage = New-MockImagePackage -Planning $planning -ImagePaths $imagePaths
}
Save-Json (Join-Path $runDir "image-package.json") $imagePackage

$imageAssets = Get-ObjectProperty $imagePackage "image_generation"
if (-not $imageAssets) {
    throw "image-package.json does not contain image_generation."
}

$imageResults = @()
foreach ($asset in $imageAssets) {
    $result = Invoke-ImageModel -ImageAsset $asset -ReferenceImagePaths $imagePaths -RunDir $runDir
    $imageResults += $result
}

Save-Json (Join-Path $runDir "image-results.json") $imageResults

$manualOmni = Get-ObjectProperty $imagePackage "manual_omni_packages"
Save-Json (Join-Path $runDir "manual-omni-package.json") $manualOmni

$finalPackage = [ordered]@{
    input_manifest = "input-manifest.json"
    vision_analysis = "vision-analysis.json"
    planning_package = "planning-package.json"
    image_package = "image-package.json"
    image_results = "image-results.json"
    manual_omni_package = "manual-omni-package.json"
    run_dir = $runDir
}
Save-Json (Join-Path $runDir "final-package.json") $finalPackage

Write-Host ""
Write-Host "Done. Image-stage package is ready:"
Write-Host $runDir
Write-Host ""
Write-Host "Next files to use:"
Write-Host "- planning-package.json"
Write-Host "- image-package.json"
Write-Host "- image-results.json"
Write-Host "- manual-omni-package.json"
