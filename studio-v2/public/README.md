# Frontend Module

Owner for the current parallel task: **Codex B**

Branch:

```text
codex/frontend-market-step
```

Active task:

```text
tasks/codex-frontend-market-step.md
```

This module owns browser UI, view state, form handling, progress feedback, and calls to the local API.

It must not:

- Read or write local files directly.
- Call AI providers directly.
- Store API keys.
- Change workflow transitions.
- Invent API payloads outside documented contracts.

Current modules:

- `js/core.js`: shared state, API helper, labels, formatting
- `js/render.js`: DOM rendering and form serialization
- `js/projects.js`: project API operations
- `js/main.js`: event wiring and application boot

