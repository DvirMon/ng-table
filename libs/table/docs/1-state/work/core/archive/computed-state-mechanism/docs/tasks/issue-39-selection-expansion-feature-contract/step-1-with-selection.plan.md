---
title: 'Step 1 — with-selection.ts: withSelection<In>(config?, derive?) on the Feature<In, Out> contract'
type: task-step
issue: 73
---

# Step 1 — `with-selection.ts`: `withSelection<In>(config?, derive?)` on the `Feature<In, Out>` contract

**PR scope:** One feature file. Spec in Step 3. `selection.utils.ts` (`selectAllIds`) already
takes a `Pick<TableStore<TRow>, …>` and is untouched.

**Task type:** code

**Skills used:** typescript-conventions, declarative-naming, extract-encapsulated-logic

**Depends on:** — (#35 landed `Feature<In, Out>` + `createTableFeature(factory, derive)`; #36
landed `withComputed()` and `Feature.displayName`)
**Parallel-safe with:** Step 2

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/with-selection.ts` (edit)

## Why This Step Exists

Spec "The feature contract" (stories 2, 7, 21) and the spec's headline example:
`withSelection({ enableMultiRowSelection: (row) => row.status === 'open' }, withComputed((store) => ({ hiddenSelected: computed(() => store.selectedRows().size - store.rows().length) })))`
— `row` typed without annotation, the block sees core plus `SelectionMembers`. Issue #39
acceptance: no row type parameter; `enableRowSelection`/`enableMultiRowSelection` receive the
consumer's row type; trailing block; removal reconciliation (ADR-0006) and the `enableRowSelection`
write-path gate unchanged.

Typing verified by probe `probe-r5-feature-conversion.ts.txt` (work folder, 2026-09-13), cases 1–3
and 10 are this feature.

## What To Do

1. **Input slice, F-bounded**, replacing `SelectionInput<TRow> = Pick<TableCore<TRow>, 'rows' | 'trackBy'>`:

   ```ts
   type SelectionInput<In> = Pick<TableStore<RowOf<In>>, 'rows' | 'trackBy'>;
   ```

   Imports: `TableStore`, `DerivedDict` from `../types`; `Feature`, `RowOf`, `TableFeatureSpec`
   from `../../engine/types`; `createTableFeature` from `../create-table-feature`. Drop `TableCore`.

2. **Extract the factory body** into
   `buildSelectionSpec<TRow>(input: Pick<TableStore<TRow>, 'rows' | 'trackBy'>, config: WithSelectionConfig<TRow>): TableFeatureSpec<TRow, SelectionMembers>`
   — today's inner arrow verbatim (`resolveRow`, `isSelectable`, gates, `applyNextSelection`,
   verbs, seed, `onRowsRemoved`, `onDestroy`), `core` → `input`. `toRowPredicate` stays a
   module-level helper.

3. **Overloads, this exact order** (derive-first first; `NoInfer` on every derive parameter):

   ```ts
   export function withSelection<In extends SelectionInput<In>, D extends DerivedDict>(
     derive: Feature<NoInfer<In> & SelectionMembers, D>,
   ): Feature<In, SelectionMembers & D>;
   export function withSelection<In extends SelectionInput<In>>(
     config?: WithSelectionConfig<RowOf<In>>,
   ): Feature<In, SelectionMembers>;
   export function withSelection<In extends SelectionInput<In>, D extends DerivedDict>(
     config: WithSelectionConfig<RowOf<In>> | undefined,
     derive: Feature<NoInfer<In> & SelectionMembers, D>,
   ): Feature<In, SelectionMembers & D>;
   ```

4. **Implementation:**

   ```ts
   export function withSelection(
     a: WithSelectionConfig<any> | Feature<any, any> = {},
     b?: Feature<any, any>,
   ): Feature<any, any> {
     const isDeriveFirst = typeof a === 'function';
     const config: WithSelectionConfig<any> = isDeriveFirst ? {} : a;
     const derive = isDeriveFirst ? a : b;
     const factory = <In extends SelectionInput<In>>(
       input: In,
     ): TableFeatureSpec<RowOf<In>, SelectionMembers> => buildSelectionSpec(input, config);
     const feature: Feature<any, any> = derive
       ? createTableFeature(factory, derive)
       : createTableFeature(factory);
     return Object.assign(feature, { displayName: 'withSelection' });
   }
   ```

   The `feature: Feature<any, any>` annotation is required (ternary without contextual type
   infers the generic factory's `In` as its constraint fallback — probe case 11).

5. **Doc comment**: keep D5 ("never stamps a `RenderRow` field"); replace "reads only core
   members" with one line: reads `rows`/`trackBy` off the store handed in, row type from the
   data slot. Move the comment that currently sits above `toRowPredicate` (it documents
   `withSelection`) back onto `withSelection`.

## Implementation Notes

- `canSelect`/`canMultiSelect` are computed from `config` inside `buildSelectionSpec` (or once
  in `withSelection` and passed in — either; keep them out of the per-store closure only if it
  reads cleaner).
- `devModeIsActive`/`ngDevMode` declaration unchanged.
- The seed write (`initialSelection`) and the D16 no-emit rule are inside the extracted body —
  do not reorder relative to `onRowsRemoved` registration.

## Risks / Watchouts

- Config-only overload before derive-first breaks the derive-first form (probe case 10).
- `WithSelectionConfig` is a weak type (all-optional): a `Feature` passed to the config-only
  overload is rejected by weak-type detection, which is what makes overload resolution fall
  through correctly — do not add an index signature to the config.

## Non-Goals

- No spec (Step 3). No `selectAllIds` change. No slice/namespacing (ADR-0015 is undecided;
  members stay flat).

## Acceptance Checks

- [ ] `withSelection({ enableMultiRowSelection: (row) => row.status === 'open' })` in a slot:
      `row` is the slot's row type, no annotation.
- [ ] The spec's `hiddenSelected` example compiles; result type includes
      `hiddenSelected: Signal<number>`; `withSelection(withComputed(...))` also compiles.
- [ ] `keyof` of a table with `withSelection()` alone is
      `keyof TableStore<Row> | keyof SelectionMembers`.
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` clean for `with-selection.ts`.

---

[Step 2: with-expansion.ts](step-2-with-expansion.plan.md) →
