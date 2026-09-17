---
title: "Step 4 — with-optimistic.spec.ts: positional form, derive-only block, composed-together throw"
type: task-step
issue: 74
---

# Step 4 — `with-optimistic.spec.ts`: positional form, derive-only block, composed-together throw

**PR scope:** One spec file (red today: array/thunk form, deleted `TableStoreConfig`).

**Task type:** test

**Skills used:** unit-test

**Depends on:** Step 2, Step 3 (the "composed together throws" case needs both converted)
**Parallel-safe with:** Step 5

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/features/with-optimistic.spec.ts` (edit)

## Why This Step Exists

Issue #40 acceptance: spec passes with the positional form, no explicit row type argument;
trailing block's members on the return type; ADR-0006 prune; "shared editing store still works
when both features are composed, in either order" — for optimistic + row-edit the observable
contract is the ADR-0007 throw, in either order.

## What To Do

1. **Helpers.** Replace `makeStore`/`optimisticStore` with `inContext(build)` and a thin
   `optimisticStore(rows = makeRows())` that returns
   `inContext(() => createTable(signal<Row[]>(rows), { trackBy: 'id', columns: makeColumns() }, withOptimistic()))`
   — keep the helper so the store type is inferred once.

2. **Mechanical rewrite** of every case; zero `withOptimistic<`/`withRowEdit<` afterwards.
   `captureEdit<Row>(…)` and friends keep their updater type argument — that is the updater
   API, not the feature contract (they are called on `store.editing.update`, whose `Row` is
   already fixed; drop the argument only if inference makes it redundant).

3. **Both orders throw:** replace the single "withOptimistic + withRowEdit composed together
   throws" case with two — `withOptimistic(), withRowEdit()` and `withRowEdit(), withOptimistic()`
   — both `toThrow(/both provide the "editing" store member/)`; the message names
   `feature 1 (withOptimistic)` / `feature 2 (withRowEdit)` in the first order (labels from #36's
   `displayName`) — assert the member name, and the labels in one of the two.

4. **Derive-only block:**
   `withOptimistic(withComputed((s) => ({ inFlight: computed(() => s.pending().size) })))` —
   runtime: 0 → `captureEdit('r1')` → 1 → `releaseEdit('r1')` → 0; types:
   `expectTypeOf(store.inFlight).toEqualTypeOf<Signal<number>>()`, in the block
   `expectTypeOf(s.editing).toEqualTypeOf<Signal<ReadonlySet<RowId>>>()`.

5. **Types describe:** `withOptimistic()` alone → `keyof` exactly
   `keyof TableStore<Row> | keyof OptimisticMembers<Row>`; `not.toBeAny()`;
   `expectTypeOf(store.editing).toEqualTypeOf<WritableView<ReadonlySet<RowId>, EditingUpdater<Row>>>()`.

6. **ADR-0006 prune** through both write paths: existing `data.update(filter)` case stays; add
   `store.value.update(removeRow('r1'))` + `TestBed.tick()` → `pending()` no longer has `r1`.

## Implementation Notes

- `patchRow`/`captureEdit`/`releaseEdit`/`revertEdit` imports unchanged; add `removeRow`.
- `trackBy: 'id' as const` in the old cases was needed by the thunk's inference; with the
  positional config object the literal is checked against `TrackByConfig<Row>` directly —
  drop `as const`.

## Risks / Watchouts

- Do not assert on the editing store's internal `state()`; observable members only.

## Non-Goals

- Row-edit-specific behaviour (Step 5).

## Acceptance Checks

- [ ] `grep -c "withOptimistic<\|withRowEdit<"` → 0; no array-form imports.
- [ ] Both composition orders throw the ADR-0007 message.
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` clean for this file.
- [ ] Runtime green (`vitest run …/with-optimistic.spec.ts`) — the user runs it.

---
← [Step 3: with-row-edit.ts](step-3-with-row-edit.plan.md) | [Step 5: with-row-edit.spec.ts + optimistic-mutations.spec.ts](step-5-with-row-edit-spec.plan.md) →
