# Step 4 — The server filtering host — the `rowOf()` reference

**PR scope:** PR 2 of 2 (`#77`). **Parallel-safe with: Steps 1, 2, 3, 5, 6, 7, 8.** **Blocks Step 9.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `angular-developer`, `typescript-conventions`
**Scaffolding agent:** `angular-implementer`

## Files

| File                                                                                                | Action                                                         |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `libs/shared/table/src/stories/filtering/server-filtering/server-filtering-story-host.component.ts` | edit — array schema, `rowOf<InvoiceRow>()`, inline form schema |
| `libs/shared/table/src/stories/filtering/fixtures/schema.ts`                                        | edit — delete `serverFilterFormSchema`                         |
| `libs/shared/table/src/stories/filtering/fixtures/types.ts`                                         | edit — delete `ServerInvoiceFilterState`                       |

The only site where `rowOf()` is the right answer rather than a fallback, which makes it the
reference example a reader is sent to. Treat the call and its comment as the deliverable, not as a
line to get compiling.

Steps 2, 3 and 4 each delete a **different** alias from `filtering/fixtures/types.ts`. No hard edge
between them, but they touch one file — sequence them if they run as separate commits.

## Why This Step Exists

`rowOf<TRow>()` shipped in `#76` and is exported from the filters barrel, but nothing calls it.
A token whose only documentation is its own doc comment is a token nobody finds.

Server mode is the case it exists for: filters are declared before any row has been fetched, so
there is no data to infer from. This host holds `rows = signal<InvoiceRow[]>([])` — an _empty_
array at construction. Passing it would be worse than wrong: an empty untyped array is exactly the
shape `#76`'s guard rejects, and here it would look like data.

`serverFilterFormSchema` is the second half of the step. It is a Signal Forms schema over the
criterion model, so it names the criterion map in a position nothing infers — the model only
becomes concrete at the `form(this.filters().value, …)` call inside the host.

## What To Do

1. Rewrite the declaration:

   ```ts
   protected readonly filters = createFilters(rowOf<InvoiceRow>(), (path) => [
     equals(path.status, { emptyValue: '' }),
     contains(path.customer, { as: 'search' }),
     inRange(path.amount, { source: () => this.serverDefaultAmount() }),
     hasNone(path.tags, { as: 'excludedTags' }),
   ]);
   ```

   > **Superseded 2026-09-16 by [#82](https://github.com/DvirMon/ng-table/issues/82):** the
   > status line is now `filter(path.status, matchesStatus, { emptyValue: '' })`. `emptyValue`
   > became additive, so an `equals` criterion always carries the rule's own `null` — and a
   > native `<select>` control value is a `string`. `filter()` with an explicit `string`
   > criterion is what keeps `[formField]` binding with no accessor.

2. **Import `rowOf` from `../../../filters/row-of`**, matching how the neighbouring imports reach
   `create-filters` and `rules` directly rather than through the barrel.
3. **Write the comment this site exists to carry.** One or two lines, terse: the filters are
   declared before any row has been fetched, so there is no data to anchor the row type — `rowOf()`
   supplies it and is never read. This is the sentence a reader arrives at from
   `docs/1-state/filters.md`; `#79` will link to it.
4. **Move the debounce into the host.** Delete `serverFilterFormSchema` from
   `filtering/fixtures/schema.ts` (and its now-unused `debounce`/`schema` imports and the
   `ServerInvoiceFilterState` import), then:

   ```ts
   protected readonly searchForm = form(this.filters().value, (path) => {
     debounce(path.search, 300);
   });
   ```

   The JSDoc currently above `serverFilterFormSchema` explains why only this story debounces —
   a keystroke costs a request here and nowhere else. Move it, do not drop it.

5. Delete `ServerInvoiceFilterState` from `filtering/fixtures/types.ts`, and the `customer` /
   `as: 'search'` comment above it — the rename is now visible in the schema itself.

## Implementation Notes

- `serverInvoiceConfig` stays in `fixtures/schema.ts`. Only the form schema leaves.
- `toQueryParams(active: Partial<Record<string, unknown>>)` is deliberately untyped against the
  criterion map — it models a hand-written serializer and reads every key through a guard. Leave
  its signature alone.
- The keys `status`, `search`, `amount`, `excludedTags` are unchanged, so the template's
  `[formField]="searchForm.search"` and every `filters.<key>()` read keep working.
- `this.rows` remains the `createTable()` data source. Only the _filters_ carrier becomes `rowOf()`.

## Risks / Watchouts

- **`form()`'s second parameter.** Confirm it accepts a schema _callback_ and not only a
  `schema()`-wrapped value in the installed `@angular/forms/signals`. If it does not, keep
  `schema<…>()` and derive its type argument from the filters instance rather than reinstating a
  hand-written alias — and say so in the step's report.
- **A template-only break.** `server-filtering-story-host.component.html` binds `searchForm` fields
  by name. `ngc` reaches the template phase only on a source-clean run, so a rename here surfaces
  in Step 9, not now. Do not rename a form field.
- The late-default race (`source: () => this.serverDefaultAmount()`) is the story's headline
  behaviour and depends on `dirty()`. The `source` option moves verbatim into the array form; check
  it did not lose its closure.

## Non-Goals

- Any other story host — Steps 1, 2, 3, 5.
- Any spec file — Steps 6–8.
- Documenting `rowOf()` in `docs/1-state/filters.md` — `#79`.

## Acceptance Checks

- [ ] `createFilters(rowOf<InvoiceRow>(), …)` — no type argument on `createFilters` itself
- [ ] A terse comment at the call says why there is no data to infer from
- [ ] `serverFilterFormSchema` no longer exists in `filtering/fixtures/schema.ts`, and the debounce
      rationale moved with the code
- [ ] `debounce(path.search, 300)` still runs — one request per typing pause, not per keystroke
- [ ] `ServerInvoiceFilterState` is gone; grep finds no reference in `src/`
- [ ] `nx run shared-table:typecheck` reports no error in the three files this step touched

---

← [Step 3: The selection filtering host](step-3-selection-filtering-host.plan.md) | [Step 5: The grouping fixtures](step-5-grouping-fixtures.plan.md) →
