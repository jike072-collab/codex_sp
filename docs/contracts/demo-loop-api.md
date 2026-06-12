# Local Demo Loop API Contract

This contract is frozen for the first runnable local loop inside `studio-v2/`.

## Project Stages

```text
assets -> analyzing -> review -> market -> script -> visual -> export
```

- Saving the market brief enters `script`.
- Generating a script keeps the project in `script`.
- Confirming a script enters `visual`.
- Storyboard generation enters `export` only after the required storyboard
  assets for the current workflow mode are complete.

Newly created projects default to:

```json
{
  "workflowMode": "single_video"
}
```

Legacy projects without that field remain readable as
`legacy_multi_segment`.

## Market Brief

```http
POST /api/projects/:projectId/market
```

Persisted `marketBrief` now includes:

```json
{
  "targetCountry": "Thailand",
  "audience": "Daily commuters",
  "creativeTheme": "city-motion",
  "coreMessage": "Light and stable",
  "tone": "energetic",
  "outputAspectRatio": "9:16",
  "videoDurationSeconds": 10
}
```

Rules:

- `videoDurationSeconds` is an integer from `5` through `15`.
- Omitted `videoDurationSeconds` defaults to `10`.
- `outputAspectRatio` controls the internal composition ratio for storyboard
  shot panels and final video framing.

## Generate Script

```http
POST /api/projects/:projectId/script/generate
```

Request body is optional.

Current default mode:

- backend produces `planningPackage.workflow_mode = "single_video"`
- backend produces `planningPackage.script_video`
- the timeline starts at `0` and ends at `marketBrief.videoDurationSeconds`
- shot count is derived from duration; it is not fixed to two 10-second
  segments

Legacy projects keep:

- `planningPackage.workflow_mode = "legacy_multi_segment"`
- `planningPackage.script_20s`
- two 10-second segments

Example current planning package:

```json
{
  "mode": "demo",
  "workflow_mode": "single_video",
  "locale_profile": {},
  "product_lock_manifest": {},
  "selling_points": [],
  "creative_direction": {},
  "script_video": {
    "total_duration_sec": 12,
    "segment_full": {
      "segment_id": "full",
      "theme": "Single video hero story",
      "duration_sec": 12,
      "shots": []
    }
  },
  "localized_copy": {},
  "confirmation_summary": {}
}
```

## Confirm Script

```http
POST /api/projects/:projectId/script/confirm
```

Rules:

- submitted product lock must preserve all confirmed `must_keep` and
  `must_not_change` items
- `single_video` confirms `script_video.segment_full`
- `legacy_multi_segment` confirms `script_20s`
- shots must be non-empty, ordered, contiguous, and non-overlapping

## Generate Storyboards

```http
POST /api/projects/:projectId/visual/generate
```

Rules:

- storyboard outer canvas is a storyboard delivery sheet, not a cropped video
  frame
- internal shot panels must follow `marketBrief.outputAspectRatio`
- real generation is always `img2img`; prompt-only fallback is forbidden
- uploaded shoe images must be included as references

Current default mode:

- create exactly one `image_generation` item with `segment_id: "full"`
- provider uses draw channel A

Legacy mode:

- create two storyboard items: `0-10s` and `10-20s`
- missing items are started concurrently

On provider failure:

- preserve any successful storyboard image
- record `visualGenerationFailure`
- retry only regenerates missing items

## Export Package

```http
GET /api/projects/:projectId/export
```

Rules:

- requires `status: "export"`
- requires the current workflow mode's storyboard assets to be complete
- current default mode exports one storyboard deliverable
- legacy mode exports two storyboard deliverables

Local filesystem paths, stored filenames, hashes, prompts, and API credentials
must not appear in the export payload.
