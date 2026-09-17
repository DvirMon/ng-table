# Issue graph — group-admission epic (#83)

Epic: [#83](https://github.com/DvirMon/ng-table/issues/83) — a predicate deciding whether a built
cluster becomes a rendered group or dissolves back into flat rows, at two scopes, plus the two
shipped-API amendments the shape carries.

## Nodes

| # | Title | State | Depends on | Blocks |
|---|---|---|---|---|
| [#84](https://github.com/DvirMon/ng-table/issues/84) | `withGrouping()` takes initial levels and a rules schema in one config | 🟡 OPEN | — | #85, #86, #87 |
| [#85](https://github.com/DvirMon/ng-table/issues/85) | Rows with no group value stay flat — table-wide `groupWhen` | 🟡 OPEN | #84 | #86, #87 |
| [#86](https://github.com/DvirMon/ng-table/issues/86) | A grouping threshold per column — `groupWhen` on `applyGrouping` | 🟡 OPEN | #85, #84 | #88 |
| [#87](https://github.com/DvirMon/ng-table/issues/87) | Order groups per column — `applyGroupOrder` replaces `config.groupOrder` | ✅ CLOSED | #85, #84 | #88 |
| [#88](https://github.com/DvirMon/ng-table/issues/88) | State what happens to missing group values and one-row groups (OQ-5, OQ-6) | 🟡 OPEN | #86, #87 | — |

## Graph

```
                      ┌──> #86 ──┐
#84 ──> #85 ────────┤           ├──> #88
                      └──> #87 ──┘
```

`#84` also blocks `#86` and `#87` directly — both need `config.schema` as well as the engine
work in `#85`. Drawn through `#85` above for legibility; the tracker carries all seven edges.

## Summary

- **Parallel-safe:** #86 and #87 — no edge between them. They share `#85`'s `admitted` flag
  upstream and `#88` downstream, but neither reads the other's artifact: #86 records a
  per-column predicate into its own map, #87 moves the comparator's declaration site.
- **Sequenced:**
  - `#84 → #85` — gated on the reshaped `WithGroupingConfig`. Both add members to that type;
    a merge-conflict edge, not a compile edge.
  - `#85 → #86` — gated on the engine predicate plumbing and `ClusterSummary`/`GroupSummary`.
  - `#85 → #87` — gated on `GroupSummary.admitted`, which the comparator now receives.
  - `#86, #87 → #88` — gated on the behaviour the product doc describes existing.
- **Current frontier:** #84.

## Open questions

Epic **Q1 — DECIDED 2026-09-16: a dissolved cluster's rows exit the grouping tree entirely**,
never re-clustering by a deeper level. Recorded in [2-decisions.md](2-decisions.md) and on
issue #85's comment thread; implemented in #85 Step 2 (`emitGroupRows`/`flattenLeaves`/
`collectClusterGroupIds` all stop descending into a dissolved node's children).

## Source

Edges user-confirmed 2026-09-15 after a five-slice breakdown was proposed and approved. Derived
at issue grain per `dependency-task-graph` — the design doc had no prior grilling ranking to
inherit, since admission was raised after `2-decisions.md`'s D1-D17 closed.

Titles/states pulled from `gh issue view` on 2026-09-15. Related docs:
[design-group-admission.md](design-group-admission.md) ·
[2-decisions.md](2-decisions.md) ·
[`0-product/grouping.md`](../../../../../0-product/grouping.md) §4.2, §4.3, OQ-5, OQ-6.
