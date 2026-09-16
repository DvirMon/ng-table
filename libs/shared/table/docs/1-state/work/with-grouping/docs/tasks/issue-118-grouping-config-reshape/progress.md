# Implementation Progress — Table: withGrouping() takes initial levels and a rules schema in one config

**Issue:** #118
**Status:** 0 / 3 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | Reshape `WithGroupingConfig` and sweep every call site | ▶ in progress | — |
| 2 | Tests for the combined config shape | ⬚ pending | — |
| 3 | Documentation the reshape owes | ⬚ pending | — |

## Graph

```
Step 1 ──┬──> Step 2
         └──> Step 3
```

**Parallel-safe:** Steps 2 and 3, once Step 1 lands.
**Dependency:** Step 1 → Step 2, Step 1 → Step 3.
