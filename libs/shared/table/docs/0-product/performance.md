---
title: Product — Table Performance Requirements
type: product
status: requirement stated, no budgets measured, no stress suite built
date: 2026-09-10
audience: product, design, engineering
---

# Table performance requirements

Cross-cutting, not one feature's concern — which is why this sits in `0-product/` rather than
under `1-state/` or `3-ui/`. Every `with-*()` feature and every directive is in scope.

**Nothing here has been measured.** This file states the requirement and names the two axes so
feature specs can be written against them. It is not a report.

## Two axes, independently

Both must be tested. They fail for different reasons and a fix for one does not help the other.

### 1. Large datasets

How each feature behaves as row count grows — 10,000 rows as the working target.

Per-feature questions: does the pipeline stage stay linear? Does a feature holding `RowId`s
degrade as the set grows? Does a render stage rebuild more than it needs on an unrelated state
change?

### 2. Heavy cell UI

How the table behaves when **each cell is expensive**, independent of row count.

The motivating case, from production experience: a table with Material-UI inputs in its cells took
seconds to render at **thirty to forty rows**. Row count was never the problem — per-cell
component instantiation was. A table that is fast at 10k plain-text rows can be unusable at 40
rows of component-bearing cells, so a row-count benchmark alone will not catch this class.

Per-feature questions: how many cells re-instantiate on a state change that should have touched
one row? Does a feature's render stage produce new `RenderRow` identities where it could have
preserved them (breaking `@for` track and forcing teardown/rebuild of every cell component)?

## Where this bites first

`withGrouping()`'s multi-level scope (D9, [`work/with-grouping/2-decisions.md`](../1-state/work/with-grouping/2-decisions.md))
is the first feature with a plausible super-linear shape: recursive clustering plus per-cluster
aggregation at every depth, re-run whenever data, grouping, or filters change. D12 makes
performance a design constraint on that work rather than a follow-up — depth behavior gets
explored with budgets in hand.

`withVirtualScroll()` is the obvious mitigation for axis 1 and is specced
([`1-state/features/virtual-scroll.md`](../1-state/features/virtual-scroll.md), `spec: drafted`,
`code: none`) but unbuilt. It does **not** address axis 2 below the windowing threshold — forty
expensive cells are forty expensive cells whether or not a virtualizer is present.

## Findings

**2026-09-10 — `withGrouping()` (issue #6), exploratory measurement, not a benchmark harness.**
Ran `clusterRows` + `buildGroupRenderRows` (`engine/grouping.ts`) directly against synthetic
data — no `TestBed`, no rendered component, per this file's axis-1 framing of "does the pipeline
stage stay linear." One machine, one run each — figures are indicative, not a certified budget.

*Axis 1 (row count, 2 grouping levels, cardinality 20/level):*

| Rows | `clusterRows` | `buildGroupRenderRows` | Total |
|---|---|---|---|
| 1,000 | 2.3ms | 2.3ms | 4.6ms |
| 10,000 | 5.8ms | 8.7ms | 14.5ms |
| 50,000 | 36.7ms | 34.1ms | 70.8ms |

10x the rows (1k → 10k) costs ~3.1x the time; 5x the rows (10k → 50k) costs ~4.9x the time —
consistent with the `Map`-bucketing design staying linear in row count, not quadratic, as
`engine/grouping.ts`'s implementation notes predicted. At the 10,000-row working target, total
time is ~14ms — well inside anything a person would notice as janky for a one-off recompute.

*Axis 2 (depth, fixed 10,000 rows, cardinality 10/level):*

| Levels | `clusterRows` | `buildGroupRenderRows` | Total |
|---|---|---|---|
| 1 | 2.4ms | 5.7ms | 8.1ms |
| 2 | 3.9ms | 5.2ms | 9.1ms |
| 3 | 7.7ms | 8.8ms | 16.5ms |
| 4 | 9.5ms | 10.9ms | 20.5ms |

Cost grows roughly linearly with depth too — each added level is one more recursive bucketing
pass over a shrinking working set, not a multiplicative blowup. Going from 1 to 4 levels roughly
2.5x's the total time, not the exponential growth a naive re-clustering-from-scratch-per-level
implementation could produce. No concerning super-linear shape showed up at these scales; depth
is real cost (matching `performance.md`'s framing that it's "the axis actually motivating D12")
but it stayed proportionate, not runaway, at 1–4 levels and 10k rows.

**Caveats, so this isn't over-read:** single-run wall-clock timings, not a statistically averaged
benchmark; no comparison against a stress suite or CI gate (none exists yet, per "Not yet
decided" below); doesn't cover axis 2's *heavy cell UI* framing at all — this only measured the
pure clustering/aggregation engine, not directive-layer rendering cost, which is a separate,
unmeasured concern once `withGrouping()` gets a directive layer.

## Not yet decided

- Concrete budgets. "10k rows" is a target, not a threshold — no ms figures agreed for initial
  render, for a sort toggle, or for a single-row patch.
- Which harness. No benchmark tooling exists in this workspace today.
- Whether budgets become CI gates or stay a manual pre-release check.
- Whether axis 2 is measured in the table's own stories or needs a fixture app with a real
  component library's inputs in the cells.
