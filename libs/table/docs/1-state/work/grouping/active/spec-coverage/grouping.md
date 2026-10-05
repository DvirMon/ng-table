---
title: Spec coverage audit — grouping
type: audit
capability: grouping
date: 2026-09-19
---

| Story | What it asserts                                                                     | Verdict    | Owner / note                                                                                                                        |
| ----- | ----------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1.1   | rows cluster contiguously, headers mark boundaries                                  | covered    | `engine/grouping/pipeline.spec.ts`, `render.spec.ts`                                                                                |
| 1.2   | group count = post-filter leaf count, nested subtree                                | covered    | `api/features/with-grouping/feature.spec.ts` (`rowsOf`)                                                                             |
| 1.3   | per-group aggregate correct at depth, post-filter, isolated failure                 | covered    | `engine/grouping/render.spec.ts`                                                                                                    |
| 1.4   | `grouping()`/`groupingLevels()`/`isGroupedBy()` reflect active levels, order, drops | covered    | `api/features/with-grouping/feature.spec.ts` (`groupingLevels`, `isGroupedBy`)                                                      |
| 2.1   | `toggleExpanded` hides/reveals a group's whole subtree                              | covered    | `api/features/with-grouping/feature.spec.ts` (`collapse/expand #25`)                                                                |
| 2.2   | one action collapses/expands every group, control self-labels                       | story      | S4/S5 gap — no signal, no verb built                                                                                                |
| 2.3   | initial expansion depth configurable, applies on first paint                        | story      | S6 gap — no group-discovery mechanism                                                                                               |
| 2.4   | sticky header stays visible, nested paths stack                                     | story      | pure CSS recipe, no state to spec                                                                                                   |
| 2.5   | expand/collapse state survives refetch, sort, regroup                               | story      | OQ-4 open — regroup stability untested                                                                                              |
| 3.1   | `setGroupLevels` replaces/updates grouping; duplicate no-op                         | covered    | `mutations/update-grouping.spec.ts`                                                                                                 |
| 3.2   | add/remove/reorder a level, mid-level removal, duplicate rejected                   | covered    | `mutations/update-grouping.spec.ts`, `feature.spec.ts`                                                                              |
| 3.3   | `groupOrder` comparator ranks siblings per-column, throw falls back                 | covered    | `engine/grouping/clusters.spec.ts`                                                                                                  |
| 3.4   | `GroupSummary.rows` drives count/aggregate-based ordering                           | covered    | `engine/grouping/clusters.spec.ts` (`sortClusters`)                                                                                 |
| 4.1   | null/undefined/`''` rows form a stated, stable group                                | story      | OQ-5 open — no decision, unasserted                                                                                                 |
| 4.2   | object-valued column groups/labels via `accessor`, stated fallback                  | unverified | `feature.spec.ts` comment says grouping reads row fields directly, "never a column's `accessor` (D7)" — contradicts doc's 4.2 claim |
| 4.3   | single-row group renders consistently (no size threshold)                           | spec       | `engine/grouping/clusters.ts` (`buildClusters`/`admitClusters`)                                                                     |
| 4.4   | unknown grouping level never blanks the table                                       | covered    | `engine/grouping/pipeline.spec.ts` — phantom cluster, not a drop; differs from doc's "resolveGroupingLevels drops it"               |
| X-G1  | `rowsOf`→`trackBy`→`selectionStateOf` selects leaf ids only                         | covered    | `api/features/with-grouping/feature.spec.ts` (cascade recipe)                                                                       |
| S-G1  | sorting the grouped column is a no-op (D5)                                          | covered    | `api/features/with-grouping/feature.spec.ts`                                                                                        |
| S-G2  | sorting reorders rows within a cluster, boundaries intact                           | covered    | `api/features/with-grouping/feature.spec.ts`                                                                                        |
| F-G1  | aggregates/counts reflect only post-filter rows                                     | covered    | `api/features/with-grouping/feature.spec.ts`                                                                                        |
| F-G2  | filter groups by their own aggregate value                                          | story      | no aggregation-filter capability exists                                                                                             |
| P-G1  | a group straddling a page repeats its heading                                       | story      | pagination unbuilt                                                                                                                  |
| P-G2  | a large grouped table stays usable                                                  | story      | owned by `performance.md`, forward-looking                                                                                          |
| D-G1  | dragging a row out of its group re-groups or snaps back                             | story      | no drag feature exists                                                                                                              |
| E-G1  | group collapse and row-detail expansion never trigger each other                    | story      | render-stage order untested within grouping specs                                                                                   |

**Summary:** covered 14, story 10, spec 1, unverified 1 (26 total; G-1/G-2 excluded — owned by `row-editing.md`).
Top gap: 4.2's product-doc claim (object-valued grouping works "through the column's own `accessor`") is directly contradicted by a spec comment in `feature.spec.ts` stating grouping reads row fields directly and never uses `accessor` (D7) — needs reconciling before the doc's ✅/🟡 marks can be trusted there.
Secondary: 4.4 also diverges — the engine never drops an unknown level (phantom cluster, D7), while the doc credits a `resolveGroupingLevels` drop that appears to be story-local, not a library guarantee.
