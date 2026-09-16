# Implementation Progress — Table: rows with no group value stay flat (table-wide groupWhen)

**Issue:** #119
**Status:** 0 / 6 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | `ClusterSummary`, the `admitted` flag, and admission-aware ordering | ⬚ pending | — |
| 2 | Emission honours admission (dissolution) | ⬚ pending | — |
| 3 | Wire `config.groupWhen` through `withGrouping()` | ⬚ pending | — |
| 4 | Tests for table-wide admission | ⬚ pending | — |
| 5 | `grouping-static` demonstrates rows with no group value staying flat | ⬚ pending | — |
| 6 | Documentation table-wide admission owes | ⬚ pending | — |

## Graph

```
#118 Step 1 ──> Step 1 ──> Step 2 ──> Step 3 ──┬──> Step 4
                                               ├──> Step 5
                                               └──> Step 6
```

**Parallel-safe:** Steps 4, 5 and 6, once Step 3 lands.
**Dependency:** Step 1 → Step 2 → Step 3; all three fan out to 4/5/6.
**External:** Step 1 depends on #118 Step 1 — both add members to `WithGroupingConfig`.

Steps 1 and 2 are deliberately unobservable on their own: nothing supplies a predicate until
Step 3, so each lands green with `renderRows()` byte-identical.
