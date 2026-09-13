# Implementation Progress — Table: withComputed() — library-declared derived state as a feature

**Issue:** #70
**Status:** 0 / 4 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | engine: optional `Feature.displayName`, fold label `feature N (name)` | ⬚ pending | — |
| 2 | with-computed.ts + index.ts: `withComputed()` — validate, wrap, name | ⬚ pending | — |
| 3 | with-computed.spec.ts: runtime, both placements, construction + evaluation errors | ⬚ pending | — |
| 4 | create-table.spec.ts: type assertions, both placements, not-any, trap 3 | ⬚ pending | — |

Graph: `1 → 2 → {3, 4}`.
Parallel-safe: `[3, 4]` after `2`. Dependency: `1 → 2 → 3`, `1 → 2 → 4`.

```
  1 ── 2 ──┬── 3
           └── 4
```

Blocked by #69 (all six steps). Docs (ADR-0014 row, persistence exclusion, CLAUDE.md) are #78.
