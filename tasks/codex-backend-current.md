# Codex A Current Backend Task

Status: READY

Route: complex

Base commit: `f996758`

Branch: `codex/backend-storyboard-524-model-discovery`

## Required Skills

Start every task or resumed task with:

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: complex
```

## Goals

1. Determine why two concurrent storyboard requests often produce one success
   and one `HTTP 524`.
2. Keep the product rule that both missing storyboard requests start
   concurrently.
3. Add a safe backend contract that discovers supported models for the Admin
   page without exposing API keys.
4. Return a Chinese-ready provider schema and a masked current-key display.

## Current Evidence

- `generateProjectVisuals()` uses `Promise.allSettled()` over both storyboard
  items, so the application does start both missing images concurrently.
- Existing tests prove both provider calls begin before either response
  resolves.
- The reported failed item reached Right Code and returned `HTTP 524`.
- `524` is a provider/gateway timeout, not evidence that the application only
  requested one image.
- Successful images are preserved and retry only targets the missing item.

Do not change those guarantees.

## Storyboard 524 Work

- Add non-secret per-item provider diagnostics:
  - project id
  - segment id / asset id
  - attempt id
  - request start time and elapsed time
  - model and requested sheet size
  - reference image count and total byte count
  - prompt character count, but never the prompt text
  - provider HTTP status
  - safe provider request-id headers when present
- Never log API keys, authorization headers, base64 image bodies, full prompts,
  uploaded image contents, or provider response bodies.
- Confirm whether the 524 comes from:
  - provider concurrent-request limits
  - provider load / gateway timeout
  - payload size
  - one segment-specific prompt/request difference
  - synchronous endpoint duration
- Inspect whether Right Code offers an asynchronous job endpoint or documented
  concurrency guidance. Do not invent an endpoint.
- Keep both missing storyboard requests concurrent unless evidence proves the
  provider contract forbids it. If it does, stop and report the conflict before
  changing the product rule.
- Do not automatically retry a 524 because it may already be billed. Preserve
  the explicit user retry flow and successful image.
- Improve the persisted safe failure details if needed so coordinator review
  can compare both item attempts without exposing secrets.

## Model Discovery Contract

Add:

```text
GET /api/admin/providers/models
GET /api/admin/providers/models?refresh=1
```

Response shape:

```json
{
  "providers": {
    "vision": {
      "status": "ok",
      "currentModel": "gemini-2.5-flash",
      "models": [{ "id": "gemini-2.5-flash", "label": "gemini-2.5-flash" }],
      "source": "provider"
    }
  }
}
```

Requirements:

- Support `vision`, `text`, and `image`.
- Use the configured provider URL and key through provider-specific adapters.
- Discover models from a real provider model-list capability when available.
- Cache successful discovery briefly so loading Admin does not repeatedly call
  paid or rate-limited endpoints.
- `refresh=1` forces a new safe discovery attempt.
- If a provider has no supported model-list endpoint, return:
  - `status: "unsupported"`
  - the current configured model as the only option
  - a clear safe message
- If discovery fails, return:
  - `status: "error"`
  - the current configured model as the only option
  - a safe error message without provider response bodies or keys
- Never invent supported models.
- Never return a full API key.

Update `GET /api/admin/providers`:

- Use Chinese labels/titles/roles/channel descriptions suitable for direct UI
  rendering.
- Change model fields to schema type `select`.
- Keep `config.keyPreview`, but format it as a masked value such as
  `•••• 9744`; never return the full key.
- Keep key update semantics: blank/omitted means unchanged, `null` means clear.

## Scope

Allowed:

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`

Do not edit:

- `studio-v2/public/**`
- `studio-v2/admin/**`
- root coordination files
- `.env`, API keys, runtime data, uploads, generated images, logs, or PID files

## Verification

- Add tests proving the two storyboard requests still start concurrently.
- Add diagnostics tests proving no key, prompt text, base64 body, or image bytes
  are logged/persisted.
- Add model discovery tests for success, unsupported, provider error, cache, and
  forced refresh.
- Test Chinese Admin schema and masked key preview.
- Run all backend tests.
- Run syntax checks for changed MJS files.

## Delivery

Push `codex/backend-storyboard-524-model-discovery` and report:

- Skills and route
- Commit hash
- Exact 524 diagnosis and evidence
- Whether provider documentation/model discovery was available
- Changed files
- Tests
- Confirmation that no frontend/Admin files or secrets were changed
