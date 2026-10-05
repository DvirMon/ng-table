---
title: 'Step 1 — editing-state.ts: createEditingStore() takes the store slice it reads (value, trackBy, indexById), not TableCore'
type: task-step
issue: 74
---

# Step 1 — `editing-state.ts`: `createEditingStore()` takes the store slice it reads (`value`, `trackBy`, `indexById`), not `TableCore`

**PR scope:** One file. Both editing features (Steps 2, 3) depend on it; nothing else calls
`createEditingStore` (`table.mock.ts` uses only `createDraftRows`, unchanged).

**Task type:** code

**Skills used:** typescript-conventions, declarative-naming

**Depends on:** — (#35 made `indexById` a public `TableStore` member, D25)
**Parallel-safe with:** —

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/editing-state.ts` (edit)

## Why This Step Exists

Architecture, settled point 9 / D25: `indexById` is public read-only precisely because both
editing features need it and "a feature can only reach what is on the store". Issue #40
acceptance: "Both read `indexById` from their input, not from an engine-internal handle."
`createEditingStore(core: TableCore<TRow>)` is the last place a consumer-facing feature names
`TableCore` — `TableCore` requires `baseColumns`, which the store does not have, so the two
features cannot be typed as `Feature<In, Out>` until this parameter changes.

## What To Do

1. **Input type**, exported next to `EditingStoreOptions`:

   ```ts
   /** The store slice the editing store reads and writes through. */
   export type EditingStoreInput<TRow> = Pick<TableStore<TRow>, 'value' | 'trackBy' | 'indexById'>;
   ```

   Import `TableStore` from `../types` (type-only); drop the `TableCore` import.

2. **Signature**: `createEditingStore<TRow>(input: EditingStoreInput<TRow>, options = {})`. Body:
   `core.value()` → `input.value()`, `core.trackBy` → `input.trackBy`,
   `core.value.update(() => rows)` → `input.value.update(() => rows)`,
   `core.indexById()` → `input.indexById()`. No behaviour change.

3. **File header comment**: the paragraph "Not a feature. … composition stays independent of
   `features` array order" states a rationale that no longer holds (spec "What changes
   semantically": argument order now governs visibility; the shared store stays, the reason
   changes — rewritten in #44). Replace with one terse line: "Not a feature. Both editing
   features build on this store; `withRowEdit()` owns the store when composed, `withOptimistic()`
   when composed alone." No D-number narration.

## Implementation Notes

- `EditingUpdaterContext.indexById` is a `ReadonlyMap` snapshot read at write time — unchanged.
- `WritableView<TRow[], RowUpdater<TRow>>` is what `TableStore.value` is; the `writeData`
  closure still calls `.update(() => rows)`.

## Risks / Watchouts

- Keep `onWrite` and `apply` — Step 3's single-mode trim and Step 6's finding both rely on
  them.

## Non-Goals

- No change to updaters (`row-edit-mutations.ts`, `optimistic-mutations.ts`), `pendingOps`,
  `pendingIds`, or ADR-0006 pruning.

## Acceptance Checks

- [ ] `editing-state.ts` no longer imports `TableCore`; `createEditingStore` accepts a
      `TableStore<TRow>` (superset of the slice).
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` reports no error in
      `editing-state.ts` (the two features still red until Steps 2–3 — expected).

---

[Step 2: with-optimistic.ts](step-2-with-optimistic.plan.md) →
