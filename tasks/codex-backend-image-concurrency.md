# Codex A Backend Follow-up: Image Concurrency Verification

Status: READY

Route: complex

Base: latest remote `v2` at task start

Branch: `codex/backend-image-concurrency`

## User Problem

The user still observes a storyboard generation problem: it looks like the two
storyboard images are not generated at the same time. The product requirement
is strict:

- generate exactly two storyboard images
- both requests should be started concurrently whenever both images are missing
- img2img only
- no prompt-only fallback
- no downgrade generation path
- preserve partial success and retry only missing/failed images

Current code appears to use `Promise.allSettled`, but this must be proven with
a test that observes request overlap, not just by reading the implementation.

The user also clarified an important size rule:

- The outer storyboard board image is a storyboard sheet/delivery image and
  should not be forced to the Step 02 video aspect ratio such as `9:16`.
- The individual shot frames inside the storyboard must follow the Step 02
  selected video aspect ratio.
- In other words, Step 02 controls the composition ratio of each frame/panel,
  not the overall storyboard sheet canvas.

## Ownership

Allowed to edit:

- `studio-v2/src/ai-providers/**`
- `studio-v2/src/workflow-domain/**`
- `studio-v2/src/local-api/**`
- `studio-v2/tests/**`
- `docs/contracts/**`

Do not edit:

- `studio-v2/public/**`
- runtime data, uploads, generated files, logs, PID files, `.env`, or API keys

## Required Work

1. Add or update a backend test with a fake image provider that intentionally
   holds both incoming requests open.
2. Prove both storyboard image requests are in flight before either response is
   released.
3. If the test fails, fix the backend so both missing storyboard items are
   requested concurrently.
4. Confirm retry behavior still requests only missing storyboard images.
5. Confirm provider failures still persist successful local images and record
   `visualGenerationFailure`.
6. Audit the generated storyboard prompt/request so it clearly tells the image
   model that the board is a storyboard sheet while every internal shot panel
   uses the selected video aspect ratio.
7. Do not break existing image storage or export readiness while making that
   distinction.
8. Add a concise contract note if behavior was undocumented.

## Acceptance Checks

Run:

```powershell
node --test .\studio-v2\tests\*.test.mjs
git diff --check
```

Report:

- branch
- commit hash
- whether two provider requests overlap in the new test
- how the outer storyboard sheet size is distinguished from the internal frame
  aspect ratio
- tests run
- any provider-side limitation discovered, such as remote API rate limiting

Do not claim this is fixed unless the test proves overlap.
