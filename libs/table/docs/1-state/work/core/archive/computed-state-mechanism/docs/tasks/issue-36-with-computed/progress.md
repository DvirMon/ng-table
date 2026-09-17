# Implementation Progress — Table: withComputed() — library-declared derived state as a feature

**Issue:** #36
**Status:** 4 / 4 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | engine: optional `Feature.displayName`, fold label `feature N (name)` | ✅ done | — |
| 2 | with-computed.ts + index.ts: `withComputed()` — validate, wrap, name | ✅ done | — |
| 3 | with-computed.spec.ts: runtime, both placements, construction + evaluation errors | ✅ done | — |
| 4 | create-table.spec.ts: type assertions, both placements, not-any, trap 3 | ✅ done | — |

Graph: `1 → 2 → {3, 4}`.
Parallel-safe: `[3, 4]` after `2`. Dependency: `1 → 2 → 3`, `1 → 2 → 4`.

```
  1 ── 2 ──┬── 3
           └── 4
```

Blocked by #35 (all six steps). Docs (ADR-0014 row, persistence exclusion, CLAUDE.md) are #44.
