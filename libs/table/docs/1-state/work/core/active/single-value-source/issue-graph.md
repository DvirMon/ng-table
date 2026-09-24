# Issue graph — single-value-source epic (#129)

Epic: [#129](https://github.com/DvirMon/ng-table/issues/129) —
`createColumns()`: one call declares a column's presentation,
accessor and rules.

Two independent wide refactors ride in this epic — the 57-site
declaration migration and the 37-file ADR-0025 rename. Neither
fits a tracer bullet, so both are sequenced
**expand → migrate → contract**. They share no file until #141.

## Nodes

| # | Title | State | Depends on | Blocks |
|---|---|---|---|---|
| [#130](https://github.com/DvirMon/ng-table/issues/130) | `col()` builder and `ColumnSet` exist, unused | ✅ CLOSED 09-24 | — | #131 |
| [#131](https://github.com/DvirMon/ng-table/issues/131) | `createTable` accepts a `ColumnSet` beside the array; `columnsSchema` removed (expand) | ✅ CLOSED 09-24 (918551f) | #130 (cleared) | #132, #137, #138 |
| [#132](https://github.com/DvirMon/ng-table/issues/132) | Construction checks relocate into `createColumns` and go dev-only | ✅ CLOSED 09-24 | #131 (cleared) | #139 |
| [#133](https://github.com/DvirMon/ng-table/issues/133) | ADR-0025 rename, expand: bare names ship beside `apply*` | ✅ CLOSED 09-24 (ffa2bf7) | — | #134, #135 |
| [#134](https://github.com/DvirMon/ng-table/issues/134) | ADR-0025 rename, migrate: library source | ✅ CLOSED 09-24 (1eaad97) | #133 (cleared) | #136 |
| [#135](https://github.com/DvirMon/ng-table/issues/135) | ADR-0025 rename, migrate: specs, story hosts, fixtures | ✅ CLOSED 09-24 (1eaad97) | #133 (cleared) | #136 |
| [#136](https://github.com/DvirMon/ng-table/issues/136) | ADR-0025 rename, contract: delete the `apply*` exports | ✅ CLOSED 09-24 (ce13765) | #134, #135 (cleared) | #141 |
| [#137](https://github.com/DvirMon/ng-table/issues/137) | Migrate declarations: specs, mocks, fixtures | ✅ CLOSED 09-25 (b6209bc) | #131 (cleared) | #139, #140 |
| [#138](https://github.com/DvirMon/ng-table/issues/138) | Migrate declarations: story hosts and type specs | ✅ CLOSED 09-24 (6af4cc7) | #131 (cleared) | #139 |
| [#139](https://github.com/DvirMon/ng-table/issues/139) | Contract: delete the array intake | ✅ CLOSED 09-24 (1704cfd) | #132 (cleared), #137 (cleared), #138 (cleared) | — |
| [#140](https://github.com/DvirMon/ng-table/issues/140) | `setColumns` narrows its input; the order window is documented | 🟡 OPEN | #137 (cleared) | #141 |
| [#141](https://github.com/DvirMon/ng-table/issues/141) | Docs, ADR-0019 amendment, CLAUDE.md invariant, decision rows, `llms` | 🟡 OPEN | #136 (cleared), #140 | — |

## Graph

```
#130[✅] ──► #131[✅] ──┬──► #132[✅] ────────┐
                    │                   │
                    ├──► #137[✅] ──┬───┼──► #139[✅]
                    │               │   │
                    └──► #138[✅] ──┴───┘
                                    │
                                    └──► #140 ──┐
                                                │
#133[✅] ──┬──► #134[✅] ──┐                     ├──► #141
           └──► #135[✅] ──┴──► #136[✅]────────┘
```

## Summary

- **Parallel-safe:** `#130` and `#133` share nothing and start
  together — the rename touches no file the declaration work
  touches until `#141`. Within the rename, `#134` and `#135` are
  disjoint file sets, both gated only on `#133`. Within the
  declaration work, `#137` and `#138` are likewise disjoint, both
  gated only on `#131`. `#140` runs alongside `#138` and `#139`
  once `#137` lands.
- **Sequenced:** `#130 → #131` (the intake cannot accept a set
  before the set exists). `#131 → {#132, #137, #138}` (all three
  need the expand arm in place). `{#132, #137, #138} → #139` —
  the contract deletes the array arm, so every caller must be
  migrated first. `#137 → #140` — the narrowed write input
  rejects any fixture still passing `order` or `meta`, and those
  fixtures are `#137`'s. `{#134, #135} → #136`, same
  expand–contract reason. `{#136, #140} → #141` — the docs pass
  describes both final surfaces.
- **Current frontier:** **#140**. `#130` and `#132` closed
  2026-09-24 (via another concurrent run — no commit sha
  captured by this workspace). `#137` shipped and closed
  2026-09-25 (b6209bc). `#139` shipped and closed 2026-09-24/25
  (1704cfd) — its every blocker (`#132`, `#137`, `#138`) was
  cleared. `#140`'s one blocker `#137` is cleared, so it remains
  frontier on its own. The rename chain (`#133 → {#134, #135} →
  #136`) shipped and closed end to end; `#141` is not yet
  frontier — it still waits on `#140`.

## Source

Edges user-confirmed 2026-09-24 against `2-spec.md` and
`3-architecture.md`, re-checked at execution grain. Two were
corrected after drafting: `#141`'s rung moved to `needs:grill`
(it carries an unresolved question, which is the ladder's own
trigger), and `#140`'s blocker moved from `#139` to `#137` (the
gate is the fixtures, not the deletions). Titles and states
pulled from `gh issue view` on 2026-09-24; states refreshed
2026-09-24 after `/ship` pushed 9033e6e — `#133`/`#134`/`#135`/
`#136` closed. Refreshed again 2026-09-24 after `/ship` pushed
918551f/ec341b1 — `#131` closed. Refreshed again 2026-09-24
after `/ship` pushed 6af4cc7 — `#138` closed. Refreshed again
2026-09-25 after `/ship` pushed b6209bc — `#137` closed; the
same read found `#130` and `#132` already closed by a concurrent
run this workspace had not yet recorded. Refreshed again
2026-09-25 after `/ship` pushed 1704cfd/0754f32 — `#139` closed.
Related docs:
[`2-spec.md`](2-spec.md), [`3-architecture.md`](3-architecture.md),
[`decisions.md`](decisions.md),
[`conflicts-vs-unshipped.md`](conflicts-vs-unshipped.md).
