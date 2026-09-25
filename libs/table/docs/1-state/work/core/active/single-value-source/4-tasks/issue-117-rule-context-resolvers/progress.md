# Implementation Progress — Table: rule contexts resolve declared columns — valueOf, criterionOf, stateOf

**Issue:** #117
**Status:** 9 / 9 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | Shared `valueOf` resolver + `GroupingHandle` value-typing | ✅ done | — |
| 2 | Grouping: `when` reads `ctx.valueOf` | ✅ done | — |
| 3 | Sorting: `sortFn` comparator reads `ctx.valueOf` | ✅ done | — |
| 4 | Filtering: rename `valueOf` → `criterionOf` | ✅ done | — |
| 5 | Column rules: add `stateOf(path)` | ✅ done | — |
| 6 | Construction check for resolver-referenced ids | ✅ done | — |
| 7 | Runtime specs: grouping, sorting, column rules | ✅ done | — |
| 8 | Cross-domain types-spec | ✅ done | — |
| 9 | Docs, stories and fixtures migration | ✅ done | — |

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
- **Plan gap found after Step 1 landed:** `with-grouping/schema.spec.ts` (not listed in any
  step's Files) hard-codes `MockColumnId` as a bare string-literal union, which stopped
  satisfying `runGroupingSchemaFn`'s new `TValues extends ColumnValueMap` constraint once Step 1
  retyped `GroupingPath`. Confirmed via `ngc -p tsconfig.spec.json` (14 errors). Fixed directly
  by the dispatcher (not a new step) — `MockColumnId` redefined as a `{ region, category,
  amount }` value map, mirroring `with-sorting`'s `RowValues` pattern; all 13 call sites needed
  no edit since they reference the type alias by name. `typecheck-spec` reconfirmed clean.
- Step 2 also touched `engine/grouping/queries.ts` (not in its own Files list) —
  `admitClusters`'s new `columns` param has no default, so `collectGroupIds`/
  `collectAppliedLevels` needed the same `() => columns` wiring. Mechanical, no behavior change.
  `engine/grouping/clusters.spec.ts` is now red under `typecheck-spec` (missing `admitClusters`'s
  new `columns` arg) — expected, Step 7 owns updating that file.
- Step 6 additionally touched `engine/grouping/clusters.ts`, `pipeline.ts`, `render.ts`,
  `queries.ts` (not in its own Files list) — `buildValueOfContext`'s new `knownIds`/`label`
  params had to thread through `admitClusters`'s four call sites, since grouping's own
  `buildValueOfContext` call lives inside `admitClusters`, not `with-grouping/feature.ts`
  itself. `ClusterOpts.knownIds`/`.label` are optional (default to the live `columns` list) so
  existing spec call sites that omit `ClusterOpts` keep working. Confirmed no hand-written
  duplicate throw — both guards call `assertDeclarationsAreKnown`.
- Several `engine/grouping/*.spec.ts` files (`clusters.spec.ts`, `render.spec.ts`, and
  siblings) call `admitClusters`/`clusterRows`/`buildGroupRenderRows`/`collectGroupIds`/
  `collectAppliedLevels` with fewer args than their current signatures — this predates Step 6
  (the `columnWhen`/`columns` params were already required, unrelated to `knownIds`/`label`) and
  is Step 7's to fix, per that step's own Files list.
