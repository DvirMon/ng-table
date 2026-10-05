# Issue graph — render-columns epic (#142)

Epic: [#142](https://github.com/DvirMon/ng-table/issues/142) — table store
gains `renderColumns`, the visible columns in render order; every story
host renders from it.

## Nodes

| #                                                      | Title                                                  | State                     | Depends on     | Blocks     |
| ------------------------------------------------------ | ------------------------------------------------------ | ------------------------- | -------------- | ---------- |
| [#143](https://github.com/DvirMon/ng-table/issues/143) | Add renderColumns to the table store                   | ✅ CLOSED 09-25 (76988b5) | —              | #144, #145 |
| [#144](https://github.com/DvirMon/ng-table/issues/144) | Render grouping story hosts from renderColumns()       | ✅ CLOSED 09-25 (c7b1834) | #143 (cleared) | —          |
| [#145](https://github.com/DvirMon/ng-table/issues/145) | Hide hidden columns in filtering and selection stories | ✅ CLOSED 09-25 (c7b1834) | #143 (cleared) | —          |

## Graph

```
#143 store primitive ──┬──> #144 grouping hosts
✅ closed              │    ✅ closed
                        └──> #145 filtering/selection hosts
                             ✅ closed
```

## Summary

- **Parallel-safe:** #144 and #145 — no shared files; both only read
  `table.renderColumns()`.
- **Sequenced:** #143 → #144 and #143 → #145, both gated on the
  `renderColumns` member existing on `TableStore` — satisfied, #143 shipped.
- **Current frontier:** none — #143, #144, #145 all shipped; #142
  (epic) itself is not tracked as a node here and remains open in
  the tracker.

## Source

Edges derived at issue grain from the spec (no grilling ranking was
recorded in `1-decisions.md`) and confirmed by the user on 2026-09-25.
Titles and states pulled from the GitHub API on 2026-09-25. Related docs:
`2-spec.md`, `1-decisions.md` in this folder; capability log
`libs/table/docs/decisions/columns.md`. Re-pulled 2026-09-25 after #143
shipped via direct push (commit `76988b5`). Re-pulled again 2026-09-25
after #144 and #145 shipped via direct push (commit `c7b1834`).
