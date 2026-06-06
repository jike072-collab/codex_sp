# Codex Collaboration Rules

Read these files before editing:

- `CODEX_RUNBOOK.md`
- `CURRENT_ASSIGNMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/PARALLEL-WORK.md`
- `docs/TASKS.md`

## Required Workflow

1. Check `CURRENT_ASSIGNMENTS.md`. Only work on a role explicitly assigned there.
2. Create or use its `codex/<task>` branch.
3. Edit only the owned paths listed for that track.
4. Do not revert, reformat, move, or clean files owned by another track.
5. Agree on API or schema contracts before changing shared behavior.
6. Run the narrowest relevant checks and report exact results.
7. Hand off with changed files, behavior, interfaces, checks, and known risks.

The active product is `studio-v2/`. Treat the root `scripts/`, `web/`, and historical output shapes as legacy references unless a task explicitly owns them.

Never commit `.env`, API keys, uploaded product images, generated outputs, logs, PID files, or `studio-v2/data/`.
