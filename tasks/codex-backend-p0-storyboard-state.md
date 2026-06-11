# Codex A Backend Task: P0 Storyboard State Boundary

Owner: Codex A, backend / coordination / integration machine.
Branch: `codex/backend-p0-storyboard-state`
Base: latest `main` / `v2`.
Route: standard.
Status: complete, verified, and merged into the frontend work baseline.

Reference image:

- `docs/reference/workbench-p0-user-feedback/07-storyboard-failure-step.png`

## Purpose

Fix the product-critical workflow boundary:

- Step 4 owns storyboard generation, partial success, failed images, and retry.
- Step 5 owns final delivery only.
- Storyboard image generation must be img2img only.
- No prompt-only fallback and no degraded image generation.
- Export readiness requires two completed storyboard images.

## Owned Paths

- `studio-v2/src/**`
- `studio-v2/tests/**`
- API contract notes if needed

Avoid broad frontend UI changes except minimal integration signals needed for review.

## Backend Contract

`project.imagePackage.image_generation[]` should expose:

- `segment_id`: `0-10s` or `10-20s`
- `type`: `storyboard_board`
- `status`: `waiting | running | done | failed`
- `generated_image.url` only when the image is actually stored
- `error.code` and `error.message` when that item failed

Project status rules:

- after script confirm: `visual`
- during storyboard generation: `visual`
- partial success or failure: `visual`
- two completed storyboard images: transition to `export`
- no image provider key: stay in `visual`, return a provider configuration error

## Acceptance

- Both storyboard requests still start concurrently.
- If one image succeeds and the other fails, the successful local image is preserved.
- Retry only regenerates missing or failed storyboards.
- Missing image provider configuration does not create demo storyboard output.
- `GET /api/projects/:id/export` is not ready before two real storyboard images exist.
- Existing rule remains: outer storyboard sheet is not forced into Step 2 video ratio; internal shot frames use the selected Step 2 ratio.
- Do not restore JSON / ZIP / CSV / Flow Omni UI download buttons.

## Provider Failure Follow-Up

The user is seeing repeated storyboard failures from Right Code:

```text
Right Code image model call failed (HTTP 400): excessive system load
```

Backend must handle this as part of the next backend pass:

- Preserve any completed image when one segment succeeds.
- Mark failed storyboard items with `status: "failed"` and a useful `error.code` / `error.message`.
- Treat provider overload messages such as `excessive system load` as retryable in the API contract.
- Keep the project in Step 4 / `visual`.
- Do not fall back to prompt-only generation.
- Do not create fake/demo storyboard output.
- If a bounded retry is added, it must still send img2img requests with reference images and must not regenerate already completed segments.

## Verification

Run:

```powershell
node --test .\studio-v2\tests\*.test.mjs
```

Expected result from the local implementation:

- 34 tests pass.
