# Codex B Current Frontend Task

Status: ACTIVE

Base commit: `9aa1915` (`Document remote frontend coordination`)

There is a new frontend refinement round. Keep every change inside
`studio-v2/public/**`.

## Coordination Source

Frontend work happens from another computer and must be coordinated through the
GitHub repository. Do not rely on chat thread memory, local-only notes, or stale
branch content.

## What To Fix

- Remove the JSON download button from final delivery.
- Keep only the last two storyboard images and their matching scripts.
- Make the sidebar delete action reliable.
- Replace the unclear delete-side spinner/history icon with a labeled control.
- Add batch-delete UI for old projects.
- Make Step 02 directly editable without an extra click-through feel.
- Turn the Step 02 controls into direct inline fields instead of drawer-style
  reveal panels.
- Keep the one-line promise field empty by default and auto-fill it from the
  project if the user leaves it blank.
- Keep the product summary dialog fully visible, with Chinese labels only.
- Move the shot-count choice into Step 02 and use it for script generation.
- Keep the script page focused on editing and confirmation, not on re-picking
  the count.
- Show the two 10-second script blocks side by side when space allows.
- Merge repeated per-shot labels so each shot is easier to scan.
- Put the script actions at the top.
- Turn the progress indicator into a percent-style bar.
- Polish motion and interaction details with tasteful animation.

## References To Study

- `greensock/GSAP`
- `greensock/gsap-skills`
- `Leonxlnx/taste-skill`
- `obra/superpowers`

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
