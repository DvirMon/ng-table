# Issue graph — tree-ui-layer epic (#165)

Epic: [#165](https://github.com/DvirMon/ng-table/issues/165) — tree UI
directives (`ngpTableTreeRow` hooks, `ngpTableTreeToggle`) plus core
row depth variable; no stylesheet, table stays `role="table"`.

## Nodes

| # | Title | Slice slug | Depends on | Blocks |
|---|---|---|---|---|
| [#182](https://github.com/DvirMon/ng-table/issues/182) | Table: rows carry --ngp-table-row-depth, drop row aria-expanded | core-row-depth | — | #184 |
| [#183](https://github.com/DvirMon/ng-table/issues/183) | Table: tree directive pair — row hooks + ngpTableTreeToggle | tree-directive-pair | — | #184, #189 |
| [#184](https://github.com/DvirMon/ng-table/issues/184) | Table: tree styling recipe | tree-styling-recipe | #182, #183 | #189 |
| [#189](https://github.com/DvirMon/ng-table/issues/189) | Table: Tree story entry — flat data, filtered tree, broken link | tree-stories | #183, #184, #169 | — |

[#169](https://github.com/DvirMon/ng-table/issues/169) ("Table:
filter reveal opens context rows") is an external blocker (epic
#163), not a node of this epic.

The slice slug is what `/to-tasks` uses in the issue's branch name,
`<type>/<NN>-<slice-slug>`.

## Graph

```
#182 core-row-depth ──────┐
                          ├──► #184 tree-styling-recipe ──┐
#183 tree-directive-pair ─┤                               │
                          └───────────────────────────────┼──► #189 tree-stories
#169 (external, epic #163) ───────────────────────────────┘
```

## Summary

- **Parallel-safe:** #182 and #183 — no shared file, and no
  attribute bound on the same element (core row vs. tree row vs.
  toggle button, D5). Both feed #184.
- **Sequenced:** #182 → #184 (recipe indents with
  `--ngp-table-row-depth`); #183 → #184 (recipe keys on the tree
  row / toggle hooks and extends the tree UI spec #183 creates);
  #183, #184 → #189 (story renders with the toggle and follows
  the recipe); #169 → #189 (filter reveal).
- **Starting frontier:** #182, #183.

## Source

Edges derived at issue grain from `1-decisions.md`'s dependency
ranking and `2-spec.md`, user-confirmed on 2026-09-30. #163 (the
epic's blocker) is not an edge: `ngpTableTreeRow` and the flat-data
tree shipped in #166–#168. Its one open child, #169 (filter
reveal), blocks only #189. Titles pulled from `gh issue view` on
2026-09-30. Related docs: [`1-decisions.md`](1-decisions.md),
[`2-spec.md`](2-spec.md),
[`decisions/tree.md`](../../../../../decisions/tree.md).
#189 added 2026-09-30, user-confirmed, after a story audit found
no Tree or Expansion story entry on main; its first step re-runs
/story-discovery (`0-product/tree.md` is stale, written
2026-09-27 during the #163 grill). The Expansion story is tracked
outside this epic as #190.
