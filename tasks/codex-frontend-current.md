# Codex B Current Frontend Task

Status: REWORK_REQUIRED

Route: complex

Base branch: `codex/integration-p0-admin-review`

Base commit: `ff893df`

Backend/Admin commit included: `9607599 Add admin provider settings console`

Frontend P0 commit included: `656d7b7 Fix frontend P0 workbench review`

## Coordination Source

Frontend work happens from another computer and must be coordinated through the
GitHub repository. Do not rely on chat thread memory, local-only notes, or stale
branch content.

This task is a follow-up from coordinator review. The backend/Admin branch and
the frontend P0 branch merge cleanly and tests pass, but the combined product is
not ready for `main` because the main workbench still exposes API editing.

## Required Skills

At the start of the task, invoke and report:

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: complex
```

If those skills are missing on the frontend computer, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-codex-skills.ps1
```

Then start a fresh Codex session and continue.

## Goal

Move hidden provider configuration out of the main five-step workbench.

The normal workbench may show provider readiness only. It must not show or edit:

- API keys
- API URLs
- model names
- provider admin fields

All provider editing must happen in the separate Admin page served at `/admin/`.

## Interface Contracts

Use these backend routes from the included backend/Admin commit:

- `GET /api/settings/providers/status`
  - public workbench status only
  - returns `providers`, `configuredCount`, and `total`
  - does not return `apiUrl`, `model`, `keyPreview`, or API keys

- `GET /api/admin/providers`
  - Admin page schema and redacted configuration
  - for `/admin/` only

- `PUT /api/admin/providers`
  - Admin page save route only

The old workbench write route is intentionally disabled:

- `PUT /api/settings/providers` returns 405

## What To Fix

- Remove the visible `API 设置` button from the main workbench header.
- Remove the main workbench API settings dialog, API key fields, clear-key
  checkboxes, secret toggles, and save logic.
- Update `studio-v2/public/js/settings.js` so the main workbench only reads
  `GET /api/settings/providers/status`.
- Do not call `PUT /api/settings/providers` anywhere in `studio-v2/public/**`.
- Keep the sidebar/right-panel provider readiness display, but show only simple
  status such as configured count or missing providers.
- If an entry point is needed, use a low-priority link/button to `/admin/` that
  does not expose secrets or admin fields in the workbench itself.
- Keep all previous P0 frontend fixes from `656d7b7` intact:
  - upload delete button clickable
  - fourth uploaded image fully visible
  - top stepper text not blocked
  - Step 2 gating before Step 3
  - Step 3 Chinese-readable script editor cards
  - progress bars with ongoing feedback
  - Step 4 partial success/failure/retry states
  - Step 5 only two storyboard images and two script/copy controls
  - no JSON/ZIP/CSV/Flow Omni buttons

## Allowed Scope

Allowed to edit:

- `studio-v2/public/**`

Do not edit:

- `studio-v2/src/**`
- `studio-v2/server.mjs`
- `studio-v2/admin/**`
- `studio-v2/tests/**`
- `schemas/**`
- `prompts/**`
- root collaboration documents
- product runtime data, uploads, generated outputs, logs, PID files, `.env`, or
  API keys

## Start Commands

```powershell
git fetch origin
git switch -c codex/frontend-admin-hide-workbench-settings origin/codex/integration-p0-admin-review
```

If the branch already exists:

```powershell
git switch codex/frontend-admin-hide-workbench-settings
git pull --ff-only origin codex/frontend-admin-hide-workbench-settings
git merge --ff-only origin/codex/integration-p0-admin-review
```

## Acceptance Checks

Run:

```powershell
$files = Get-ChildItem -LiteralPath ".\studio-v2\public\js" -Filter *.js
foreach ($file in $files) { node --check $file.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

Start the local service and verify:

- `http://127.0.0.1:8810/` returns 200.
- `http://127.0.0.1:8810/admin/` returns 200.
- Main workbench no longer has API key/API URL/model editing UI.
- Main workbench does not call `PUT /api/settings/providers`.
- Provider readiness still displays from `/api/settings/providers/status`.
- `/admin/` remains the place where API URL, model, and key can be edited.
- User feedback screenshots still look fixed, especially upload, Step 2, Step 3,
  Step 4, and Step 5.

## Delivery

Push:

```powershell
git push -u origin codex/frontend-admin-hide-workbench-settings
```

Report:

- Skills and route
- Commit hash
- Changed files
- Confirmation that only `studio-v2/public/**` changed
- JS syntax check result
- Browser/service checks
- Screenshots or short visual notes for the main workbench and `/admin/`
- Any remaining risk
