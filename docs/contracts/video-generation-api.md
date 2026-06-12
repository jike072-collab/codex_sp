# Video Generation API

Step 05 is now a backend video workflow. The ordinary workbench still stays on
the existing project stage machine and continues to use `status: "export"` as
the ready-for-delivery stage, but the persisted project record now carries a
separate `videoPackage`.

Only backend-owned files may produce or mutate this contract.

## Routes

### Generate Missing Segments

```http
POST /api/projects/:projectId/videos/generate
```

Rules:

- Requires the current two-storyboard export shape to be ready.
- Builds two 10-second requests from:
  - `planningPackage.script_20s.segment_a_0_10s`
  - `planningPackage.script_20s.segment_b_10_20s`
  - the matching storyboard sheet image for each segment
  - all uploaded product reference images
  - `marketBrief.outputAspectRatio`
- Missing segments are submitted concurrently.
- Completed local videos are kept; already completed segments are not
  regenerated.
- Failure of one segment does not delete the other segment's success.
- No automatic retry is performed for provider timeouts such as `HTTP 524`
  because the provider may already have billed the request.

Success response:

```json
{
  "project": {
    "id": "opaque-project-id",
    "videoPackage": {
      "mode": "provider",
      "video_generation": [
        { "segment_id": "0-10s", "status": "queued" },
        { "segment_id": "10-20s", "status": "queued" }
      ]
    }
  }
}
```

### Poll Provider Status

```http
GET /api/projects/:projectId/videos/status
```

Rules:

- Refreshes only in-flight segments: `submitting`, `queued`, `generating`, or
  `downloading`.
- Downloads completed provider videos into local project storage.
- Keeps safe per-segment diagnostics without leaking full keys, prompt text,
  base64 payloads, image/video contents, or provider response bodies.
- If local `ffmpeg` is available, the backend may try to merge the two finished
  10-second segments into a final 20-second video.
- If `ffmpeg` is unavailable or merge fails, the API still succeeds and keeps
  the two segment videos.

### Retry One Failed Segment

```http
POST /api/projects/:projectId/videos/:segmentId/retry
```

`segmentId` must be `0-10s` or `10-20s`.

Rules:

- Resets only the targeted failed segment.
- Preserves the other segment's completed local video.
- Clears any previous merged `final_video` so a later refresh can rebuild it if
  both segments become ready.

### Download One Segment

```http
GET /api/projects/:projectId/videos/:segmentId/download
```

Downloads the locally stored segment file with its persisted MIME type.
Returns `409 VIDEO_NOT_READY` when the segment does not yet have a stored local
video.

### Download Final Merged Video

```http
GET /api/projects/:projectId/videos/final/download
```

Returns the locally merged final video when available. Returns
`409 FINAL_VIDEO_NOT_READY` when the project only has two segment videos or the
local merge is unavailable.

## Persisted `videoPackage`

The project schema now includes:

```json
{
  "videoPackage": {
    "requestedAt": "2026-06-12T01:10:00.000Z",
    "aspect_ratio": "4:5",
    "mode": "partial",
    "video_generation": [
      {
        "asset_id": "0-10s_video_segment",
        "segment_id": "0-10s",
        "type": "video_segment",
        "aspect_ratio": "4:5",
        "duration_sec": 10,
        "storyboard_asset_id": "storyboard-a",
        "storyboard_image_url": "/uploads/project/storyboard-a.png",
        "status": "done",
        "script_copy": "0-10s script copy",
        "generated_video": {
          "provider": "clmm-mall.top",
          "model": "seedance2.0 720p-fast",
          "url": "/uploads/project/video-0-10s.mp4",
          "storedName": "video-0-10s.mp4",
          "mimeType": "video/mp4",
          "size": 123456
        }
      },
      {
        "asset_id": "10-20s_video_segment",
        "segment_id": "10-20s",
        "type": "video_segment",
        "aspect_ratio": "4:5",
        "duration_sec": 10,
        "storyboard_asset_id": "storyboard-b",
        "storyboard_image_url": "/uploads/project/storyboard-b.png",
        "status": "failed",
        "script_copy": "10-20s script copy",
        "error": {
          "code": "VIDEO_PROVIDER_TIMEOUT",
          "message": "Video generation timed out.",
          "retryable": true,
          "failedAt": "2026-06-12T01:10:12.000Z"
        },
        "provider_diagnostics": {
          "segmentId": "10-20s",
          "assetId": "10-20s_video_segment",
          "attemptId": "opaque-attempt-id",
          "startedAt": "2026-06-12T01:10:00.000Z",
          "model": "seedance2.0 720p-fast",
          "aspectRatio": "4:5",
          "durationSec": 10,
          "providerHost": "clmm-mall.top",
          "providerPath": "/v1/videos/generations",
          "storyboardImageCount": 1,
          "referenceImageCount": 1,
          "inputImageCount": 2,
          "referenceImageTotalBytes": 2048,
          "storyboardImageBytes": 4096,
          "keyPreview": "•••• 9744",
          "providerStatus": 524,
          "providerRequestId": "opaque-request-id",
          "errorCode": "VIDEO_PROVIDER_TIMEOUT",
          "outcome": "failed"
        }
      }
    ],
    "final_video": {
      "status": "unavailable",
      "reason": "ffmpeg_not_available"
    }
  }
}
```

`videoPackage.mode` values:

- `waiting`
- `provider`
- `partial`
- `done`

Per-segment `status` values:

- `waiting`
- `submitting`
- `queued`
- `generating`
- `downloading`
- `done`
- `failed`

`final_video.status` values:

- `waiting`
- `merging`
- `done`
- `unavailable`
- `failed`

## Provider Request Shape

The default provider configuration targets the OpenAI-video-compatible channel
at `clmm-mall.top` with model `seedance2.0 720p-fast`.

Backend request shape:

```json
{
  "model": "seedance2.0 720p-fast",
  "prompt": "segment-specific video prompt",
  "image": [
    "data:image/png;base64,...storyboard-sheet...",
    "data:image/png;base64,...reference-shoe..."
  ],
  "duration": 10,
  "resolution": "720p",
  "aspect_ratio": "4:5",
  "response_format": "url"
}
```

Notes:

- The storyboard sheet is the first image and remains a sheet-style reference.
- Uploaded product images are passed as full intact references after the sheet.
- `aspect_ratio` comes from Step 02 and controls the internal video framing.
- The backend does not log the prompt body, base64 images, or complete provider
  response payloads.

Provider response handling accepts either:

- an immediate downloadable video URL, or
- an async job id plus status URL for later polling.
