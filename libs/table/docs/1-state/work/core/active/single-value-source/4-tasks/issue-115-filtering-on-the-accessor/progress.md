# Implementation Progress — Table: filtering reads the accessor; criteria key by column id

**Issue:** #115
**Status:** 8 / 8 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | Re-key the filter type surface to column id | ✅ done | — |
| 2 | The engine reads the accessor | ✅ done | — |
| 3 | Widen `withFiltering`'s input; ids checked at construction | ✅ done | — |
| 4 | Engine specs | ✅ done | — |
| 5 | Feature spec | ✅ done | — |
| 6 | Type specs | ✅ done | — |
| 7 | Stories and fixtures migrate | ✅ done | — |
| 8 | Docs, decisions and `llms.txt` | ✅ done | — |

## Execution graph

```
1 ──► 2 ──► 3 ──┬──► 5  feature spec
      │         ├──► 6  type specs
      │         └──► 7  stories ──► 8  docs
      └──► 4  engine specs
```

**Parallel-safe:** `[3, 4]` after 2; `[5, 6, 7]` after 3.
**Longest chain:** `1 → 2 → 3 → 7 → 8`.

## Notes

- **The tree is red between steps, by design.** Step 1 breaks
  `src/stories/**` until Step 7; Step 2 breaks the engine specs until
  Step 4; Step 3 breaks two foreign specs until Step 5. Don't soften a
  check to get an early green.
- **`nx run shared-table:typecheck` runs twice** where templates are in
  scope (Steps 7, 8).
- **Ruled while planning, 2026-09-25:** `FiltersPath<TRow, TValues>`
  with `TValues` required; no `ColumnValuesOfSet<>` alias (deferred);
  a removed column degrades like G72. Step 8 records all three.
