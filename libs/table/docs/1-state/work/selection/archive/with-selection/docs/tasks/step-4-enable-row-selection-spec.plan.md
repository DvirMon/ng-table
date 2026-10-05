---
title: 'Step 4 — enableRowSelection() spec coverage'
type: task-step
issue: 63
---

# Step 4 — `enableRowSelection()` spec coverage

**PR scope:** Depends on Step 3 (tests the gate it adds).

**Task type:** test

**Skills used:** unit-test, angular-developer

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/features/with-selection.spec.ts` (edit — add cases, don't create a
  new file; `withSelection` already has a colocated spec from Step 2)

## Why This Step Exists

The issue's acceptance criteria name six concrete cases for the gate. This step is their
executable form, added to the existing `describe('withSelection', ...)` block.

## Depends on

Step 3 — needs `enableRowSelection` to exist on `WithSelectionConfig`.

## What To Do

Add the following `it()` blocks, reusing `makeStore`/`mockRows`/`mockTrackBy`/`withNgDevMode`
already defined in the file:

1. **Blocked `toggle`.** `enableRowSelection: (row) => row.id !== 1`; `store.toggle(1)` → no-op,
   `selectedRows()` stays empty.
2. **Blocked `select` with a mixed id array.** Same predicate; `store.select([1, 2])` → only `2`
   lands in `selectedRows()`.
3. **Ungated `deselect` of a row that became non-selectable after being selected.** Use a
   mutable predicate closure so the row is selectable at select-time and not at deselect-time:

   ```ts
   const selectableIds = new Set([1, 2, 3]);
   const store = makeStore(
     () => ({
       trackBy: mockTrackBy,
       columns: makeColumns(),
       features: [
         withSelection<MockRow>({ enableRowSelection: (row) => selectableIds.has(row.id) }),
       ],
     }),
     mockRows,
   );

   store.toggle(1);
   expect(store.selectedRows().has(1)).toBe(true);

   selectableIds.delete(1); // row 1 becomes non-selectable while selected

   store.deselect([1]);
   expect(store.selectedRows().has(1)).toBe(false);
   ```

4. **Gated seed.** `initialSelection: [1, 2]` + `enableRowSelection: (row) => row.id !== 1` →
   `selectedRows()` contains only `2` after construction; no emission (D16 still holds).
5. **Unresolvable id stays permissive (D8).** A predicate that blocks every _resolvable_ row —
   `enableRowSelection: () => false` — with `store.toggle(999)` (id absent from `mockRows`) still
   adding `999`. A predicate returning `true` wouldn't distinguish this from "gate disabled," so
   it must be `() => false` to prove the permissive-when-unresolved branch specifically.
6. **No emission on a fully-blocked write.** Subscribe to `selectionChanged` first; with a
   predicate that blocks row `1`, `store.select([1])` → `emissions` stays `[]`. Assert this
   directly — it falls out of `applyNextSelection`'s existing no-op guard, no new code path to
   test.

## Implementation Notes

- These are new cases added to the existing spec file — don't duplicate `makeColumns`/`makeStore`
  or create a second describe block.
- Case 3's mutable predicate closure is scoped to that one test; don't promote it to a shared
  helper.

## Risks / Watchouts

- Don't overwrite or merge into the existing "`initialSelection` seeds silently" test (Step 2) —
  add the gated-seed case alongside it so the ungated path's coverage doesn't regress.
- Case 5 must use a predicate that blocks every resolvable row, not one that allows everything —
  otherwise it doesn't actually exercise the permissive-when-unresolved branch.

## Non-Goals

- No DOM/structural/directive-layer tests — those belong to the UI-layer directive specs.
- No test of internal recompute counts.

## Acceptance Checks

- [ ] All six cases from the issue's acceptance criteria are present and pass locally.
- [ ] Existing coverage (Step 2's tests) is untouched, not merged or overwritten.
- [ ] `nx test shared-table` passes — user runs this, per this repo's "never run tests
      unprompted" convention; report what's worth verifying instead of running it.

---

← [Step 3: enableRowSelection() write-path gate (D58)](step-3-enable-row-selection-gate.plan.md) | [Step 5: 3-spec.md — enableRowSelection() config + scope rules](step-5-spec-doc-update.plan.md) →
