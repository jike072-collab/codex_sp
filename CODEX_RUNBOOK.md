# Codex Runbook

This file is the shared operating file for both Codex agents. Read it before
editing. If it conflicts with a direct user instruction, ask or follow the
newer user instruction. If it conflicts with an API contract, the contract wins.

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
-> generate visual prompts and Flow Omni packages
-> download JSON export
```

Do not spend first-version time on real model integrations, visual redesign,
batch workflows, accounts, cloud sync, or advanced storage features unless the
closed loop already works.

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
studio-v2/src/workflow-domain/**
studio-v2/src/local-api/**
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
- Maintain storage safety and persisted project shape.
- Run backend, domain, API, and final integration tests.
- Integrate Codex B's frontend branch into `main`.

### Codex B: browser frontend

Branch:

```text
codex/frontend-market-step
```

Owns:

```text
studio-v2/public/**
```

Responsibilities:

- Render workflow stages from persisted `project.status`.
- Implement market creative form against the frozen market contract.
- Implement script generation, editable script confirmation, visual prompt
  display, Flow Omni package copying, and JSON export download against the
  frozen demo-loop contract.
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

## Step Discipline

Use this loop for every module:

1. Sync: run `git fetch origin`, inspect ahead/behind status, and read this
   file plus the active task file.
2. Scope: confirm the files you will edit are inside your owned paths.
3. Implement one small module at a time.
4. Verify that module before moving to the next one.
5. Commit after a passing module or coherent milestone.
6. Push immediately after commit when GitHub authentication is available.
7. Handoff with branch, commit, changed files, behavior, tests, and blockers.

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
- `export`: four visual prompts, two Flow Omni packages, copy controls, and
  JSON download are visible.

### Final closed-loop verification

Before handoff or integration, run:

```text
node --test studio-v2/tests/*.test.mjs
```

Then exercise the browser workflow from project creation through JSON export.
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
4. Visual prompt package: Codex A owns deterministic package generation; Codex B
   owns prompt and Flow Omni display/copy UI.
5. JSON export: Codex A owns export endpoint; Codex B owns download entrypoint.
6. Integration: Codex A merges and reruns the full closed-loop verification.
