# Parallel Task Board

Active V2 follow-up assignments are recorded in:

- `tasks/codex-backend-image-concurrency.md`
- `tasks/codex-frontend-ui-v2-density-followup.md`

Completed previous-round assignments remain in:

- `tasks/codex-backend-current.md`
- `tasks/codex-frontend-current.md`

For every round, Codex A must:

1. Sync and branch from the latest `main`.
2. Create one task file per Codex with non-overlapping owned paths.
3. Record `Route: simple|standard|complex` using `docs/MODEL-ROUTING.md`.
4. Freeze shared contracts before frontend implementation begins.
5. Integrate only after each branch passes its owned checks.

Frontend work remains limited to `studio-v2/public/**`. Backend, contracts,
storage, providers, and integration remain owned by Codex A.
