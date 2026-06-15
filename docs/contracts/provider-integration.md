# Provider Integration Contract

The browser never receives provider credentials. Provider selection and request
construction stay entirely server-side.

## Workflow Mode Reset Boundary

`PUT /api/projects/:projectId/workflow-mode` accepts:

```json
{ "workflowMode": "single_video", "confirmReset": false }
```

It returns `200` when no downstream package must be removed. If planning,
storyboard, or video state exists, it returns
`409 WORKFLOW_MODE_RESET_REQUIRED` until `confirmReset: true` is supplied.
The confirmed update clears provider-derived script, image, video, failure,
and timing state in one project save while preserving source assets, vision
analysis, product lock confirmation, and market settings.

## Vision

- Workflow route: `POST /api/projects/:projectId/analyze`
- Provider: Right Code native Gemini endpoint
- Default base endpoint: `https://right.codes/gemini`
- Default model: `gemini-2.5-flash`
- Authentication: `x-goog-api-key: <VISION_MODEL_API_KEY>`
- Request format: Gemini `generateContent`
- No usable key: deterministic demo analysis
- Failure code: `VISION_PROVIDER_ERROR`

The minimum analyze contract is one uploaded image file. A single uploaded file
may already be a four-view collage; the backend forwards that original collage
image intact and does not require splitting it into multiple files.

## Script

- Workflow route: `POST /api/projects/:projectId/script/generate`
- Default provider: official DeepSeek OpenAI-compatible chat endpoint
- Configured provider may be any compatible current script channel, including
  local Sub2API.
- Default endpoint: `https://api.deepseek.com/chat/completions`
- Default model: `deepseek-v4-pro`
- Authentication: `Authorization: Bearer <TEXT_MODEL_API_KEY>`
- Response format: JSON object
- No usable key: deterministic demo planning package
- Failure code: `TEXT_PROVIDER_ERROR`
- Invalid generated package code: `TEXT_PROVIDER_INVALID_OUTPUT`

Single mode (`single_video`):

- `planningPackage.workflow_mode = "single_video"`
- `planningPackage.script_video.total_duration_sec = marketBrief.videoDurationSeconds`
- one full timeline from `0` to the selected duration

Dual 20-second mode (`legacy_multi_segment`) keeps two 10-second segments.
The shared system prompt does not hard-code either script shape. Each model
request appends a mode-specific output contract and includes the selected mode,
total duration, required and forbidden top-level keys, a complete
mode-specific `output_schema`, and shot-diversity rules. Single mode accepts
only `script_video.segment_full`; dual mode accepts only `script_20s`.
Generated or edited scripts are rejected when `visual + action + camera`
repeats exactly or when a majority of shots reuse the same two-field template.
Invalid provider output is returned with neutral script-channel wording and
without a paid silent retry.

## Images

- Workflow route: `POST /api/projects/:projectId/visual/generate`
- Default provider: CodesOnline OpenAI-compatible image edit endpoint
- Default endpoint: `https://image.codesonline.dev/v1/images/edits`
- Draw channel A authentication: `Authorization: Bearer <IMAGE_MODEL_API_KEY>`
- Draw channel B authentication: `Authorization: Bearer <IMAGE_SECONDARY_API_KEY>`
- Request format: `multipart/form-data`; the HTTP client supplies the boundary
- Request fields: `model`, `prompt`, `image`, optional repeated `image[]`,
  `n: 1`, `size`, `quality: "high"`, optional `upscale`,
  `response_format: "url"`
- No usable key or manual provider mode: local demo package only
- Failure code: `IMAGE_PROVIDER_ERROR`

Rules:

- Real image generation is always `img2img`; no prompt-only fallback.
- Every storyboard call must include uploaded shoe reference images. The first
  reference uses multipart field `image`; later references use `image[]`.
- PNG, JPEG, and WebP references are uploaded with safe filenames and matching
  MIME types. A request may contain at most 10 references and 100MB total.
- Each storyboard item is one provider request with `n = 1`. Legacy dual mode
  keeps separate concurrent A/B requests and never collapses them into one
  `n = 2` request.
- Storyboard sheet outer canvas is a delivery sheet and is not forced to match
  Step 02 video ratio.
