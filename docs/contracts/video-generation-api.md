# Video Generation API

Step 05 now centers on backend video generation.

Current default mode for newly created projects is `single_video`:

- one confirmed script package: `planningPackage.script_video`
- one storyboard sheet: `imagePackage.image_generation[0]`
- one video task: `videoPackage.video_generation[0]`

Dual 20-second projects persist as `legacy_multi_segment` and keep their two
10-second segment behavior. User-facing surfaces call this mode “双版 20 秒”.

Mode changes use:

```http
PUT /api/projects/:projectId/workflow-mode
```

with `{ "workflowMode": "...", "confirmReset": false }`. The route returns
`200` for a direct switch when no downstream result exists, or
`409 WORKFLOW_MODE_RESET_REQUIRED` with current/requested modes and
`resetStages` when script, storyboard, or video state would be removed.
Retrying with `confirmReset: true` clears those downstream packages before a
new mode-specific video package can be created.

## Routes

### Generate Missing Video Tasks

```http
POST /api/projects/:projectId/videos/generate
```

Rules:

- Requires export-ready storyboard assets for the current workflow mode.
- `single_video` builds one request from:
  - `planningPackage.script_video.segment_full`
  - the `full` storyboard sheet
  - all uploaded product reference images
  - `marketBrief.outputAspectRatio`
  - `marketBrief.videoDurationSeconds`
- `legacy_multi_segment` keeps the dual-request flow:
  - `0-10s`
  - `10-20s`
- Missing video tasks are submitted concurrently.
- Completed local videos are preserved.
- Failed tasks are kept as failed; retry only resubmits the missing or failed
  task.
- `HTTP 524`, `504`, and `408` are treated as possibly billed timeouts, so the
  backend does not auto-retry them.

Success example for the current default mode:

```json
{
  "project": {
    "id": "opaque-project-id",
    "videoPackage": {
      "workflow_mode": "single_video",
      "mode": "provider",
      "video_generation": [
        { "segment_id": "full", "status": "queued", "duration_sec": 12 }
      ],
      "final_video": {
        "status": "unavailable",
        "reason": "single_video_mode"
      }
    }
  }
}
```

### Poll Provider Status

```http
GET /api/projects/:projectId/videos/status
```

Rules:

- Refreshes only in-flight tasks: `submitting`, `queued`, `generating`, or
  `downloading`.
- Downloads completed provider videos into local project storage.
- Keeps safe per-task diagnostics without leaking full keys, prompt text,
  base64 payloads, image contents, video contents, or full provider response
  bodies.
- `single_video` never requires an ffmpeg merge step.
- `legacy_multi_segment` may still attempt a local ffmpeg merge after both
  segment videos complete.

### Retry One Failed Task

```http
POST /api/projects/:projectId/videos/:segmentId/retry
```

Current valid `segmentId` values:

- `full` for `single_video`
- `0-10s`
- `10-20s`

Rules:

- Resets only the targeted failed task.
- Preserves every already completed local video.
- For dual 20-second projects, clears any previous merged `final_video`
  so a later refresh can rebuild it.

### Download One Local Video

```http
GET /api/projects/:projectId/videos/:segmentId/download
```

Returns the stored local video for the target task. Returns
`409 VIDEO_NOT_READY` when that task has not produced a local file yet.

### Download Dual-Segment Final Merge

```http
GET /api/projects/:projectId/videos/final/download
```

Only applies to dual 20-second projects. Returns
`409 FINAL_VIDEO_NOT_READY` when no merged local file exists.

## Persisted `videoPackage`

Current default mode:

```json
{
  "videoPackage": {
    "requestedAt": "2026-06-12T01:10:00.000Z",
    "aspect_ratio": "4:5",
    "workflow_mode": "single_video",
    "mode": "done",
    "video_generation": [
      {
        "asset_id": "full_video_segment",
        "segment_id": "full",
        "type": "video_segment",
        "aspect_ratio": "4:5",
        "duration_sec": 12,
        "storyboard_asset_id": "full_storyboard_board",
        "storyboard_image_url": "/uploads/project/storyboard-full.png",
        "status": "done",
        "script_copy": "full video script copy",
        "generated_video": {
          "provider": "clmm-mall.top",
          "model": "seedance2.0 720p-fast",
          "url": "/uploads/project/video-full.mp4",
          "storedName": "video-full.mp4",
          "mimeType": "video/mp4",
          "size": 123456,
          "durationSec": 12,
          "aspectRatio": "4:5"
        }
      }
    ],
    "final_video": {
      "status": "unavailable",
      "reason": "single_video_mode"
    }
  }
}
```

Dual 20-second projects keep:

- `workflow_mode: "legacy_multi_segment"`
- two `video_generation[]` items for `0-10s` and `10-20s`
- optional local `final_video`

## Provider Request Shape

Default video provider configuration:

- API URL: `https://clmm-mall.top/v1/videos/generations`
- model: `seedance2.0 720p-fast`
- authentication: `Authorization: Bearer <VIDEO_MODEL_API_KEY>`

Backend request shape:

```json
{
  "model": "seedance2.0 720p-fast",
  "prompt": "segment-specific video prompt",
  "image": [
    "data:image/png;base64,...storyboard-sheet...",
    "data:image/png;base64,...reference-shoe..."
  ],
  "duration": 12,
  "resolution": "720p",
  "aspect_ratio": "4:5",
  "response_format": "url"
}
```

Notes:

- The storyboard sheet is always the first reference image.
- Uploaded product photos are appended as full intact identity references.
- `aspect_ratio` comes from Step 02 and controls the internal video framing.
- In current mode, `duration` must match `marketBrief.videoDurationSeconds`.
- The backend never logs or returns the full API key, prompt body, base64 image
  payloads, raw video payloads, or full provider response bodies.
