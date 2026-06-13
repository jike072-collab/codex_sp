# DeepSeek Current Task

Status: READY - CODE REVIEW / SMALL PATCH ONLY

Target: DeepSeek code-edit-only assistant

Published: 2026-06-13 Asia/Shanghai

Route: complex

Branch: `codex/deepseek-admin-provider-key-review`

Start from: latest `origin/main` at or after `949c8b2`

## Role

DeepSeek does not have image recognition. Do not infer from screenshots. Work only from repository files, tests, and the behavior described below.

This is a code-review and minimal-patch task for the admin provider settings page. Do not take ownership of the whole backend implementation. Do not change `.env`, do not print full keys, and do not add any billing, balance, price, payment, or usage features.

## Required First Reads

Read these files before making any edit:

1. `CURRENT_ASSIGNMENTS.md`
2. `tasks/README.md`
3. `tasks/codex-deepseek-current.md`
4. `studio-v2/admin/admin.js`
5. `studio-v2/admin/index.html`
6. `studio-v2/admin/styles.css`
7. `studio-v2/src/storage/provider-settings.mjs`
8. `studio-v2/src/ai-providers/provider-models.mjs`
9. `studio-v2/src/local-api/static-files.mjs`
10. `studio-v2/src/local-api/request-handler.mjs`

## Problem

The admin provider settings UI can show two different layouts:

- expected: dark horizontal table layout;
- wrong: old white vertical card layout.

The API already exposes separate provider profiles for the vision provider:

- Right Code Gemini masked preview: `**** 9744`
- Sub2API local chat masked preview: `**** ca2e`

The UI must never show the Right Code key preview while the Sub2API preset is selected.

## What To Check And Patch

1. Admin static loading:
   - Verify `/admin/` loads the latest `studio-v2/admin/admin.js` and `studio-v2/admin/styles.css`.
   - If static caching can serve old assets, add or propose a no-store / versioned asset fix.
   - Do not make unrelated public workbench changes.

2. Admin layout:
   - Verify `admin.js` actually renders `.provider-table`.
   - If `admin.js` still renders old `provider-card` / `channel-card` cards, patch it so the provider settings render as the dark horizontal table.
   - Preserve existing field behavior: preset select, model select, secret input, secret visibility toggle, clear-key checkbox, key preview, and model status.

3. Key profile switching:
   - On preset dropdown switch, read the selected preset profile from `config.profiles` / channel profiles.
   - Empty API key input means "use the saved key for this selected profile".
   - Do not reuse the active runtime key from another preset.
   - Model sync failure must not overwrite or clear the key preview.

4. Model sync:
   - Switching a preset should immediately call the admin-only model preview endpoint.
   - If the selected preset has no saved key, show a missing-key model status and do not call another preset with another key.
   - If Sub2API model sync fails, keep the Sub2API masked preview visible.

5. Security:
   - Public `/api/settings/providers/status` must stay redacted: no URL, no model name, no `keyPreview`, no key suffix.
   - Admin endpoints may return only masked previews.
   - Full keys must never appear in code, test fixtures outside fake values, logs, screenshots, commits, or task files.

## Acceptance Criteria

- Refreshing `http://127.0.0.1:8810/admin/` shows only the dark horizontal provider table.
- Switching Right Code -> Sub2API -> Right Code three times preserves the correct masked previews:
  - Right Code: `**** 9744`
  - Sub2API: `**** ca2e`
- Sub2API model sync failure shows only a model-sync error and does not change the key preview.
- Saving Sub2API activates the Sub2API URL/model/key for runtime calls without restart.
- Saving Right Code activates the Right Code URL/model/key for runtime calls without restart.
- Clearing a preset key affects only the selected preset.
- No `.env`, uploaded assets, generated files, logs, or full keys are committed.

## Required Verification

Run the narrow checks first, then the broader suite:

```powershell
node --test .\studio-v2\tests\api-settings-delete.test.mjs
node --test .\studio-v2\tests\provider-models.test.mjs
node --test .\studio-v2\tests\*.test.mjs
node --check studio-v2/admin/admin.js
```

If you cannot run browser verification, state that clearly and provide the exact manual browser steps needed.

## Delivery

Push your work to `codex/deepseek-admin-provider-key-review` and report:

- branch name;
- commit hash;
- files changed;
- exact tests run and pass/fail result;
- whether the admin page is dark horizontal only;
- confirmation that no `.env` or full key was touched.
