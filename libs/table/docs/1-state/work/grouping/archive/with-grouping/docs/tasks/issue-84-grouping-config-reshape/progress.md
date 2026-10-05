# Implementation Progress — Table: withGrouping() takes initial levels and a rules schema in one config

**Issue:** #84
**Status:** 3 / 3 complete

| Step | Title                                                  | Status    | PR  |
| ---- | ------------------------------------------------------ | --------- | --- |
| 1    | Reshape `WithGroupingConfig` and sweep every call site | ✅ done\* | —   |
| 2    | Tests for the combined config shape                    | ✅ done\* | —   |
| 3    | Documentation the reshape owes                         | ✅ done   | —   |

\* `nx run shared-table:typecheck` / `nx run shared-table:typecheck-spec` / `nx test shared-table`
are red project-wide, but only from pre-existing, unrelated `filters/` WIP (uncommitted before
this issue's work started, part of `table-owned-filtering`). `typecheck-spec`'s full-program error
list traces zero errors to `with-grouping.ts`/`.spec.ts`/story hosts — the 5 remaining errors are
all `withFiltering({ predicates: ... })` call sites unrelated to this issue. The `@ts-expect-error`
tripwire for the deleted overload is confirmed live (no `TS2578` unused-directive diagnostic at
that line). `initialGrouping` confirmed absent from `libs/shared/table/src` (grep clean). No
isolated per-spec runner exists for this project, so `with-grouping.spec.ts`'s new assertions are
verified by the typecheck signal plus manual inspection, not a green `nx test` run — full suite
verification is blocked until the unrelated `filters/` refactor lands.

## Graph

```
Step 1 ──┬──> Step 2
         └──> Step 3
```

**Parallel-safe:** Steps 2 and 3, once Step 1 lands.
**Dependency:** Step 1 → Step 2, Step 1 → Step 3.
