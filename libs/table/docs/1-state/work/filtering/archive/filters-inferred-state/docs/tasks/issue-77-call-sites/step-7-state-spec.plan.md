# Step 7 — `state.spec.ts`

**PR scope:** PR 2 of 2 (`#77`). **Parallel-safe with: Steps 1, 2, 3, 4, 5, 6, 8.** **Blocks Step 9.**
**Task type:** `test`
**Stack:** angular
**Skills used:** `unit-test`, `typescript-conventions`
**Scaffolding agent:** `test-implementer`

## Files

| File                                          | Action                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `libs/shared/table/src/filters/state.spec.ts` | edit — `build` helper, two type-naming sites, delete `InvoiceFilterState` |

198 lines, one schema. Small, but it is the file `architecture.md` marks "check only" — which is
wrong, and this step is where that is corrected.

## Why This Step Exists

`architecture.md`'s file-layout table reads _"`src/filters/state.spec.ts`, `matchers.spec.ts` |
check only — neither imports the recorder today"_. True about the recorder, and beside the point:
this file calls `createFilters<Invoice, InvoiceFilterState>(schema)` at line 30 and names
`InvoiceFilterState` twice more. It does not compile.

The two extra sites are the interesting part. Both name the criterion map where nothing infers it:

- line 110 — `const readonlyRoot: Signal<InvoiceFilterState> = filters().value.asReadonly()`
- line 226 — `schema<InvoiceFilterState>(() => { … })`, fed to `form()`

Per the ticket's resolution, both derive locally rather than keeping the alias.

## What To Do

1. Rewrite the helper:

   ```ts
   function build<S extends readonly unknown[]>(schema: (path: FiltersPath<Invoice>) => S) {
     return TestBed.runInInjectionContext(() => createFilters(rowOf<Invoice>(), schema));
   }

   function buildInvoiceFilters(source?: () => RangeCriterion) {
     return build((path) => [
       equals(path.status),
       inRange(path.amount, source ? { source } : undefined),
       contains(path.customer),
     ]);
   }
   ```

2. **Line 110 — drop the annotation.** The assertion is that `asReadonly()` tracks the same state
   and exposes no `set`; the annotation was never what proved it:

   ```ts
   const readonlyRoot = filters().value.asReadonly();
   ```

3. **Line 226 — inline the schema callback.** The test's stated claim is that the criterion model
   is schema-compatible at all, which the callback form asserts identically:

   ```ts
   const filterForm = TestBed.runInInjectionContext(() =>
     form(filters().value, () => {
       // Intentionally empty: the assertion is that the model is schema-compatible at all.
     }),
   );
   ```

   Drop the `schema` import if nothing else uses it.

4. Delete `InvoiceFilterState`. **Keep `RangeCriterion`** — `buildInvoiceFilters`' `source`
   parameter and `EMPTY_RANGE` both use it, and its comment ("`inRange`'s criterion shape is not
   exported, so a consumer typing `TState` restates it") needs rewording: a consumer no longer
   types `TState`, but the shape is still unexported and a _test_ still restates it to build a
   source value.

## Implementation Notes

- Every assertion in this file is about the root being a writable view over the nodes — read
  composition, `set`/`update` fan-out, source reconciliation, form binding. None depends on how
  `TState` was supplied. All of them stay byte-identical.
- `equalsCriterion` (~238) imports from `./state` directly and touches no schema. Untouched.
- `matchers.spec.ts` genuinely is check-only — it never calls `createFilters`. Confirm, do not edit.

## Risks / Watchouts

- **`form()`'s second parameter.** Same open point as Step 4: confirm the installed
  `@angular/forms/signals` accepts a bare callback there. If it does not, keep `schema<…>()` and
  derive its type argument from `buildInvoiceFilters`' inferred return rather than reinstating a
  hand-written alias — and report it, because Step 4 depends on the same answer.
- Line 110's test asserts `expect('set' in readonlyRoot).toBe(false)`. Dropping the annotation does
  not weaken it — the check is runtime. Do not replace the annotation with a cast to compensate.

## Non-Goals

- `create-filters.spec.ts` (Step 6), `with-filtering.spec.ts` (Step 8).
- `matchers.spec.ts` — nothing to change.
- Adding type-level assertions here; `#78` owns the type seam.

## Acceptance Checks

- [ ] `build` passes `rowOf<Invoice>()`; no call names a type argument
- [ ] `buildInvoiceFilters` returns an array of three rules
- [ ] `InvoiceFilterState` is gone; `RangeCriterion` survives with corrected prose
- [ ] Neither `Signal<…>` nor `schema<…>` names a criterion map
- [ ] Every assertion is byte-identical to `HEAD`
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` reports no error in this file
- [ ] `nx test shared-table -- state` passes

---

← [Step 6: `create-filters.spec.ts`](step-6-create-filters-spec.plan.md) | [Step 8: `with-filtering.spec.ts`](step-8-with-filtering-spec.plan.md) →
