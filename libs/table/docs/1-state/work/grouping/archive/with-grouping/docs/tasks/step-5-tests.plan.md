---
title: "Step 5 — Tests through the public createTable() surface"
type: task-step
issue: 6
---

# Step 5 — Tests through the public `createTable()` surface

**PR scope:** Depends on Step 3 (updater factories) and Step 4 (the composed feature) — this is
integration-through-the-public-surface testing, not unit testing of either in isolation (those
already have their own specs from Steps 1–3).

**Task type:** test

**Skills used:** unit-test, angular-developer

**Scaffolding agent:** test-implementer

**Depends on:** Step 3, Step 4

## Files

- `libs/shared/table/src/api/features/with-grouping.spec.ts` (new)
- `libs/shared/table/src/table.mock.ts` (edit — add grouping fixtures)

## Why This Step Exists

Testing Decisions (`../../3-spec.md`): "A test composes the feature into a real table via the
table factory and asserts on the public members (`table.grouping`, `table.renderRows`). No test
reaches into the fold's internals... Structural and DOM tests belong to the directive layer."
This step is that — the acceptance criteria in issue #7 that can only be proven end-to-end
(standalone composition, filter→group ordering, construction throw) live here, not in Steps 1–3's
pure-function specs.

## What To Do

### 1. `table.mock.ts` — grouping fixtures

Add a row shape with two groupable columns and a numeric column, sized so a naive
"average of children's averages" produces a different number than the true leaf-level average —
this is what makes the depth-correctness acceptance criterion provable, not just plausible:

```ts
export interface GroupingMockRow {
  id: number;
  region: string;
  category: string;
  amount: number;
}

/** Deliberately unequal cluster sizes per (region, category) — `US > Electronics` has 2 rows,
 * every other leaf cluster has 1, so a parent average computed from its children's already-
 * computed averages (125) differs from the true leaf-level average (150) for `region: 'US'`.
 * See with-grouping Step 5 plan, "depth-correctness case." */
export const mockGroupingRows: GroupingMockRow[] = [
  { id: 1, region: 'US', category: 'Electronics', amount: 100 },
  { id: 2, region: 'US', category: 'Electronics', amount: 300 },
  { id: 3, region: 'US', category: 'Furniture', amount: 50 },
  { id: 4, region: 'EU', category: 'Electronics', amount: 20 },
  { id: 5, region: 'EU', category: 'Furniture', amount: 10 },
  { id: 6, region: 'EU', category: 'Furniture', amount: 90 },
];
```

### 2. `with-grouping.spec.ts` — cover every issue-#7 acceptance criterion

Compose via the real `createTable()` factory (`data: signal(mockGroupingRows)`, `columns` with
`id: 'region'`/`'category'`/`'amount'`, `features: [withGrouping<GroupingMockRow>()]`), matching
`with-selection.spec.ts`'s composition style. Cases:

- `table.grouping()` starts `[]`; `table.grouping.update(setGroupLevels(['region']))` updates it
  and re-clusters `table.renderRows()`.
- Two-level grouping (`['region', 'category']`): `renderRows()` contains nested `kind: 'group'`
  headers at `depth: 0` and `depth: 1`, leaf rows at `depth: 2`, contiguous per cluster.
- **Depth-correctness:** an `amount` column with `aggregateFn: rows => rows.reduce((s, r) => s +
  r.amount, 0) / rows.length` (plain average) at two-level grouping — assert the `region: 'US'`
  header's `aggregates.amount` equals `150` (true leaf average across all 3 US rows), not `125`
  (naive average of the two category averages). This is the test the spec calls out by name.
- `withGrouping()` composed alone (no other features): `renderRows()` renders every group fully
  expanded — no collapsed/hidden rows, since #25's `expandedRows` coupling doesn't exist yet.
- Compose `withFiltering()`-equivalent (or a manual pre-filtered `data` signal, whichever this
  repo's current filtering primitive supports at implementation time — check
  `docs/1-state/filters.md`/`createFilters()`'s landed shape before writing this case) alongside
  `withGrouping()`: `aggregates` reflect only the post-filter rows.
- Construction throw: `withGrouping({ initialGrouping: ['not-a-column'] })` throws synchronously
  when composed into `createTable()`, before any signal is read.
- Runtime degrade: `table.grouping.update(setGroupLevels(['region', 'not-a-column']))` does
  **not** throw — `renderRows()` groups by `region` only, dropping the unknown level.
- Removing rows that were a cluster's sole members removes that cluster from `renderRows()` with
  no residual header (data-driven — no `onRowsRemoved` needed for this, since the pipeline/render
  stages recompute from `core.rows()` on every change; assert the *behavior*, not that a specific
  hook fired).

## Implementation Notes

- If `createFilters()` (the current filtering primitive, superseded from `withFiltering()` — see
  `docs/1-state/filters.md`) isn't a `features: []` composable by the time this step runs, test
  the filter→group interaction more directly: pre-filter the `data` signal passed into
  `createTable()` and assert `aggregates` only reflect the reduced set. The acceptance criterion
  is "`aggregateFn` receives post-filter rows," which the fixed `filter → group → sort → expand`
  pipeline order already guarantees structurally — this test is confirming that guarantee holds
  through the public surface, not exercising `createFilters()` itself.
- Reuse `mockTrackBy`-style patterns already in `table.mock.ts` — add
  `mockGroupingTrackBy: TrackByFn<GroupingMockRow> = (row) => row.id` alongside the new fixture
  rather than inlining a lambda per test.

## Risks / Watchouts

- Don't assert on `RenderRow.id`'s exact string format for group headers (e.g. the `group:...`
  serialization) unless the spec commits to that format — Steps 1–2 treat it as an internal
  detail. Assert uniqueness and stability (the same cluster always gets the same id across two
  reads with unchanged input), not a specific string shape.

## Non-Goals

- No directive/DOM/template tests — out of scope for the state layer per this package's
  `CLAUDE.md` Testing section.
- No `groupOrder`/collapse/rule-engine test cases (#24/#59/#60).

## Acceptance Checks

- [ ] Every bullet in issue #7's Acceptance Criteria maps to at least one passing test here (or,
      for the construction-throw and pipeline-order criteria, to a Step 1–4 spec already covering
      it — note which, don't duplicate).
- [ ] `nx test shared-table` passes.

---
← [Step 4: with-grouping.ts feature plugin + barrel export](step-4-with-grouping-feature.plan.md) | [Step 6: Docs — perf findings, frontmatter, status regen](step-6-docs-and-perf.plan.md) →
