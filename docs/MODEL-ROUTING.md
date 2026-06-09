# Automatic Model Routing

This repository uses a lightweight routing policy inspired by NadirClaw. The
coordinator classifies every task before delegating it and selects the cheapest
model that can complete the work safely.

## Tiers

### Simple

Use `gpt-5.4-mini` with low or medium thinking.

Typical work:

- Read files, inspect Git state, summarize diffs, or report test output.
- Update a narrow task file or documentation section.
- Make a deterministic, single-file cosmetic change with a frozen contract.
- Run an already-known verification command.

### Standard

Use `gpt-5.4` with medium thinking.

Typical work:

- Implement a bounded feature inside one owned module.
- Adjust several frontend files against stable API contracts.
- Add focused tests for an understood behavior.
- Fix a reproducible bug with a clear cause and limited blast radius.

### Complex

Use `gpt-5.5` with high thinking. Use xhigh only for genuinely difficult
architecture, debugging, or integration work.

Typical work:

- Change contracts, schemas, storage, workflow state, or provider behavior.
- Diagnose ambiguous failures, concurrency, data migration, billing, timeout,
  or partial-success behavior.
- Coordinate or integrate multiple branches or modules.
- Review images or UI behavior where code and visual evidence must be
  reconciled.

## Forced Upgrades

Route directly to Complex when any of these apply:

- The task requires tools plus a multi-step implementation loop.
- More than one ownership boundary or contract is affected.
- A provider call may have external side effects or charges.
- Existing data may need migration, cleanup, or compatibility handling.
- The request contains an image or requires browser/visual verification.
- The task has already failed twice on a lower tier.
- The classifier is uncertain. When uncertain, over-serve rather than risk a
  bad implementation.

## Session Rules

- Keep the chosen model for the coherent task or thread.
- Models may upgrade during a task, but do not downgrade after complex state or
  reasoning has entered the session.
- Split unrelated simple follow-up work into a fresh task instead of keeping it
  in a costly complex session.
- Keep task files concise and reference exact commits and contracts to avoid
  sending old chat history.

## Delegation

Before starting or sending work to another Codex:

1. Write `Route: simple|standard|complex` in the task or delegation.
2. Select the mapped model and thinking level when the thread tool supports it.
3. Include only the required files, contracts, acceptance checks, and base
   commit.
4. Upgrade the route if the implementation crosses a forced-upgrade boundary.

NadirClaw can also run as a local OpenAI-compatible proxy, but its `codex
onboard` command overwrites the machine-level Codex provider configuration.
Repository routing is therefore the portable default for both computers and
does not require sharing provider credentials.
