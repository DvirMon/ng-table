# Issue graph — grouping-expansion-coupling epic (#130)

Epic: [#130](https://github.com/DvirMon/acme/issues/130) — remove `withGrouping()`'s direct read
of `withExpansion()`'s `expandedRows`, by giving `RenderRow` a parent link and moving
descendant-hiding into one engine-owned prune stage.

## Nodes

| # | Title | State | Depends on | Blocks |
|---|---|---|---|---|
| [#131](https://github.com/DvirMon/acme/issues/131) | `expandAll()` takes explicit ids; `withGrouping()` publishes `groupIds` | 🟡 OPEN | — | — |
| [#132](https://github.com/DvirMon/acme/issues/132) | `RenderRow.parentId` + engine-owned prune stage (grouping still prunes) | 🟡 OPEN | — | #133 |
| [#133](https://github.com/DvirMon/acme/issues/133) | Grouping stops pruning; delete `readExpandedRows` | 🟡 OPEN | #132 | — |

## Graph

```
#131  (expandAll ids + groupIds)        ── independent, no edges

#132  (parentId + prune stage)  ──▶  #133  (grouping stops pruning)
```

## Summary

- **Parallel-safe:** #131 and #132. They share no file — #131 touches `with-expansion.ts`'s
  public overloads and `with-grouping.ts`'s member list; #132 touches `api/types.ts`,
  `engine/render-stages.ts` and both emit paths. Whichever lands second absorbs a trivial merge
  in `with-grouping.ts`.
- **Sequenced:** #132 → #133, gated on the prune stage actually carrying the hiding. Expand-then-
  contract: pruning twice is idempotent, so #132 is green with grouping's own prune still in
  place, and #133 removes it only afterwards.
- **Current frontier:** #131 and #132.

## Why #131 is not subsumed by #132/#133

`parentId` fixes the read side — who gets hidden. `expandAll`'s gap is the write side: discovery
walks `rows()`, where synthetic headers never appear, and that stays true after the refactor.
Discovering from `renderRows()` instead does not work either — a collapsed group's descendants
are absent from it, so nested headers stay invisible and the walk would need repeated passes to
converge. `groupIds()` derives from the cluster tree and is collapse-independent, which is why
it is the id source in both worlds.

## Source

Edges derived in-session and confirmed by the user (2026-09-16): granularity, #131's placement
inside the epic, and folding the ADR into #132 rather than giving it its own issue. Titles and
states pulled from `gh issue view` on 2026-09-16.

Related docs: [`plan.md`](plan.md) (the written contract for all three slices),
[`prior-art.md`](prior-art.md) (TanStack / AG Grid / MUI X / CDK survey, claims pinned to
published artifacts). Supersedes part of ADR-0011; closes out D11 in
`../with-grouping/2-decisions.md`.
