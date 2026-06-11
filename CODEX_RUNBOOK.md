# Codex Runbook

This file is the shared operating file for both Codex agents. Read it before
editing. If it conflicts with a direct user instruction, ask or follow the
newer user instruction. If it conflicts with an API contract, the contract wins.

## Mandatory Skill Bootstrap

At the beginning of every task or resumed task, all Codex roles MUST invoke:

1. `$nadirclaw-model-router`
2. `$superpowers-workflow`

The invocation order is fixed. This applies to frontend, backend, coordinator,
integration, review, documentation, Git operations, and test-only work.

Before editing, report:

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: simple|standard|complex
```

Before handoff, repeat the skill and route record together with checks run.
Do not begin implementation if either skill is unavailable. Install the
repository copies first:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-codex-skills.ps1
```

## First Version Goal

The first version is judged by one thing: the local no-key demo loop must run
end to end.

```text
create project
-> upload shoe images
-> analyze or demo analyze
-> review product lock
-> save market brief
-> generate demo script
-> confirm edited script
-> generate two storyboard images using the Step 02 aspect ratio
-> review the two storyboard images and matching scripts
```

Do not spend first-version time on real model integrations, visual redesign,
batch workflows, accounts, cloud sync, or advanced storage features unless the
closed loop already works.

## UI V2 Goal

The second version is a visual and interaction upgrade for the same local
workflow. Read `docs/UI-V2-BRIEF.md` before starting UI V2 work.

UI V2 must preserve the current workflow and contracts while improving:

- layout hierarchy
- visual consistency
- upload-stage polish
- stepper clarity
- right-side status/readiness presentation
- motion and click feedback
- final two-storyboard delivery presentation

Do not reintroduce JSON delivery, Flow Omni packages, prompt-only paid image
generation, or direct provider calls from the browser frontend.

## Module Split

### Codex A: contracts, backend, integration

Branch:

```text
main
```

Owns:

```text
docs/contracts/**
schemas/**
prompts/**
studio-v2/src/workflow-domain/**
studio-v2/src/local-api/**
studio-v2/src/ai-providers/**
studio-v2/src/storage/**
studio-v2/tests/**
studio-v2/server.mjs
CURRENT_ASSIGNMENTS.md
tasks/**
```

Responsibilities:

- Freeze shared contracts before frontend depends on them.
- Implement project status transitions and validation.
- Implement local API endpoints.
- Implement vision, text, and image provider adapters after their contracts are frozen.
- Maintain storage safety and persisted project shape.
- Run backend, domain, API, and final integration tests.
- Integrate Codex B's frontend branch into `main`.

### Codex B: browser frontend

Branch:

```text
codex/<frontend-task>
```

Owns:

```text
studio-v2/public/**
```

Responsibilities:

- Render workflow stages from persisted `project.status`.
- Implement market creative form against the frozen market contract.
- Implement script generation, editable script confirmation, two-storyboard
  delivery display and script copy actions against the frozen demo-loop
  contract.
- Preserve the existing visual language and avoid framework/dependency changes.
- Verify the affected browser workflow.

## Required Contracts

All agents must use these files as the source of truth:

```text
docs/contracts/market-creative-api.md
docs/contracts/demo-loop-api.md
schemas/studio-project.schema.json
```

Do not invent alternate routes, payload fields, status names, or enum values.
If a needed behavior is missing from a contract, pause and update the contract
through Codex A before implementing competing behavior.

## Cross-Computer Repository Coordination

Frontend work may happen on another computer. From now on, frontend coordination
must use GitHub repository state, not chat thread memory.

- Codex B uses only the current task file in `tasks/`, the frozen contracts, and
  its branch commits as the source of truth.
- Before claiming or continuing frontend work, Codex B must fetch the repository,
  rebase or merge the latest `main`, and confirm the base commit in its task
  handoff.
- Progress is reported through task-file status updates or branch commits with
  clear handoff notes.
- Do not rely on prior chat threads, local-only notes, or stale branch content
  to define frontend scope.
- Codex A updates shared contracts and task files on `main`; Codex B implements
  only the assigned frontend scope after syncing from GitHub.

## Automatic Model Routing

