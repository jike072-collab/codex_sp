# Codex B Frontend Task: P0 Workbench Review Fixes

Owner: Codex B, frontend machine.
Branch: `codex/frontend-p0-workbench-review`
Base: latest `main` after backend contract is available, or coordinate with Codex A before starting.
Route: complex.
Status: assigned, not complete.

Reference images:

- `docs/reference/workbench-p0-user-feedback/01-upload-delete-and-fourth-image.png`
- `docs/reference/workbench-p0-user-feedback/02-stepper-overlap.png`
- `docs/reference/workbench-p0-user-feedback/03-settings-square-cards.png`
- `docs/reference/workbench-p0-user-feedback/04-confirm-modal-overflow.png`
- `docs/reference/workbench-p0-user-feedback/05-progress-realtime.png`
- `docs/reference/workbench-p0-user-feedback/06-script-editor-target.png`
- `docs/reference/workbench-p0-user-feedback/07-storyboard-failure-step.png`

## Hard Boundaries

Frontend owns only:

- `studio-v2/public/**`

Do not edit:

- `studio-v2/src/**`
- `studio-v2/tests/**`
- provider logic
- storage logic
- prompts or schemas unless Codex A explicitly asks

Do not restore:

- JSON download button
- ZIP download button
- CSV download button
- Flow Omni / manual omni package buttons

## Product Rules

- Step 4 is storyboard generation and storyboard review.
- Step 5 is final delivery only.
- Image generation is img2img only; no prompt-only fallback and no degraded image generation.
- Two storyboards should be generated concurrently by the backend.
- Partial success must visibly preserve successful images.
- Retry should be presented as "continue missing storyboard images", not "restart everything".
- Final delivery should only expose two storyboard images and two script copy controls.
- Outer storyboard sheet should display in its real image ratio.
- Internal storyboard shot frames are composed according to the Step 2 selected video ratio.

## P0 Screens To Fix

### FE-01 Upload Image Cards And Delete Button

Fix the uploaded asset card behavior shown in reference image 01.

Required:

- The delete button must be clickable.
- The delete button must not be blocked by the image, card, overlay, or parent hit area.
- The fourth uploaded image must be fully visible, not cropped to only part of the shoe.
- Uploaded image cards should use `object-fit: contain` or equivalent so the full product image is inspectable.
- Keep stable card dimensions so deleting, hovering, or loading does not shift the grid.

Acceptance:

- Upload 4 images, click the delete control on any card, and confirm the asset is removed.
- The fourth image displays the whole shoe/product, not a cropped slice.

### FE-02 Top Stepper Layout

Fix the top stepper issue shown in reference image 02.

Required:

- The top stepper must not cover or collide with page text.
- Replace the current floating/circle-over-line feel with a cleaner boxed step item treatment if needed.
- Step number and step label should sit inside the same visible step block/box.
- Long page width should not cause labels to drift under the progress line.

Acceptance:

- At desktop width, all five step labels are readable and not covered by the progress line or circles.
- At narrower widths, labels still do not overlap each other or the main content.

### FE-03 Step 2 Settings Square Cards

Match the settings card direction in reference image 03.

Required:

- Country, audience, aspect ratio, theme, tone, and shot count must be square/rectangular setting cards with icon + label + value inside the card.
- The Product Lock card should use the same visual language: clean box, clear label, value inside, not a loose text block.
- The selected aspect ratio copy must explain: it affects internal storyboard shot frames and prompts; it does not force the outer storyboard sheet canvas.

Acceptance:

- Step 2 settings and Product Lock look like one coherent control system.

### FE-04 Step 2 Gate Before Step 3

Step 2 must not let the user enter Step 3 until the fourth reference/checkpoint image flow has been completed.

Required:

- If the required fourth image/checkpoint is missing or incomplete, the Step 3 action must stay disabled.
- Explain the blocker near the main action button.
- Once the fourth image/checkpoint is complete and Product Lock/settings are confirmed, the user can enter Step 3.

Acceptance:

- Attempting to continue early keeps the user on Step 2 with a clear reason.
- Completing the required fourth image/checkpoint unlocks Step 3.

