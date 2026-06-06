# Provider Integration Contract

The browser never receives provider credentials and continues to use the
existing project workflow routes. Provider selection is entirely server-side.

## Vision

- Workflow route: `POST /api/projects/:projectId/analyze`
- Provider: Right Code OpenAI-compatible draw endpoint
- Default endpoint: `https://www.right.codes/draw/v1/chat/completions`
- Default model: `gemini-2.5-flash`
- Authentication: `Authorization: Bearer <VISION_MODEL_API_KEY>`
- No usable key: deterministic demo analysis
- Failure code: `VISION_PROVIDER_ERROR`

The request uses OpenAI-compatible multimodal message content. Uploaded images
are sent as local base64 data URLs and are not made publicly accessible.

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
- No usable key or `IMAGE_MODEL_PROVIDER=manual`: prompt-only demo package
- Failure code: `IMAGE_PROVIDER_ERROR`

The provider receives all uploaded product views as base64 references. Four
requests are made, one per persisted prompt. Successful results are stored as
optional `generated_image` metadata on each image-generation item.

## Secret And Failure Rules

- API keys are read only from the ignored root `.env` or process environment.
- Keys must never be persisted in project JSON, exports, logs, or responses.
- A configured provider failure must return a stable error instead of silently
  falling back to demo output.
- Automated tests use placeholder keys or injected local fake responses and
  must never consume paid provider quota.

## Provider Documentation

- Right Code draw API: `https://docs.right.codes/docs/rc_extension/draw/`
- DeepSeek API quick start: `https://api-docs.deepseek.com/`
