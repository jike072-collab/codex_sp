# Codex B Current Frontend Task

Status: WAITING

There is no new frontend development request assigned right now.

## Coordination Source

Frontend work happens from another computer and must be coordinated through the
GitHub repository. Do not rely on chat thread memory, local-only notes, or stale
branch content.

## Allowed Scope

Allowed to edit:

- `studio-v2/public/**`

Do not edit:

- `studio-v2/src/**`
- `studio-v2/server.mjs`
- `schemas/**`
- `prompts/**`
- root collaboration documents
- product runtime data, uploads, generated outputs, logs, PID files, `.env`, or
  API keys

## Current Guardrails

- Do not continue old `codex/frontend-market-step` placeholder work unless a new
  task explicitly says to do so.
- Do not carry forward old branch behavior or local changes as current scope.
- Use only the current task file, frozen contracts, and branch commits as the
  coordination record.
- Sync from GitHub before starting: fetch, then rebase or merge the latest
  `main`.

## Required Future Task Shape

Every future frontend task must include:

- Base commit: exact `main` commit hash to start from.
- Goal: the user-facing behavior to implement or verify.
- Interface contracts: contract files, routes, payloads, schemas, and status
  names that apply.
- File scope: exact allowed write paths.
- Acceptance checks: narrow syntax checks, browser checks, and any user-visible
  verification required.
- Progress format: how to update task status while working.
- Delivery format: branch name, commit hash, changed files, behavior, checks,
  known risks, and whether anything needs Codex A integration.

## Delivery When Assigned

When a new task is assigned, create or update a `codex/<task>` frontend branch,
keep changes inside `studio-v2/public/**`, push the branch, and report through
GitHub-visible commits or task-file status.
