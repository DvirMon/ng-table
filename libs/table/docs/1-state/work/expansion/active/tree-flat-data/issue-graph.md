# Issue graph — tree-flat-data epic (#163)

Epic: [#163](https://github.com/DvirMon/ng-table/issues/163) —
`withTree()` builds its hierarchy from flat `data()` (E5).

## Nodes

| # | Title | Slice slug | Depends on | Blocks |
|---|---|---|---|---|
| [#166](https://github.com/DvirMon/ng-table/issues/166) | Table: stage context + parent-link engine slot (tree prefactor) | stage-context-parent-link | — | #167 |
| [#167](https://github.com/DvirMon/ng-table/issues/167) | Table: withTree({ parentId }) nests flat rows | flat-tree-nesting | #166 | #168, #170 |
| [#168](https://github.com/DvirMon/ng-table/issues/168) | Table: filtering a tree keeps ancestors as context rows | filter-context-rows | #167 | #169 |
| [#169](https://github.com/DvirMon/ng-table/issues/169) | Table: filter reveal opens context rows | filter-reveal | #168 | — |
| [#170](https://github.com/DvirMon/ng-table/issues/170) | Table: grouping a tree groups roots only | grouping-tree-roots | #167 | — |

The slice slug is what `/to-tasks` uses in the issue's branch
name, `<type>/<NN>-<slice-slug>`.

## Graph

```
#166 ──► #167 ──┬──► #168 ──► #169
                └──► #170
```

## Summary

- **Parallel-safe:** #168 and #170 after #167 — no edge between
  them; both read the parent link from #166 through the tree
  built in #167.
- **Sequenced:** #166 → #167 (stage context + parentLink slot)
  → #168 (flat tree rows to filter) → #169 (context-row slot
  and `isContextRow`); #167 → #170 (flat tree rows to group).
- **Starting frontier:** #166.

## Source

Edges user-confirmed in `/to-issues` on 2026-09-27, derived at
execution grain from `1-decisions.md`'s dependency ranking and
`3-architecture.md`'s file layout. The `ngpTableTreeRow`
directive is folded into #168 as a vertical slice. Titles
pulled from `gh issue view` on 2026-09-27. Related docs:
`1-decisions.md`, `2-spec.md`, `3-architecture.md` in this
folder.
