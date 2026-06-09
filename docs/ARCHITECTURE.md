# Architecture

## Purpose

The project is a local-first production tool that turns product reference images into reviewed advertising assets and an exportable first-version delivery package. Human review remains explicit at important workflow stages, and secrets, uploaded assets, project state, and generated output remain local.

This document defines module boundaries for ongoing work. The current `studio-v2` implementation may colocate several modules in the same files; new work should preserve these boundaries so they can be separated without changing behavior.

## Dependency Direction

```text
frontend -> local-api -> workflow-domain
                    |-> ai-providers
                    |-> storage

ai-providers -> workflow-domain contracts
storage      -> workflow-domain contracts
tests        -> any module under test
```

`workflow-domain` owns business language and rules. It must not depend on HTTP request objects, browser APIs, filesystem paths, or a provider-specific response shape. `frontend` communicates through local API contracts rather than reading local storage directly.

## Modules

### frontend

Owns the browser interface, view state, user input, progress display, review controls, and presentation formatting.

- Calls `local-api` through documented request and response contracts.
- Does not hold provider credentials or call AI vendors directly.
- Does not infer workflow state that belongs in `workflow-domain`.
- Treats project and asset identifiers as opaque values.

Current implementation area: `studio-v2/public/`.

### local-api

Owns the local HTTP server, routing, request validation, response mapping, static asset delivery, and translation between transport data and application operations.

- Authenticates or limits local access if network exposure is introduced.
- Delegates workflow decisions to `workflow-domain`.
- Delegates model calls to `ai-providers`.
- Delegates persistence to `storage`.
- Returns stable error codes and safe messages; provider payloads and secrets must not leak to clients.

Current implementation area: `studio-v2/src/local-api/` and the thin `studio-v2/server.mjs` entry point.

### workflow-domain

Owns the product workflow, entities, state transitions, validation rules, review gates, and provider-independent contracts.

Core concepts include project, source asset, product lock, market direction, script, storyboard, keyframe, review decision, and export package.

- Defines allowed stage transitions and required inputs.
- Keeps human approval explicit and auditable.
- Distinguishes observed facts, model inferences, and user-provided claims.
- Produces deterministic validation and normalization where possible.
- Contains no filesystem, HTTP, DOM, or vendor SDK code.

### ai-providers

Owns integrations with vision, text, image, and future generation services.

- Implements interfaces defined by `workflow-domain`.
- Converts provider responses into normalized domain results.
- Contains timeouts, cancellation, retries, and provider error classification.
- Supports deterministic fake providers for local development and tests.
- Never logs API keys, full secret-bearing headers, or sensitive source assets by default.

Current implementation area: `studio-v2/src/ai-providers/`, plus legacy provider calls in workflow scripts.

### storage

Owns persistence of projects, stage results, source asset metadata, generated asset references, and schema/version migration.

- Keeps path construction and filesystem operations inside the module.
- Uses atomic writes for state that must survive interruption.
- Validates data when reading and before writing.
- Does not persist API keys in project records.
- Treats `studio-v2/data/` and `outputs/` as local runtime data, never source-controlled fixtures.

Current implementation area: `studio-v2/src/storage/`.

### tests

Owns automated verification, fixtures, fakes, and end-to-end workflow checks.

- Unit tests cover domain rules and normalization.
- Contract tests cover local API, storage, and provider adapters.
- Integration tests use temporary storage and fake providers.
- End-to-end tests cover the smallest critical user journey.
- Fixtures are synthetic, minimal, secret-free, and stored outside ignored runtime directories.

## Interface Rules

Cross-module contracts must be explicit, versionable data structures. A contract change should include its validation, producer tests, consumer tests, and migration or compatibility note.

Prefer stable identifiers, ISO 8601 timestamps, enumerated workflow states, and structured errors such as:

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project was not found."
  }
}
```

Provider-specific fields must stop at the `ai-providers` boundary. Filesystem paths must stop at the `storage` boundary. UI labels must stop at the `frontend` boundary.

## Security and Data Handling

- Read secrets from local environment configuration.
- Commit examples only, never real `.env` files.
- Validate uploaded MIME type, size, identifiers, and resolved paths.
- Keep runtime data and generated artifacts in ignored directories.
- Redact credentials and sensitive payloads from errors and logs.
- Bind local services to loopback by default.
