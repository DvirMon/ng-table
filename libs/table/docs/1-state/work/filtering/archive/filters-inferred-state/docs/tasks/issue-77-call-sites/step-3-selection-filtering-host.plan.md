# Step 3 — The selection filtering host

**PR scope:** PR 2 of 2 (`#77`). **Parallel-safe with: Steps 1, 2, 4, 5, 6, 7, 8.** **Blocks Step 9.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `angular-developer`, `typescript-conventions`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Action |
|---|---|
| `libs/shared/table/src/stories/filtering/selection-filtering/selection-filtering-story-host.component.ts` | edit — array schema, row carrier |
| `libs/shared/table/src/stories/filtering/fixtures/types.ts` | edit — delete `SelectionInvoiceFilterState` |

Three filters, no group, no gate, no guard function. The purely mechanical one of the five.

Steps 2, 3 and 4 each delete a **different** alias from `filtering/fixtures/types.ts`. No hard edge
between them, but they touch one file — sequence them if they run as separate commits.

## Why This Step Exists

The story is about selection surviving a filter, not about filtering. Its filter set exists only to
move rows in and out of view. It still declares the previous signature, so it does not compile.

## What To Do

1. Rewrite the declaration in place — `data` is already declared above `filters`, so no reorder:

   ```ts
   protected readonly filters = createFilters(this.data, (path) => [
     equals(path.status, { emptyValue: '' }),
     contains(path.customer),
     hasAny(path.tags),
   ]);
   ```

   > **Superseded 2026-09-16 by [#82](https://github.com/DvirMon/ng-table/issues/82):** the
   > status line is now `filter(path.status, matchesStatus, { emptyValue: '' })`. `emptyValue`
   > became additive, so an `equals` criterion always carries the rule's own `null` — and a
   > native `<select>` control value is a `string`. `filter()` with an explicit `string`
   > criterion is what keeps `[formField]` binding with no accessor.

2. Drop the `SelectionInvoiceFilterState` import; keep `InvoiceRow`.
3. Delete `SelectionInvoiceFilterState` from `filtering/fixtures/types.ts`.
4. The comment above the declaration ("The subset this story filters by …") describes *why* the set
   is small, not the signature. Leave it.

## Implementation Notes

- Keys `status`, `customer`, `tags` are all borrowed from their paths, so `isStatusActive`,
  `isCustomerActive`, `isTagsActive`, `filterForm` and the template all keep working untouched.
- `form(this.filters().value)` takes no schema here — nothing to move, unlike Step 4.
- `hasAny(path.tags)` yields `readonly unknown[]`, not `readonly string[]` as the deleted alias
  claimed. That is the schema's own answer and it is the correct one; if a template or a host
  member turns out to depend on the narrower type, that is a finding — record it, do not restore
  the alias to paper over it.

## Risks / Watchouts

- The `hasAny` criterion widening above is the one place this step can produce a real error rather
  than a clean compile. The tag controls write through `toggleOption(…)`; check that call still
  typechecks before concluding the step is done.
- The class doc block is long and is about selection semantics, retention and denominators. None of
  it describes the filters signature. Resist rewriting it.

## Non-Goals

- Any other story host — Steps 1, 2, 4, 5.
- Any spec file — Steps 6–8.
- Broadening the story's filter set. Three filters is deliberate.

## Acceptance Checks

- [ ] `createFilters` names no type argument and passes `this.data`
- [ ] The schema returns an array of three rules
- [ ] `SelectionInvoiceFilterState` is gone; grep finds no reference in `src/`
- [ ] The tag multi-select still typechecks against the `hasAny` criterion
- [ ] `nx run shared-table:typecheck` reports no error in either file this step touched

---
← [Step 2: The client filtering host](step-2-client-filtering-host.plan.md) | [Step 4: The server filtering host — the `rowOf()` reference](step-4-server-filtering-host.plan.md) →
