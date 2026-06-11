# Codex B Current Frontend Task

Status: READY

Route: complex

Base commit: `b28bb04`

Branch: `codex/frontend-cinematic-workbench`

Backend dependency branch: `codex/backend-storyboard-524-model-discovery`

## Required Skills

Start every task or resumed task with:

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: complex
```

## Goals

- Remove the supplier-ready block from the lower-left workbench sidebar.
- Make the Admin page fully Chinese.
- Fix the Admin page right edge being clipped at common desktop widths.
- Replace free-text model inputs with model selection controls.
- Show the currently saved API key as a masked value.
- Add a final visual polish pass so the workbench and Admin pages feel like a
  stable finished product rather than a patched prototype.
- Revise the submitted cinematic dark theme: keep useful layout/interaction
  improvements, but return the product to the earlier lighter workbench visual
  direction.

## Main Workbench

Remove the lower-left supplier status block shown as:

- `供应商就绪 3/3`
- `识图、脚本、图片供应商均已就绪`
- `管理供应商`

The normal five-step workbench does not need this block. Do not restore API
editing, model editing, URL editing, or key editing in `studio-v2/public/**`.

### Stable Step Navigation

- Fix Step 02 so its number box, text box, spacing, alignment, and occupied
  dimensions match Steps 01, 03, 04, and 05.
- Switching to Step 02 must not move the step navigation, page content, header,
  or viewport.
- Active/inactive states may change color, border, icon, and font weight, but
  must not change width, height, padding, border thickness, line wrapping, or
  grid track size.
- Reserve stable dimensions for every step item and its label.
- The Chinese Step 02 label must fit without clipping or wrapping differently
  from the other step labels.
- Do not use an active-state transform, scale, margin, or font-size change that
  causes layout movement.

## Admin Page

- Translate every visible Admin label, status, helper, button, validation
  message, provider title, role, channel, field label, and save state into
  natural Chinese.
- Keep technical values such as model ids and URLs unchanged.
- Fix card/input overflow so the right-most provider card and its controls are
  fully visible at 1280px, 1366px, 1440px, and 1920px desktop widths.
- Also verify a narrow/mobile viewport.
- Long API URLs must not force the card wider than its grid track.
- Use a responsive grid with stable minimums; do not create horizontal page
  scrolling.

## Visual Polish Pass

Make the current pages visually cleaner and more consistent without changing the
workflow or backend contract.

Allowed polish targets:

- Workbench spacing, alignment, density, button states, card borders, shadows,
  typography scale, and hover/focus feedback.
- Step navigation clarity and stability.
- Step 02 control cards and product-lock presentation.
- Step 03 script editor card hierarchy and scanability.
- Step 04 partial-success/failure/retry states.
- Step 05 final two-image/two-script delivery layout.
- Admin provider cards, form controls, badges, model selector, key area, and
  save/sync states.

Polish rules:

- Keep the product as an actual app screen, not a landing page.
- Do not add marketing hero sections, decorative blobs, oversized cards, or
  one-note color themes.
- Do not use a full black/cinematic production-studio theme for the main
  workbench.
- The main canvas, stage cards, forms, storyboard/script areas, dialogs, and
  Admin page should stay light, calm, and work-focused.
- A dark sidebar or small dark status strip is acceptable, but black should not
  dominate the whole product.
- Preserve useful non-color improvements from the submitted cinematic branch,
  such as clearer progress/status, stable stepper sizing, better action dock
  behavior, and improved layout density, if they remain usable after the color
  rollback.
- Remove or soften any cinematic/banner-like section that makes the app feel
  like a marketing page instead of a production tool.
- Do not place cards inside other cards.
- Do not introduce layout movement when switching steps or changing states.
- Buttons and controls must keep stable dimensions across loading, hover,
  disabled, success, and error states.
- Long Chinese text, model ids, URLs, and error messages must wrap cleanly
  without covering neighboring content.
- Maintain the existing five-step workflow and all current product rules.
- Do not restore API editing in the normal workbench.
- Do not restore JSON, ZIP, CSV, or Flow Omni export buttons.

## Model Control

Use the backend contract:

```text
GET /api/admin/providers/models
GET /api/admin/providers/models?refresh=1
```

- Render model fields as a `<select>` or equivalent accessible menu.
- Populate each provider's options from the backend response.
- Select the current configured model.
- Provide a Chinese refresh-model-list action.
- Show Chinese `读取中 / 已同步 / 不支持自动读取 / 读取失败` states.
- Do not provide a free-text model field.
- If discovery is unsupported or fails, show the current model as the only
  selectable option; do not invent model names.

## API Key Control

- Show the backend-provided masked current key, for example `•••• 9744`.
- Never display or request the full existing key.
- Keep a separate optional replacement input:
  - blank means unchanged
  - entering a new key replaces it
  - clear checkbox removes it
- Use Chinese helper text and clear confirmation.

## Scope

Allowed:

- `studio-v2/admin/**`
- `studio-v2/public/**` only for removing the lower-left supplier block

Do not edit:

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`
- root coordination files
- `.env`, API keys, runtime data, uploads, generated images, logs, or PID files

## Coordination

- The localization/layout/sidebar work may begin from `f996758`.
- Model dropdown integration must use the frozen backend contract above.
- Before final delivery, merge or rebase the completed backend branch so the
  browser verification uses the real model discovery API.
- Keep all frontend changes in `codex/frontend-admin-provider-ux`.

## Verification

- Run syntax checks for every JS file under `studio-v2/public/js` and
  `studio-v2/admin`.
- Start the local service.
- Verify the workbench no longer shows the lower-left supplier block.
- Click through Steps 01-05 and verify Step 02 causes no visible page jump.
- Compare the step item bounding boxes before and after selecting Step 02; their
  positions and dimensions must remain unchanged.
- Verify Admin at 1280px, 1366px, 1440px, 1920px, and a narrow viewport.
- Verify no horizontal page scroll and no clipped right-most card.
- Verify all visible Admin interface text is Chinese.
- Verify model options load, refresh, select, save, and resync.
- Verify masked current key, replacement, unchanged blank, and clear states.
- Verify visual polish on desktop and narrow/mobile widths:
  - no overlapping text
  - no clipped controls
  - no horizontal scrolling
  - no page jump when switching steps
  - button text fits in every state
- Verify the visual tone is not overwhelmingly black:
  - main work area uses light surfaces
  - dark areas are limited to navigation or secondary emphasis
  - Step 02, Step 03, Step 04, Step 05 remain easy to read for repeated work
- Provide screenshots of the workbench sidebar and Admin desktop/mobile views.
- Provide before/after Step 02 navigation screenshots or a short recording that
  demonstrates there is no layout shift.
- Provide final screenshots for Step 02, Step 03, Step 04 partial/failure state,
  Step 05 delivery, and Admin provider settings.

## Delivery

Push `codex/frontend-admin-provider-ux` and report:

- Skills and route
- Commit hash
- Changed files
- JS checks
- Browser viewport checks
- Screenshots
- Confirmation that no backend files or secrets were changed
