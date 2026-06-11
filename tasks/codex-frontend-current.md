# Codex B Current Frontend Task

Status: READY

Route: complex

Base commit: `f996758`

Branch: `codex/frontend-admin-provider-ux`

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

## Main Workbench

Remove the lower-left supplier status block shown as:

- `供应商就绪 3/3`
- `识图、脚本、图片供应商均已就绪`
- `管理供应商`

The normal five-step workbench does not need this block. Do not restore API
editing, model editing, URL editing, or key editing in `studio-v2/public/**`.

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
- Verify Admin at 1280px, 1366px, 1440px, 1920px, and a narrow viewport.
- Verify no horizontal page scroll and no clipped right-most card.
- Verify all visible Admin interface text is Chinese.
- Verify model options load, refresh, select, save, and resync.
- Verify masked current key, replacement, unchanged blank, and clear states.
- Provide screenshots of the workbench sidebar and Admin desktop/mobile views.

## Delivery

Push `codex/frontend-admin-provider-ux` and report:

- Skills and route
- Commit hash
- Changed files
- JS checks
- Browser viewport checks
- Screenshots
- Confirmation that no backend files or secrets were changed
