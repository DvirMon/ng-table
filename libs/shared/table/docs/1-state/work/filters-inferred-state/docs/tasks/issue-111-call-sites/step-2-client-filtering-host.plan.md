# Step 2 — The client filtering host

**PR scope:** PR 2 of 2 (`#111`). **Parallel-safe with: Steps 1, 3, 4, 5, 6, 7, 8.** **Blocks Step 9.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `angular-developer`, `typescript-conventions`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Action |
|---|---|
| `libs/shared/table/src/stories/filtering/client-filtering/client-filtering-story-host.component.ts` | edit — array schema, row carrier, `anyOf` group, `keepValidCriteria`, prose |
| `libs/shared/table/src/stories/filtering/fixtures/types.ts` | edit — delete `ClientInvoiceFilterState` |
| `libs/shared/table/src/stories/filtering/fixtures/mock.ts` | edit — one sentence of prose |

The widest of the five: six filters, an `anyOf` group, a custom `filter()` closing over host state,
and a guard function that names the criterion map in a position nothing infers.

Steps 2, 3 and 4 each delete a **different** alias from `filtering/fixtures/types.ts`. No hard edge
between them, but they touch one file — sequence them if they run as separate commits.

## Why This Step Exists

This host is the filtering showcase. It declares the previous signature, and it is also the one
site where deleting the alias is not purely mechanical: `keepValidCriteria()` returns
`Partial<ClientInvoiceFilterState>`, a position with nothing to infer from.

Its class doc also states `createFilters()` takes no data argument. That is now false, and it is
the sentence a reader consults when asking why the option lists are hand-supplied.

## What To Do

1. **Reorder, then rewrite the declaration.** `data` currently sits ~30 lines below `filters`; move
   it above, then:

   ```ts
   protected readonly data = signal<InvoiceRow[]>(INVOICE_ROWS_MOCK);

   protected readonly filters = createFilters(this.data, (path) => [
     equals(path.status, { emptyValue: '' }),
     contains(path.customer),
     inRange(path.amount, { source: () => DEFAULT_AMOUNT_RANGE }),
     inDateRange(path.issuedAt),
     filter(
       path.tags,
       (cell: string[], criterion: TagCriterion): boolean => {
         if (this.tagsPredicateIsBroken()) {
           throw new Error('The tags predicate is broken (story control).');
         }
         return matchesTagCriterion(cell, criterion);
       },
       { isEmpty: isEmptyTagCriterion, emptyValue: EMPTY_TAG_CRITERION },
     ),
     anyOf('search', [contains(path.note), filter(path.id, matchesInvoiceNumber)]),
   ]);
   ```

2. **`anyOf` loses both its type argument and its callback.** The children come from the same
   `path`, not a second `searchPath` handle. Keep the comment above it about declared-not-scanned
   paths; it is still true and still the reason the group exists.
3. **`keepValidCriteria` names nothing.** Build the result by spread so its type infers, and drop
   the `Partial<ClientInvoiceFilterState>` annotations on both the return and the local:

   ```ts
   function keepValidCriteria(saved: Record<string, unknown>) {
     return {
       ...(isInvoiceStatus(saved['status']) ? { status: saved['status'] } : {}),
       ...(typeof saved['customer'] === 'string' ? { customer: saved['customer'] } : {}),
       ...(isRangeCriterion(saved['amount']) ? { amount: saved['amount'] } : {}),
       ...(isDateRangeCriterion(saved['issuedAt']) ? { issuedAt: saved['issuedAt'] } : {}),
       ...(isTagCriterion(saved['tags']) ? { tags: saved['tags'] } : {}),
       ...(typeof saved['search'] === 'string' ? { search: saved['search'] } : {}),
     };
   }
   ```

   Its doc comment's point — a partial load is still a complete state, because omitted keys reset
   to their declared default — survives unchanged. Only the sentence explaining the `Partial<…>`
   *annotation* goes.
