# Workflow Domain

Owner: **Codex A / main integration**

This module defines provider-independent business rules:

- project stages and valid transitions
- required data for each review gate
- normalization and validation
- market creative contract
- future script, visual, and export contracts

Frontend and provider modules must consume these contracts rather than duplicating the rules.

Current contract work:

```text
docs/contracts/market-creative-api.md
```

Current modules:

- `domain-error.mjs`: expected domain errors and HTTP-safe status metadata
- `project-workflow.mjs`: stages and legal transitions
- `product-review.mjs`: product-lock confirmation gate
- `market-brief.mjs`: market brief validation and confirmation
- `value-normalizers.mjs`: shared deterministic value normalization
