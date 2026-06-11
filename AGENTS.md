# Codex Collaboration Rules

## Mandatory Skills On Every Task

Every Codex working in this repository MUST invoke both skills at the start of
every task, including implementation, review, debugging, documentation, Git
coordination, testing, and resumed work:

1. `$nadirclaw-model-router`
2. `$superpowers-workflow`

Invoke them in that order. The first skill selects the route/model/reasoning
tier. The second skill controls repository inspection, task decomposition,
owned-path discipline, implementation, verification, and handoff.

This is not optional and does not depend on task size. Each task update or
handoff must record:

- `Skills: nadirclaw-model-router, superpowers-workflow`
- `Route: simple | standard | complex`

If either skill is not installed, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-codex-skills.ps1
```

Then restart or open a fresh Codex thread before editing.

Read these files before editing:

- `CODEX_RUNBOOK.md`
- `CURRENT_ASSIGNMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/PARALLEL-WORK.md`
- `docs/MODEL-ROUTING.md`
- `docs/TASKS.md`

## Required Workflow

1. Invoke both mandatory skills in the required order.
2. Check `CURRENT_ASSIGNMENTS.md`. Only work on a role explicitly assigned there.
3. Create or use its `codex/<task>` branch.
4. Edit only the owned paths listed for that track.
5. Do not revert, reformat, move, or clean files owned by another track.
6. Agree on API or schema contracts before changing shared behavior.
7. Run the narrowest relevant checks and report exact results.
8. Hand off with skills, route, changed files, behavior, interfaces, checks, and known risks.

The active product is `studio-v2/`. Root legacy `scripts/` and `web/` entrypoints have been removed; do not recreate or extend them for first-version work.

Never commit `.env`, API keys, uploaded product images, generated outputs, logs, PID files, or `studio-v2/data/`.
