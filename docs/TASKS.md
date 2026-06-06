# Parallel Task Board

Remote repository: `https://github.com/jike072-collab/codex_sp`

Each task uses its own `codex/<task>` branch and owns only the listed paths.

## Track A: Frontend Workflow

Branch: `codex/frontend-market-step`

Owned paths:

- `studio-v2/public/**`

Task:

- Implement step 03: target market, audience, creative direction, and review.
- Call stable local API contracts; do not edit backend modules.

## Track B: Local API

Branch: `codex/local-api-contracts`

Owned paths:

- `studio-v2/src/local-api/**`
- `studio-v2/server.mjs`

Task:

- Add structured API errors and request validation.
- Preserve current routes while documenting any new contract.

## Track C: Workflow Domain

Branch: `codex/domain-transitions`

Owned paths:

- `studio-v2/src/workflow-domain/**`
- `schemas/**`

Task:

- Define project stage transitions and validation rules.
- Move product-lock normalization into provider-independent domain code.

## Track D: AI Providers

Branch: `codex/ai-provider-adapters`

Owned paths:

- `studio-v2/src/ai-providers/**`
- `prompts/**`

Task:

- Define vision and text provider interfaces.
- Keep fake/demo providers usable without credentials.
- Add timeout and safe provider error mapping.

## Track E: Storage

Branch: `codex/storage-safety`

Owned paths:

- `studio-v2/src/storage/**`

Task:

- Add atomic project writes and schema versioning.
- Add safe asset removal and project archive operations.

## Track F: Tests

Branch: `codex/core-tests`

Owned paths:

- `studio-v2/tests/**`

Task:

- Add zero-dependency unit and API tests using temporary directories and fake providers.
- Cover create project, upload, demo analysis, review confirmation, and invalid transitions.

## Integration Order

1. Workflow domain contracts
2. Storage and AI providers
3. Local API
4. Frontend
5. Tests and release verification

