# Implementation Progress — Table: convert withSorting, withFiltering, withGrouping to the Feature<In, Out> contract

**Issue:** #72
**Status:** 6 / 6 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | with-sorting.ts: `withSorting<In>(config?, derive?)`, F-bounded input | ✅ done | — |
| 2 | with-filtering.ts: `Feature<In, {}>`, `Filters<RowOf<In>>` | ✅ done | — |
| 3 | with-grouping.ts: `composed` → lazy guarded store read, `ColumnId<RowOf<In>>` | ✅ done | — |
| 4 | with-sorting.spec.ts: positional, type assertions, trailing block | ✅ done | — |
| 5 | with-filtering.spec.ts: positional, `{}` contribution asserted | ✅ done | — |
| 6 | with-grouping.spec.ts: either-order expansion, pipeline permutation, autocomplete | ✅ done | — |

Graph: `1 → 4`, `2 → 5`, `{1, 2, 3} → 6`.
Parallel-safe: `[1, 2, 3]`; `[4, 5, 6]` after their code steps. Dependency: `1 → 4`, `2 → 5`, `3 → 6`.

```
  1 ──┬── 4
      │
  2 ──┼── 5
      │
  3 ──┴── 6   (6 also needs 1, 2; cross-issue: #73 for bare withSelection()/withExpansion())
```

Typing mechanism verified by probe: `../../../probe-r5-feature-conversion.ts.txt` (F-bounded
`In extends Pick<TableStore<RowOf<In>>, …>`, `NoInfer` on derive, derive-first overload declared
before config-only). Decided 2026-09-13: derive block may take the first position when the
feature's config is optional and not itself a function — grouping is trailing-only.
Docs (ADR-0003 update, CLAUDE.md `composed` line, migration table) are #78.
