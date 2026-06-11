# Provider Integration Contract

The browser never receives provider credentials and continues to use the
existing project workflow routes. Provider selection is entirely server-side.

## Vision

- Workflow route: `POST /api/projects/:projectId/analyze`
- Provider: Right Code native Gemini endpoint
- Default base endpoint: `https://right.codes/gemini`
- Default model: `gemini-2.5-flash`
- Authentication: `x-goog-api-key: <VISION_MODEL_API_KEY>`
- Request format: Gemini `generateContent`; image inputs use base64
  `inlineData`.
- No usable key: deterministic demo analysis
- Failure code: `VISION_PROVIDER_ERROR`

The adapter builds
`/v1beta/models/:model:generateContent` from the configured base endpoint.
Uploaded images are sent inline and are not made publicly accessible. A
configured `/draw/v1/chat/completions` URL remains supported for legacy keys
that are authorized for the Draw channel.

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

Provider output must pass the existing 20-second timeline, required shot field,
and confirmed product-lock validation before it can be persisted.

## Images

- Workflow route: `POST /api/projects/:projectId/visual/generate`
- Provider: Right Code OpenAI-compatible image endpoint
- Default endpoint: `https://www.right.codes/draw/v1/images/generations`
- Default model: `gpt-image-2`
- Authentication: `Authorization: Bearer <IMAGE_MODEL_API_KEY>`
- Request fields: `model`, `prompt`, optional `image`, pixel `size`, and
  `response_format: "url"`.
- No usable key or `IMAGE_MODEL_PROVIDER=manual`: local demo package only; no
  paid image-generation provider call is made.
- Failure code: `IMAGE_PROVIDER_ERROR`

The provider receives all uploaded product views as plain base64 reference
strings in the `image` array, without a `data:<mime>;base64,` prefix. Two
requests are made, one for each storyboard sheet. The provider `size` is the
outer storyboard sheet canvas size, not the Step 02 video ratio. Step 02
`marketBrief.outputAspectRatio` is expressed in the prompt and persisted
`image_generation[].aspect_ratio` as the internal shot-frame composition ratio.
Successful results are stored as optional `generated_image` metadata on each
image-generation item.

Real image generation is img2img only. Every storyboard call must include the
uploaded shoe reference images. If Right Code returns HTTP `403` while reference
images are included, surface the error and save a retryable visual generation
failure; do not retry prompt-only generation.

When a storyboard request returns `HTTP 524`, preserve the successful storyboard
item, do not auto-retry the failed one, and persist safe per-item diagnostics for
coordinator review. Diagnostics may include project id, segment id, attempt id,
timing, model, requested size, reference image count/bytes, prompt character
count, provider status, and safe request-id headers. Diagnostics must never
include API keys, prompts, base64 image bodies, uploaded image contents, or
provider response bodies.

## Secret And Failure Rules

- API keys are read only from the ignored root `.env` or process environment.
- Vision, text, and image credentials are configured independently.
- The old single `rightCodesApiKey` update field is no longer part of the
  settings contract. Use `visionApiKey` and `imageApiKey` separately.
- Keys must never be persisted in project JSON, exports, logs, or responses.
- A configured provider failure must return a stable error instead of silently
  falling back to demo output.
- Automated tests use placeholder keys or injected local fake responses and
  must never consume paid provider quota.

## Provider Documentation

- Right Code API key and channel restrictions:
  `https://docs.right.codes/docs/rc_quick_start/apikey.html`
- Right Code Gemini channel: `https://right.codes/gemini`
- Right Code Draw API: `https://docs.right.codes/docs/rc_extension/draw/`
- Right Code image generations:
  `https://docs.right.codes/docs/rc_extension/draw/images-generations.html`
- DeepSeek API quick start: `https://api-docs.deepseek.com/`

No public provider documentation was found for a model-list endpoint or for an
asynchronous draw-job endpoint during this task. The Admin model-discovery API
therefore falls back to the current configured model whenever a provider does
not explicitly support discovery.