- Internal shot panels must follow `marketBrief.outputAspectRatio`.
- Single mode builds one storyboard item with `segment_id: "full"` and uses
  draw channel A exactly once.
- Dual 20-second mode builds `0-10s` and `10-20s` items, starts both missing
  requests concurrently, and maps them to draw channels A and B respectively.
- Successful storyboard results are preserved; retries only regenerate missing
  items.
- Provider `data[]` responses may contain multiple results, but the current
  storyboard item consumes only the first result. URL results are downloaded
  immediately and saved locally; `b64_json` remains supported.
- CodesOnline is the default image profile. Legacy Right Code Draw and local
  Sub2API profiles remain selectable, with independent profile keys/models and
  their existing JSON transport.
- CodesOnline Admin model choices are local image tiers, not remote provider
  models:
  - `img2` -> provider `model=gpt-image-2`, no `upscale`
  - `img2-2k` -> provider `model=gpt-image-2`, `upscale=2k`
  - `img2-4k` -> provider `model=gpt-image-2`, `upscale=4k`
- Existing CodesOnline `gpt-image-2` settings are displayed and executed as
  the `img2` standard tier. CodesOnline model discovery never calls
  `/v1/models`; legacy image profiles keep their existing model discovery.
- Safe diagnostics may include segment id, attempt id, channel id/title,
  masked key preview, model, request size, provider host/path, reference image
  counts/bytes, and safe request-id headers.
- Diagnostics must never include full API keys, prompts, base64 image payloads,
  uploaded image contents, or full provider response bodies.

## Video

- Workflow routes:
  - `POST /api/projects/:projectId/videos/generate`
  - `GET /api/projects/:projectId/videos/status`
  - `POST /api/projects/:projectId/videos/:segmentId/retry`
  - `GET /api/projects/:projectId/videos/:segmentId/download`
  - optional dual-segment merge:
    `GET /api/projects/:projectId/videos/final/download`
- Provider: `clmm-mall.top` OpenAI-video-compatible channel
- Default endpoint: `https://clmm-mall.top/v1/videos/generations`
- Default model: `seedance2.0 720p-fast`
- Authentication: `Authorization: Bearer <VIDEO_MODEL_API_KEY>`
- Request fields: `model`, `prompt`, `image[]`, `duration`, `resolution`,
  `aspect_ratio`, `response_format`
- Failure codes:
  - `VIDEO_PROVIDER_NOT_CONFIGURED`
  - `VIDEO_PROVIDER_ERROR`
  - `VIDEO_PROVIDER_TIMEOUT`
  - `VIDEO_PROVIDER_STATUS_ERROR`
  - `VIDEO_PROVIDER_INVALID_OUTPUT`

Rules:

- `VIDEO_MODEL_API_KEY` is independent. Video generation must not reuse
  vision, text, image, or secondary-image keys.
- Newly created projects default to `single_video` and submit one `full` video
  task with `duration = marketBrief.videoDurationSeconds`.
- Dual 20-second projects keep two concurrent tasks for `0-10s` and
  `10-20s`.
- Successful local videos are preserved.
- Failed tasks remain failed; user retry only resubmits the missing or failed
  task.
- `HTTP 524`, `504`, and `408` are treated as possibly billed timeouts, so the
  backend does not auto-retry them.
- Current single-video mode does not require ffmpeg merge.
- Dual 20-second mode may still attempt an ffmpeg merge when both segments
  complete.
- Safe diagnostics may include segment id, attempt id, timing, masked key
  preview, model, provider host/path, request id, storyboard/reference counts,
  duration, and output size.
- Diagnostics must never include full API keys, prompt text, base64 payloads,
  source image contents, source video contents, or full provider response
  bodies.

## Secret And Failure Rules

- API keys are read only from the ignored root `.env` or process environment.
- Vision, text, image, and video credentials are configured independently.
- Admin field `videoApiKey` writes to `VIDEO_MODEL_API_KEY`.
- Keys must never be persisted in project JSON, exports, logs, or responses.
- A configured provider failure must return a stable error instead of silently
  falling back to demo output.
- Automated tests use placeholder keys or injected local fake responses and
  must never consume paid provider quota.
