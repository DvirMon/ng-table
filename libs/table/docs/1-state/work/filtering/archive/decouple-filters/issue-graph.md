# Issue graph — decouple-filters epic (#67)

Epic: [#67](https://github.com/DvirMon/ng-table/issues/67) — decouple `createFilters()` from `withFiltering()` (predicate list in, `matcher()` out).

## Nodes

| #                                                    | Title                                                                                | State     | Depends on | Blocks |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ | --------- | ---------- | ------ |
| [#68](https://github.com/DvirMon/ng-table/issues/68) | `matcher()` on the filters root — a filter model that answers its own match question | ✅ CLOSED | —          | #70    |
| [#69](https://github.com/DvirMon/ng-table/issues/69) | `withFiltering` accepts a predicate list — filter a table with no filter model       | ✅ CLOSED | —          | #70    |
| [#70](https://github.com/DvirMon/ng-table/issues/70) | Migrate every filtering call site to the predicate list, split specs by ownership    | ✅ CLOSED | #68, #69   | #71    |
| [#71](https://github.com/DvirMon/ng-table/issues/71) | Delete the coupled filtering surface and the filters side channel + ADR-0016         | ✅ CLOSED | #70        | #72    |
| [#72](https://github.com/DvirMon/ng-table/issues/72) | Relocate the filters domain to its own folder and barrel                             | ✅ CLOSED | #71        | #73    |
| [#73](https://github.com/DvirMon/ng-table/issues/73) | Split the filtering docs by domain                                                   | ✅ CLOSED | #72        | —      |

## Graph

```
#68 (matcher() on filters root)   ─┐
                                    ├──▶ #70 ──▶ #71 ──▶ #72 ──▶ #73
#69 (withFiltering predicate list) ─┘     ✅       ✅        ✅        ✅
     ✅                                  migrate   delete   relocate   docs
```

## Summary

- **Epic complete** — every node closed, epic #67 closed 2026-09-14.
- **Sequenced as planned:** #71 → #72 → #73, each gated on the prior step's artifact. The coupled surface was deleted only once every call site was on predicates (#70); the folder move followed deletion, so nothing rebased across a rename; docs were split last because they cite the paths the move renamed.
- **Fallout:** #74 (grouping-selection fixture helpers, d6c28d5) — closed.
- **Verification:** `npx ngc -p libs/shared/table/tsconfig.lib.json --noEmit` clean, 0 errors.

## Source

Dependency chain confirmed by user: `{#68, #69} parallel ──> #70 ──> #71 ──> #72 ──> #73`. Titles/states pulled from `gh issue view` on 2026-09-14. Related docs: `spec.md`, `architecture.md`, `../with-filtering/migration-decouple-filters-from-table.md`.
