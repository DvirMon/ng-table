# Implementation Progress — Table: rule contexts resolve declared columns — valueOf, criterionOf, stateOf

**Issue:** #117
**Status:** 0 / 9 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | Shared `valueOf` resolver + `GroupingHandle` value-typing | ⬚ pending | — |
| 2 | Grouping: `when` reads `ctx.valueOf` | ⬚ pending | — |
| 3 | Sorting: `sortFn` comparator reads `ctx.valueOf` | ⬚ pending | — |
| 4 | Filtering: rename `valueOf` → `criterionOf` | ⬚ pending | — |
| 5 | Column rules: add `stateOf(path)` | ⬚ pending | — |
| 6 | Construction check for resolver-referenced ids | ⬚ pending | — |
| 7 | Runtime specs: grouping, sorting, column rules | ⬚ pending | — |
| 8 | Cross-domain types-spec | ⬚ pending | — |
| 9 | Docs, stories and fixtures migration | ⬚ pending | — |

## Execution graph

```
1 ──┬─► 2 ──┐
    ├─► 3 ──┤
4 ──┤       ├─► 7 ──┐
5 ──┴─► 6 ──┘        ├─► 9
              8 ─────┘
```

**Dependency:** `1 → {2, 3}`; `{1,2,3,5} → 6`; `{2,3,5,6} → 7`; `{1,4,5} → 8`; `{2,3,4,5} → 9`.
**Parallel-safe:** `[2, 3, 4, 5]` after 1 (4 and 5 need no dependency at all); `[7, 8]` once their
own upstream steps land.

## Notes

- Steps 4 and 5 have no dependency on Step 1 — they can start immediately, in parallel with
  Step 1.
- Step 6 is the narrowest step: it needs Steps 1, 2, 3, and 5 all landed, since it adds the same
  guard to every resolver body that exists by then.
