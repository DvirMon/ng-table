# Implementation Progress — Table: migrate the library's Storybook hosts to positional createTable

**Issue:** #41
**Status:** 4 / 4 complete — issue closed

| Step | Title                                                                           | Status  | PR                      |
| ---- | ------------------------------------------------------------------------------- | ------- | ----------------------- |
| 1    | Nine row-edit story hosts + two schema files on positional `createTable()`      | ✅ done | fe23c9a (on feat/table) |
| 2    | Tidy the two migration-touched lines that skipped formatting                    | ✅ done | 46094b7                 |
| 3    | `docs/3-ui/stories.md`: `schema.ts` row and the "no schema call in a host" rule | ✅ done | 46094b7                 |
| 4    | Storybook render/behaviour verification (user-run) and #41 close-out            | ✅ done | —                       |

Graph: `1 → {2, 3}`; `{2, 3} → 4`.
Parallel-safe: `[2, 3]` after `1`. Dependency: `1 → 2 → 4`, `1 → 3 → 4`.

```
        ┌── 2 ──┐
  1 ────┤       ├── 4
        └── 3 ──┘
```

Step 1 was found already landed (commit `fe23c9a`) when this plan was written on 2026-09-13; its
acceptance checks were re-run against HEAD rather than re-implemented.

## Step 4 — render/behaviour walkthrough (2026-09-14)

User ran the table library's Storybook and walked all nine `Table / Row Editing /` stories.
Every row of the Step 4 checklist reported green — no failing story, no failing interaction.
The `multiple` arg still drives `withRowEdit({ multiple })` without a rebuild.

The issue was closed on 2026-09-13 on the strength of the code steps; this walkthrough is AC 3's
evidence, recorded after the fact. Nothing red, so the closure stands.
