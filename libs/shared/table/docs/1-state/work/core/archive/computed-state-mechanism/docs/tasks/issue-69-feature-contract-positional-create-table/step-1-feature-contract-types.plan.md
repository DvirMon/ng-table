---
title: "Step 1 — engine/types.ts + api/types.ts: Feature<In, Out> contract, TableConfig, ReadonlyStore, indexById"
type: task-step
issue: 69
---

# Step 1 — engine/types.ts + api/types.ts: `Feature<In, Out>` contract, `TableConfig`, `ReadonlyStore`, `indexById`

**PR scope:** Types only. Introduces the new feature contract and the public config/store
additions, deletes the array-form types. Nothing that *uses* the new types changes here — the
fold, `createTable()`, and the authoring helper follow in Steps 3–5. The lib is expected to
stop compiling at this step (issue: "not green individually") — every shipped `with-*` still
names `TableCore`/`TableFeature`.

**Task type:** code

**Skills used:** typescript-conventions, terse-jsdoc-for-ai-and-humans

**Depends on:** — (first step; #68 already landed)
**Parallel-safe with:** —

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/engine/types.ts` (edit)
- `libs/shared/table/src/api/types.ts` (edit)

## Why This Step Exists

Architecture "Types to add" + "Current source" rows for both files. `Feature<In, Out>`
replaces `TableFeature<TRow, Members>` (D20); the row type is recovered as `RowOf<In>`. The
public config becomes a plain `TableConfig<TRow>` with `injector` (D24, story 11).
`ReadonlyStore<S>` (D28) and `DerivedDict` are defined here because #70's `withComputed()`
consumes them and #69 owns the type surface. `indexById` goes public read-only (D25) so the
editing features can reach it from a `Feature<In extends Shape>`.

## What To Do

### `engine/types.ts`

1. Add, replacing `TableFeature`:

   ```ts
   // `unknown`, not `any`: Signal<TRow[]> is assignable to Signal<readonly unknown[]> and RowOf
   // still infers through it (review finding 9).
   export type Shape = { rows: Signal<readonly unknown[]> };
   export type RowOf<S> = S extends { rows: Signal<readonly (infer R)[]> } ? R : never;

   /** A composable feature: a function of the store built so far. Row type recovered as `RowOf<In>`. */
   export interface Feature<In extends Shape, Out extends object> {
     (input: In): TableFeatureSpec<RowOf<In>, Out>;
   }
   ```

2. Delete `TableFeature`. Keep `TableCore<TRow>` and `TableFeatureSpec` — the engine handle is
   still what the internally-spliced column-schema wiring receives (D25, ADR-0010).
3. Rewrite `TableCore`'s doc comment: it is no longer "handed to feature factories as their
   first argument"; it is the engine handle internal features receive. Rewrite the `indexById`
   member doc: it is now also exposed on `TableStore` (D25), no longer "engine-internal only".
4. `TableFeatureSpec<TRow, Members extends object = object>` — change the default to `{}`
   (architecture: a member-less feature returns `Feature<In, {}>`, never `Feature<In, object>`).

### `api/types.ts`

1. Add:

   ```ts
   export type DerivedDict = Record<string, Signal<unknown>>;

   /** D28: the derive block's parameter — every WritableView loses `.update`; everything else
    * passes through. Mutating methods are statically indistinguishable from queries and stay. */
   export type ReadonlyStore<S> = {
     readonly [K in keyof S]: S[K] extends WritableView<infer T, any> ? Signal<T> : S[K];
   };

   export interface TableConfig<TRow> {
     trackBy: TrackByConfig<TRow>;
     columns: ColumnDefInput<TRow>[];
     columnsSchema?: ColumnsSchemaFn<TRow> | ColumnSchema<TRow>;
     injector?: Injector;
   }
   ```

2. `TableStore<TRow>` gains `readonly indexById: Signal<ReadonlyMap<RowId, number>>` with a
   one-line doc (id → position in `data()`; read-only; feeds `RowUpdater` ctx and editing
   features).
3. Delete `TableStoreConfig`, `UnionToIntersection`, `FeatureMembers`, `ComposedFeatureMembers`.
4. `AnyTableFeature` becomes `Feature<any, any>` — the fold's runtime-length list type. Rewrite
   its doc comment: the "consumers must repeat `<TRow>`" paragraph is now false (D20). Say what
   it is: the erased element type the engine folds; consumers never name it. Do not cite
   ADR-0003's rejection — ADR-0003 owes an update (#78).
5. Import `Feature` from `../engine/types` (replacing `TableFeature`), `Injector` from
   `@angular/core`.

## Implementation Notes

- `ReadonlyStore` uses `any` in an `infer` position only (`WritableView<infer T, any>`); that is
  not the constraint-slot trap (research §"Three silent-failure traps" #1). Add a one-line
  comment saying so, otherwise a reviewer will flag it.
- `Feature` is an interface with one call signature (not a type alias of a function type) —
  matches the verified probe and leaves room for #71's `composeFeatures()` to reuse it.
- `slots.ts` derives `ClaimedCoreKey` from `keyof TableStore` and has a completeness guard:
  adding `indexById` to `TableStore` makes `CORE_MEMBER_KEYS` non-exhaustive and **breaks the
  type-level guard**. Add `'indexById'` to `CORE_MEMBER_KEYS` in this step — it is a
  non-overridable core key. (This is a one-line touch on `engine/slots.ts`; include it here
  rather than opening a separate step.)

## Risks / Watchouts

- **Expected compile breakage** after this step: `create-table.ts`, `table-schema.ts`,
  `create-table-feature.ts`, `compose-table.ts`, every `with-*.ts` referencing `TableFeature`.
  Steps 3–5 fix the engine/api files; the features are #72–#74. Do not "fix" the features here.
- `export * from './api/types'` in `index.ts` means the deleted types vanish from the barrel
  automatically and the new ones appear. Verify nothing under `src/stories/**` or
  `apps/**` is touched — those migrate in #75/#76.

## Non-Goals

- No overloads, no `createTable` signature change (Steps 2, 4).
- No `withComputed`, no `composeFeatures` (#70, #71).
- No feature conversions (#72–#74).

## Acceptance Checks

- [ ] `Shape`, `RowOf`, `Feature` exported from `engine/types.ts`; `TableFeature` gone.
- [ ] `DerivedDict`, `ReadonlyStore`, `TableConfig` exported from `api/types.ts`;
      `TableStoreConfig`, `ComposedFeatureMembers` gone.
- [ ] `TableStore.indexById` present, `readonly`, `Signal<ReadonlyMap<RowId, number>>`.
- [ ] `CORE_MEMBER_KEYS` includes `'indexById'`; the `CoreMemberKeysAreExhaustive` guard still
      compiles.
- [ ] `AnyTableFeature` doc no longer claims consumers must repeat the row type.
- [ ] Type-level sanity in a scratch check (not committed): `RowOf<TableStore<Invoice>>` is
      `Invoice`; `Signal<Invoice[]>` satisfies `Shape`.

---
[Step 2: tools/generate-overloads.ts — 15 + 15 overloads as call-signature interfaces](step-2-generate-overloads-script.plan.md) →
