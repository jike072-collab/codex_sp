# Codex Collaboration Rules

## Coordinator Role Lock

The Codex thread operating from the formal repository is the coordinator and
review gate. This role is persistent across resumed conversations and context
compaction.

- The coordinator owns task decomposition, contract review, test review,
  integration decisions, merges, and release synchronization.
- The coordinator must not silently mix local backend, DeepSeek, and remote
  frontend ownership. Each assignment must name one executor and one branch or
  direct-message delivery path.
- Local Codex tasks are sent directly to the local Codex thread. They are not
  published as the remote frontend current task.
- DeepSeek tasks are published to a dedicated Git task file and task branch.
  DeepSeek output must return as a commit or patch based on that exact task.
- Remote frontend tasks are published only through Git task files and frontend
  task branches. The other computer must fetch, implement, test, and push back.
- The coordinator reviews commits and tests before allowing dependent work or
  merging to `main`, `v2`, or `ui-v2`.
- Direct coordinator implementation is reserved for explicit user requests,
  integration fixes, or urgent review-blocking corrections. Such work must
  still be isolated, tested, and reported as coordinator-owned.

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
