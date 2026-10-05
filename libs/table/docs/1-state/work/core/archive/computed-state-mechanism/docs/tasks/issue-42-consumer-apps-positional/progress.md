# Implementation Progress — Table: migrate apps/demo and apps/ng-table to positional createTable

**Issue:** #42
**Status:** 3 / 3 complete — issue closed

| Step | Title                                                                     | Status  | PR  |
| ---- | ------------------------------------------------------------------------- | ------- | --- |
| 1    | `apps/demo`: seven demos on positional `createTable()`                    | ✅ done | —   |
| 2    | `apps/ng-table` home copy + `apps/demo/CLAUDE.md` off the deleted builder | ✅ done | —   |
| 3    | Demo behaviour verification and #42 close-out                             | ✅ done | —   |

Graph: `{1, 2} → 3`.
Parallel-safe: `[1, 2]`. Dependency: `1 → 3`, `2 → 3`.

```
  1 ──┐
      ├── 3
  2 ──┘
```

Plan written 2026-09-13. Blockers #38, #39, #40 are closed; `createTableSchema()` is already
deleted from the library (D25, #35), so `apps/demo` does not type-check until Step 1 lands.
