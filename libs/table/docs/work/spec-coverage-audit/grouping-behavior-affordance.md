---
title: Spec coverage audit — grouping, behavior vs affordance
type: audit
capability: grouping
date: 2026-09-19
---

Supersedes [`grouping.md`](grouping.md), which sorted whole stories and so classified a testable
behavior as story-owned. Each story here is split: **behavior** (a state transition over the
public API) vs **affordance** (what a person reaches and perceives). Behaviors are deduped by
decision point — several stories routinely reduce to one fact.

## Behavior halves, deduped by decision point

| Decision point | Stories | Owner | Tested? |
|---|---|---|---|
| Same-value rows land contiguous; grouping adds and drops no rows | 1.1, 3.1 | `engine/grouping/pipeline.ts` | yes — `pipeline.spec.ts` |
| Count and summary are over a cluster's own post-filter leaves, at every depth | 1.2, 1.3, 3.4, F-G1 | `engine/grouping/render.ts` | yes — `render.spec.ts`, `feature.spec.ts` |
| A throwing `aggregateFn` blanks only its own group and column, reported once per evaluation | 1.3 | `engine/grouping/render.ts` | yes — `render.spec.ts` |
| Active levels read back in order with real labels; an unknown level still agrees with render output | 1.4, 3.2, 4.4 | `api/features/with-grouping/feature.ts` | yes — `feature.spec.ts` |
| Add / remove / reorder a level; a duplicate is refused; a middle removal keeps nesting | 3.1, 3.2 | `mutations/update-grouping.ts` | yes — `update-grouping.spec.ts` |
| Collapsing takes the whole subtree; a nested collapse stays shut when only the outer opens | 2.1 | engine `'prune'` stage (ADR-0017) | yes — `feature.spec.ts` |
| `groupIds()` enumerates every header at every depth, collapse-independent | 2.2, 2.3 | `engine/grouping/queries.ts` | yes — `feature.spec.ts` |
| Group ids are value-derived, so a row reorder cannot drift them | 2.5, S-G2 | `engine/grouping/clusters.ts` | yes — `queries.spec.ts` |
| A sort change leaves `expandedRows` untouched | 2.5 | `api/features/with-expansion.ts` | yes — `feature.spec.ts` |
| **A refetch replacing every row object leaves collapse state intact** | **2.5** | **`api/features/with-expansion.ts`** | **no** |
| **A regroup discards collapse state wholesale, never half-restored** | **2.5** | **`api/features/with-expansion.ts`** | **no** |
| **Collapsing a group changes nothing selected** | **2.1** | **`api/features/with-selection.ts`** | **no** |
| **Ungrouping leaves the selection untouched — no phantom group ids** | **X-G1** | **`api/features/with-selection.ts`** | **no** |
| Sorting inside a group keeps clusters contiguous and group order undisturbed | 3.3, S-G2 | `api/features/with-grouping/feature.ts` | yes — `feature.spec.ts` |
| Sorting the grouped column is a no-op on cluster order when no `groupOrder` is supplied | S-G1 | `api/features/with-grouping/feature.ts` | yes — `feature.spec.ts` |
| `groupOrder` across modes, per-depth independence, stable fallback on a throw, reported once | 3.3, 3.4 | `engine/grouping/clusters.ts` | yes — `clusters.spec.ts` |
| Blank/missing group values: a rejected cluster's rows stay flat, none lost | 4.1 | `engine/grouping/clusters.ts` | yes — `feature.spec.ts` |
| **An object key with no `extractValue` merges every row into one bucket, silently** | **4.2** | **`engine/grouping/clusters.ts`** | **no** |
| A single-row group renders as an ordinary group; a size-threshold `when` can dissolve it | 4.3 | `engine/grouping/clusters.ts` | yes — `feature.spec.ts` |
| An unknown level degrades to one phantom cluster per parent — never a throw, never dropped | 4.4 | `engine/grouping/clusters.ts` | yes — `feature.spec.ts`, `pipeline.spec.ts` |
| `rowsOf()` is post-filter, collapse-independent, stale-header-safe, `[]` on a missing group | X-G1 | `engine/grouping/queries.ts` | yes — `feature.spec.ts`, `queries.spec.ts` |
| No group header id ever enters the selection | X-G1 | `api/features/with-selection.ts` | yes — `feature.spec.ts` |
| **Group chevron and row chevron are independently keyed; neither triggers the other** | **E-G1** | **`engine/grouping/render.ts`** | **no** |
| Async rule: pending holds the last explicit set, `onSuccess` replaces, `onError` → `[]` | (async story) | `engine/grouping/rules.ts` | yes — `rules.spec.ts` |
| Filter precedes group, so an empty group is unrepresentable | F-G1 | `engine/pipeline.ts` | yes — `feature.spec.ts` |

Not listed: 2.2's "is everything expanded" signal and 2.3's initial depth. Those are missing
**features** (S4, S6), not missing tests — there is nothing to assert yet.

## Affordance halves with no home

No directive spec covers grouping; `src/directives/` holds one spec in total
(`ngp-table-row-field.directive.spec.ts`). These fall to Storybook by absence, not by decision.

| Story | Affordance | Only proven by |
|---|---|---|
| 2.1 | The whole header row is the hit area, not just the chevron | `grouping-collapsible/` |
| 2.1 | The chevron is a real `<button>` carrying `aria-expanded` | `grouping-collapsible/` |
| 2.4 | Sticky headers stack per depth and hand off without overlap | nothing — U5, unbuilt |
| 1.4 | `groupedColumnMode` — what the grouped column does on screen | `grouping-static/` |
| X-G1 | A partly-selected group reads as visibly tri-state | `grouping-selection/` |
| U1 | Banner vs per-column group header layout | `grouping-static/`, `grouping-crud/` |

## Summary

24 distinct decision points; **6 untested**, all cross-feature. 6 affordances have no home.
Highest value: **collapsing a group changes nothing selected** (2.1) — grouping.md already flags
it as undemonstrated, no story composes `withExpansion()` with `withSelection()`, and it is the
failure a person would notice immediately.
The 5 others: refetch and regroup collapse survival (2.5), ungroup vs selection (X-G1), the silent
object-key merge (4.2), and group-vs-row chevron independence (E-G1).
