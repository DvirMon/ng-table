# Issue graph — panel-directives epic (#199)

Epic: [#199](https://github.com/DvirMon/ng-table/issues/199) — detail panel a11y directives (`ngpTablePanelToggle`, `ngpTablePanel`).

## Nodes

| # | Title | Slice slug | Depends on | Blocks |
|---|---|---|---|---|
| [#211](https://github.com/DvirMon/ng-table/issues/211) | Table: ngpTablePanel directive and panel registry | `panel-content` | — | [#212](https://github.com/DvirMon/ng-table/issues/212) |
| [#212](https://github.com/DvirMon/ng-table/issues/212) | Table: ngpTablePanelToggle directive | `panel-toggle` | [#211](https://github.com/DvirMon/ng-table/issues/211), [#209](https://github.com/DvirMon/ng-table/issues/209) (external: shared collapsible core, not a child of this epic) | — |
| [#213](https://github.com/DvirMon/ng-table/issues/213) | Docs: rewrite expansion UI spec for panel directives | `ui-spec-rewrite` | — | — |

The slice slug is what `/to-tasks` uses in the issue's branch name, `<type>/<NN>-<slice-slug>`.

## Graph

```
#211 ──────┐
           ├──▶ #212
#209 ──────┘
(external)

#213   (standalone)
```

## Summary

- **Parallel-safe:** [#211](https://github.com/DvirMon/ng-table/issues/211) and [#213](https://github.com/DvirMon/ng-table/issues/213) (no shared files: #211 is code under `libs/table/src/directives`, #213 is docs).
- **Sequenced:** #211 → #212 (gated on the panel registry and the shared spec host); #209 → #212 (gated on the shared collapsible core supplying click/`aria-expanded`/`data-expanded`).
- **Starting frontier:** #211, #213.

## Source

Edges from [`3-architecture.md`](3-architecture.md) § Slicing hint, re-checked at build grain and user-confirmed 2026-10-02. Titles from `gh issue view` on 2026-10-02. Related docs: [`1-decisions.md`](1-decisions.md), [`2-spec.md`](2-spec.md), [`3-architecture.md`](3-architecture.md).
