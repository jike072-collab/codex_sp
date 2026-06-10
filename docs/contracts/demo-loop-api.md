# Local Demo Loop API Contract

This contract is frozen for the first runnable local demo loop. Frontend and backend implementations must use these exact routes and payload fields.

## Project Stages

```text
assets -> analyzing -> review -> market -> script -> visual -> export
```

- Saving the market brief enters `script`.
- Generating a script keeps the project in `script`.
- Confirming an edited script enters `visual`.
- Generating visual prompts enters `export` in no-key demo mode or when both
  storyboard images finish successfully. If a real image provider call partly
  fails, the project keeps the successful storyboard image, returns a retryable
  provider error, and stays in `visual`.

All successful mutation responses return:

```json
{
  "project": {
    "...": "complete persisted project object"
  }
}
```

Expected client errors use:

```json
{
  "error": "Human-readable message",
  "code": "STABLE_ERROR_CODE"
}
```

## Generate Demo Script

```http
POST /api/projects/:projectId/script/generate
```

Request body is optional. An empty JSON object is accepted. The browser may
send `shotsPerSegment` to choose how many shots each 10-second segment should
contain:

```json
{
  "shotsPerSegment": 5
}
```

Allowed values are `3`, `4`, and `5`; invalid or missing values default to `5`.

Requirements:

- Project status is `script`.
- Confirmed `visionAnalysis` exists.
- Confirmed `marketBrief` exists.

Behavior:

- When `TEXT_MODEL_API_KEY` is configured, generate the planning package through
  the configured DeepSeek-compatible text provider.
- Without a usable text key, generate the deterministic local planning package.
- Repeated demo calls replace the unconfirmed planning package with the same
  deterministic result. API mode may return different creative wording.
- Project status remains `script`.
- Each generated 10-second segment contains the requested number of shots in
  demo mode. API mode receives the requested count in the text-provider prompt
  and must still pass the 20-second timeline validator.
- Set `scriptGeneratedAt`.
- Clear `scriptConfirmedAt` when replacing an unconfirmed package.

The persisted `planningPackage` shape is:

```json
{
  "mode": "demo",
  "locale_profile": {
    "target_country": "Thailand",
    "language": "Thai",
    "subtitle_style": "Short, friendly ecommerce captions.",
    "voiceover_style": "Energetic and natural.",
    "cta_style": "Short shopping CTA."
  },
  "product_lock_manifest": {},
  "selling_points": [
    {
      "point": "Distinctive product identity",
      "evidence": "visible",
      "visual_proof": "Product colors and silhouette are visible in references.",
      "ad_expression": "Keep the shoe clearly recognizable."
    }
  ],
  "creative_direction": {
    "video_positioning": "20-second local ecommerce shoe ad",
    "core_emotion": ["ready", "confident"],
    "visual_style": ["clean product hero", "fast ecommerce cuts"],
    "recommended_theme": "city-motion",
    "theme_reason": "Selected in the confirmed market brief."
  },
  "script_20s": {
    "total_duration_sec": 20,
    "segment_a_0_10s": {
      "segment_id": "0-10s",
      "theme": "Hook and product identity",
      "duration_sec": 10,
      "shots": []
    },
    "segment_b_10_20s": {
      "segment_id": "10-20s",
      "theme": "Proof and product close",
      "duration_sec": 10,
      "shots": []
    }
  },
  "localized_copy": {
    "caption_lines": [],
    "cta_options": [],
    "do_not_use": []
  },
  "confirmation_summary": {
    "what_to_confirm": [],
    "risk_notes": []
  }
}
```

Every shot uses:

```json
{
  "start_sec": 0,
  "end_sec": 2.5,
  "visual": "",
  "action": "",
  "camera": "",
  "selling_point": "",
  "localized_caption_or_vo": "",
  "sound": "",
  "transition": ""
}
```

## Confirm Edited Script

```http
POST /api/projects/:projectId/script/confirm
Content-Type: application/json
```

Request:

```json
{
  "planningPackage": {
    "...": "complete planning package from the generate response, including edits"
  }
}
```

Requirements:

- Project status is `script`.
- A generated planning package already exists.
- The submitted product lock must preserve all confirmed `must_keep` and `must_not_change` entries.
- Total duration is exactly 20 seconds.
- Each segment duration is exactly 10 seconds.
- Segment A covers `0` through `10`; segment B covers `10` through `20`.
- Shots are non-empty, ordered, contiguous, non-overlapping, and have all required string fields.

Behavior:

- Normalize and persist the complete submitted package.
- Set `scriptConfirmedAt`.
- Enter `visual`.

## Generate Visual Prompts

```http
POST /api/projects/:projectId/visual/generate
```

Request body is optional. An empty JSON object is accepted.

Requirements:

- Project status is `visual`.
- A confirmed planning package exists.

Behavior:

- Always generate two deterministic storyboard prompt entries first.
- The overall generated image is a storyboard sheet/delivery board. It is not
  forced to the Step 02 video aspect ratio.
- Step 02 `marketBrief.outputAspectRatio` controls the composition ratio of
  each internal shot frame/panel inside the storyboard sheet.
- When `IMAGE_MODEL_API_KEY` is configured and the provider is not `manual`,
  call the configured image provider once for each missing storyboard entry.
  Real provider calls are img2img-only and must include the uploaded shoe
  reference images.
