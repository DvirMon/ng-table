---
title: "Step 1 — with-sorting.ts: withSorting<In>(config?, derive?) on the Feature<In, Out> contract"
type: task-step
issue: 72
---

# Step 1 — `with-sorting.ts`: `withSorting<In>(config?, derive?)` on the `Feature<In, Out>` contract

**PR scope:** One feature file. No spec change here (Step 4). The library stays red on
`with-sorting.spec.ts` until Step 4 — that spec is already red today (it imports the deleted
`TableStoreConfig`/array form).

**Task type:** code

**Skills used:** typescript-conventions, declarative-naming, extract-encapsulated-logic

**Depends on:** — (#35 landed `Feature<In, Out>`, `createTableFeature(factory, derive)`; #36 landed
`withComputed()` and `Feature.displayName`)
**Parallel-safe with:** Step 2, Step 3

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/with-sorting.ts` (edit)

## Why This Step Exists

Spec "The feature contract": a feature is a function of the store built so far and recovers the
row type as `RowOf<In>`; no `<TRow>` at the call site (stories 2, 7). Architecture "Current
source" row for `with-*.ts`: each becomes `withX<In extends Shape, D extends DerivedDict = {}>(config?,
derive?)` and gains the trailing derive block via `createTableFeature()` (story 21 — no per-feature
plumbing). Issue #38 acceptance: no row type parameter, optional trailing `withComputed(...)`,
`{}` not `object` for a member-less contribution, `setup`/`onDestroy`/`onRowsRemoved` unchanged.

The typing mechanism was verified by probe (`probe-r5-feature-conversion.ts.txt`, work folder,
2026-09-13): an **F-bounded** `In` gives the factory body row-typed core members with no cast.

## What To Do

1. **Input slice, F-bounded.** Replace `SortingInput<TRow> = Pick<TableCore<TRow>, 'columns'>` with

   ```ts
   /** The store slice this feature reads, row-typed. F-bounded: `In extends SortingInput<In>`
    * gives the factory `input.columns(): ColumnDef<RowOf<In>>[]` with no cast. */
   type SortingInput<In> = Pick<TableStore<RowOf<In>>, 'columns'>;
   ```

   Import `TableStore` from `../types`, `Feature`/`RowOf`/`TableFeatureSpec` from
   `../../engine/types`, `DerivedDict` from `../types`, `createTableFeature` from
   `../create-table-feature`. Drop the `TableCore` import.

2. **Extract the factory body** into a named pure builder (it is the existing inner arrow, unchanged):

   ```ts
   function buildSortingSpec<TRow>(
     input: Pick<TableStore<TRow>, 'columns'>,
     config: WithSortingConfig
   ): TableFeatureSpec<TRow, SortingMembers> { /* today's inner arrow, `core` → `input` */ }
   ```

3. **Public overloads — this exact order** (derive-first before config-only, or TS fixes the
   block's contextual type to `Shape`; `NoInfer` keeps `In` inferred from the `createTable` slot,
   not from the block):

   ```ts
   export function withSorting<In extends SortingInput<In>, D extends DerivedDict>(
     derive: Feature<NoInfer<In> & SortingMembers, D>
   ): Feature<In, SortingMembers & D>;
   export function withSorting<In extends SortingInput<In>>(
     config?: WithSortingConfig
   ): Feature<In, SortingMembers>;
   export function withSorting<In extends SortingInput<In>, D extends DerivedDict>(
     config: WithSortingConfig | undefined,
     derive: Feature<NoInfer<In> & SortingMembers, D>
   ): Feature<In, SortingMembers & D>;
   ```

4. **Implementation signature** (loosely typed, same convention as `createTableFeature` and
   `withComputed`):

   ```ts
   export function withSorting(
     a: WithSortingConfig | Feature<any, any> = {},
     b?: Feature<any, any>
   ): Feature<any, any> {
     const isDeriveFirst = typeof a === 'function';
     const config: WithSortingConfig = isDeriveFirst ? {} : a;
     const derive = isDeriveFirst ? a : b;
     const factory = <In extends SortingInput<In>>(input: In): TableFeatureSpec<RowOf<In>, SortingMembers> =>
       buildSortingSpec(input, config);
     const feature: Feature<any, any> = derive
       ? createTableFeature(factory, derive)
       : createTableFeature(factory);
     return Object.assign(feature, { displayName: 'withSorting' });
   }
   ```

   The `feature` annotation is required: without a contextual type the ternary infers the generic
   factory's `In` as its constraint fallback and the two branches stop unifying (probe, case 11).

5. **Doc comment**: keep the three-state/multi description; replace the "no compile-time feature
   dependency" sentence with one line stating the row type comes from the store handed in.
   Terse, no decision narration.

## Implementation Notes

- `SortRule.columnId` stays `string` — sorting has no column-id config, so nothing to
  autocomplete here (grouping is Step 3).
- `NoInfer` needs TS ≥ 5.4; repo is on 6.0.3.
- `D` is always inferred from a real `derive` argument in the with-derive overloads, so
  `NormalizeDerived` (research trap #3) is not needed on the feature's own overloads —
  `createTableFeature`'s second overload still applies it internally.
- `displayName` is set by `Object.assign`, no cast (`Feature.displayName` is optional
  `readonly`; the assigned object type satisfies it).

## Risks / Watchouts

- Do not write `In extends Shape` and read `input.columns()` — `Shape` has no `columns`; the
  F-bound is the mechanism, not a nicety.
- Do not put the config-only overload first (probe, case 10 failure mode).
- `AnyTableFeature = Feature<any, any>` must still accept the result; it does.

## Non-Goals

- No spec change (Step 4). No story/app migration (#41/#76). No docs (#44).

## Acceptance Checks

- [ ] `withSorting()` in a `createTable` slot infers `In` with no type argument; `store.sorting`,
      `toggleSort`, `sortChanged` typed as before.
- [ ] `withSorting({ multi: true }, withComputed((s) => ({ n: computed(() => s.sorting().length) })))`
      and `withSorting(withComputed(...))` both compile; `store.n` is `Signal<number>`.
- [ ] `keyof` of a table composed with `withSorting()` alone is exactly
      `keyof TableStore<Row> | keyof SortingMembers` — no index signature.
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` reports no error in
      `with-sorting.ts`.

---
[Step 2: with-filtering.ts — Feature<In, {}>](step-2-with-filtering.plan.md) →
