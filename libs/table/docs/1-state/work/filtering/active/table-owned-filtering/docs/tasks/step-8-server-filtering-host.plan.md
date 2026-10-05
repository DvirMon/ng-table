# Step 8 — Server-filtering host: the filters move into the table

**PR scope:** PR 1 of 1 (`#91`). **Parallel-safe with: Step 7, Step 9, Step 10.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `angular-developer`
**Scaffolding agent:** `angular-implementer`

## Files

| File                                                                                           | Line              | Action                                                             |
| ---------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------ |
| `libs/table/src/stories/filtering/server-filtering/server-filtering.filters.ts`                | `:1-27`           | rewrite — hoisted schema `const`, no `createFilters`/`rowOf`/`as:` |
| `libs/table/src/stories/filtering/server-filtering/server-filtering-story-host.component.ts`   | `:62-138`, `:148` | edit — model into the table, field order, prose                    |
| `libs/table/src/stories/filtering/server-filtering/server-filtering-toolbar.component.ts`      | `:34-36`          | edit — `dirty()` is `@internal`                                    |
| `libs/table/src/stories/filtering/server-filtering/server-filtering-toolbar.component.html`    | —                 | edit — only what the input rename forces                           |
| `libs/table/src/stories/filtering/server-filtering/server-filtering-story-host.component.html` | `:10`             | edit — prose                                                       |
| `libs/table/src/stories/filtering/fixtures/utils.ts`                                           | —                 | read only — `EMPTY_RANGE`, `isRangeCriterion` unchanged            |

## Why This Step Exists

This story is the entire evidentiary basis for the spec. R10 justified standalone filters on one
claim: _in server mode filters produce the data, so a table-owned filter object cannot be
constructed at all_. The spec calls that claim false and points at this host. Until the host
actually builds its filters **through the table**, the refutation is asserted rather than shown.

The issue body describes a `signal([]) + effect + untracked + load()` loop to unwind. **That loop is
already gone** — the host reads `rxResource` with `params: () => ({ query: toQueryParams(...) })`
and a `linkedSignal` pair. What remains is the ownership move, which is smaller than the issue
implies but is the part that carries the argument.

Second thing only this step can settle: the toolbar reads `filters().amount().dirty()` to render the
late-default race. `dirty()` is `@internal` as of `#90` Step 4. The issue is explicit — the
indicator reads from what the story can still observe, or the step says plainly that nothing can.
Something can, and it is in this host already.

## What To Do

1. **`server-filtering.filters.ts` — hoisted `const`, `as:` keys become object keys.**

   ```ts
   export const serverInvoiceFilters = (path: FiltersPath<InvoiceRow>) => ({
     status: filter(path.status, matchesStatus, { emptyValue: '' }),
     search: contains(path.customer),
     amount: inRange(path.amount, { source: () => serverDefaultAmount() }),
     excludedTags: hasNone(path.tags),
   });
   ```

   `{ as: 'search' }` and `{ as: 'excludedTags' }` are deleted outright — the written property name
   _is_ the key now (R51). `toQueryParams` reads `active['search']` and `active['excludedTags']`
   already, so the request shape does not change. Confirm that by eye; a silently renamed key would
   drop a query param with no type error, since `toQueryParams` takes
   `Partial<Record<string, unknown>>`.

2. **`serverDefaultAmount` moves to module scope**, same trade as Step 7's story control: a hoisted
   schema takes only `path`, and this signal is the late arrival the story exists to demonstrate.
   Export it so the host's `deliverServerDefault()` can `set()` it, and keep `EMPTY_RANGE` as its
   initial value.

3. **`rowOf<InvoiceRow>()` and its JSDoc paragraph go.** The file's doc comment currently explains
   _why_ a carrier is needed. That explanation is now the opposite of the truth: `TRow` is
   `RowOf<In>`, supplied by the table. Replace it with one line naming what the table supplies.

4. **Host — the ownership move.** Declaration order matters and is the whole risk:

   ```ts
   protected readonly table = createTable(
     () => this.lastPage().rows,
     serverInvoiceConfig,
     withFiltering({ manual: true, schema: serverInvoiceFilters }),
     createTableFeature((_store: Pick<TableStore<InvoiceRow>, 'rows'>) => ({
       members: { totalRowCount: this.serverTotal },
     })),
   );

   protected readonly invoices = rxResource({
     params: () => ({
       query: toQueryParams(this.table.filters().criteria()),
       options: { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() },
     }),
     stream: ({ params }) => { … },
   });
   ```

   `table` first, `invoices` second, `lastPage` third. The rows thunk is read lazily inside a
   `computed()` (`api/create-table.ts:52-59`), so a field declared later is fine — **this is the
   no-construction-cycle proof and it should be stated in a comment on that thunk**, not left for a
   reader to rediscover.

