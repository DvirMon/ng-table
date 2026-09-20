# Issue graph — prune-stage-revisit epic (#105)

Epic: [#105](https://github.com/DvirMon/ng-table/issues/105) — render stages exchange a nested
node tree; an engine-owned flatten walk replaces the terminal `'prune'` stage (supersedes
ADR-0017 D2). **Closed 2026-09-20 — all four slices shipped.**

## Nodes

| # | Title | State | Depends on | Blocks | Shipped in |
|---|---|---|---|---|---|
| [#106](https://github.com/DvirMon/ng-table/issues/106) | Drop the unclaimed `'paginate'` render stage | ✅ CLOSED | — | #107 | `29052f7` |
| [#107](https://github.com/DvirMon/ng-table/issues/107) | Render stages exchange a nested node tree; a flatten walk replaces the prune | ✅ CLOSED | #106 | #108, #109 | `e0161ee`, `333ef5b` |
| [#108](https://github.com/DvirMon/ng-table/issues/108) | Group headers report expansion through `row.isExpanded` | ✅ CLOSED | #107 | — | `4b38acd`, `a34db14` |
| [#109](https://github.com/DvirMon/ng-table/issues/109) | Record the tree-shaped render IR across the ADR set | ✅ CLOSED | #107 | — | `8d843f6` |

## Graph

```
#106  drop 'paginate'          ✅
  │
  ▼
#107  nested node IR + flattenVisible          ✅
  │   RenderNode · RenderNodeTransform · mapNodes
  │   four prune constructs deleted
  ├──────────────┐
  ▼              ▼
#108 ✅        #109 ✅
row.isExpanded  ADR set
in stories      (ADR-0023, 0011 amend,
 + MDX + docs    0020 in place)
```

## Summary

- **Parallel-safe:** #108 and #109 — held at execution, both landed off #107 with no edge
  between them.
- **Sequenced:** #106 → #107 → {#108, #109}. Every edge held: #106 removed the entry and the
  fixtures from the two files #107 rewrote; #108 had no `isExpanded` to read until #107 stamped
  it; #109 would have described unshipped code.
- **Current frontier:** none — epic closed.

## How it actually ran, vs. the plan

Worth recording, because the divergence is the useful part:

- **#108 and #109 were implemented inside the #107 session**, not as separate passes. All four
  commits landed tagged `(#107)`, so only #107 auto-closed; #106, #108 and #109 were closed by
  hand against the commits that shipped them. `ADR-0023`'s own header says "implemented in #107".
- **#109's `needs:grill` rung was satisfied without a grill.** Its question — what happens to
  ADR-0020 D2's anchor set once `'paginate'` and `'prune'` are both gone — was answered in the
  ADR text directly: *no post-flatten anchor exists*. The rung was right to exist; it just got
  resolved in passing rather than in a session of its own.
- **#108 was the only slice with a real gap at review.** Three of its four criteria passed, but
  `docs/overview.md` still taught the pre-flatten pattern — gating nested rows on
  `store.expandedRows().has(row.id)` and re-rendering `row.children` by hand, which post-#107
  renders every child twice. Fixed in `a34db14`.

## Follow-ups left open

- **[#102](https://github.com/DvirMon/ng-table/issues/102) (ADR-0020)** — D6's row-count clause
  still anchors against `'paginate'`. Flagged as an ⚑ Open item in the ADR; the name must not be
  restored as its target.
- **[#101](https://github.com/DvirMon/ng-table/issues/101) (ADR-0012)** — runs next, and is
  cheaper for this landing. A cyclic `children` array still overflows the stack; #101 owns the
  data contract that admits one.

## Source

Edges user-confirmed 2026-09-20 via `/to-issues`, re-derived at execution grain from
`1-decisions.md`'s node ranking. States, commits and labels pulled from `gh issue view` and
`git log` on 2026-09-20, after the push.

Related docs: [`2-spec.md`](2-spec.md) · [`3-architecture.md`](3-architecture.md) ·
[`1-decisions.md`](1-decisions.md) ·
[ADR-0023](../../../../../adr/0023-tree-shaped-render-ir.md).
