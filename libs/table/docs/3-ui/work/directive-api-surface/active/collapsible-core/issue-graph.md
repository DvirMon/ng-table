# Issue graph — collapsible-core epic (#209)

Epic: [#209](https://github.com/DvirMon/ng-table/issues/209) — one
internal collapsible trigger core shared by the tree and panel
toggles; the tree toggle is retrofitted onto it.

## Nodes

| # | Title | Slice slug | Depends on | Blocks |
|---|---|---|---|---|
| [#215](https://github.com/DvirMon/ng-table/issues/215) | Table: tree toggle runs on a shared collapsible core | tree-toggle-on-collapsible-core | — | — |

The slice slug is what `/to-tasks` uses in the issue's branch name,
`<type>/<NN>-<slice-slug>`.

## Graph

```
#215 tree-toggle-on-collapsible-core
```

## Summary

- **Parallel-safe:** n/a — single slice.
- **Sequenced:** none inside the epic. Outside it (D6): #199's
  planning PR merges before #209 ships; #212 builds on #215's core.
- **Starting frontier:** #215.

## Source

Single slice, user-confirmed 2026-10-02: the core has no test seam
of its own (spec § Testing Decisions), so it ships with the tree
retrofit; docs/story cleanup rides along. Titles pulled from
`gh issue view` on 2026-10-02. Related docs: `1-decisions.md`,
`2-spec.md`, `3-architecture.md` (same folder).
