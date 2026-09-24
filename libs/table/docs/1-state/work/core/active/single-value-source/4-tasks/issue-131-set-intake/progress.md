# Implementation Progress — `createTable` accepts a `ColumnSet` beside the array (expand)

**Issue:** [#131](https://github.com/DvirMon/ng-table/issues/131)
**Status:** 6 / 6 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | `createTable` accepts a `ColumnSet` beside the array | ✅ done | — |
| 2 | Generator constraint, regenerated | ✅ done | — |
| 3 | Move the three specs off `columnsSchema` | ✅ done | — |
| 4 | Delete `columnsSchema` from `createTable` | ✅ done | — |
| 5 | Carriage proofs: `create-table.types.spec.ts` | ✅ done | — |
| 6 | Record the amendment | ✅ done | — |

## Graph

```
1 ──┬──► 2 ────────────┐
    └──► 3 ──► 4 ──────┴──► 5 ──► 6
```

Parallel-safe: [2, 3] after 1; [2, 4] once 3 is done.
Dependency: 1 → 3 → 4 → 5 → 6.

## Scope note

`columnsSchema` is removed in this slice, not in #139 (user
ruling, 2026-09-24). The array intake stays, with no rules,
until #139. Prose docs naming `columnsSchema` stay with
#141.
