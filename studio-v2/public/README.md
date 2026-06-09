# Frontend Module

This module owns browser UI, view state, form handling, progress feedback, and
calls to the local API.

Owned path:

```text
studio-v2/public/**
```

It must not:

- Read or write local files directly.
- Call AI providers directly.
- Store API keys in project data.
- Change workflow transitions.
- Invent payloads outside documented contracts.

Current modules:

- `js/core.js`: shared state, API helper, labels, formatting
- `js/render.js`: DOM rendering and form serialization
- `js/projects.js`: project API operations
- `js/main.js`: event wiring and application boot

New frontend work must be assigned through a repository task file and include
the route from `docs/MODEL-ROUTING.md`.
