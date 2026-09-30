# Issue graph — tree-ui-layer epic (#165)

Epic: [#165](https://github.com/DvirMon/ng-table/issues/165) — tree UI
directives (`ngpTableTreeRow` hooks, `ngpTableTreeToggle`) plus core
row depth variable; no stylesheet, table stays `role="table"`.

## Nodes

| # | Title | Slice slug | Depends on | Blocks |
|---|---|---|---|---|
| [#182](https://github.com/DvirMon/ng-table/issues/182) | Table: rows carry --ngp-table-row-depth, drop row aria-expanded | core-row-depth | — | #184 |
| [#183](https://github.com/DvirMon/ng-table/issues/183) | Table: tree directive pair — row hooks + ngpTableTreeToggle | tree-directive-pair | — | #184 |
| [#184](https://github.com/DvirMon/ng-table/issues/184) | Table: tree styling recipe | tree-styling-recipe | #182, #183 | — |

The slice slug is what `/to-tasks` uses in the issue's branch name,
`<type>/<NN>-<slice-slug>`.

## Graph

```
#182 core-row-depth ──────┐
                          ├──► #184 tree-styling-recipe
#183 tree-directive-pair ─┘
```

## Summary

- **Parallel-safe:** #182 and #183 — no shared file, and no
  attribute bound on the same element (core row vs. tree row vs.
  toggle button, D5). Both feed #184.
- **Sequenced:** #182 → #184 (recipe indents with
  `--ngp-table-row-depth`); #183 → #184 (recipe keys on the tree
  row / toggle hooks and extends the tree UI spec #183 creates).
- **Starting frontier:** #182, #183.

## Source

Edges derived at issue grain from `1-decisions.md`'s dependency
ranking and `2-spec.md`, user-confirmed on 2026-09-30. #163 (the
epic's blocker) is not an edge: `ngpTableTreeRow` and the flat-data
tree shipped in #166–#168; only #169 (filter reveal) remains open
and no slice depends on it. Titles pulled from `gh issue view` on
2026-09-30. Related docs: [`1-decisions.md`](1-decisions.md),
[`2-spec.md`](2-spec.md),
[`decisions/tree.md`](../../../../../decisions/tree.md).
