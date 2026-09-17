---
title: "Step 4 — groupOrder test coverage"
type: task-step
issue: 58
---

# Step 4 — `groupOrder` test coverage

**PR scope:** Depends on both Step 2 (engine) and Step 3 (feature config) existing.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

**Depends on:** Step 2, Step 3
**Parallel-safe with:** Step 5

## Files

- `libs/shared/table/src/engine/grouping.spec.ts` (edit)
- `libs/shared/table/src/api/features/with-grouping.spec.ts` (edit)

## Why This Step Exists

Issue #58's acceptance criteria plus the spec's Testing Decisions both call for this coverage.
Two layers, matching the file split issue #6 already established for this feature (both files
exist today from that work):

- `engine/grouping.spec.ts` — `sortClusters` is pure `ClusterNode[] → ClusterNode[]` logic
  (no signals, no Angular); CLAUDE.md's own rule is that pure engine code needing `TestBed` is a
  sign it landed in the wrong file, so this is plain `vitest` against `ClusterNode` fixtures
  directly.
- `with-grouping.spec.ts` — the issue's "tests go through the public `createTable()` surface
  only" criterion, and the spec's Testing Decisions ("a test composes the feature into a real
  table via the table factory and asserts on the public members"), are about *this* file: the
  end-to-end behavior a consumer actually sees (`store.grouping`, `store.renderRows()`).

Spec: `../../3-spec.md`, Testing Decisions — the `groupOrder`-specific bullets.

## What To Do

**`engine/grouping.spec.ts`** — add a `describe('sortClusters', ...)` block:

- Given a flat two-level `ClusterNode[]` fixture (build via `buildClusters` or hand-construct),
  a `groupOrder` comparing `rows.length` reorders top-level siblings by count, and independently
  reorders each parent's own children by their own count — assert a case where the correct
  per-parent order would be *wrong* if a global (cross-parent) sort were applied instead, proving
  D9's "siblings only" invariant, not just checking the top level.
- `groupOrder` omitted (`undefined`) returns `nodes` unchanged, by reference, at every level
  (extra assurance beyond the feature-level "first-occurrence order" test — this is the actual
  short-circuit).
- A `groupOrder` that throws: the affected level falls back to the pre-sort order; assert
  `console.error` (spy it) is called **exactly once** even when multiple nodes across multiple
  levels would each trigger a throw during that one `sortClusters` call (pass one shared
  `{ done: false }` across nested calls exactly as `clusterRows`/`buildGroupRenderRows` do).

**`with-grouping.spec.ts`** — add cases to the existing `describe('withGrouping', ...)` block,
composing `withGrouping<GroupingMockRow>({ groupOrder: ... })` with `mockGroupingRows`/
`makeColumns()`/`makeStore()` (existing helpers in this file):

- `groupOrder` omitted: `store.renderRows()`'s group headers appear in first-occurrence order
  (regression — matches the existing "US, EU" ordering already asserted in this file for issue
  #6's tests).
- `groupOrder` supplied, e.g. `(a, b) => b.rows.length - a.rows.length` (order by descending row
  count): `store.renderRows()`'s group headers reorder accordingly, while each cluster's own row
  order (`kind: 'row'` rows nested under a given header) is unchanged from input order.
- With multi-level grouping (`setGroupLevels(['region', 'category'])`) and a `groupOrder` that
  would reorder region siblings, assert the `category` sub-clusters *within* a given region are
  still in their own first-occurrence (or `groupOrder`, if it reorders them too) order — never
  reordered *by* the other region's `groupOrder` result.
- Composing `withSorting()` with a `sort` on the grouped column (`region`) and no `groupOrder`:
  `store.renderRows()`'s cluster order is unchanged from the un-sorted case — the D5 no-op,
  asserted explicitly rather than assumed.
- A `groupOrder` that throws: `store.renderRows()` still renders (falls back to stable order),
  doesn't throw up through `renderRows()` itself.

## Implementation Notes

- Reuse `mockGroupingRows`/`mockGroupingTrackBy`/`makeColumns`/`makeStore` from this file
  (`../../table.mock`) — `mockGroupingRows` already has unequal cluster sizes (`US >
  Electronics` = 2 rows, every other leaf = 1) specifically suited to count-based `groupOrder`
  assertions; don't add a second fixture.
- Spy `console.error` with `vi.spyOn(console, 'error').mockImplementation(() => {})` (or the
  project's existing convention if `create-filters.spec.ts` already established one for the
  ADR-0014 pattern — check there first) and restore it in an `afterEach`.

## Risks / Watchouts

- Don't assert on `sortClusters`'s internal `reported` object or any other closure-private state
  — only on `console.error` call count and the returned tree/render rows, per this repo's
  "no test reaches into the fold's internals" rule.
- Keep the throwing-`groupOrder` test's comparator throwing deterministically (e.g. `throw new
  Error('boom')` unconditionally) rather than only on specific inputs — a comparator that throws
  intermittently makes `Array.sort`'s call count, and therefore which pairs got compared before
  the throw, engine-dependent.

## Non-Goals

- No new fixture data — extend the existing `GroupingMockRow`/`mockGroupingRows` usage in both
  spec files.
- No directive/DOM-level test — out of scope for this layer per the table's own testing rule.

## Acceptance Checks

- [ ] `groupOrder` omitted preserves first-occurrence order (regression, unchanged from #6).
- [ ] `groupOrder` supplied reorders clusters without disturbing row order within a cluster.
- [ ] With multi-level grouping, a `groupOrder` at one level orders only that level's siblings,
      not clusters at a different depth.
- [ ] A `sort` on the grouped column is confirmed a no-op on cluster order.
- [ ] A `groupOrder` that throws falls back to stable order and reports exactly once per
      evaluation (not once per pairwise comparison).
- [ ] `nx test shared-table` passes.

---
← [Step 3: groupOrder on WithGroupingConfig](step-3-with-grouping-config.plan.md) | [Step 5: Docs banner update](step-5-docs-banner.plan.md) →
