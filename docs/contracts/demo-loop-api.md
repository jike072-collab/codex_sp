# Local Demo Loop API Contract

This contract is frozen for the first runnable local demo loop. Frontend and backend implementations must use these exact routes and payload fields.

## Project Stages

```text
assets -> analyzing -> review -> market -> script -> visual -> export
```

- Saving the market brief enters `script`.
- Generating a script keeps the project in `script`.
- Confirming an edited script enters `visual`.
- Generating visual prompts enters `export`.

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

- Always generate the deterministic visual prompt and Flow Omni package first.
- When `IMAGE_MODEL_API_KEY` is configured and the provider is not `manual`,
  call the configured image provider once for each of the four prompt entries.
- Without a usable image key, keep prompt-only demo behavior.
- Create exactly four `image_generation` entries:
  - `0-10s_storyboard_board`, `16:9`
  - `0-10s_video_keyframe`, `9:16`
  - `10-20s_storyboard_board`, `16:9`
  - `10-20s_video_keyframe`, `9:16`
- Every prompt includes the confirmed product `must_keep` and `must_not_change` rules.
- Create exactly two `manualOmniPackages`, one for each segment.
- Set `visualGeneratedAt`.
- Enter `export`.

Persisted fields:

```json
{
  "imagePackage": {
    "mode": "demo",
    "storyboard_plan": {},
    "image_generation": [],
    "qc_checklist": []
  },
  "manualOmniPackages": [
    {
      "segment_id": "0-10s",
      "upload_references": [],
      "script": {},
      "flow_omni_prompt": "",
      "caption_note": ""
    }
  ]
}
```

In API image mode, each `image_generation` item also includes:

```json
{
  "generated_image": {
    "provider": "right_codes",
    "model": "gpt-image-2",
    "url": "https://provider.example/generated.png",
    "size": "1024x1536",
    "referenceMode": "reference_images"
  }
}
```

## Export Delivery Package

```http
GET /api/projects/:projectId/export
```

Requirements:

- Project status is `export`.
- Planning, visual, and Omni packages exist.

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
  "manualOmniPackages": [],
  "qcChecklist": []
}
```

Local filesystem paths, stored filenames, hashes, and API credentials must not appear in the export.

## Restore Behavior

`GET /api/projects/:projectId` returns all persisted workflow fields. The frontend must render from project state:

- `script` with no `planningPackage`: show Generate Script.
- `script` with `planningPackage`: show editable script.
- `visual`: show Generate Visual Prompts.
- `export`: show prompts, Omni packages, copy actions, and JSON download.