Read `docs/MODEL-ROUTING.md` before delegating or starting a new task.

- Classify every task as `simple`, `standard`, or `complex`.
- The coordinator must select the mapped model and thinking level when creating
  or continuing a Codex thread.
- Tool-driven multi-step work, cross-module changes, provider billing/timeouts,
  data compatibility, and visual review force the complex route.
- A task may upgrade but must not downgrade inside the same coherent session.
- Task files and delegation messages must record the route so the Codex on the
  other computer makes the same choice.

## Step Discipline

Use this loop for every module:

1. Bootstrap: invoke both mandatory skills and record the chosen route.
2. Sync: run `git fetch origin`, inspect ahead/behind status, and read this
   file plus the active task file.
3. Scope: confirm the files you will edit are inside your owned paths.
4. Implement one small module at a time.
5. Verify that module before moving to the next one.
6. Commit after a passing module or coherent milestone.
7. Push immediately after commit when GitHub authentication is available.
8. Handoff with skills, route, branch, commit, changed files, behavior, tests,
   and blockers.

Never revert, reset, overwrite, or reformat another agent's work to make your
own branch cleaner.

## Module Test Order

### Backend and contracts

Codex A runs:

```text
node --test studio-v2/tests/*.test.mjs
```

Also verify documented error cases for invalid status, invalid market fields,
broken script timeline, and export requirements.

### Frontend modules

Codex B runs after each frontend milestone:

```text
node --check studio-v2/public/js/*.js
git diff --check
```

Browser smoke checks:

- `market`: product review enters market form; required fields validate; save
  calls `/api/projects/:id/market`; success enters `script`.
- `script`: generate button calls `/script/generate`; editable shot fields
  render; confirmation calls `/script/confirm`; success enters `visual`.
- `visual`: generate button calls `/visual/generate`; success enters `export`.
- `export`: exactly two selected-aspect storyboard images and matching 0-10s
  and 10-20s script copy controls are visible.

### Final closed-loop verification

Before handoff or integration, run:

```text
node --test studio-v2/tests/*.test.mjs
```

Then exercise the browser workflow from project creation through the final two
storyboard images and matching scripts.
If a local sandbox blocks port listening, rerun the same command with approved
unsandboxed permission and record that reason.

## Wait Or Continue Rule

If one Codex finishes while the other is still working:

- Continue only when the next work uses a frozen contract and stays inside your
  owned files.
- Wait when the next work requires an unfrozen contract, a schema change, a
  shared file, or a route/status shape the other Codex has not provided.
- Fetch and inspect remote changes before continuing after any long pause.
- If remote changed your owned files, merge the latest branch and reconcile
  behavior before adding new work.
- If tests fail because the other module is incomplete, stop at the contract
  boundary and hand off the exact failing command and reason.
- If GitHub push is blocked by authentication, keep local commits clean, report
  the commit hash, and retry push after authentication is fixed.

## Current First-Version Modules

1. Product setup and product lock review: existing baseline.
2. Market creative: Codex A owns API/domain; Codex B owns form UI.
3. Demo script: Codex A owns deterministic generator and confirm validation;
   Codex B owns generation button and editable script UI.
4. Storyboard package: Codex A owns deterministic package generation; Codex B
   owns two-storyboard display, image preview, and script copy UI.
5. Final delivery: Codex B presents exactly two storyboard images and their two
   matching scripts without a JSON download entrypoint.
6. Integration: Codex A merges and reruns the full closed-loop verification.

## Current Local Provider Rules

- API settings use three independent local keys:
  `visionApiKey`, `deepSeekApiKey`, and `imageApiKey`.
- Do not reintroduce the legacy single `rightCodesApiKey` contract.
- Right Code vision uses the Gemini channel: `https://right.codes/gemini`.
- Right Code image generation uses the Draw channel:
  `https://www.right.codes/draw/v1/images/generations`.
- Image generation is img2img only: every real storyboard call must include the
  uploaded shoe reference images. Do not fall back to prompt-only image
  generation when references are rejected.
- Provider settings may display role/channel/model and a local key suffix for
  operator debugging, but full keys remain out of project JSON, exports, logs,
  commits, and final handoff text.
