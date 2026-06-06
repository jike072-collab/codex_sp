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

