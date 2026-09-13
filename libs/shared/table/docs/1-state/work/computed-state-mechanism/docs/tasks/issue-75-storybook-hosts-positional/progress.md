# Implementation Progress — Table: migrate the library's Storybook hosts to positional createTable

**Issue:** #75
**Status:** 3 / 4 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | Nine row-edit story hosts + two schema files on positional `createTable()` | ✅ done | fe23c9a (on feat/table) |
| 2 | Tidy the two migration-touched lines that skipped formatting | ✅ done | uncommitted |
| 3 | `docs/3-ui/stories.md`: `schema.ts` row and the "no schema call in a host" rule | ✅ done | uncommitted |
| 4 | Storybook render/behaviour verification (user-run) and #75 close-out | ⬚ pending | — |

Graph: `1 → {2, 3}`; `{2, 3} → 4`.
Parallel-safe: `[2, 3]` after `1`. Dependency: `1 → 2 → 4`, `1 → 3 → 4`.

```
        ┌── 2 ──┐
  1 ────┤       ├── 4
        └── 3 ──┘
```

Step 1 was found already landed (commit `fe23c9a`) when this plan was written on 2026-09-13; its
acceptance checks were re-run against HEAD rather than re-implemented.