5. **`rows` and `serverTotal`.** `rows` is currently a `linkedSignal` feeding `createTable`; with the
   thunk reading `lastPage()` directly it has no job left. Delete it unless the template reads it.
   `serverTotal` stays — the `createTableFeature` override is one of the story's stated points.

6. **`manual: true` is load-bearing.** Without it the client-side `filter` stage would narrow the
   already-narrowed server page a second time. The old host composed no filtering feature at all;
   `manual` is what replaces that.

7. **The race indicator.** Host computes it and passes it down:

   ```ts
   /** The late-default race, made visible without `dirty()` (internal since #90): the typed
    * criterion no longer follows the declared source, so an arriving default loses. */
   protected readonly amountIgnoresServerDefault = computed(() => {
     const typed = this.table.filters.amount().value();
     const declared = serverDefaultAmount();
     return typed.min !== declared.min || typed.max !== declared.max;
   });
   ```

   Toolbar's `isAmountDirty` becomes an `input.required<boolean>()` under a name that says what it
   means rather than restating the deleted member — `amountIgnoresServerDefault`. Update the
   template binding and the JSDoc.

8. **Prose.** Three places claim "no filtering feature is composed" and "`createFilters()` feeds the
   request": the class JSDoc (`:62-69`), `toQueryParams`' JSDoc (`:24-28`) and the template's
   intro line (`:10`). All three become: the table owns the model, `manual: true` skips the local
   stage, and `criteria()` drives the request.

## Implementation Notes

- `filters` is `Filters<TRow, TState>` — callable _and_ indexable. `this.table.filters()` is the
  root; `this.table.filters.amount()` is the node. The toolbar's existing
  `this.filters().amount()` is correct because `this.filters` there is an `input`, so `()` unwraps
  the signal. Passing `[filters]="table.filters"` keeps every toolbar call site working unchanged.
- The toolbar's `ServerCriteria` import must follow the schema file:
  `type ServerCriteria = StateOf<ReturnType<typeof serverInvoiceFilters>>`, `StateOf` from
  `../../../filters/types`.
- Debounce stays exactly where it is — `form(this.table.filters().value, (path) => debounce(path.search, 300))`.
  R25 keeps debouncing in the Signal Form, and `searchForm` moves after `table` with everything else.

## Risks / Watchouts

- **The one real ordering trap in this issue.** `table`'s rows thunk closes over `lastPage`, which
  closes over `invoices`, whose params close over `table`. That is a cycle in the _reference_ graph
  and not in the _evaluation_ graph, and it only stays safe because the thunk is lazy. If the
  implementer is tempted to pass `this.rows` (an eagerly-constructed `linkedSignal`) instead of a
  thunk, the cycle becomes real. Pass the thunk.
- `filters` was declared before the first fetch for a reason the old code stated. That reason is
  gone but the _behaviour_ must not change: the story still has to render with an empty first page
  and issue its first request from empty criteria.
- **Request count.** The story counts requests to make the debounce visible. Moving the model must
  not add a request on construction. If `criteria()` is read once more than before, `requestCount`
  starts at 2 and the acceptance check below catches it.

## Non-Goals

- `filtering.mdx`'s server section — Step 11.
- Making `dirty()` public again. The issue rules it out explicitly.
- Any change to `toQueryParams`' hand-written mapping. It is the story's point that no serializer
  ships; only its JSDoc's first sentence changes.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` reports no error originating under
      `src/stories/filtering/server-filtering/`. Run twice — the first run aborts before the
      template phase if any `.ts` error remains, and both toolbar and host templates are in scope.
- [ ] `serverInvoiceFilters` is a `const` annotated `(path: FiltersPath<InvoiceRow>)`.
- [ ] No `createFilters`, `rowOf`, `as:` or `.dirty()` under `src/stories/filtering/server-filtering/`.
- [ ] `createTable` receives a **thunk** for rows, and `table` is declared before `invoices`.
- [ ] `withFiltering({ manual: true, schema: … })` — `manual` present, or the page is filtered twice.
- [ ] Story issues one request per criterion change, debounce intact: typing in the search box
      produces one increment of `requestCount` per pause, not per keystroke, and the count is 1
      after first load.
- [ ] "Deliver server default now" still visibly loses to an already-typed amount, and still wins
      when the amount is untouched.

---

← [Step 7: Client-filtering host](step-7-client-filtering-host.plan.md) | [Step 9: Remaining call sites](step-9-remaining-call-sites.plan.md) →
