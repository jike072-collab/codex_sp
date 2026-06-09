# Codex A Current Backend Task

Status: ACTIVE

Base commit: `9aa1915` (`Document remote frontend coordination`)

This round is about keeping the backend honest for the UI cleanup work.

## Coordination Source

Codex A owns contracts, backend routes, storage, providers, and tests. Keep
changes outside `studio-v2/public/**`.

## What To Fix

- Add a batch-delete path for old projects so the sidebar can clear noisy legacy
  items in one pass.
- Make project deletion behave cleanly for stale export-era projects.
- Decide how legacy export records should be treated when they still contain old
  visual packages that do not match the selected aspect ratio.
- Make storyboard generation failures clearer when the provider times out after
  a billed call.
- Preserve the current contract for the frontend, but close the gap where the UI
  says delivery is ready while export still returns `EXPORT_NOT_READY`.
- Keep the backend side of the asset deletion path and project list stable while
  the frontend refactor lands.

## Scope

Allowed to edit:

- `studio-v2/src/workflow-domain/**`
- `studio-v2/src/local-api/**`
- `studio-v2/src/ai-providers/**`
- `studio-v2/src/storage/**`
- `studio-v2/tests/**`
- `schemas/**`
- `prompts/**`

Do not edit:

- `studio-v2/public/**`
- root collaboration documents unless the contract itself must be updated

## Verification

- Run the narrow backend/API tests that cover the changed path.
- Confirm old export-era projects are handled intentionally.
- Confirm the sidebar and export states no longer disagree with the actual API
  result.
