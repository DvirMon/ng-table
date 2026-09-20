# Issue graph — panel-tree-split epic (#101)

Epic: [#101](https://github.com/DvirMon/ng-table/issues/101) — split
`withExpansion()` into a detail-panel feature and `withTree()`, both shipping as
ADR-0015 slices.

## Nodes

| # | Title | State | Depends on | Blocks |
|---|---|---|---|---|
| [#118](https://github.com/DvirMon/ng-table/issues/118) | `createExpansionStore()` — the shared open-id factory, plus `initial` | 🟡 OPEN | — | #119 |
| [#119](https://github.com/DvirMon/ng-table/issues/119) | `withTree()` — the row tree, the `'tree'` stage and `state()` | 🟡 OPEN | #118 | #120 |
| [#120](https://github.com/DvirMon/ng-table/issues/120) | Collapsible grouping composes `withTree()`; grouping spec decoupled | 🟡 OPEN | #119 | #121 |
| [#121](https://github.com/DvirMon/ng-table/issues/121) | `withExpansion()` narrows to the detail panel and ships as a slice | 🟡 OPEN | #120 | #122 |
| [#122](https://github.com/DvirMon/ng-table/issues/122) | Reconcile the expansion docs and ADR-0012 with the split | 🟡 OPEN | #121 | — |

## Graph

```
#118 ──► #119 ──► #120 ──► #121 ──► #122
store     tree    grouping  panel     docs
          feature migrates  narrows   + ADRs
```

A single chain — no parallel-safe pair. Each edge is a real artifact
dependency, not presentation order:

- **#118 → #119** — `withTree()` builds its own `createExpansionStore()`
  instance. The factory has to exist first.
- **#119 → #120** — every verb the grouping story migrates onto
  (`table.tree.expand/collapse/toggle`) is introduced by `withTree()`.
- **#120 → #121** — the story and `with-grouping/feature.spec.ts` are the only
  in-repo consumers of the verbs #121 deletes. Until they move,
  narrowing `withExpansion()` cannot typecheck.
- **#121 → #122** — the docs describe the end-state surface. Written earlier
  they would document a shape #121 then changes.

## Summary

- **Parallel-safe:** none. The chain is genuine; splitting #120 from #121 to run
  them together was considered and rejected — they share
  `with-grouping/feature.spec.ts` and the story template.
- **Sequenced:** #118 → #119 gated on the factory's type surface; #119 → #120 on
  the `table.tree` slice; #120 → #121 on the in-repo call sites being migrated;
  #121 → #122 on the final public surface.
- **Current frontier:** **#118** — no blockers, `ready-for-agent`.

## Readiness at slicing time

| # | rung | why |
|---|---|---|
| #118 | `ready-for-agent` | one new file + a behavior-preserving rewire; the emission rule and full type surface are in `3-architecture.md` |
| #119 | `needs:tasks` | high — new feature seam, stage relocation, discovery walk, tri-state, ADR-0014 guard |
| #120 | `ready-for-agent` | broad but mechanical; every site enumerated in the call-site checklist |
| #121 | `needs:tasks` | high — removing the union contribution is an interaction between the feature contract and the flatten walk |
| #122 | `ready-for-agent` | broad but enumerated; no design calls left |

Breadth fired the count trigger on #120 and #122; difficulty did not, so
neither carries `needs:tasks`.

## Source

Edges derived from `1-decisions.md`'s post-grill node graph
(`S → A → {B, C}`, `D → C → F`, `D8 → I`, `J` leaf), re-mapped at **execution**
grain per `decompose-by-dependency-graph` § Execution grain — which is what
turned the grill's parallel `B`/`C` into the sequence #119 → #120 → #121, since
the panel's narrowing shares files with the grouping migration. Slicing and the
linear chain confirmed with the maintainer 2026-09-20. Titles and states pulled
from `gh issue view` on 2026-09-20.

Related docs: [`1-decisions.md`](1-decisions.md) ·
[`2-spec.md`](2-spec.md) · [`3-architecture.md`](3-architecture.md) ·
[`docs/decisions/expansion.md`](../../../../decisions/expansion.md) ·
[ADR-0012](../../../../adr/0012-split-expansion-into-panel-and-tree.md)
