---
title: "Step 2 — with-optimistic.ts: withOptimistic<In>(derive?) on the Feature<In, Out> contract"
type: task-step
issue: 74
---

# Step 2 — `with-optimistic.ts`: `withOptimistic<In>(derive?)` on the `Feature<In, Out>` contract

**PR scope:** One feature file. Spec in Step 4.

**Task type:** code

**Skills used:** typescript-conventions, declarative-naming

**Depends on:** Step 1
**Parallel-safe with:** Step 3

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/with-optimistic.ts` (edit)

## Why This Step Exists

Spec "The feature contract" (stories 2, 21); issue #74: no row type parameter, `indexById` read
from the input, optional trailing block "e.g. an 'is any edit dirty' … signal". Optimistic has
**no config**, so the derive block is its only parameter. Verified by probe
`probe-r5-feature-conversion.ts.txt` case 6 (2026-09-13): `withOptimistic(withComputed(...))`
infers `In` from the slot once the derive parameter is `NoInfer<In>`.

## What To Do

1. **Input slice, F-bounded:**

   ```ts
   type OptimisticInput<In> = EditingStoreInput<RowOf<In>>;
   ```

   (`EditingStoreInput` from `./editing-state`, Step 1.) Imports: `Feature`, `RowOf`,
   `TableFeatureSpec` from `../../engine/types`; `DerivedDict` from `../types`;
   `createTableFeature` from `../create-table-feature`. Drop `TableCore`.

2. **Overloads, this order** (no config, so derive-only is the second form):

   ```ts
   export function withOptimistic<In extends OptimisticInput<In>>(): Feature<In, OptimisticMembers<RowOf<In>>>;
   export function withOptimistic<In extends OptimisticInput<In>, D extends DerivedDict>(
     derive: Feature<NoInfer<In> & OptimisticMembers<RowOf<In>>, D>
   ): Feature<In, OptimisticMembers<RowOf<In>> & D>;
   ```

3. **Implementation:**

   ```ts
   export function withOptimistic(derive?: Feature<any, any>): Feature<any, any> {
     const factory = <In extends OptimisticInput<In>>(
       input: In
     ): TableFeatureSpec<RowOf<In>, OptimisticMembers<RowOf<In>>> => {
       const store = createEditingStore<RowOf<In>>(input);
       return {
         members: { editing: store.editing, pending: store.pending, pendingOps: store.pendingOps, unconfirmed: store.unconfirmed },
         onRowsRemoved: store.onRowsRemoved,
       };
     };
     const feature: Feature<any, any> = derive
       ? createTableFeature(factory, derive)
       : createTableFeature(factory);
     return Object.assign(feature, { displayName: 'withOptimistic' });
   }
   ```

4. **Doc comment**: keep the always-editable example and the scope paragraph (update/create/
   delete, never move). Replace "listing both in `features` throws at construction (ADR-0007)"
   with "composing both throws at construction (ADR-0007)" — same fact, no array wording.

## Implementation Notes

- `OptimisticMembers<TRow>` unchanged (`editing` write view, `pending`, `pendingOps`,
  `unconfirmed`).
- The zero-argument overload must come first: with `derive?` optional in a single signature `D`
  would infer as its constraint (research trap #2).

## Risks / Watchouts

- Without `NoInfer`, `In` is inferred from the block's own `In'` and the slot check fails
  (probe: first run of case 6 was exactly this error).

## Non-Goals

- No spec (Step 4). No change to updaters.

## Acceptance Checks

- [ ] `withOptimistic()` in a slot: `store.editing` is
      `WritableView<ReadonlySet<RowId>, EditingUpdater<Row>>` with `Row` from the slot.
- [ ] `withOptimistic(withComputed((s) => ({ busy: computed(() => s.pending().size > 0) })))`
      compiles; `store.busy` is `Signal<boolean>`; inside the block `s.editing` is
      `Signal<ReadonlySet<RowId>>` (no `.update`).
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` clean for `with-optimistic.ts`.

---
← [Step 1: editing-state.ts](step-1-editing-state-input.plan.md) | [Step 3: with-row-edit.ts](step-3-with-row-edit.plan.md) →
