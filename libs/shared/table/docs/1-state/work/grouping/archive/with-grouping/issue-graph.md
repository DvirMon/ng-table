# Issue graph — group-admission epic (#117)

Epic: [#117](https://github.com/DvirMon/acme/issues/117) — a predicate deciding whether a built
cluster becomes a rendered group or dissolves back into flat rows, at two scopes, plus the two
shipped-API amendments the shape carries.

## Nodes

| # | Title | State | Depends on | Blocks |
|---|---|---|---|---|
| [#118](https://github.com/DvirMon/acme/issues/118) | `withGrouping()` takes initial levels and a rules schema in one config | 🟡 OPEN | — | #119, #120, #121 |
| [#119](https://github.com/DvirMon/acme/issues/119) | Rows with no group value stay flat — table-wide `groupWhen` | 🟡 OPEN | #118 | #120, #121 |
| [#120](https://github.com/DvirMon/acme/issues/120) | A grouping threshold per column — `groupWhen` on `applyGrouping` | 🟡 OPEN | #119, #118 | #122 |
| [#121](https://github.com/DvirMon/acme/issues/121) | Order groups per column — `applyGroupOrder` replaces `config.groupOrder` | 🟡 OPEN | #119, #118 | #122 |
| [#122](https://github.com/DvirMon/acme/issues/122) | State what happens to missing group values and one-row groups (OQ-5, OQ-6) | 🟡 OPEN | #120, #121 | — |

## Graph

```
                      ┌──> #120 ──┐
#118 ──> #119 ────────┤           ├──> #122
                      └──> #121 ──┘
```

`#118` also blocks `#120` and `#121` directly — both need `config.schema` as well as the engine
work in `#119`. Drawn through `#119` above for legibility; the tracker carries all seven edges.

## Summary

- **Parallel-safe:** #120 and #121 — no edge between them. They share `#119`'s `admitted` flag
  upstream and `#122` downstream, but neither reads the other's artifact: #120 records a
  per-column predicate into its own map, #121 moves the comparator's declaration site.
- **Sequenced:**
  - `#118 → #119` — gated on the reshaped `WithGroupingConfig`. Both add members to that type;
    a merge-conflict edge, not a compile edge.
  - `#119 → #120` — gated on the engine predicate plumbing and `ClusterSummary`/`GroupSummary`.
  - `#119 → #121` — gated on `GroupSummary.admitted`, which the comparator now receives.
  - `#120, #121 → #122` — gated on the behaviour the product doc describes existing.
- **Current frontier:** #118.

## Open questions

Epic **Q1 — DECIDED 2026-09-16: a dissolved cluster's rows exit the grouping tree entirely**,
never re-clustering by a deeper level. Recorded in [2-decisions.md](2-decisions.md) and on
issue #119's comment thread; implemented in #119 Step 2 (`emitGroupRows`/`flattenLeaves`/
`collectClusterGroupIds` all stop descending into a dissolved node's children).

## Source

Edges user-confirmed 2026-09-15 after a five-slice breakdown was proposed and approved. Derived
at issue grain per `dependency-task-graph` — the design doc had no prior grilling ranking to
inherit, since admission was raised after `2-decisions.md`'s D1-D17 closed.

Titles/states pulled from `gh issue view` on 2026-09-15. Related docs:
[design-group-admission.md](design-group-admission.md) ·
[2-decisions.md](2-decisions.md) ·
[`0-product/grouping.md`](../../../../../0-product/grouping.md) §4.2, §4.3, OQ-5, OQ-6.
