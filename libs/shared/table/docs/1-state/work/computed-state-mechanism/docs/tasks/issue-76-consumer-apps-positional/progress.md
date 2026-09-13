# Implementation Progress — Table: migrate apps/demo and apps/ng-table to positional createTable

**Issue:** #76
**Status:** 2 / 3 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | `apps/demo`: seven demos on positional `createTable()` | ✅ done | — |
| 2 | `apps/ng-table` home copy + `apps/demo/CLAUDE.md` off the deleted builder | ✅ done | — |
| 3 | Demo behaviour verification (user-run) and #76 close-out | ▶ in progress (awaiting user demo walkthrough) | — |

Graph: `{1, 2} → 3`.
Parallel-safe: `[1, 2]`. Dependency: `1 → 3`, `2 → 3`.

```
  1 ──┐
      ├── 3
  2 ──┘
```

Plan written 2026-09-13. Blockers #72, #73, #74 are closed; `createTableSchema()` is already
deleted from the library (D25, #69), so `apps/demo` does not type-check until Step 1 lands.
