# Implementation Progress — Table: rows with no group value stay flat (table-wide groupWhen)

**Issue:** #119
**Status:** 6 / 6 complete (tests not run locally — see note below)

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | `ClusterSummary`, the `admitted` flag, and admission-aware ordering | ✅ done | — |
| 2 | Emission honours admission (dissolution) | ✅ done | — |
| 3 | Wire `config.groupWhen` through `withGrouping()` | ✅ done | — |
| 4 | Tests for table-wide admission | ✅ done | — |
| 5 | `grouping-static` demonstrates rows with no group value staying flat | ✅ done | — |
| 6 | Documentation table-wide admission owes | ✅ done | — |

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

**Test execution note (2026-09-17):** `nx test shared-table` and `nx run shared-table:typecheck`/
`typecheck-spec` are all currently red program-wide, but only from ~30 pre-existing errors in
`src/stories/**` and `src/filters/state.spec.ts` — unrelated in-flight `table-owned-filtering`
config drift on this branch, not from anything Steps 1-6 touched. Every file this issue's steps
edited was individually confirmed to typecheck clean (scoped checks, isolated from the filtering
breakage). Step 4's new tests were not executed locally as a result — `shared-table`'s test
executor bundles the whole spec program in one build regardless of `--include` scoping, so the
pre-existing failures abort before any test runs. Re-run `nx test shared-table` once
`table-owned-filtering` compiles again to get a real pass/fail on Step 4's 16 new cases.
