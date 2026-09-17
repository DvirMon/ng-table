---
title: "Step 3 — compose-table.ts: fold hands each consumer feature the store only; base store gains indexById"
type: task-step
issue: 69
---

# Step 3 — `compose-table.ts`: fold hands each consumer feature the store only; base store gains `indexById`

**PR scope:** Engine fold only. `composeTable(config, features, internalFeatures)`'s outer
shape is unchanged; what changes is how each consumer feature is *called* and what the base
store carries. `create-table.ts` is untouched here (Step 4).

**Task type:** code

**Skills used:** typescript-conventions, declarative-naming

**Depends on:** Step 1
**Parallel-safe with:** Step 2, Step 5

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/engine/compose-table.ts` (edit)
- `libs/shared/table/src/engine/compose-table.spec.ts` (edit — green-keeping only: the
  two-argument factories in existing cases become one-argument; no new cases, Step 6)

## Why This Step Exists

Architecture "Runtime — the fold" step 3: "for each feature argument in order: call it with
the accumulating store". #34 already builds the base store first and pre-claims core keys;
what remains is retiring the `(core, composed)` calling convention (D20, D25) — a consumer
feature receives one argument, the store, and reads `indexById` from it (D25) rather than from
the engine handle.

## What To Do

1. **Two feature kinds, typed separately.** Internal features (the column-schema wiring) keep
   taking the engine handle — `baseColumns` stays engine-only (D25, ADR-0010). Introduce a local
   type for them and keep `AnyTableFeature` (`Feature<any, any>`) for consumers:

   ```ts
   /** Engine-supplied features receive the core handle — never a consumer `Feature`. */
   type InternalFeature<TRow> = (core: TableCore<TRow>) => TableFeatureSpec<TRow>;
   ```

   `composeTable`'s third parameter becomes `readonly InternalFeature<TRow>[]`.

2. **Fold call site.** Consumer features: `const spec = feature(store)`. Internal features:
   `const spec = feature(handle.core)`. Keep one loop body — make `LabeledFeature` carry a
   pre-bound thunk produced by `labelFeatures()`, so the loop does not branch on kind:

   ```ts
   interface LabeledFeature<TRow> {
     readonly run: () => TableFeatureSpec<TRow>;
     readonly label: string;
   }
   ```

3. **Base store gains `indexById`.** `createBaseStore()` adds
   `indexById: handle.core.indexById`. `FoldingStore<TRow>`
   (`TableStore<TRow> & Record<string, unknown>`) picks it up from `TableStore` (Step 1).

4. **Retire the trailing comment** about `ComposedFeatureMembers` at the return — the static
   side is now the generated overloads (Step 2). Replace with one line: the cast in
   `create-table.ts` remains the static/dynamic boundary (ADR-0003).

5. **Spec green-keeping:** every `(core, composed) =>` factory in `compose-table.spec.ts`
   becomes `(store) =>`; reads of `composed.x` become `store.x`. The "shows a feature only
   earlier features' members at factory time" case keeps its assertion — it now reads the
   store handed in.

## Implementation Notes

- The removal-reconciliation effect keeps reading `handle.core.indexById()` — do not switch it
  to `store.indexById`; same signal, but the effect is engine-owned and should not depend on
  the public store shape.
- `store` is one shared reference; a feature that captures it and reads lazily (method,
  `computed()`, stage) sees every later feature. This is the runtime truth D25 relies on for
  grouping's `expandedRows` read. Say it in the fold's doc comment, once.
- Do not add any `isSignal()` check or derive-block special case in the fold (D28, review
  finding 2).

## Risks / Watchouts

- Internal-first fold order must not change (#34 step 3 risk carries over).
- Shipped `with-*` factories still have `(core: TableCore<TRow>)` / `(core, composed)`
  signatures. At runtime they now receive the store as `core` — `columns`, `rows`, `value`,
  `trackBy`, `indexById` all exist, so most keep working incidentally; `baseColumns` does not,
  and grouping's `composed` is `undefined`. This is the "not green individually" window;
  #38–#40 close it. Do not patch features here.

## Non-Goals

- No change to `createTable()` (Step 4). No feature conversions.
- No new spec cases — Step 6.

## Acceptance Checks

- [ ] `foldFeatures` calls consumer features with exactly one argument, the store.
- [ ] Internal features receive `handle.core`; `wireColumnsSchemaAsync` still reads
      `baseColumns` unchanged.
- [ ] `store.indexById` is defined before any feature runs and is the core's signal.
- [ ] Existing `compose-table.spec.ts` cases pass with only the factory-signature edits.
- [ ] `engine/` compiles (`tsc --noEmit`, engine files) even while api files are still red
      from Step 1.

---
← [Step 2: tools/generate-overloads.ts](step-2-generate-overloads-script.plan.md) | [Step 4: create-table.ts — positional signature, config.injector, delete table-schema.ts](step-4-positional-create-table.plan.md) →