- When both storyboard entries are missing, both provider requests must be
  started before waiting for either provider response. They must not be
  serialized as first image then second image.
- Without a usable image key, keep local no-key demo behavior: create the two
  prompt/storyboard entries without making a paid provider call.
- Create exactly two `image_generation` entries:
  - `0-10s_storyboard_board`, storyboard sheet with internal shot panels at the selected aspect ratio
  - `10-20s_storyboard_board`, storyboard sheet with internal shot panels at the selected aspect ratio
- Every prompt includes the confirmed product `must_keep` and `must_not_change` rules.
- Do not create separate keyframe images or Flow Omni packages for V1.
- On full success, set `visualGeneratedAt`, clear `visualGenerationFailure`,
  and enter `export`.
- On partial provider success, preserve any stored local storyboard image,
  set `imagePackage.mode` to `partial`, record `visualGenerationFailure`, keep
  the project in `visual`, and return the provider error. Retrying
  `/visual/generate` reuses already stored local storyboard images and only
  calls the provider for missing entries.

Persisted fields:

```json
{
  "imagePackage": {
    "mode": "demo",
    "storyboard_plan": {},
    "image_generation": [],
    "qc_checklist": []
  },
  "manualOmniPackages": []
}
```

In API image mode, each `image_generation` item also includes:

```json
{
  "generated_image": {
    "provider": "right_codes",
    "model": "gpt-image-2",
    "url": "https://provider.example/generated.png",
    "size": "1536x1024",
    "referenceMode": "reference_images"
  }
}
```

On a retryable visual provider failure, the persisted project includes:

```json
{
  "status": "visual",
  "visualGeneratedAt": null,
  "visualGenerationFailure": {
    "code": "IMAGE_PROVIDER_TIMEOUT",
    "message": "Human-readable provider failure.",
    "failedAt": "ISO-8601 timestamp",
    "possiblyBilled": true
  }
}
```

## Export Delivery Package

```http
GET /api/projects/:projectId/export
```

Requirements:

- Project status is `export`.
- Planning package and exactly two current-aspect `storyboard_board` entries
  exist, one for `0-10s` and one for `10-20s`.

Response:

- Status `200`.
- `Content-Type: application/json; charset=utf-8`.
- `Content-Disposition: attachment; filename="shoe-ad-<projectId>.json"`.
- Body is the export package itself, not wrapped in `{ "project": ... }`.

Export shape:

```json
{
  "schemaVersion": 1,
  "exportedAt": "ISO-8601 timestamp",
  "project": {
    "id": "",
    "name": "",
    "targetCountry": "",
    "audience": "",
    "createdAt": "",
    "updatedAt": ""
  },
  "sourceAssets": [
    {
      "id": "",
      "name": "",
      "mimeType": "",
      "size": 0
    }
  ],
  "visionAnalysis": {},
  "marketBrief": {},
  "planningPackage": {},
  "imagePackage": {},
  "storyboardDeliverables": [
    {
      "segment_id": "0-10s",
      "aspect_ratio": "9:16",
      "storyboard": {},
      "script": {},
      "script_copy": ""
    },
    {
      "segment_id": "10-20s",
      "aspect_ratio": "9:16",
      "storyboard": {},
      "script": {},
      "script_copy": ""
    }
  ],
  "manualOmniPackages": [],
  "qcChecklist": []
}
```

Local filesystem paths, stored filenames, hashes, and API credentials must not appear in the export.

The local API keeps this JSON route for compatibility and internal verification.
UI V2 must not show a JSON download button; the final screen presents only the
two storyboard images, their two matching scripts, and copy controls.

## Project List Summary

```http
GET /api/projects
```

The project list returns compact summaries for the sidebar and right-side
readiness panel. Heavy generated payloads such as `visionAnalysis`,
`planningPackage`, and `imagePackage` are omitted from each summary, but the
summary includes enough status for UI V2:

```json
{
  "projects": [
    {
      "id": "opaque-project-id",
      "name": "Project name",
      "status": "visual",
      "assets": [],
      "hasAnalysis": true,
      "hasPlanningPackage": true,
      "hasImagePackage": true,
      "exportReady": false,
      "visualNeedsRegeneration": false,
      "visualGenerationFailure": {
        "code": "IMAGE_PROVIDER_TIMEOUT",
        "message": "Human-readable provider failure.",
        "failedAt": "ISO-8601 timestamp",
        "possiblyBilled": true
      },
      "omniPackageCount": 0
    }
  ]
}
```

Use `exportReady` to decide whether the final two-storyboard delivery is ready.
Use `visualNeedsRegeneration` for old export-era projects whose stored
storyboard package does not match the current two-storyboard contract.

## Restore Behavior

`GET /api/projects/:projectId` returns all persisted workflow fields. The frontend must render from project state:

- `script` with no `planningPackage`: show Generate Script.
- `script` with `planningPackage`: show editable script.
- `visual`: show the action to generate two storyboard images.
- `visual` with `imagePackage.mode` of `partial`: show the successful local
  storyboard image, the missing/failed entry, and a retry action.
- `export` with `exportReady: false`: show that current-size storyboards must
  be regenerated.
- `export` with generated images: show two clickable storyboard images, the matching
  0-10s and 10-20s script copy actions.
