# Issue graph — treegrid-keyboard-model epic (#196)

Epic: [#196](https://github.com/DvirMon/ng-table/issues/196) — table-wide APG grid/treegrid keyboard model (roving tabindex, key map, treegrid row focus, store-held focus position).

## Nodes

| #                                                      | Title                                                                    | Slice slug                         | Depends on | Blocks                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------- | ---------- | ----------------------- |
| [#232](https://github.com/DvirMon/ng-table/issues/232) | Table: focus position store member (table.focus, moveTo)                 | store-focus-member                 | —          | 233, 234, 235           |
| [#233](https://github.com/DvirMon/ng-table/issues/233) | Table: keep the focused position valid when rows or columns change       | focus-recovery                     | 232        | —                       |
| [#234](https://github.com/DvirMon/ng-table/issues/234) | Table: single-open panel follows the focused position                    | expansion-follow-focus             | 232        | —                       |
| [#235](https://github.com/DvirMon/ng-table/issues/235) | Table: grid role, roving tabindex and arrow-key navigation on body cells | grid-navigation-core               | 232        | 236, 237, 239, 240, 241 |
| [#236](https://github.com/DvirMon/ng-table/issues/236) | Table: header row, Page Up/Down and RTL in grid navigation               | header-paging-rtl                  | 235        | 238                     |
| [#237](https://github.com/DvirMon/ng-table/issues/237) | Table: focus widgets inside cells without breaking the single Tab stop   | widgets-in-cells                   | 235        | 239, 241, 242           |
| [#238](https://github.com/DvirMon/ng-table/issues/238) | Table: div-grid host keeps the same keys, roles and focus model          | div-grid-parity                    | 236        | —                       |
| [#239](https://github.com/DvirMon/ng-table/issues/239) | Table: treegrid row focus, expand and collapse by keyboard               | treegrid-row-navigation            | 235, 237   | 240                     |
| [#240](https://github.com/DvirMon/ng-table/issues/240) | Table: group header rows are arrow stops                                 | group-header-stops                 | 235, 239   | —                       |
| [#241](https://github.com/DvirMon/ng-table/issues/241) | Table: an open detail panel is an arrow stop                             | panel-arrow-stop                   | 235, 237   | —                       |
| [#242](https://github.com/DvirMon/ng-table/issues/242) | Docs: virtual-scroll focus contract                                      | docs-virtual-scroll-focus-contract | 237        | —                       |

The slice slug is what `/to-tasks` uses in the issue's branch name, `<type>/<NN>-<slice-slug>`.

## Graph

```
232 store-focus-member
 ├──► 233 focus-recovery
 ├──► 234 expansion-follow-focus
 └──► 235 grid-navigation-core
        ├──► 236 header-paging-rtl ──► 238 div-grid-parity
        └──► 237 widgets-in-cells
               └──► 242 docs-virtual-scroll-focus-contract

 235 ──┐
       ├──► 239 treegrid-row-navigation
 237 ──┘            │
                    │
 235 ──┐            │
       ├────────────┴──► 240 group-header-stops
 (235 + 239 joined)

 235 ──┐
       ├──► 241 panel-arrow-stop
 237 ──┘
```

Joined edges: 239 <- 235 + 237; 240 <- 235 + 239; 241 <- 235 + 237.

## Summary

- **Parallel-safe:** 233, 234, 235 after 232; 236 and 237 after 235 (241 also after 237).
- **Sequenced:** 232 → 235 → 237 → 239 → 240 (store, then core navigation, then widget tabindex handling, then treegrid, then group headers); 235 → 236 → 238 (header row before div-grid parity); 235 + 237 → 241 (panel stop needs multi-widget cells); 237 → 242.
- **Starting frontier:** #232 (structural, not live state).
- Note: 237 gates 239 because Tab-walking a focused treegrid row's buttons needs the descendant tabindex handling; 238 follows 236 because the header-row markup decision lands there.

## Source

User-confirmed breakdown 2026-10-13 (/to-issues), derived from the grilling ranking K1-K14 in 1-decisions.md re-checked at issue grain. #201 (same capability, K0) was closed as superseded. Titles from the issues as created on 2026-10-13. Related docs: 2-spec.md, 3-architecture.md, 1-decisions.md in the same folder; ADR-0030.
