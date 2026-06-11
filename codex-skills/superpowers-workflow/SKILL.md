---
name: superpowers-workflow
description: Mandatory second skill for every task in this repository; after model routing, use the repository-first workflow for inspection, planning, owned-path implementation, verification, review, Git coordination, and handoff.
---

# Superpowers Workflow

## Repository Requirement

Invoke this skill second on every task and resumed task, immediately after
`$nadirclaw-model-router`.

## Use

- Read the repo rules and the current task file before editing.
- Preserve the existing architecture unless the task explicitly asks for a change.
- Split complex work into small, non-overlapping steps.
- Keep parallel work isolated by owned paths and branches.
- Validate after each meaningful change.

## Workflow

1. Inspect the task brief, repo conventions, and current branch state.
2. Identify the smallest safe change set.
3. Implement one concern at a time.
4. Run the narrowest useful checks first, then broader tests.
5. Report remaining risk plainly.

## Coordination

- When multiple Codex threads are involved, assign clear ownership and avoid overlap.
- Use task files and branch names as the source of truth.
- Reconcile branches only after the owned checks pass.

## Output Habit

- Prefer concise, actionable status updates.
- Name any assumptions that affect the result.
- Do not bury a failure behind optimistic wording.
