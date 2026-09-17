# Issue graph — decouple-filters epic (#101)

Epic: [#101](https://github.com/DvirMon/acme/issues/101) — decouple `createFilters()` from `withFiltering()` (predicate list in, `matcher()` out).

## Nodes

| # | Title | State | Depends on | Blocks |
|---|---|---|---|---|
| [#102](https://github.com/DvirMon/acme/issues/102) | `matcher()` on the filters root — a filter model that answers its own match question | ✅ CLOSED | — | #104 |
| [#103](https://github.com/DvirMon/acme/issues/103) | `withFiltering` accepts a predicate list — filter a table with no filter model | ✅ CLOSED | — | #104 |
| [#104](https://github.com/DvirMon/acme/issues/104) | Migrate every filtering call site to the predicate list, split specs by ownership | ✅ CLOSED | #102, #103 | #105 |
| [#105](https://github.com/DvirMon/acme/issues/105) | Delete the coupled filtering surface and the filters side channel + ADR-0016 | ✅ CLOSED | #104 | #106 |
| [#106](https://github.com/DvirMon/acme/issues/106) | Relocate the filters domain to its own folder and barrel | ✅ CLOSED | #105 | #107 |
| [#107](https://github.com/DvirMon/acme/issues/107) | Split the filtering docs by domain | ✅ CLOSED | #106 | — |

## Graph

```
#102 (matcher() on filters root)   ─┐
                                    ├──▶ #104 ──▶ #105 ──▶ #106 ──▶ #107
#103 (withFiltering predicate list) ─┘     ✅       ✅        ✅        ✅
     ✅                                  migrate   delete   relocate   docs
```

## Summary

- **Epic complete** — every node closed, epic #101 closed 2026-09-14.
- **Sequenced as planned:** #105 → #106 → #107, each gated on the prior step's artifact. The coupled surface was deleted only once every call site was on predicates (#104); the folder move followed deletion, so nothing rebased across a rename; docs were split last because they cite the paths the move renamed.
- **Fallout:** #108 (grouping-selection fixture helpers, d6c28d5) — closed.
- **Verification:** `npx ngc -p libs/shared/table/tsconfig.lib.json --noEmit` clean, 0 errors.

## Source

Dependency chain confirmed by user: `{#102, #103} parallel ──> #104 ──> #105 ──> #106 ──> #107`. Titles/states pulled from `gh issue view` on 2026-09-14. Related docs: `spec.md`, `architecture.md`, `../with-filtering/migration-decouple-filters-from-table.md`.
