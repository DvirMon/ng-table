---
title: "Step 3 — with-selection.spec.ts + selection.utils.spec.ts: positional form, hiddenSelected headline case, reconciliation"
type: task-step
issue: 73
---

# Step 3 — `with-selection.spec.ts` + `selection.utils.spec.ts`: positional form, `hiddenSelected` headline case, reconciliation

**PR scope:** Two spec files, both red today (array/thunk form, deleted
`TableStoreConfig`/`ComposedFeatureMembers`). `selection.utils.spec.ts` composes
`withFiltering()` (#72 Step 2) and `withSelection()`.

**Task type:** test

**Skills used:** unit-test

**Depends on:** Step 1
**Parallel-safe with:** Step 4
**Cross-issue edge:** `with-selection.spec.ts` composes `withSorting()` and
`selection.utils.spec.ts` composes `withFiltering()` (#72). Their old signatures still satisfy a
slot structurally; if #72 has not landed, keep `withSorting<MockRow>()` / `withFiltering<MockRow>(…)`
with a `// #72 strips the type argument` comment on those calls only.

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/features/with-selection.spec.ts` (edit)
- `libs/shared/table/src/api/features/selection.utils.spec.ts` (edit)

## Why This Step Exists

Issue #73 acceptance: "the `hiddenSelected` example from the spec compiles and evaluates
correctly"; reconciliation still prunes on `data.set(...)` replacement and on
`value.update(removeRow(...))`; `selectAllIds()` and the `enableRowSelection` gate unchanged;
no explicit row type argument.

## What To Do

1. **Helpers.** In both files replace `makeStore<const F …>` and the array-form imports with
   `inContext<T>(build: () => T): T { return TestBed.runInInjectionContext(build); }`; every
   case calls `createTable(signal<MockRow[]>(rows), { trackBy: mockTrackBy, columns: makeColumns() }, withSelection(...), ...)`
   inside it. `withNgDevMode` stays.

2. **Mechanical rewrite** of every existing case; zero `withSelection<` afterwards. Assertions
   untouched — D58 gate, multi-select rule (dev throw / prod truncation), D16 seed, `emitEvent`,
   `selectionStateOf`, `isSelectable`, `selectionChanged` completion.

3. **Headline case (spec, issue):**

   ```ts
   const store = inContext(() =>
     createTable(signal([...mockRows]), { trackBy: mockTrackBy, columns: makeColumns() },
       withSelection(
         { enableMultiRowSelection: (row) => row.id !== 2 },
         withComputed((s) => ({
           hiddenSelected: computed(() => s.selectedRows().size - s.rows().length),
         }))
       )
     )
   );
   ```

   Runtime: with 3 rows and nothing selected `hiddenSelected()` is −3; `select([1])` → −2.
   (The spec's example is a count difference, not a set difference — assert what it computes.)
   Types: `expectTypeOf(store.hiddenSelected).toEqualTypeOf<Signal<number>>()`; inside the
   block `expectTypeOf(s.selectedRows).toEqualTypeOf<Signal<ReadonlySet<RowId>>>()`,
   `expectTypeOf(s.value).toEqualTypeOf<Signal<MockRow[]>>()` (write view projected, no `.update`);
   in the config callback `expectTypeOf(row).toEqualTypeOf<MockRow>()`.

4. **Types describe** (`expectTypeOf`, enforced by `tsc -p tsconfig.spec.json`):
   `withSelection()` alone → `keyof` is exactly `keyof TableStore<MockRow> | keyof SelectionMembers`,
   `not.toBeAny()`; derive-first `withSelection(withComputed(...))` compiles and contributes.

5. **Reconciliation, both write paths** (ADR-0006): the existing "removing a selected row prunes
   its id" case covers `data.update(filter)`; add the sibling through the store's write view:
   `store.value.update(removeRow(1))` then `TestBed.tick()` → id 1 gone from `selectedRows()`,
   no `selectionChanged` emission. Import `removeRow` from `../../mutations/row-mutations`.

6. **`selection.utils.spec.ts`:** rewrite compositions (`withFiltering({ filters }), withSelection()`);
   `selectAllIds(store)` / `{ includeHidden: true }` assertions unchanged.

## Implementation Notes

- `import { expectTypeOf } from 'vitest'`; `computed` from `@angular/core`; `withComputed`
  from `./with-computed`.
- `TestBed.resetTestingModule()` completion case stays.

## Risks / Watchouts

- Do not assert fold internals or registry contents (spec "Testing Decisions").

## Non-Goals

- No new selection semantics; no slice/namespace assertions (ADR-0015 undecided).

## Acceptance Checks

- [ ] `grep -c "withSelection<"` → 0 in both files; no array-form imports remain.
- [ ] `hiddenSelected` case: types and runtime as above.
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` clean for both files.
- [ ] Runtime green (`vitest run` on both files) — the user runs it.

---
← [Step 2: with-expansion.ts](step-2-with-expansion.plan.md) | [Step 4: with-expansion.spec.ts](step-4-with-expansion-spec.plan.md) →
