---
title: "Step 6 — with-grouping.spec.ts: positional form, either-order expansion, pipeline-order permutation, column-id autocomplete"
type: task-step
issue: 72
---

# Step 6 — `with-grouping.spec.ts`: positional form, either-order expansion, pipeline-order permutation, column-id autocomplete

**PR scope:** One spec file (1,126 lines today, red: array/thunk form, deleted
`TableStoreConfig`/`ComposedFeatureMembers`). The largest rewrite in this issue and the one
carrying three of #72's acceptance lines.

**Task type:** test

**Skills used:** unit-test

**Depends on:** Step 1, Step 2, Step 3
**Parallel-safe with:** Step 4, Step 5
**Cross-issue edge:** this spec composes `withSelection()` and `withExpansion()` (#73). Their
*old* signatures still satisfy a `createTable` slot structurally (a `(core: Pick<TableCore<Row>, 'rows' | 'trackBy'>) => spec`
is assignable to `Feature<TableStore<Row> & O, …>`), so if #73 has not landed, keep the explicit
`withSelection<GroupingMockRow>()` / `withExpansion<GroupingMockRow>()` on those calls **only**
and leave a `// #73 strips the type argument` comment; #73 Step 3/4 remove them. If #73 has
landed, write them bare.

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/features/with-grouping.spec.ts` (edit)

## Why This Step Exists

Issue #72 acceptance lines owned here:
- "Grouping + expansion composed in either order: expanded groups render correctly (spec covers
  both orders)" — D25's lazy guarded read.
- "Pipeline stage order (filter → group → sort → expand) and render-stage order unchanged by
  argument order — spec asserts this for at least one permutation" — spec story 22.
- Column ids autocomplete from the row type (story 6) — `@ts-expect-error` on a typo.
- Each spec passes with the positional form and contains no explicit row type argument.

## What To Do

1. **Helpers.** Replace `makeStore`/`AnyTableFeature`/`TableStoreConfig`/`ComposedFeatureMembers`
   with `inContext(build)` (Step 4, item 1). `makeColumns`, `toShape`, `findHeader`, the header-id
   constants stay.

2. **Mechanical rewrite** of every case to
   `createTable(signal<GroupingMockRow[]>(rows), { trackBy: mockGroupingTrackBy, columns: makeColumns() }, withGrouping(...), ...)`.
   Zero `withGrouping<` afterwards. The `buildRows(features: readonly AnyTableFeature[])` helper
   in "feature array order does not affect collapse behavior" cannot spread into the per-arity
   overloads — replace it with two explicit `createTable(...)` calls (grouping-first,
   expansion-first) and compare their `[id, depth]` shapes; retitle to "argument order does not
   affect collapse behaviour".

3. **Either-order expansion (D25).** Extend the collapse/expand describe with an explicit pair:
   - `withExpansion(), withGrouping({ initialGrouping: ['region'] })` — expansion first;
   - `withGrouping({ initialGrouping: ['region'] }), withExpansion()` — grouping first.
   In both: nothing toggled → only two depth-0 headers; `toggleExpanded(US_HEADER_ID)` → the
   three US leaves appear, EU stays collapsed. Same expected `renderRows()` shape for both.
   Add the type-level half: in the expansion-first order, a trailing block on grouping sees
   `expandedRows` — `withGrouping({}, withComputed((s) => { expectTypeOf(s.expandedRows).toEqualTypeOf<Signal<Set<RowId>>>(); return { … }; }))`;
   in the grouping-first order the same read is a `@ts-expect-error` (types stricter than runtime).

4. **Pipeline-order permutation (story 22).** One new case: build the same data with
   `withFiltering({ filters }), withGrouping({ initialGrouping: ['region'] }), withSorting()` and
   with `withSorting(), withGrouping({ initialGrouping: ['region'] }), withFiltering({ filters })`;
   apply the same filter value and `toggleSort('amount')` to both; assert `rows()` ids equal and
   `renderRows()` `toShape(...)` equal. Filter → group → sort is observable: a filtered-out row
   is absent from every group, and leaves inside a group are sorted.

5. **Column-id autocomplete.** In a `describe('types')`: `withGrouping({ initialGrouping: ['region'] })`
   compiles; `withGrouping({ initialGrouping: ['not-a-column'] })` is a `@ts-expect-error`
   (`ColumnId<TRow>` is `Extract<keyof TRow, string> | (string & {})` — **check**: if the
   `string & {}` escape makes any string compile, assert autocompletion via
   `expectTypeOf<Parameters<typeof withGrouping<TableStore<GroupingMockRow>>>[0]>()` including
   `'region'` instead, and drop the `@ts-expect-error`; say which in the PR). Also
   `expectTypeOf(store.grouping).toEqualTypeOf<WritableView<string[], GroupingUpdater<GroupingMockRow>>>()`
   and `expectTypeOf(store.rowsOf).toEqualTypeOf<(group: RenderRow<GroupingMockRow>) => readonly GroupingMockRow[]>()`.

6. **Trailing block runtime case:** `withGrouping({ initialGrouping: ['region'] }, withComputed((s) => ({ levels: computed(() => s.grouping().length) })))`
   → `levels()` is 1; `store.grouping.update(setGroupLevels(['region', 'category']))` → 2.

7. Existing rules/schema-fn/async-rule/`groupOrder`/`rowsOf` cases: rewrite the composition
   only; assertions untouched.

## Implementation Notes

- `ColumnId<TRow>` (`api/types.ts`, D14) deliberately keeps arbitrary strings compilable for
  derived columns — item 5's check is real, not hypothetical. The autocomplete guarantee is
  "known keys are offered", not "unknown keys rejected"; the runtime throw for an unknown id
  (existing case) is the enforcement.
- The `Resource`/`ResourceStatus` async-rule cases run inside `TestBed` already; unchanged.
- `mockGroupingRows`/`mockGroupingTrackBy` from `table.mock.ts` unchanged.

## Risks / Watchouts

- The two-call permutation must use the **same** `filters` instance (filter state is the
  consumer's, not the table's) — build it once with `createFilters` in the injection context.
- Do not assert on fold internals (how many times a factory ran) — spec "Testing Decisions".

## Non-Goals

- No new grouping semantics; no group-header tick (spec "Out of Scope").

## Acceptance Checks

- [ ] `grep -c "withGrouping<" with-grouping.spec.ts` → 0; `withSelection<`/`withExpansion<` → 0
      once #73 landed (or exactly the commented interim calls otherwise).
- [ ] Both expansion orders render identically after `toggleExpanded`; both permutations of
      filter/group/sort produce identical `rows()` and `renderRows()`.
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` clean for this file.
- [ ] Runtime green (`vitest run …/with-grouping.spec.ts`) — the user runs it.

---
← [Step 5: with-filtering.spec.ts](step-5-with-filtering-spec.plan.md)
