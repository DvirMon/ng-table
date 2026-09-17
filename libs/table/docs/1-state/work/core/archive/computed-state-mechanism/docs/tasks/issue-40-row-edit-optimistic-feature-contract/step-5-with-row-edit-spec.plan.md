---
title: "Step 5 — with-row-edit.spec.ts + optimistic-mutations.spec.ts composed cases: positional form, trailing block, ADR-0006 prune"
type: task-step
issue: 74
---

# Step 5 — `with-row-edit.spec.ts` + `optimistic-mutations.spec.ts` composed cases: positional form, trailing block, ADR-0006 prune

**PR scope:** Two spec files. `with-row-edit.spec.ts` fully; in `optimistic-mutations.spec.ts`
only the `createTable(...)` compositions (the "composed with withRowEdit (real store…)" describe
and the "delete → revert keeps unconfirmed" case) — its pure-updater cases do not touch the
feature contract. `row-edit-mutations.spec.ts` builds no store and is untouched.

**Task type:** test

**Skills used:** unit-test

**Depends on:** Step 3
**Parallel-safe with:** Step 4

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/features/with-row-edit.spec.ts` (edit)
- `libs/shared/table/src/mutations/optimistic-mutations.spec.ts` (edit — composition sites only)

## Why This Step Exists

Issue #40 acceptance: "Each feature's spec and the mutation specs pass with the positional form
and contain no explicit row type argument"; open edits pruned when rows leave `data`
(ADR-0006); trailing block on the return type; `{ multiple }` behaviour unchanged.

## What To Do

1. **Helpers.** Replace `makeStore` with `inContext(build)`; every case calls
   `createTable(signal<Row[]>(rows), { trackBy: 'id', columns: makeColumns() }, withRowEdit(...))`.
   Zero `withRowEdit<` afterwards in both files.

2. **Mechanical rewrite** of every case: single-mode trim, `multiple: true`, live `multiple`
   flip (`signal`-backed), `beginEdit`/`endEdit`/`createRow`, `draft` behaviour, `unconfirmed`
   retry (D54/R1). Assertions unchanged.

3. **Trailing block:**
   `withRowEdit({ multiple: true }, withComputed((s) => ({ openCount: computed(() => s.editing().size) })))`
   — runtime: 0 → `beginEdit('r1')` → 1 → `beginEdit('r2')` → 2 → `clearEdit()` → 0; types:
   `expectTypeOf(store.openCount).toEqualTypeOf<Signal<number>>()`, in the block
   `expectTypeOf(s.draft).toEqualTypeOf<WritableSignal<Row[]>>()` (a `WritableSignal` is not a
   `WritableView` — the projection leaves it alone; assert that, it is the documented edge of D28).

4. **Types describe:** `withRowEdit()` alone → `keyof` exactly
   `keyof TableStore<Row> | keyof RowEditMembers<Row>`; `not.toBeAny()`;
   `expectTypeOf(store.draft).toEqualTypeOf<WritableSignal<Row[]>>()`.

5. **ADR-0006, second write path:** existing cases prune via `data.update(...)`; add
   `beginEdit('r1')` → `store.value.update(removeRow('r1'))` → `TestBed.tick()` → `editing()`
   empty, `draft()` has no `r1`.

6. **`optimistic-mutations.spec.ts`:** rewrite the two `createTable` sites to
   `createTable(signal<Person[]>([...rows]), { trackBy: 'id', columns: makeColumns() }, withRowEdit())`;
   drop `as const`; assertions (the patchRow-then-swapRowId ordering invariant, the R1 prune
   exemption) unchanged.

## Implementation Notes

- Updater type arguments (`createRow<Row>(...)`, `removeEdit<Row>(...)`) are the updater API,
  not the feature contract — keep them unless inference makes them redundant.
- `import { expectTypeOf } from 'vitest'`; `removeRow` from `../../mutations/row-mutations`.

## Risks / Watchouts

- The live-`multiple` flip case relies on `setup`'s `effect` — run `TestBed.tick()` after
  flipping, as today.

## Non-Goals

- No new row-edit semantics (G13/O26 stays open).

## Acceptance Checks

- [ ] `grep -c "withRowEdit<"` → 0 in both files; no array-form imports.
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` clean for both files.
- [ ] Runtime green (`vitest run` on both files) — the user runs it.

---
← [Step 4: with-optimistic.spec.ts](step-4-with-optimistic-spec.plan.md) | [Step 6: finding — order the two features vs keep the shared store](step-6-shared-store-finding.plan.md) →
