# Issue graph — decouple-filters epic (#101)

Epic: [#101](https://github.com/DvirMon/acme/issues/101) — decouple `createFilters()` from `withFiltering()` (predicate list in, `matcher()` out).

## Nodes

| # | Title | State | Depends on | Blocks |
|---|---|---|---|---|
| [#102](https://github.com/DvirMon/acme/issues/102) | `matcher()` on the filters root — a filter model that answers its own match question | ✅ CLOSED | — | #104 |
| [#103](https://github.com/DvirMon/acme/issues/103) | `withFiltering` accepts a predicate list — filter a table with no filter model | 🟡 OPEN | — | #104 |
| [#104](https://github.com/DvirMon/acme/issues/104) | Migrate every filtering call site to the predicate list, split specs by ownership | 🟡 OPEN | #102, #103 | #105 |
| [#105](https://github.com/DvirMon/acme/issues/105) | Delete the coupled filtering surface and the filters side channel + ADR-0016 | 🟡 OPEN | #104 | #106 |
| [#106](https://github.com/DvirMon/acme/issues/106) | Relocate the filters domain to its own folder and barrel | 🟡 OPEN | #105 | #107 |
| [#107](https://github.com/DvirMon/acme/issues/107) | Split the filtering docs by domain | 🟡 OPEN | #106 | — |

## Graph

```
#102 (matcher() on filters root)   ─┐
                                     ├──▶ #104 (migrate call sites) ──▶ #105 (delete coupled surface) ──▶ #106 (relocate folder) ──▶ #107 (split docs)
#103 (withFiltering predicate list) ─┘
```

## Summary

- **Parallel-safe:** #102, #103 (no edge between them — both feed #104, neither depends on the other). #102 is done.
- **Sequenced:** #104 → #105 → #106 → #107, each gated on the prior step's artifact (predicate-list call sites must exist before the coupled surface can be deleted; deletion must land before the folder move; the move must land before docs are split to match).
- **Current frontier:** #103 (only remaining blocker for #104).

## Source

Dependency chain confirmed by user: `{#102, #103} parallel ──> #104 ──> #105 ──> #106 ──> #107`. Titles/states pulled from `gh issue view` on 2026-09-14. Related docs: `spec.md`, `architecture.md`, `../with-filtering/migration-decouple-filters-from-table.md`.
