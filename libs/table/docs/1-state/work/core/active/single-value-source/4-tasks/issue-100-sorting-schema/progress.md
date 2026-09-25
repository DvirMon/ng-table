# Implementation Progress — Table: per-column sorting config moves off ColumnDef into withSorting()

**Issue:** #100
**Status:** 6 / 6 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | The sorting schema module | ✅ done | — |
| 2 | Wire `withSorting({ schema })` | ✅ done | — |
| 3 | Delete the old surface | ✅ done | — |
| 4 | Runtime spec | ✅ done | — |
| 5 | Types spec | ✅ done | — |
| 6 | Docs, decisions and `llms.txt` | ✅ done | — |

## Execution graph

```
1 ──► 2 ──► 3 ──┬─► 4  runtime spec
                ├─► 5  types spec
                └─► 6  docs
```

**Dependency:** `1 → 2 → 3`.
**Parallel-safe:** `[4, 5, 6]` after 3.

## Notes

- **The spec target is red from Step 2 until Step 4, by design.** Step 2
  stops reading the old config, and Step 3 deletes it. Don't soften a
  check to get a green run early.
- **Rulings made while planning, 2026-09-25**, recorded by Step 6:
  - three declarators (SO22 stands);
  - `sortable(path, { enable })`, with an ADR-0018 amendment;
  - a `sortingSchema<Row>(fn)` identity helper for reuse;
  - no `apply()`;
  - a duplicate declarator of the same kind throws.
