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

Projects without that field are inferred from their persisted script shape.
The persisted value `legacy_multi_segment` is presented to users as
“双版 20 秒”.

## Switch Workflow Mode

```http
PUT /api/projects/:projectId/workflow-mode
Content-Type: application/json

{
  "workflowMode": "legacy_multi_segment",
  "confirmReset": false
}
```

Accepted `workflowMode` values are `single_video` and
`legacy_multi_segment`. The latter is always labeled “双版 20 秒” in
user-facing surfaces.

- With no `planningPackage`, `imagePackage`, or `videoPackage`, the mode is
  saved immediately and returns `200`.
- If script or downstream results exist and `confirmReset` is not `true`, the
  route returns `409 WORKFLOW_MODE_RESET_REQUIRED`.
- The `409` body includes `currentWorkflowMode`, `requestedWorkflowMode`, and
  `resetStages`, whose values are drawn from `script`, `storyboard`, and
  `video`.
- With `confirmReset: true`, the backend switches mode in one saved update,
  clears script/storyboard/video packages plus their generated, confirmed,
  failure, and timing state, and returns the project to `status: "script"`.
- Assets, vision analysis, confirmed product lock, review confirmation,
  market brief, and market confirmation are preserved.

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

Single mode:

- backend produces `planningPackage.workflow_mode = "single_video"`
- backend produces `planningPackage.script_video`
- the timeline starts at `0` and ends at `marketBrief.videoDurationSeconds`
- shot count is derived from duration; it is not fixed to two 10-second
  segments

Dual 20-second mode keeps:

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
- normalized `visual + action + camera` signatures must be unique
- a majority of shots may not reuse the same template for any two of
  `visual`, `action`, and `camera`
- repeated model output returns a Chinese `INVALID_SCRIPT` message and is not
  retried automatically

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

Single mode:

- create exactly one `image_generation` item with `segment_id: "full"`
- provider uses draw channel A

Dual 20-second mode:

- create two storyboard items: `0-10s` and `10-20s`
- missing items are started concurrently
- `0-10s` uses draw channel A and `10-20s` uses draw channel B

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
- single mode exports one storyboard deliverable
- dual 20-second mode exports two storyboard deliverables

Local filesystem paths, stored filenames, hashes, prompts, and API credentials
must not appear in the export payload.
