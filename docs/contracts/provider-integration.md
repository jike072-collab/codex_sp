# Provider Integration Contract

The browser never receives provider credentials. Provider selection and request
construction stay entirely server-side.

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
- Provider: official DeepSeek OpenAI-compatible chat endpoint
- Default endpoint: `https://api.deepseek.com/chat/completions`
- Default model: `deepseek-v4-pro`
- Authentication: `Authorization: Bearer <TEXT_MODEL_API_KEY>`
- Response format: JSON object
- No usable key: deterministic demo planning package
- Failure code: `TEXT_PROVIDER_ERROR`
- Invalid generated package code: `TEXT_PROVIDER_INVALID_OUTPUT`

Current default script mode is `single_video`:

- `planningPackage.workflow_mode = "single_video"`
- `planningPackage.script_video.total_duration_sec = marketBrief.videoDurationSeconds`
- one full timeline from `0` to the selected duration

Legacy `legacy_multi_segment` projects keep the old two 10-second segments.

## Images

- Workflow route: `POST /api/projects/:projectId/visual/generate`
- Default provider: CodesOnline OpenAI-compatible image edit endpoint
- Default endpoint: `https://image.codesonline.dev/v1/images/edits`
- Draw channel A authentication: `Authorization: Bearer <IMAGE_MODEL_API_KEY>`
- Draw channel B authentication: `Authorization: Bearer <IMAGE_SECONDARY_API_KEY>`
- Request format: `multipart/form-data`; the HTTP client supplies the boundary
- Request fields: `model`, `prompt`, `image`, optional repeated `image[]`,
  `n: 1`, `size`, `quality: "high"`, `response_format: "url"`
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
- Current default mode builds one storyboard item with `segment_id: "full"`.
- Legacy mode keeps two storyboard items: `0-10s` and `10-20s`.
- Successful storyboard results are preserved; retries only regenerate missing
  items.
- Provider `data[]` responses may contain multiple results, but the current
  storyboard item consumes only the first result. URL results are downloaded
  immediately and saved locally; `b64_json` remains supported.
- CodesOnline is the default image profile. Legacy Right Code Draw and local
  Sub2API profiles remain selectable, with independent profile keys/models and
  their existing JSON transport.
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
  - optional legacy merge: `GET /api/projects/:projectId/videos/final/download`
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
- Legacy projects keep two concurrent tasks for `0-10s` and `10-20s`.
- Successful local videos are preserved.
- Failed tasks remain failed; user retry only resubmits the missing or failed
  task.
- `HTTP 524`, `504`, and `408` are treated as possibly billed timeouts, so the
  backend does not auto-retry them.
- Current single-video mode does not require ffmpeg merge.
- Legacy dual-segment mode may still attempt an ffmpeg merge when both segments
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
