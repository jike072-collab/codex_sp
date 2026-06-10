# Codex A UI V2 Backend And Integration Task

Status: READY

Route: standard

Base commit: `84e3129` (`Require img2img storyboard generation`)

Branch: `codex/backend-ui-v2-support`

## Goal

Support and integrate the `ui-v2` frontend work without changing the product
workflow unnecessarily. This task is mostly contract protection, verification,
and final integration.

## Ownership

Allowed to edit:

- `docs/contracts/**`
- `schemas/**`
- `prompts/**`
- `studio-v2/src/workflow-domain/**`
- `studio-v2/src/local-api/**`
- `studio-v2/src/ai-providers/**`
- `studio-v2/src/storage/**`
- `studio-v2/tests/**`

Do not edit:

- `studio-v2/public/**`

Root coordination docs may be edited only by the coordinator or when a contract
change is required.

## Backend Guardrails

- Keep the current workflow states and route names stable.
- Do not add a new UI-only API unless the frontend cannot implement the design
  from existing project summaries.
- Do not reintroduce prompt-only paid image generation.
- Preserve img2img-only storyboard generation.
- Preserve partial success behavior for storyboards.
- Preserve local storage and no-key demo mode.
- No runtime data, uploads, logs, PID files, `.env`, or API keys in commits.

## Work Items

1. Read `docs/UI-V2-BRIEF.md` and `tasks/codex-frontend-ui-v2.md`.
2. Audit whether the frontend can show the requested right-panel readiness
   information from existing project summaries.
3. If a tiny contract addition is truly needed, update:
   - `docs/contracts/demo-loop-api.md`
   - tests under `studio-v2/tests/**`
   - local API code
4. Keep any backend change narrowly scoped.
5. After Codex B pushes `codex/frontend-ui-v2`, fetch and review the branch.
6. Run full tests and browser smoke checks before merging.

## Verification

Run:

```powershell
node --test .\studio-v2\tests\*.test.mjs
git diff --check
```

If integrating frontend:

```powershell
node --check .\studio-v2\public\js\*.js
node --test .\studio-v2\tests\*.test.mjs
```

Browser smoke checks should cover create project, upload, Step 02 save, script
generation, storyboard partial failure display, and final delivery.

## Handoff

When done, push `codex/backend-ui-v2-support` or merge to `main` only after
review. Report:

- branch
- commit hash
- changed files
- tests run
- whether Codex B is blocked by any contract gap
