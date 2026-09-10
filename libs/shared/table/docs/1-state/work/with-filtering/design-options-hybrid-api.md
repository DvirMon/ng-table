---
title: Filtering API — design decisions (createFilters)
type: design
status: grill complete — 26 decisions recorded, ready to spec
date: 2026-09-09
audience: developers
---

# Filtering API — design decisions

**Read [The design, consolidated](#the-design-consolidated) — it is the whole API in one place,
and it is what a spec should be written from.** [Resolved during the grill](#resolved-during-the-grill-2026-09-09)
(R1–R26) holds the rationale behind each line of it. Everything between the two is the history
that produced them: a scenario, four options that were eliminated, and Option E, which R1–R25
then refined and in places corrected.

Started as a follow-on from
[research-filter-state-ownership.md](research-filter-state-ownership.md), whose verdict was:
`query` is consumer-owned (pre-exists the table), `columnFilters` is store-owned (no life outside
it). It pressure-tested that verdict against a table with **five filters of four different
kinds** plus a **server-supplied default arriving after construction**, compared four API shapes —
and ended by overturning the verdict entirely: under R10/R11 there is no table-owned filter slice
at all.

> The proposed API names below (`applyFilter`, `equals()`, `dateRange()`, `createFilters()`, …)
> are **sketches for discussion** and do not exist in `src/`.
>
> **Option A is not hypothetical, though.** `withFiltering()`, `setColumnFilter()`,
> `clearColumnFilter()`, `setGlobalFilter()` and `clearFilters()` all exist and work today in
> `src/api/features/with-filtering.ts` (untracked in the working tree, re-exported from
> `src/index.ts`, wired into the pipeline via `stages: { filter }`). That implementation is the
> superseded shape this document argues against — see R12 for what removing it entails.

---

# The design, consolidated

Everything below this heading up to "The scenario" is the decided API in one place. Each line
carries the decision that produced it; the R-numbers are the rationale, not extra reading.

## Declaration

```ts
readonly filters = createFilters<Invoice>((path) => {
  equals(path.status);                                 // key `status`, reads row.status
  toggle(path.isArchived);
  inRange(path.amount, { source: () => bounds() });    // server-supplied default
  inDateRange(path.dueDate);

  anyOf('search', (path) => {                          // one criterion, several predicates, OR'd
    contains(path.customer);
    contains(path.notes);
    filter(path.amount, (cell, q) => cell > Number(q));
  });

  applyWhen(path, ({ valueOf }) => valueOf(path.category) !== null, (path) => {
    equals(path.subCategory);                          // only applies once a category is chosen
  });

  filter(path.tags, (cell, c: { include: string[]; exclude: string[] }) =>
    hasAny(cell, c.include) && hasNone(cell, c.exclude));   // the general rule
}, { injector });                                      // optional, R24
```

| Element | Decision |
|---|---|
| `createFilters<TRow>(schema, opts?)` — no `data` argument, `TRow` annotated | R10, R11, R24 |
| Named rules (`equals`, `contains`, `inRange`, `toggle`, `hasAny`, …) called on a path | R7 |
| `filter(path, predicate)` — the general rule, peer of Signal Forms' `validate()` | R7 |
| Matchers also exported as plain `(cell, criterion) => boolean` functions | R7 |
| `anyOf(key, schema)` — one criterion, many paths, each with its own predicate | R8 |
| `applyWhen(path, condition, schema)` — conditional activation | R15 |
| One filter per path; a duplicate throws at construction | R5, R6 |
| Key borrowed from the path when there is one; named positionally for a group | R3, R9 |
| A criterion may be a compound object (`{min,max}`, `{from,to}`) | R2 |
| `{ source }` — a server-supplied default the user can override | R19 |

## State

Property access is a child; a call is state. Root included (R20).

```ts
filters()                       // root state
filters().value()               // { status: null, amount: {min,max}, search: 'acme' } — complete
filters().active()              // { search: 'acme' } — empties omitted
filters().reset(v?)             // no arg → source; null → empty; value → that value
filters().dirty()               // derived: value differs from source

filters.status                  // a filter node
filters.status().value()        // its criterion
filters.status().value.set('open')
filters.status().reset()
filters.status().dirty()
```

| Member | Purpose | Decision |
|---|---|---|
| `value()` | stable shape, one entry per declared filter — binds to controls, persists | R14 |
| `active()` | derived, empties omitted — request params, "N filters applied", `hasFilters` | R14 |
| `reset(value?)` | one verb, three behaviors; `clear()` is `reset(null)` | R17 |
| `dirty()` | **derived, never stored** — gates whether `source` may overwrite | R19 |

`filters().value` is a real `WritableSignal`, so it is also the model for a Signal Form (R18).

## Wiring — three modes

```ts
// client — the feature filters the rows
features: [withFiltering<Invoice>({ filters: this.filters })]

// server — the feature is not composed; filters feed the request that produces the data
readonly invoices = resource({
  params: () => this.filters().active(),
  loader: ({ params }) => fetchInvoices(toQuery(params)),
});
readonly table = createTable(this.invoices.value, () => ({ trackBy: 'id', columns: [...] }));

// forms — optional; the form's model IS the filter model, no adapter
readonly filterForm = form(this.filters().value, (path) => {
  required(path.search);
  debounce(path.search, 300);
});
```

`withFiltering({ manual: true })` is retained for symmetry with `withSorting` (R23).

## Semantics

- **Combination:** within an `anyOf` group, **OR**; across filters, **AND** (R8).
- **Empty criteria** skip their predicate. What counts as empty is per-predicate, declared beside
  it (`autoRemove`-shaped), and applied before evaluation (R14).
- **Null/undefined cell values:** one stated library-wide policy — still to be specified.
- **Pipeline:** filtering runs first, before group/sort/expand (unchanged).

## Deliberately not shipped

| Not shipped | Instead | Decision |
|---|---|---|
| Runtime operator picker (AG Grid / PrimeNG column menu) | operators are fixed at declaration | R1 |
| `{ as: }` for a second filter on one path | one predicate over a compound criterion | R6 |
| `ColumnDef.filterFn` / `enableFiltering` | predicates live in the schema | R12 |
| Per-filter `encode` for server params | consumer maps `active()` | R16 |
| Debounce | Signal Forms' `debounce()` over the model | R25 |
| Persistence / storage adapter | consumer's `JSON.stringify` + `reset(value)` | R21 |
| Data-derived filter options (set filters) | consumer computes them | R11 |

## Still open at spec time

1. Null/undefined cell-value policy — stated once, centrally.
2. What happens when a predicate throws.
3. Which symbols the barrel exports, and from which file.
4. ~~The fate of the superseded `with-filtering.ts`~~ — resolved, see R26.
5. Issue #5: close-and-replace, or rewrite (R13).
6. `state-persistence.md`'s filter slice (R22), and the shared persistence feature (R21).

---

## The scenario

```ts
interface Invoice {
  id: string;
  customer: string;                                   // ← global search hits this
  status: 'draft' | 'sent' | 'paid' | 'overdue';      // ← dropdown, single select
  isArchived: boolean;                                // ← toggle
  dueDate: Date;                                      // ← date-range picker
  amount: number;                                     // ← numeric range
}
```

Requirements:

1. Global search box over all columns — the box lives in the consumer's toolbar.
2. Four per-column filters, each a different criterion **shape**: a union literal, a boolean, a
   `{ from, to }` date range, a `{ min, max }` number range.
3. `dueDate` has a **default supplied by the server** (current fiscal quarter), resolved
   asynchronously *after* the table is constructed.
4. If the user has already picked a date range before the server default lands, the default must
   not clobber their choice.

Requirement 4 is the one that separates the options. It is invisible until you write the async
wiring out.

---

## Option A — feature config seed + store-owned + imperative setters

The shape closest to today's `withSorting()`.

```ts
readonly query = signal('');                      // consumer-owned, bound to the search box

readonly table = createTable(this.data, () => ({
  trackBy: 'id',
  columns: [
    { id: 'customer',   accessor: (r) => r.customer },
    { id: 'status',     accessor: (r) => r.status,     filterFn: (v, f) => v === f },
    { id: 'isArchived', accessor: (r) => r.isArchived, filterFn: (v, f) => v === f },
    { id: 'dueDate',    accessor: (r) => r.dueDate,    filterFn: isWithinRange },
    { id: 'amount',     accessor: (r) => r.amount,     filterFn: isWithinBounds },
  ],
  features: [
    withFiltering<Invoice>({
      query: this.query,
      columnFilters: () => inject(INVOICE_FILTER_DEFAULTS),   // NgRx-style factory seed
    }),
  ],
}));

protected onSelectStatus(status: Invoice['status'] | null): void {
  status === null
    ? this.table.clearColumnFilter('status')
    : this.table.setColumnFilter('status', status);
}
```

Async default (requirement 3 + 4):

```ts
constructor() {
  effect(() => {
    const range = this.defaults.value()?.dueDateRange;
    // Requirement 4 is a MANUAL guard the consumer must remember to write.
    if (range && !this.table.hasColumnFilter('dueDate')) {
      this.table.setColumnFilter('dueDate', range);
    }
  });
}
```

**Costs**
- `FilterRule.value` is `unknown` → `setColumnFilter('dueDate', 'oops')` compiles fine.
- Column ids are bare strings → `setColumnFilter('dueDat', …)` is a silent no-op typo.
- Requirement 4 is consumer-authored boilerplate, and needs a `hasColumnFilter()` we'd have to add.

---

## Option B — declarative `applyFilter()` rules, criteria in consumer signals

```ts
readonly query    = signal('');
readonly status   = signal<Invoice['status'] | null>(null);
readonly archived = signal<boolean | null>(null);
readonly amount   = signal<{ min: number; max: number } | null>(null);

// Requirement 3 + 4 collapse into one line — server value seeds it,
// a user write overrides it, and no manual guard is needed.
readonly dueDate = linkedSignal(() => this.defaults.value()?.dueDateRange ?? null);

readonly table = createTable(this.data, () => ({
  trackBy: 'id',
  columns: [...],
  columnsSchema: (path) => {
    applyFilter(path.status,     { when: this.status,   match: (v, f) => v === f });
    applyFilter(path.isArchived, { when: this.archived, match: (v, f) => v === f });
    applyFilter(path.dueDate,    { when: this.dueDate,  match: isWithinRange });
    applyFilter(path.amount,     { when: this.amount,   match: isWithinBounds });
  },
  features: [withFiltering<Invoice>({ query: this.query })],
}));
```

**Wins**
- `path.dueDate` is compile-checked against `keyof Invoice` (`ColumnsPath<TRow>` is a mapped
  type over `Extract<keyof TRow, string>`) — the typo class from Option A is gone.
- Requirement 4 is free. `linkedSignal` already has the exact semantics: recompute from source,
  user writes win until the source changes. Already used in this repo (`draft-rows.ts`,
  `columns-schema/wiring.ts`).
- `null` = inactive, one uniform convention across every filter kind.

**Costs**
- Criteria live in consumer signals → contradicts the research verdict and every library
  surveyed.
- **Persistence restore breaks.** `state-persistence.md` needs read *and* write. The store can
  snapshot consumer signals fine, but cannot write a restored snapshot back into them unless
  they're handed over as `WritableSignal` — at which point ownership is muddled anyway.
- Five signals of consumer boilerplate before you've filtered anything.

---

## Option C — typed filter factories in the feature config, store-owned

```ts
features: [
  withFiltering<Invoice>({
    query: this.query,
    columns: {
      status:     equals<Invoice['status']>(),
      isArchived: equals<boolean>(),
      dueDate:    dateRange({ initial: () => inject(DEFAULTS).dueDateRange }),
      amount:     numberRange(),
    },
  }),
]
```

```ts
this.table.setColumnFilter('dueDate', { from, to });   // ✅ shape checked
this.table.setColumnFilter('status', 'paid');          // ✅ union checked
this.table.setColumnFilter('status', 'nope');          // ❌ compile error
```

**Wins**
- Store owns state → matches the research verdict, the repo convention, and persistence restore.
- Per-column criterion types → fixes `value: unknown`.
- Kinds are composable *factories*, not config flags — one mechanism plus shipped sugar, the
  same relationship `insertRow`/`removeRow` have to `value.update()`.
- `initial` as an injection-context factory covers the DI/server seed.

**Costs**
- Largest new API surface of the four.
- Column keys checked against the config record, not `keyof TRow` — weaker than Option B's paths.
- Requirement 4 still needs an answer (a `skipIfTouched`-style option, or the same manual guard).

---

## Option D — `applyFilter()` declaration + store-owned state

The synthesis: Option B's typed schema paths, Option C's typed kinds, Option A's ownership.

```ts
columnsSchema: (path) => {
  applyFilter(path.status,     equals<Invoice['status']>());
  applyFilter(path.isArchived, equals<boolean>());
  applyFilter(path.amount,     numberRange());
  applyFilter(path.dueDate,    dateRange({
    initial: () => inject(DEFAULTS).dueDateRange,   // async/DI seed, declared not wired
  }));
},
features: [withFiltering<Invoice>({ query: this.query })],
```

- Declaration sits with `applyVisible()` / `applySortNulls()` — same DSL, same file, same mental
  model.
- `path.dueDate` compile-checked against `keyof TRow`.
- Criterion values live in the store → persistence restore works, `manual` mode can serialize.
- Writes still go through `table.setColumnFilter('dueDate', …)`, now typed via the schema.

**Open problem:** `ColumnRuleContext<TRow>` is `{ columns: () => ColumnDef<TRow>[] }` — column
scoped, no row. Existing rules answer "should this column show," evaluated once; a filter
predicate evaluates per row. So `applyFilter` would not reuse the current rule-evaluation path
unchanged — it registers a predicate the *pipeline* runs, while `applyVisible` registers one the
*column fold* runs. Same DSL surface, two different execution sites. Whether that's elegant
reuse or an overloaded word is the thing to decide.

---

## Comparison

| | A: config + setters | B: rules + consumer signals | C: typed factories in config | D: rules + store-owned |
|---|---|---|---|---|
| Criterion type safety | ❌ `unknown` | ⚠️ consumer's own types | ✅ | ✅ |
| Column key checked vs `keyof TRow` | ❌ string | ✅ path | ⚠️ config record | ✅ path |
| State owner | store | consumer | store | store |
| Persistence **restore** | ✅ | ❌ | ✅ | ✅ |
| `manual` mode serialization | ✅ | ✅ (read only) | ✅ | ✅ |
| Async server seed | manual `effect` | ✅ `linkedSignal` | ✅ `initial` factory | ✅ `initial` factory |
| Req. 4 (no clobber) | manual guard | ✅ free | needs an option | needs an option |
| Matches repo DSL | ⚠️ new config shape | ✅ `apply*` | ⚠️ new config shape | ✅ `apply*` |
| Matches surveyed libraries | ✅ | ❌ | ✅ | ✅ |
| New API surface | smallest | small | largest | medium |

## Where A–D point

> **⚠️ Superseded by Option E and R10.** This section's verdict (D, fallback A) was reached before
> `createFilters()` existed. Every option here keeps filter state inside the table, which R10
> shows cannot work in server mode. Retained as the reasoning that produced E, not as a
> recommendation.

**D**, with **A** as the fallback if `applyFilter` living in `columnsSchema` while executing in
the pipeline reads as overloading rather than reuse.

**B** is the only option that makes requirement 4 free, and that is worth noticing — but it pays
for it with persistence restore, which `state-persistence.md` has already committed to.

---

# Option E — `createFilters()` as its own primitive

**This is where the discussion landed, and it supersedes A–D.** A–E are retained above because
the reasoning that eliminated each one is what justifies E.

Filter state stopped looking like a table feature's private concern and started looking like its
own domain object — declared side by side with the data, the same way `createTable()` and Signal
Forms' `form()` are.

```ts
readonly filters = createFilters(this.data, (path) => {
  const defaults = inject(FILTER_DEFAULTS);       // schema fn runs in an injection context

  equals(path.status);
  toggle(path.isArchived);
  numberRange(path.amount, { source: () => defaults.amountBounds });
  dateRange(path.dueDate,  { source: () => this.config.value()?.quarter ?? null });
  filter(path.customer, (cell, q) => contains(cell, q));   // the base primitive; kinds are sugar
}, { injector });                                  // same escape hatch createTable has

readonly table = createTable(this.data, () => ({
  trackBy: 'id',
  columns: [...],
  features: [withFiltering<Invoice>({ filters: this.filters })],
}));
```

```html
<my-toggle [value]="filters.isArchived.value()" (valueChange)="filters.isArchived.set($event)" />
```

## Why E resolves what A–D could not

| Tension in A–D | How E dissolves it |
|---|---|
| Table-owns-state (less consumer boilerplate) **vs** consumer-owns-model (server mode untouched by the store) | Both. `createFilters` manufactures the state, but the object is consumer-held, not buried in a feature |
| Server-side filtering dragging table complexity along | `withFiltering` is never composed. Consumer watches `filters.value()`, fetches, writes `data`. The store is not involved |
| Enumerated filter kinds as public API surface | `filter(path, predicate)` is the contract; `equals`/`toggle`/`dateRange`/`numberRange` are shipped sugar over it — the relationship `insertRow` has to `value.update()` |
| Persistence restore | One object, one serializable value. Snapshot and restore without reaching into table internals |
| Column-key typos | `ColumnsPath<TRow>` (already implemented) gives compile-checked paths |

Three existing precedents in this repo, not one: `createTable(data, optsFn)`,
`columnSchema((path) => …)`, and `applyVisibleAsync`'s resource-backed rule.

## Where a default filter value comes from — three mechanisms, not one

The single most-corrected point of the discussion. `validateAsync` / `applyVisibleAsync` were
initially assumed to be the model for server-supplied defaults. **They are not**, and the reason
is semantic rather than syntactic.

| Source of the default | Mechanism | Timing | User can override? |
|---|---|---|---|
| DI token / route resolver, already resolved | `inject()` in the schema body, read from closure | sync | yes — plain initial value |
| HTTP landing after construction | **`linkedSignal`** over the resource | async | yes — writes win until source changes |
| Server-enforced constraint | `validateAsync` / `applyVisibleAsync` shape | async | **no** — resource always wins |

`validateAsync`'s output is authoritative and continuous: it re-derives whenever params change
and always wins. Correct for visibility — a permission check *should* keep overriding. Wrong for
a user-editable criterion, because the server would re-clobber the user's choice on every
refetch. That is a permanent requirement-4 violation, not an edge case.

`linkedSignal` has exactly the needed semantics (seed from source; user writes persist until the
source changes) and is already used in this repo — `api/features/draft-rows.ts:63`,
`engine/columns-schema/wiring.ts:65`.

**Consequence: requirement 4 needs no policy flag.** It falls out of picking the right primitive.

NgRx's `withState(() => inject(TOKEN))` factory overload is real and verified, but **synchronous** —
it covers row 1 of that table only. It was initially mis-transplanted into a Signal-Forms-shaped
sketch as an async mechanism; it is not one.

## Effect of `source` on the API surface

Small — one optional field:

```ts
interface FilterOptions<T> {
  source?: () => T | null;
}
```

- One `source` covers all three rows above. A constant is a source that never changes.
- The handle's public shape is identical with or without it (`linkedSignal` vs plain `signal`
  internally). No API bifurcation, no conditional typing at the binding site.
- `createFilters` inherits `createTable`'s injection-context requirement and `{ injector }`
  escape hatch — not a new concept.

## Resolved during the grill (2026-09-09)

**R1 — No runtime operator picker.** The schema declares each filter's match logic; the end user
changes values only. Named operators, a per-column operator list, and coercion-per-operator are
out of scope with it. Full reasoning and the surviving constraints:
[research-generic-filter-utilities.md](research-generic-filter-utilities.md), Finding 7.

**R2 — The filter model is a Signal Forms model, and a criterion may be an object.** The mapping
is an inversion, which is why it wasn't obvious:

| Signal Forms | Filters |
|---|---|
| model field value — the writable signal the user edits | **the criterion** |
| validator parameter, fixed at declaration (`minLength(path.name, 3)`) | the predicate's own constants |
| — (no equivalent) | the row cell being tested |

A validator compares a field **against itself**; a filter compares a criterion **against row
data**. Everything else lines up. Signal Forms rules can target a non-leaf/group path —
`validateTree(schemaPath, …)` reads the whole object via `value()`
([cross-field logic](https://angular.dev/guide/forms/signals/cross-field-logic)) — so a compound
criterion is precedented, not a workaround.

```ts
// the filter model is a form model
{ status: 'open', customer: 'acme', amount: { min: 100, max: null }, dueDate: { from, to } }
```

Consequence: **a range is one filter, not two.** `filters.amount` is a single handle over
`{ min, max }`. The predicate still takes `(cell, criterion) => boolean`, so Finding 2 holds.

**R3 — A filter declares a criterion key *and* a read path.** These are the two things Option E
ran together. 1:1 by default (`equals(path.status)` → `filters.status`, reads `row.status`), so
there is no naming ceremony in the common case.

**R4 — Global search is the many-paths case of the same mechanism** (resolves the old Q4). One
criterion, several read paths — not a distinct feature. Superseded in syntax by R8; the
principle stands.

**R5 — One filter per path. A duplicate throws at construction.** Matches the repo's existing
`SlotRegistry` single-occupancy rule (`engine/slots.ts`) for member keys and pipeline stages.

**R6 — No `{ as: 'name' }` escape hatch for declaring a second filter on one path.** Two shipped
sugars cannot be combined on a column; combining operators means dropping to the base primitive
and writing one predicate over a compound criterion:

```ts
// include + exclude on one column — the strongest case found for { as: }
filter(path.tags, (cell, c: { include: string[]; exclude: string[] }) => …);
```

The trade was taken knowingly: include/exclude is a genuinely common pattern and it now costs a
custom predicate. Chosen on reversibility — adding `{ as: }` later is additive and
non-breaking; removing it is not. Revisit if the escape hatch is reached for repeatedly.

**R7 — Named rules and one general rule, side by side. Exported matchers underneath.** The
schema body is written in Signal Forms' style: named rules called directly on a path, with a
single general rule reached for only when none fits. `filter()` is the peer of `validate()`, not
a layer beneath `equals()`.

```ts
// Signal Forms                          // Filters
form(model, (path) => {                  createFilters<Invoice>((path) => {
  required(path.name);                     equals(path.status);
  minLength(path.name, 3);                 contains(path.customer);
  validate(path.age, ({value}) => …);      inRange(path.amount);
});                                        filter(path.tags, (cell, c) =>
                                             hasAny(cell, c.include) && hasNone(cell, c.exclude));
                                         });
```

The **matchers** (`equals`, `contains`, `inRange`, `hasAny`, `hasNone`, …) are also exported as
plain binary functions, so a custom predicate is assembled from shipped parts rather than written
from scratch. That is what makes R6's trade affordable.

Rejected on the way here: collapsing the two forms into one, so that declaring a filter was
always `filter(path.x, equals)`. It removes a concept but reads as indirection — a schema rule
calling a rule — and abandons the Signal Forms writing style the whole design is modelled on.

**R8 — `anyOf(key, schema)`: one criterion, several predicates, OR'd.** A nested schema block,
in the Signal Forms idiom. Replaces the array/variadic sketches in R4, and removes the need for a
`search()` export entirely — text search is the ordinary instance of it.

```ts
createFilters<Invoice>((path) => {
  equals(path.status);          // key borrowed from the path
  inRange(path.amount);

  anyOf('search', (path) => {   // key given: three paths cannot supply one
    contains(path.customer);
    filter(path.amount,  (cell, q) => cell > Number(q));
    filter(path.dueDate, (cell, q) => cell.getFullYear() === +q);
  });
});
```

Three properties, in the order they were argued:

1. **Per-path predicates, not a shared one.** This is what the variadic form
   (`contains(path.a, path.b)`) could not express — `contains` for free text, `startsWith` for an
   ID column, an arbitrary `filter()` for anything else.
2. **Two type slots per predicate, only one of them shared.** The *cell* type comes from the
   predicate's own path and varies freely; the *criterion* type is shared across the group. Above,
   one `string` criterion is read as a substring, as a number, and as a year — the flexibility
   requirement that drove the whole design.
3. **Not text-specific.** `anyOf('window', (path) => { inRange(path.createdAt);
   inRange(path.dueDate); })` gives one `{from, to}` criterion matching either date column.

Combination stays two-level and matches PrimeNG's split (verified in
[research-generic-filter-utilities.md](research-generic-filter-utilities.md), Finding 6):
**within a group, OR; across filters, AND.**

**R9 — The criterion key comes from the path when there is exactly one; otherwise it is named.**
A group takes its key positionally because the key is mandatory there. State stays flat, one
entry per criterion:

```ts
{ status: 'open', amount: { min: 100, max: null }, search: 'acme' }
```

`filters.search` is an ordinary handle at the binding site. The predicates behind it are
invisible, exactly as `filters.amount` hides `{min, max}` behind one pair of controls.

**R10 — `createFilters()` is standalone, not a `withFiltering()` config field** (resolves Q7).
Forced by server mode, not chosen on taste: there, the filters feed the request that *produces*
the data.

```ts
readonly filters  = createFilters<Invoice>((path) => { … });
readonly invoices = resource({
  params: () => this.filters().active(),              // active(), not value() — R14
  loader: ({ params }) => fetchInvoices(params),      // → /invoices?status=open&search=acme
});
readonly table    = createTable(this.invoices.value, () => ({ trackBy: 'id', columns: […] }));
```

Filters → request → data → table. Had the filters lived inside the feature, building that
resource would need `table.filters`, which needs the data the resource has not fetched yet. A
construction cycle — the code cannot be written at all. The reversibility argument for deferring
the standalone primitive (see the over-reach section below) is therefore moot: there is no
working alternative to defer to.

Corrected on the way here: an `effect()` watching `filters.value()` and writing a data signal.
`resource({ params })` is the reactive shape; an effect writing a signal is not.

**R11 — `createFilters` takes no `data` argument; it is parameterised by `TRow` only**
(resolves Q2).

Consequence of R10: in server mode the data does not exist when the filters are declared. The
data signal *is* `this.invoices.value`, which depends on the resource, which depends on the
filters — so `createFilters(this.data, schema)` is a circular reference. Data cannot be a
**required** argument.

Two things were dropped in that step, and only one was forced:

- **Reading rows to derive filter options** — AG-Grid-style set filters, whose dropdown values
  come from the distinct values in the loaded rows. Genuinely impossible in server mode, since
  the rows arrive already filtered. Correctly dropped; the consumer computes options from their
  own data and passes them to their own control.
- **Type inference** — only needs the data in client mode, where it *does* exist. Not forced.

**Accepted cost: `TRow` must be written explicitly.** This is the one place the API is worse than
the two it is modelled on, because both of those have a value in argument position to infer from:

```ts
createTable(this.data, …)              // TRow inferred from data
form(this.model, …)                    // TModel inferred from model
createFilters<Invoice>((path) => …)    // must be annotated
```

TypeScript cannot recover `TRow` from a callback whose parameter is `ColumnsPath<TRow>`, so
without a value argument the annotation is unavoidable.

Rejected: an optional first argument (`createFilters(this.data, schema)` in client mode,
`createFilters<Invoice>(schema)` in server mode). It restores inference where the data exists,
but costs two call shapes and an overload, and requires a subtle rule — the data is
inference-only and never read — that a consumer would reasonably misread as enabling
data-derived options. One annotation per table is cheaper than that.

**R12 — `ColumnDef.filterFn` and `ColumnDef.enableFiltering` are deleted** (resolves Q3).
Neither has a consumer once predicates live in the schema keyed by path: `filterFn` has no
criterion to pair with, and `enableFiltering` existed only to exclude a column from a global
filter that auto-scanned every column — `anyOf` lists its paths explicitly instead. D1
(case-insensitive auto-scan) and D3 (auto-detected default predicate) describe that removed
behavior and go with them. D2 (no built-in debounce) is unaffected.

**They are not dead fields today, so deleting them is not free.** Issue #5's framing ("typed but
unconsumed") no longer holds: both are declared at `api/types.ts:78-79` and actively consumed by
the superseded `api/features/with-filtering.ts` — `const match = column.filterFn ??
defaultFilterMatch;` and `if (column.enableFiltering === false) { return false; }`. Removing the
two fields therefore means removing that feature file and its spec as well. That is the same
open user decision the handoff already records; R12 does not settle it unilaterally.

**R13 — Issue #5 is left untouched until the spec is written.** Roughly 7 of its 12 requirements
are contradicted — every one that names an API symbol — and it still refers to `createTableStore()`
and `store.setData()`, both renamed in shipped code. Its behavioral half survives: filtering runs
first in the pipeline, filters AND together (refined by R8 to *across filters* AND, *within a
group* OR), `manual: true` skips the client stage, no built-in debounce, tests through the public
surface only. Whether to close-and-replace or rewrite it is deferred to spec time.

**R14 — Empty criteria skip their predicate but stay in the aggregate.** Two halves:

*Skipping is forced.* `contains(cell, '')` would match everything and
`inRange(cell, {min:null,max:null})` would throw, so an empty criterion must skip evaluation.
What counts as empty is **per-predicate** — `''`, `null`, `{min:null,max:null}`, `[]` — so each
shipped predicate declares its own emptiness test, and `filter()` must let a custom predicate
declare one too. This is TanStack's `autoRemove` factoring, chosen over PrimeNG's (which repeats
the check inside all twenty match functions, subtly divergently). See
[research-generic-filter-utilities.md](research-generic-filter-utilities.md), Finding 5.

*Visibility is not one choice — there are two shapes, and both ship.* This came out of a
pushback that was right: filters were compared to the Signal Forms **model** (always complete),
but they are equally comparable to `errors()` (only what is active). Signal Forms has both, and
so do we.

Verified from the docs: a validator returns `null`/`undefined` when it passes, so `errors()`
carries only failures; and the model "always contains every declared field regardless of
validity" — the structure is fixed, validity travels in separate signals
([validation guide](https://angular.dev/guide/forms/signals/validation)).

| Signal Forms | Shape | Filter analogue |
|---|---|---|
| model | always complete | the criteria the user edits |
| `errors()` | only active | which filters are currently narrowing |

A criterion is user-editable input, two-way bound to a control — that is the **model**. "Which
filters are active" is derived output of evaluation — that is **`errors()`**. Different things,
both needed:

```ts
filters().value()    // { status: null, amount: { min: null, max: null }, search: 'acme' }
filters().active()   // { search: 'acme' }
```

- `value()` — stable shape, one entry per declared filter. Binds to controls, persists,
  restores. Typed as the full model, no optional-key handling.
- `active()` — derived, empties omitted. Builds the request URL, drives an "N filters applied"
  chip, answers `hasFilters`.

**This also dissolves the 3–1 precedent that appeared to run against `value()`.** Verified:
AG Grid's `getFilterModel()` returns only active filters and a cleared column stops appearing
("Setting a `model` of `null` will reset the filter (make inactive)"); TanStack's nine built-in
`filterFns` all carry `autoRemove`, which "return[s] `true` if the filter value should be removed
from the filter state"; Material React Table inherits that; only PrimeNG keeps entries, because
its `filters` is an object seeded per column. But AG Grid's and TanStack's state **is** the
active set — nothing declares their filters up front, so they have no model to be complete about
and the two concepts collapsed into one. A declared schema separates them again.

**The URL takes `active()`.** A dynamic param set is the better shape: `status=` forces the
server to disambiguate "no filter" from "status is empty"; `?search=acme` and
`?search=acme&status=` are two cache entries for one query; and omitting unset optional params is
the REST convention.

```ts
readonly invoices = resource({
  params: () => this.filters.active(),
  loader: ({ params }) => fetchInvoices(params),
});
```

An API that demands a fixed param set reads `value()` instead. The consumer builds the query
either way.

**R15 — `applyWhen()` for conditional activation, taken from Signal Forms directly.** Verified:
`applyWhen(path, condition, schema)` conditionally applies whole rule groups, `disabled` /
`readonly` / `hidden` take `{ when }`, and *"Like disabled fields, hidden fields also skip
validation"* with values preserved
([form logic](https://angular.dev/guide/forms/signals/form-logic)). Same `{ when }` vocabulary
this repo already adopted for `applyVisible`.

```ts
createFilters<Invoice>((path) => {
  equals(path.category);

  applyWhen(path, ({ valueOf }) => valueOf(path.category) !== null, (path) => {
    equals(path.subCategory);      // only applies once a category is chosen
  });
});
```

It belongs at the rule level, not inside the predicate, because of R14's two shapes. A condition
written into the predicate as a pass-through:

```ts
filter(path.subCategory, (cell, c) => !hasCategory() ? true : cell === c);   // ✗
```

…still reports the filter as active, so it reaches the URL and the "N filters applied" chip while
matching every row. `when` switches it off at the right level: the criterion stays in `value()`,
disappears from `active()`. Precisely the disabled/hidden semantics Signal Forms already defines
— value preserved, evaluation skipped.

**R16 — No per-filter `encode`. The consumer maps `active()` to their transport.** Server APIs
differ irreconcilably (`?amount_min=&amount_max=`, `?amount=100..900`, `{amount:{gte,lte}}`), and
`active()` is a plain object, so mapping it is a pure function the consumer owns:

```ts
params: () => toQuery(this.filters.active())
```

An `encode` option would sit next to the declaration that knows the criterion's shape, which is
appealing — but it couples the schema to *one* transport, and a filter set feeding both an HTTP
API and the URL bar needs two encodings. One slot cannot hold both. Revisit only if writing those
mapping functions proves repetitive across tables.

**R17 — One `reset(value?)`, in the reactive-forms shape** (resolves Q1).

```ts
filters().reset();                          // → source (or empty when no source is declared)
filters().reset(null);                      // → empty
filters.amount().reset({ min: 0, max: 500 });  // → an arbitrary value
filters.amount().reset();                   // per-filter, same three forms
```

Reset-to-source is the default reading of "clear filters": a server-supplied value is where an
untouched filter lives, not a suggestion that gets spent.

TanStack ships both behaviors behind `resetColumnFilters(defaultState?: boolean)`. Rejected —
the reader has to learn what `true` means. Also rejected: a `reset()` / `clear()` verb pair,
because the one-method form covers a third case for free (reset to an arbitrary value) instead of
enumerating a method per case (`general-mechanism-over-enumerated-cases`). `clear()` disappears
as a separate export — it is `reset(null)`.

`null` is a **sentinel meaning "this filter's empty value"**, not a literal. R14 makes emptiness
per-predicate, so `reset(null)` yields `''` for text, `{min:null,max:null}` for a range, `[]` for
a multi-select.

**Divergence from Signal Forms, deliberate and worth documenting.** `FieldState.reset(value?)`
*"Resets the touched and dirty state of the field and its descendants"* — with no argument it
does **not** change the value ([angular/angular#65949](https://github.com/angular/angular/issues/65949):
*"takes an optional value to set to the form, and if not passed, the value will not be changed"*),
which is the sharp edge this repo already records at `row-editing.md:583`. Our `reset()` changes
the **value** — back to source, to empty, or to an argument. Same word, different operation, and
both are reachable at once when a form is layered over the filters
(`filterForm.search().reset()` clears flags; `filters.search().reset()` changes the criterion).

Delegating reset to the form entirely was considered and rejected: its no-argument form cannot
express "back to source", its value form needs a value the library holds and the consumer does
not, and a consumer using plain `<input>`s would have no reset at all — which would make R18's
optional form wiring mandatory.

Verified wrinkle in the other borrowed precedent: Angular's reactive-forms `reset()` defaults to `null`, and
returns to the initial value only when the control is `nonNullable: true` — *"By default, the
control will reset to null"* ([FormControl](https://angular.dev/api/forms/FormControl)). Since
`nonNullable: true` is the recommended modern usage, reset-to-declared-value is what most Angular
developers actually experience, so the borrowed shape reads correctly despite the inverted
default.

Interaction with R14: after `reset()` a sourced filter is non-empty, so it stays in `active()`
and in the request URL. After `reset(null)` it drops out of both.

**R18 — The model is one `WritableSignal`, so a consumer can put a real Signal Form over it.**
Signal Forms never copies state — the developer's `WritableSignal` *is* the source of truth
([research-filter-state-ownership.md](research-filter-state-ownership.md)) — so exposing the
criteria model as one writable signal makes form wiring free:

```ts
readonly filterForm = form(this.filters().value, (path) => {
  required(path.search);
  min(path.amount.min, 0);          // validate the criteria themselves
});
```
```html
<input [control]="filterForm.search" />
```

No adapter, no sync effect, no duplicated state. The model is plain data (R2), which is exactly
what `form()` accepts.

No separate `filters.model` is needed: `filters().value` **is** the `WritableSignal`, verified as
*"A writable signal containing the value for this field. Updating this signal will update the
data model that the field is bound to"*
([FieldState](https://angular.dev/api/forms/signals/FieldState)), and `form()` takes
`model: WritableSignal<TModel>`. So the wiring is `form(this.filters().value, schema)`.

Structural cost, accepted: the per-filter handles become views onto keys of one signal, not N
independent signals with a computed aggregate — `form()` cannot take a synthesized object. This
repo already has that shape in `WritableView` (`engine/writable-view.ts`), where `table.value`
reads through and `.update()` writes through to one underlying signal. Consequence: `source` is
no longer a per-filter `linkedSignal`; it becomes "reconcile source into key K while K is not
dirty" (R19), which is the same policy stated explicitly.

**R19 — `dirty` gates source reconciliation** (resolves Q6). A restored snapshot and a
late-arriving server default fight; `dirty` decides.

`dirty` = **the criterion holds a written value, not its declared source value.**

**It is derived, never stored:**

```ts
dirty = () => !equalsCriterion(value(), sourceValue())
```

Any write updates it automatically — the user typing, a form writing through, a snapshot restore,
`reset(v)`. There is no flag to keep in sync, which removes a whole class of desync between the
filters and a Signal Form layered over them (R18). Stored flags on both sides would be two facts
that can diverge; one derived value cannot.

One semantic difference from Signal Forms, and it is harmless: theirs is dirty *"even if the
current value matches the initial value"*; ours reads false when the user happens to type exactly
the source value. `dirty` exists only to answer "may the source overwrite this?" — and when the
value already equals the source, overwriting is a no-op. No observable effect.

```ts
filters.amount().dirty()   // false → follows the server default as it arrives and changes
                           // true  → the written value holds; source arrivals do not overwrite
filters.amount().reset();  // clears dirty → follows the source again
```

Verified: Signal Forms defines `dirty()` as *"User has modified an interactive field (even if
they never blurred it, and even if the current value matches the initial value)"*, `touched()` as
focus/blur, and `reset()` *"clears the touched and dirty flags"*
([field state](https://angular.dev/guide/forms/signals/field-state-management)). The same word
for the same idea — but load-bearing here rather than informational: in a form `dirty` drives an
"unsaved changes" prompt; here it decides who wins when the config request lands.

Restoring counts as a write because that value *was* a user's earlier choice — and with the
derived form it needs no special handling; a restored value that differs from the source is dirty
by construction. Nothing is permanently detached, though: a genuinely updated server default
reaches the user the moment they reset.

`overridden` describes the mechanism more literally and would remove a name collision with the
form's own `dirty`. `dirty` was kept on familiarity, so the distinction must be documented — the
two are different facts:

| | means |
|---|---|
| `filterForm.amount().dirty()` | user edited this control since the last form reset — a UI concern |
| `filters.amount().dirty()` | this criterion is no longer following its source — the reconciliation gate |

**Values cannot desync between the two; flags can.** Per R18 the form's model *is*
`filters().value` — one storage location, two views — so a write through either is the same
write. Only the flags are separately owned. The residue to document: `filters.amount().reset()`
changes the value but does not clear the *form's* `touched`/`dirty`; a consumer who cares calls
`filterForm.amount().reset()` as well.

Distinct from `active()`:

| | `dirty` | in `active()` |
|---|---|---|
| untouched, no source | false | no |
| untouched, source gave `{0, 10000}` | false | **yes** |
| user typed a value | **true** | yes |
| user typed exactly the source value | false — harmless, see above | yes |
| user cleared it (`reset(null)`) | **true** | no |

Signal Forms has no equivalent for the conflict itself — the docs *"[do] not address
asynchronous server defaults or value reconciliation"*. It supplies the mechanism, not the
policy.

**R20 — Every node is callable for state, navigable for children** (resolves Q5). The Signal
Forms shape, adopted whole: **property access = child, call = state**, root included.

```ts
filters()                    // root state
filters().value()            // whole criteria model
filters().active()           // R14
filters().reset()            // R17
filters().dirty()            // R19

filters.status               // a filter node
filters.status().value()     // its criterion
filters.status().value.set('open')
filters.status().reset()
```

Chosen because it removes a real collision structurally rather than by convention. A flat
`filters.status.value()` shape puts the library's members in the same namespace as the consumer's
column names, and `value`, `active`, `reset` and `dirty` are all plausible column names — an
invoice's `value` is the obvious one. Under R20, `filters.value` is *always* the handle for a
column named `value` and `filters().value` is *always* the model. No reserved words, no
sub-namespace.

Note this reverses, for filters only, the table's own choice recorded in
[`../with-mutations/2-decisions.md`](../with-mutations/2-decisions.md) (D-block at :436–449),
which rejected "the full callable-plus-`.value` `Field` shape" in favour of flat members. That
rejection turned on the table having *three independent slices and no single root model*,
including an optional `editing` slice — synthesizing one root object would have broken
tree-shaking and the additive-feature-members model. Filters have exactly one root model and
nothing optional, so the reason does not carry over.

Cost: an extra `()` at binding sites. Mitigated by R18 — with a form wired over the model, the
template binds `filterForm.search`, not the filter handle.

**R21 — Persistence stays consumer-owned; a shared mechanism is a separate, parallel feature.**
`createFilters` ships no storage adapter.

```ts
localStorage.setItem('f', JSON.stringify(this.filters().value()));
this.filters().reset(JSON.parse(localStorage.getItem('f') ?? 'null'));
```

R14's `value()` and R17's `reset(value)` are both halves already. Swapping `sessionStorage`, a
URL, or a server-side profile is a one-word change.

The TanStack Query comparison is what settles it. Its persister plugin
(`@tanstack/react-query-persist-client`, with `createSyncStoragePersister` /
`createAsyncStoragePersister`) exists because the query cache is **internal and unreachable** —
you cannot serialize it yourself, so the plugin is the only door. Verified: persistence there is
opt-in and not built in; the cache itself is in memory, keyed by query key, with `staleTime` and
`gcTime` governing staleness and collection
([caching](https://tanstack.com/query/latest/docs/framework/react/guides/caching),
[persistQueryClient](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient)).
None of that machinery has an analogue here — a criterion is never stale, never refetched, never
shared between components. Our need is only the bolt-on half, and our state is already a plain
object in the consumer's hand.

What a shipped mechanism *would* buy is the fiddly part, and it is not the storage abstraction:
debounced writes, a version stamp plus migration when the schema changes, revive for non-JSON
criteria (the `Date` problem), and the drift rule (unknown key → ignore; missing key → leave at
default). Those are the same four problems for sort and column state, which the table already
commits to.

**Therefore: a persistence mechanism is a feature of its own, to be designed in parallel, taking
both the table's snapshot and a filters model as inputs.** Not owned by `createFilters`, and not
owned by the table either. Goal is one unified persistence DX rather than each consumer
re-solving versioning and revival per table.

**R22 — `state-persistence.md` now conflicts with R10 and must be re-scoped.** In its
`LayoutSnapshot` shape it declares:

```ts
filters?: { columnFilters: FilterRule[]; globalFilter: string };  // withFiltering()
```

— a filter slice **inside the table's snapshot**. Under R10 the table does not own filters, so
the table cannot populate that slice. Its shape is also superseded (`FilterRule[]` /
`globalFilter` are R12-deleted). Two ways out, deferred to the persistence feature's own design:
drop the slice and have the consumer merge two objects, or make the shared utility take table
state and a filters model as separate inputs. Do not fix it inside the filter spec.

**R23 — `withFiltering({ manual: true })` is kept.** Under R10 the ordinary server-side path
does not compose the feature at all — the filters feed the resource, the resource yields
already-filtered rows, the table renders them. That makes `manual` redundant for the common case.
Kept anyway, for consistency: `withSorting` carries the same flag today
(`WithSortingConfig.manual?: boolean`), and a table filtering server-side while sorting
client-side composes two features whose `manual` settings differ. Dropping it from one would make
the contract irregular for no gain.

Precision on the precedent, corrected by audit: `manual` is **not** yet the universal convention
this reasoning assumed. Only `withSorting` and the superseded `withFiltering` accept it.
`withExpansion`'s config has just `childrenAccessor` and `isExpandable`, and **`withGrouping` does
not exist** — it appears only as a doc-comment in `api/types.ts` marking a future feature. So
`manual` is a two-feature convention being preserved, not a five-feature one.

**R24 — `createFilters(schema, { injector? })`, mirroring `createTable` and `form()`.** An
injection context is genuinely needed: R19's source reconciliation (write the server value into a
non-dirty key when it arrives) is reactive work with a lifetime.

Verified at the source both `createTable` and this design imitate — `FormOptions.injector` is
*"The injector to use for dependency injection. If this is not provided, the injector for the
current injection context, will be used."*
([FormOptions](https://angular.dev/api/forms/signals/FormOptions)). Implicit `inject()` normally;
the explicit injector is the escape hatch for construction outside a field initializer.

One shape difference from `form()`, following from R11 and R18: `form(model, schema, options)`
takes a model the consumer already owns, whereas `createFilters<TRow>(schema, options)` **builds**
the model from the schema and exposes it as `filters().value` for the consumer to hand to
`form()`. The criteria have no life before the schema declares them; a form's model does.

**R25 — D2 stands: no debounce in `createFilters`.** Reopened because Signal Forms ships a
`debounce()` schema rule, and because server mode makes the cost concrete — every keystroke
changes `active()`, which is the resource's `params`, so every keystroke is a request.

Kept out anyway, because R18 already hands the consumer the better answer. The form is built over
the filter model, so Signal Forms' `debounce()` applies to the criteria directly — nothing to
bridge:

```ts
readonly filterForm = form(this.filters().value, (path) => {
  debounce(path.search, 300);
});
```

A consumer not using Signal Forms for their inputs debounces with their own signal. Shipping a
third way to debounce, inside the filter schema, would duplicate a mechanism the composition
already provides.

**R26 — The superseded `with-filtering.ts` stays on disk; its removal is an implementation task,
not a spec-time edit** (resolves Still-open #4, and the deletion half of R12).

`src/api/features/with-filtering.ts`, its spec, `FilterRule` in `api/types.ts`, the
`src/index.ts` barrel line, and `ColumnDef.filterFn` / `ColumnDef.enableFiltering` are all left
untouched while the specs are written. The specs describe `createFilters()` only; they do not
describe the code currently in the tree, and they do not pretend the two fields are already gone.

Reasoning: the specs and the deletion are separable units of work, and deleting first would leave
the library with no filtering at all for the whole spec-writing window. R12 is unchanged as a
*decision* — the fields go — but it is executed as a step in the implementation plan, sequenced
with the code that replaces them, so filtering never regresses to nothing.

Consequences for the spec pipeline:

- `/to-tasks` must emit an explicit removal step: delete `with-filtering.ts` + `.spec.ts`, remove
  `FilterRule` and the `index.ts` export, and drop `filterFn` / `enableFiltering` from
  `ColumnDef`. It depends on `createFilters()` landing first.
- Until that step runs, `features/filtering.md`'s superseded banner stays accurate and must keep
  saying the code exists.

## Open questions for the grill

1. ~~**`clear()` semantics.**~~ — resolved, see R17. One `reset(value?)`; `reset(null)` → empty.
2. ~~**Does `createFilters` take `data`, or just `TRow`?**~~ — resolved, see R11. `TRow` only.
3. ~~**`ColumnDef.filterFn` / `enableFiltering` become obsolete.**~~ — resolved, see R12/R13.
4. ~~**Where does the global query live?**~~ — resolved, see R4. One criterion, many read paths.
5. ~~**Handle shape** — callable or object?~~ — resolved, see R20. Callable for state, navigable
   for children.
6. ~~**Persistence vs. server defaults can fight.**~~ — resolved, see R19. `dirty` gates it.
7. ~~**Does `createFilters` belong in this library at all?**~~ — resolved, see R10. Standalone,
   forced by server mode.

## Still-valid behavioral decisions

**Only D2 survives.** This section previously claimed all three carried over to E unchanged; R12
contradicts it, and R12 is the later and more specific decision.

| | Decision | Status under E |
|---|---|---|
| D1 | Global filter match is case-insensitive, not configurable | **Gone.** It described the auto-scan over every filterable column. `anyOf` lists its paths and predicates explicitly (R8), so case sensitivity is whatever the chosen predicate does |
| D2 | No built-in debounce; the consumer debounces their own input | **Stands** — reaffirmed by R25, which routes debouncing through the Signal Form over the model |
| D3 | Missing `filterFn` falls back to an auto-detected default (string-contains / equality) | **Gone.** Every filter names its predicate; there is no "missing predicate" case left to fall back from |

See [../../features/filtering.md](../../features/filtering.md), whose banner carried the same
error and has been corrected.

---

# Should E be split? — the over-reach question

> **⚠️ Resolved — R10 settled the standalone half (Half 2); R6/R7 settled the kinds half
> (Half 1).** This section is kept because its two-halves framing is what produced those
> decisions, and because the acceptance test in "The flexibility objection" is still the standard
> shipped kinds must meet. Its open-question framing below is historical.

The question as it was raised: **is `createFilters()` taking on more responsibility than a table
library should?**

The survey answers this in two halves, with opposite verdicts.

## Half 1 — typed filter kinds: well-precedented, 2 of 4 ship them

| Library | Ships filter kinds? | Evidence |
|---|---|---|
| AG Grid | **yes** | verified `initialState` example is `{ year: { filterType: 'set', values: ['2012'] } }` — `filterType` is first-class, and whole filter components ship per kind |
| PrimeNG | **yes** | verified source types filters as `{ [s: string]: FilterMetadata \| FilterMetadata[] }`; `FilterMetadata` carries a match mode |
| TanStack | no | `columnFilters` is `{ id, value: unknown }[]`; matching is `filterFn` per column |
| `MatTableDataSource` | no | single `filter: string` + consumer-supplied `filterPredicate` |

Shipping `equals`/`dateRange`/`numberRange` is joining the majority, not over-reaching.

## Half 2 — the standalone primitive: novel, 0 of 4 ship it

No surveyed library exposes filter state usable *without* its table. Honest reasons it may not
exist:

- Decoupled filters can't do table-aware things — derive `select` options from column data, know
  which columns exist, respect visibility.
- Two objects to wire rather than one.
- In local mode filter state's only consumer *is* the table, so the table is its natural owner.

Counter-argument: all four libraries predate fine-grained reactivity. A standalone reactive
filter object was expensive in the hooks/provider era and is nearly free with signals — which is
why Signal Forms could decouple form state from the form component. Absence of precedent is
partly chronology, not purely judgment. But it is still unvalidated.

## The flexibility objection — and it cuts at Half 1, not Half 2

Ship `dateRange()` and the library has decided what a date range *means*: inclusive bounds?
timezone? null handling? A product whose semantics differ then fights the abstraction instead of
writing three lines. TanStack's `value: unknown` + `filterFn` is deliberately unopinionated for
exactly this reason.

Note this is [`general-mechanism-over-enumerated-cases`](../../../../../../.claude/rules/general-mechanism-over-enumerated-cases.md)
cutting *against* parts of E, having been cited *for* it earlier. Both readings are available,
which is the tell that it needs deciding rather than assuming.

**The target shape is already established in this repo**: `table.value.update(updater)` is the
one general write; `insertRow` / `removeRow` / `patchRow` are shipped sugar over it, and a
consumer who needs something else writes their own updater and bypasses them entirely (D30).
Filtering should land in the same relationship — `filter(path, predicate)` is the contract,
`equals`/`dateRange`/`numberRange` are removable conveniences.

**Acceptance test for the kinds:** can a consumer ignore every shipped kind and lose nothing but
typing convenience? If yes, the kinds are sugar. If the kinds accrete options until bypassing
them means losing real capability, they have become the contract — AG Grid's set filter, with
dozens of options, is what that failure mode looks like at maturity.

## Suggested resolution

> **⚠️ Overridden by R10 (same day).** The resolution below — build the typed kinds inside
> `withFiltering()` and extract `createFilters()` standalone only once something proves it needs
> filters without a table — rests on extraction being cheap and deferral being free. It is not:
> in server-side mode the filters feed the request that *produces* the data, so a table-owned
> filter object cannot be constructed at all (R10). There is no working alternative to defer to.
> The reasoning below is retained because the *other* half of its argument — the acceptance test
> for whether shipped kinds are genuinely sugar — still holds and fed R7.


Split the halves and defer the novel one:

1. Build typed kinds **inside `withFiltering`** — precedented, delivers the DX, low risk.
2. Extract `createFilters` as a standalone primitive **only when something genuinely needs
   filters without a table**. Server-side mode is the candidate, but that should be proven, not
   assumed.

Extraction later is mechanical. Un-shipping a public standalone primitive is not — so this
ordering keeps the expensive decision reversible. Consistent with promote-on-evidence in
[file-organization](../../../../../../.claude/rules/file-organization.md): give something its own
scope because it already outgrew the smaller one, not because it might.

## Prerequisite research — done

> **✅ Completed:** [research-generic-filter-utilities.md](research-generic-filter-utilities.md).
> Five utilities surveyed from source — PrimeNG `FilterService`, sift.js, react-querybuilder,
> json-rules-engine, TanStack `filterFns`. The `FilterService` lead below was confirmed. The brief
> is retained for the standard it sets, not as outstanding work.

Survey **generic filter utilities** — filter engines decoupled from any table — to learn what
problem shape they converged on. PrimeNG appears to ship one (`FilterService`, with a registry of
named match modes and a registration hook for custom ones) — **verify from source, this is a lead,
not an established fact.** Look also for standalone predicate/query-builder libraries outside the
table ecosystem.

The question to answer is not "what do they ship" but "what did they find is the *irreducible*
core of the filtering problem" — the smallest general mechanism that supports overriding, with
sugar layered on for the common cases. That is what should drive the API, not the four table
libraries' historical shapes.
