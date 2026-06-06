# Parallel Codex Work

## Goal

Parallel work should produce small, independently reviewable branches with clear ownership and stable interfaces. No agent may discard or rewrite another contributor's work to make its own branch cleaner.

## File Ownership

Every task declares its write scope before editing. Ownership is temporary and task-specific.

- One active owner edits a file at a time.
- Shared contracts, schemas, manifests, and central routing files require explicit coordination.
- Read outside the owned scope as needed, but do not make opportunistic edits there.
- Existing uncommitted changes belong to another contributor unless proven otherwise.
- Never revert, reset, overwrite, or reformat unrelated changes.

When a task needs a file owned by another branch, agree on an interface first or split the work so one branch supplies the shared change.

## Branches

Use one branch per task, named:

```text
codex/<task>
```

Use a short lowercase task slug, for example `codex/provider-timeouts` or `codex/project-list-tests`. Keep commits focused and do not mix generated artifacts or unrelated cleanup into the branch.

## Interface-First Work

For cross-module work, settle the contract before parallel implementation begins.

1. Define inputs, outputs, errors, ownership, and compatibility expectations.
2. Add or update the smallest contract artifact or test.
3. Record assumptions that consumers may rely on.
4. Let module owners implement against the agreed contract.
5. Integrate only after producer and consumer verification passes.

A contract branch should land before dependent branches when practical. If it cannot, dependent work must reference the exact commit and avoid silently inventing a competing shape.

## Conflict Avoidance

- Divide work by module or disjoint file set.
- Announce changes to shared files before editing them.
- Rebase or merge the latest target branch before handoff, then rerun verification.
- Avoid broad formatting, file moves, dependency churn, and drive-by refactors.
- Keep generated data, logs, outputs, and local configuration out of commits.
- Resolve conflicts by preserving both intended behaviors; do not choose a side based only on recency.

## Handoff

Every handoff includes:

- Branch name and latest commit.
- Files changed and module ownership.
- Behavior completed and intentionally deferred.
- Interfaces added or changed.
- Verification commands and results.
- Known risks, assumptions, migration notes, and dependent branches.

The receiving contributor should be able to continue without reconstructing decisions from chat history.

## Verification

Run the narrowest relevant checks during development and the full affected-module suite before handoff.

Minimum verification:

- Review the final diff for scope and accidental secret or artifact inclusion.
- Run formatting, linting, and tests available for each changed module.
- Exercise changed local API routes and the affected browser workflow when applicable.
- Test failure paths for storage and provider changes.
- Confirm fake or mock providers work without credentials.
- Confirm ignored runtime paths remain untracked.

If a check cannot run, record the exact reason and residual risk. Do not report unrun checks as passing.

## Merge Rules

A branch is ready to merge when:

- Its scope and owner are clear.
- Required reviews and checks pass.
- Shared interfaces are documented and tested.
- The branch is current enough to expose integration conflicts.
- No unrelated changes, secrets, runtime data, outputs, logs, or PID files are present.
- Handoff notes identify follow-up work without hiding required completion work.

Merge interface or schema changes before their consumers. Merge foundational changes before presentation changes. When two branches conflict semantically, pause the merge and reconcile the contract; do not patch around incompatible assumptions in the final branch.

After merging, dependent branches update from the target branch, resolve conflicts within their owned files, and rerun affected verification before merge.