### FE-05 Confirmation Modal Overflow

Fix the modal overflow shown in reference image 04.

Required:

- No horizontal scrollbar inside the confirmation modal.
- Content must fit within the modal on 1280px desktop width.
- Close button must not cover text.
- Primary button should remain fully visible.

Acceptance:

- The confirmation modal has no horizontal overflow and no text clipped on desktop.

### FE-06 Real-Time Progress Indicators

Fix progress behavior shown in reference image 05.

Required:

- All progress bars must visibly move while work is running.
- Do not leave a progress bar stuck at a fixed percentage without explaining what is happening.
- Script generation progress should show current sub-step.
- Storyboard generation progress should show 0/2, 1/2, 2/2 and current retry/failure status.
- If backend does not expose exact progress yet, use a bounded optimistic progress that keeps moving until the request resolves, then snap to the real result.

Acceptance:

- During script and storyboard generation, the UI continuously communicates progress and does not appear frozen.

### FE-07 Script Editor Target Layout

Rebuild the Step 3 script editor toward reference image 06.

Required:

- The editor display language should be Chinese for readability.
- The actual generated copy and backend payload must still use the currently selected country/language.
- Show two 10-second sections.
- Show compact shot cards in a grid.
- Each shot card should show time, shot number, picture, action, camera, voiceover/subtitle, sound, and transition.
- Editing should still preserve the backend script structure.
- Avoid small nested scrollbars inside cards.

Acceptance:

- Step 3 looks like a readable storyboard/script review board.
- Chinese UI labels do not change the selected market language used by generation.

### FE-08 Stepper And View State

Make the visible workflow unambiguous:

- `visual` project status maps to Step 4.
- `export` project status maps to Step 5.
- Storyboard generation, partial completion, failed completion, and retry all stay in Step 4.
- Step 5 never says "generating storyboard".

Acceptance:

- No page title, right panel, or stepper highlight labels storyboard generation as Step 5.

### FE-09 Step 4 Storyboard States

Implement clear states for:

- 0/2 generating: two skeleton cards.
- 1/2 partial: one real storyboard card plus one missing/failed card.
- 2/2 complete: two large storyboard cards with preview, segment, ratio, shot count, and image download.
- failed: preserve completed images and show retry for only missing/failed items.

Acceptance:

- A user can immediately tell which segment exists and which segment is pending or failed.
- The failure state in reference image 07 must be Step 4, not Step 5.

### FE-10 Step 5 Final Delivery

Keep Step 5 lean:

- two storyboard images
- two corresponding script blocks
- copy controls

Remove or keep hidden:

- JSON export UI
- ZIP export UI
- CSV export UI
- Flow Omni / manual omni UI

Acceptance:

- Final page is not a toolbox of formats; it is the final handoff page.

### FE-11 Product Lock Visibility

On Step 2, add a prominent Product Lock card using existing project data:

- product type
- main colors
- shoe shape / silhouette
- sole or outsole notes
- material / texture notes
- logo or pattern rules
- must keep
- must not change
- confidence if available

Acceptance:

- A first-time reviewer can see what product identity is locked before generating script or storyboards.

### FE-12 Settings Clarity

Improve existing Step 2 settings UI:

- mark AI recommended values
- mark user-modified values
- explain that selected aspect ratio affects internal storyboard shot frames and prompts, not the outer storyboard sheet canvas
- keep popovers within viewport without horizontal overflow

Acceptance:

- Settings changes are visually clear and do not confuse outer sheet ratio with internal frame ratio.

## Required PR Notes

The frontend PR must include:

- changed files
- screenshots for upload/delete, Step 2 settings/Product Lock, Step 2 modal, Step 3 script editor, Step 4 partial/failure, Step 5 final
- whether backend contract fields were assumed or observed
- syntax check result for all `studio-v2/public/js/*.js`
- unresolved items, if any

## Frontend Verification

Run:

```powershell
$files = Get-ChildItem -LiteralPath ".\studio-v2\public\js" -Filter *.js
foreach ($file in $files) { node --check $file.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

Also open:

```text
http://127.0.0.1:8810/
```

and capture the five screenshots listed above.