4. **`loadSavedFilterRaw`.** `STALE_SAVED_FILTER as Partial<ClientInvoiceFilterState>` becomes
   `as never` — or whatever the narrowest escape is that still compiles against the inferred
   `reset()` parameter. **The escape must stay visible**: the story's stated finding is that an
   unvalidated snapshot cannot be written without stepping outside the type. Rewrite the JSDoc to
   name the inferred map rather than the deleted alias; do not delete the assertion and do not
   hide it behind a helper.
5. **Prose.** Two sentences claim `createFilters()` takes no data argument — one in this class's
   doc block (the option-lists paragraph), one above `STATUS_OPTIONS` in `fixtures/mock.ts`. The
   fact they defend is still true and still worth stating: option lists are hand-supplied, not
   derived from the rows. Rewrite them to say that the carrier is an inference anchor the library
   never reads, so distinct values are still never derived from it.
6. Delete `ClientInvoiceFilterState` from `filtering/fixtures/types.ts`. Keep `RangeCriterion`,
   `DateRangeCriterion` and `TagCriterion` — the custom `filter()` still annotates its predicate
   with `TagCriterion`, and that annotation is now the *only* thing typing the `tags` criterion.

## Implementation Notes

- `CLIENT_FILTER_KEYS` and `ClientFilterKey` stay. `this.filters[key]()` indexes the inferred map by
  a literal-union key exactly as it indexed the alias, so the summary row and its × buttons need no
  change.
- The `anyOf` group is homogeneous: `contains` yields `string`, and `matchesInvoiceNumber(cell:
  number, criterion: string)` yields `string` from its own annotation. `#110`'s homogeneity check
  is against `CriterionOf<C[0]>`, so a child whose criterion drifts from the first child's is a
  compile error — expected, not a bug to route around.
- `path.note` is `string | null` and `path.id` is `number`; both are cell types, not criterion
  types, and neither participates in the group's homogeneity check.
- The template is unaffected — every key (`status`, `customer`, `amount`, `issuedAt`, `tags`,
  `search`) is what the schema already produced.

## Risks / Watchouts

- **`filter()`'s two inference sites.** The criterion is typed by the predicate's annotation *and*
  by `options.isEmpty`. Here they are `TagCriterion` and `isEmptyTagCriterion`. If they disagree the
  result is an error, not a silent widening — but check it compiles rather than assuming.
- **Deleting the alias silently weakens `keepValidCriteria`.** The spread form only produces the
  right type because every branch is behind a real type guard. If a guard is dropped or replaced
  with a `typeof x === 'object'`, the inferred member widens and `reset()` still accepts it. Keep
  all six guards.
- **Field reorder is not cosmetic here** — `withFiltering({ predicates: () => [this.filters().matcher()] })`
  is passed to `createTable(this.data, …)` below, so both fields are read in initializer position.

## Non-Goals

- Any other story host — Steps 1, 3, 4, 5.
- Any spec file — Steps 6–8.
- Changing what the story renders or which controls it offers. A visible difference means the
  rewrite is wrong.

## Acceptance Checks

- [ ] `createFilters` names no type argument and passes `this.data`
- [ ] `this.data` is declared before `this.filters`
- [ ] `anyOf('search', [...])` takes an array, no type argument, no callback
- [ ] `keepValidCriteria` carries no type annotation naming a criterion map, and all six guards
      remain
- [ ] `ClientInvoiceFilterState` is gone; grep finds no reference in `src/`
- [ ] The "takes no data argument" claim is gone from both the class doc and `fixtures/mock.ts`
- [ ] `RangeCriterion`, `DateRangeCriterion`, `TagCriterion` still exist and are still imported
- [ ] `nx run shared-table:typecheck` reports no error in the three files this step touched

---
← [Step 1: Composition: the derived-state story host](step-1-composition-derived-state.plan.md) | [Step 3: The selection filtering host](step-3-selection-filtering-host.plan.md) →
