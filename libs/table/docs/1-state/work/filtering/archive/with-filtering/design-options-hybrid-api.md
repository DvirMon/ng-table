---
title: Filtering API — design decisions (withFiltering)
type: design
status: re-grilled 2026-09-16 — 56 decisions recorded. Filtering is table-owned (R50): the model
  moves into withFiltering(), createFilters/rowOf leave the public surface, the schema returns an
  object literal (R51), `when` replaces applyWhen (R53), the predicate escape hatch is deleted
  (R54) and the member surface is eight (R56). Supersedes R10, R11, R15, R24, R35, R36, R47, R48.
  Ready to spec.
date: 2026-09-16
audience: developers
---

# Filtering API — design decisions

**Read [The design, consolidated](#the-design-consolidated) — it is the whole API in one place,
and it is what a spec should be written from.** [Resolved during the grill](#resolved-during-the-grill-2026-09-09)
(R1–R31) holds the rationale behind each line of it. Everything between the two is the history
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
> `src/api/features/with-filtering.ts` (**committed** in `be39054`, re-exported from
> `src/index.ts:13`, wired into the pipeline via `stages: { filter }`). That implementation is the
> superseded shape this document argues against — see R12 for what removing it entails, and R26
> for when.

---

# The design, consolidated

Everything below this heading up to "The scenario" is the decided API in one place. Each line
carries the decision that produced it; the R-numbers are the rationale, not extra reading.

## Declaration

```ts
readonly filters = createFilters<Invoice>((path) => {
  equals(path.status);                                 // key `status`, reads row.status
  equals(path.isArchived);                             // boolean column — no separate toggle (R28)
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
    hasAnyOf(cell, c.include) && hasNoneOf(cell, c.exclude));  // the general rule
}, { injector });                                      // optional, R24
```

| Element                                                                                            | Decision      |
| -------------------------------------------------------------------------------------------------- | ------------- |
| `createFilters<TRow>(schema, opts?)` — no `data` argument, `TRow` annotated                        | R10, R11, R24 |
| Named rules (`equals`, `contains`, `inRange`, `inDateRange`, `hasAny`, `hasNone`) called on a path | R7, R28       |
| `filter(path, predicate)` — the general rule, peer of Signal Forms' `validate()`                   | R7            |
| Matchers also exported as plain `(cell, criterion) => boolean` functions                           | R7            |
| `anyOf(key, schema)` — one criterion, many paths, each with its own predicate                      | R8            |
| `applyWhen(path, condition, schema)` — conditional activation                                      | R15           |
| One filter per path; a duplicate throws at construction                                            | R5, R6        |
| Key borrowed from the path when there is one; named positionally for a group                       | R3, R9        |
| A criterion may be a compound object (`{min,max}`, `{from,to}`)                                    | R2            |
| `{ source }` — a server-supplied default the user can override                                     | R19           |
| `{ as }` — override the key borrowed from the path                                                 | R31           |

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

| Member          | Purpose                                                                      | Decision |
| --------------- | ---------------------------------------------------------------------------- | -------- |
| `value()`       | stable shape, one entry per declared filter — binds to controls, persists    | R14      |
| `active()`      | derived, empties omitted — request params, "N filters applied", `hasFilters` | R14      |
| `reset(value?)` | one verb, three behaviors; `clear()` is `reset(null)`                        | R17      |
| `dirty()`       | **derived, never stored** — gates whether `source` may overwrite             | R19      |

`filters().value` is a real `WritableSignal`, so it is also the model for a Signal Form (R18).

## Wiring — three modes

```ts
// client — the feature filters the rows
// TRow infers from the enclosing config since 5a3a09d — no per-call generic
features: [withFiltering({ filters: this.filters })]

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
- **Null/undefined cell values:** a null or undefined cell **fails every positive matcher** and
  **passes every negative one** (`hasNone` — a row with no tags has none of them). Guarded inside
  each shipped matcher, never in the runner, so a custom `filter()` predicate receives the cell
  unguarded and owns its own handling. No consumer-facing option (R27).
- **Pipeline:** filtering runs first, before group/sort/expand (unchanged).
- **A throwing predicate** deactivates that filter for the evaluation and reports once; it never
  takes the table down. Construction-time errors still throw. ADR-0014, R29.

## Deliberately not shipped

| Not shipped                                                              | Instead                                           | Decision |
| ------------------------------------------------------------------------ | ------------------------------------------------- | -------- |
| Runtime operator picker (AG Grid / PrimeNG column menu)                  | operators are fixed at declaration                | R1       |
| A _second_ filter on one path (`as` renames, it does not duplicate)      | one predicate over a compound criterion           | R6, R31  |
| `ColumnDef.filterFn` / `enableFiltering`                                 | predicates live in the schema                     | R12      |
| Per-filter `encode` for server params                                    | consumer maps `active()`                          | R16      |
| Debounce                                                                 | Signal Forms' `debounce()` over the model         | R25      |
| Persistence / storage adapter                                            | consumer's `JSON.stringify` + `reset(value)`      | R21      |
| Data-derived filter options (set filters)                                | consumer computes them                            | R11      |
| Any null/empty-cell option (`matchEmpty`, `cell:`, `isBlank`, `orEmpty`) | one internal policy; `filter()` for anything else | R27      |
| `toggle()`                                                               | `equals()` over a boolean column                  | R28      |

## Still open at spec time

1. ~~Null/undefined cell-value policy~~ — resolved, see R27.
2. ~~What happens when a predicate throws.~~ — resolved, see R29 and ADR-0014.
3. ~~Which symbols the barrel exports, and from which file~~ — unblocked by R30; the list is in
   [filters.md](../../filters.md#public-api).
4. ~~The fate of the superseded `with-filtering.ts`~~ — resolved, see R26.
5. Issue #6: close-and-replace, or rewrite (R13). **Belongs at `/to-issues`, not spec time.**
6. `state-persistence.md`'s filter slice (R22), and the shared persistence feature (R21).
   **Deferred by design** — R21 hands it to a separate persistence feature; do not solve it here.
7. ~~Matcher/rule name collision~~ — resolved, see R30.

---

## The scenario

```ts
interface Invoice {
  id: string;
  customer: string; // ← global search hits this
  status: 'draft' | 'sent' | 'paid' | 'overdue'; // ← dropdown, single select
  isArchived: boolean; // ← toggle
  dueDate: Date; // ← date-range picker
  amount: number; // ← numeric range
}
```

Requirements:

1. Global search box over all columns — the box lives in the consumer's toolbar.
2. Four per-column filters, each a different criterion **shape**: a union literal, a boolean, a
   `{ from, to }` date range, a `{ min, max }` number range.
3. `dueDate` has a **default supplied by the server** (current fiscal quarter), resolved
   asynchronously _after_ the table is constructed.
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
- **Persistence restore breaks.** `state-persistence.md` needs read _and_ write. The store can
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
      status: equals<Invoice['status']>(),
      isArchived: equals<boolean>(),
      dueDate: dateRange({ initial: () => inject(DEFAULTS).dueDateRange }),
      amount: numberRange(),
    },
  }),
];
```

```ts
this.table.setColumnFilter('dueDate', { from, to }); // ✅ shape checked
this.table.setColumnFilter('status', 'paid'); // ✅ union checked
this.table.setColumnFilter('status', 'nope'); // ❌ compile error
```

**Wins**

- Store owns state → matches the research verdict, the repo convention, and persistence restore.
- Per-column criterion types → fixes `value: unknown`.
- Kinds are composable _factories_, not config flags — one mechanism plus shipped sugar, the
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
unchanged — it registers a predicate the _pipeline_ runs, while `applyVisible` registers one the
_column fold_ runs. Same DSL surface, two different execution sites. Whether that's elegant
reuse or an overloaded word is the thing to decide.

---

## Comparison

|                                    | A: config + setters | B: rules + consumer signals | C: typed factories in config | D: rules + store-owned |
| ---------------------------------- | ------------------- | --------------------------- | ---------------------------- | ---------------------- |
| Criterion type safety              | ❌ `unknown`        | ⚠️ consumer's own types     | ✅                           | ✅                     |
| Column key checked vs `keyof TRow` | ❌ string           | ✅ path                     | ⚠️ config record             | ✅ path                |
| State owner                        | store               | consumer                    | store                        | store                  |
| Persistence **restore**            | ✅                  | ❌                          | ✅                           | ✅                     |
| `manual` mode serialization        | ✅                  | ✅ (read only)              | ✅                           | ✅                     |
| Async server seed                  | manual `effect`     | ✅ `linkedSignal`           | ✅ `initial` factory         | ✅ `initial` factory   |
| Req. 4 (no clobber)                | manual guard        | ✅ free                     | needs an option              | needs an option        |
| Matches repo DSL                   | ⚠️ new config shape | ✅ `apply*`                 | ⚠️ new config shape          | ✅ `apply*`            |
| Matches surveyed libraries         | ✅                  | ❌                          | ✅                           | ✅                     |
| New API surface                    | smallest            | small                       | largest                      | medium                 |

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

| Tension in A–D                                                                                               | How E dissolves it                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table-owns-state (less consumer boilerplate) **vs** consumer-owns-model (server mode untouched by the store) | Both. `createFilters` manufactures the state, but the object is consumer-held, not buried in a feature                                                                  |
| Server-side filtering dragging table complexity along                                                        | `withFiltering` is never composed. Consumer watches `filters.value()`, fetches, writes `data`. The store is not involved                                                |
| Enumerated filter kinds as public API surface                                                                | `filter(path, predicate)` is the contract; `equals`/`toggle`/`dateRange`/`numberRange` are shipped sugar over it — the relationship `insertRow` has to `value.update()` |
| Persistence restore                                                                                          | One object, one serializable value. Snapshot and restore without reaching into table internals                                                                          |
| Column-key typos                                                                                             | `ColumnsPath<TRow>` (already implemented) gives compile-checked paths                                                                                                   |

Three existing precedents in this repo, not one: `createTable(data, optsFn)`,
`columnSchema((path) => …)`, and `applyVisibleAsync`'s resource-backed rule.

## Where a default filter value comes from — three mechanisms, not one

The single most-corrected point of the discussion. `validateAsync` / `applyVisibleAsync` were
initially assumed to be the model for server-supplied defaults. **They are not**, and the reason
is semantic rather than syntactic.

| Source of the default                       | Mechanism                                        | Timing | User can override?                    |
| ------------------------------------------- | ------------------------------------------------ | ------ | ------------------------------------- |
| DI token / route resolver, already resolved | `inject()` in the schema body, read from closure | sync   | yes — plain initial value             |
| HTTP landing after construction             | **`linkedSignal`** over the resource             | async  | yes — writes win until source changes |
| Server-enforced constraint                  | `validateAsync` / `applyVisibleAsync` shape      | async  | **no** — resource always wins         |

`validateAsync`'s output is authoritative and continuous: it re-derives whenever params change
and always wins. Correct for visibility — a permission check _should_ keep overriding. Wrong for
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

| Signal Forms                                                          | Filters                       |
| --------------------------------------------------------------------- | ----------------------------- |
| model field value — the writable signal the user edits                | **the criterion**             |
| validator parameter, fixed at declaration (`minLength(path.name, 3)`) | the predicate's own constants |
| — (no equivalent)                                                     | the row cell being tested     |

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

**R3 — A filter declares a criterion key _and_ a read path.** These are the two things Option E
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

**Re-examined and upheld under R31 (2026-09-10).** `as` gives every single-path rule an
optional key override, which mechanically _could_ make two rules on one path legal by giving them
distinct keys. It deliberately does not: R5's single-occupancy check is on the **path**, not the
key, so two rules on one path throw whether or not their `as` names differ. Granting the escape
hatch is still the additive, non-breaking move it was here — moving that check from the path to
the key is a one-line change if the workaround proves to be reached for repeatedly.

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

The **matchers** are also exported as plain binary functions, so a custom predicate is assembled
from shipped parts rather than written from scratch. That is what makes R6's trade affordable.

> **Naming superseded by R30.** The examples in this decision give the matchers the same names as
> the rules, which cannot compile — one identifier cannot be both a one-argument declaration and a
> two-argument boolean test. Matchers are `isEqual` / `isContaining` / `isInRange` /
> `isInDateRange` / `hasAnyOf` / `hasNoneOf`; the rules keep the bare verbs. The mechanism R7
> describes is unchanged.

Rejected on the way here: collapsing the two forms into one, so that declaring a filter was
always `filter(path.x, equals)`. It removes a concept but reads as indirection — a schema rule
calling a rule — and abandons the Signal Forms writing style the whole design is modelled on.

**R8 — `anyOf(key, schema)`: one criterion, several predicates, OR'd.** A nested schema block,
in the Signal Forms idiom. Replaces the array/variadic sketches in R4, and removes the need for a
`search()` export entirely — text search is the ordinary instance of it.

```ts
createFilters<Invoice>((path) => {
  equals(path.status); // key borrowed from the path
  inRange(path.amount);

  anyOf('search', (path) => {
    // key given: three paths cannot supply one
    contains(path.customer);
    filter(path.amount, (cell, q) => cell > Number(q));
    filter(path.dueDate, (cell, q) => cell.getFullYear() === +q);
  });
});
```

Three properties, in the order they were argued:

1. **Per-path predicates, not a shared one.** This is what the variadic form
   (`contains(path.a, path.b)`) could not express — `contains` for free text, `startsWith` for an
   ID column, an arbitrary `filter()` for anything else.
2. **Two type slots per predicate, only one of them shared.** The _cell_ type comes from the
   predicate's own path and varies freely; the _criterion_ type is shared across the group. Above,
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

> **✅ Stands (2026-09-14, re-grill).** `createFilters` is still standalone, and R35's row carrier
> involves no table — the rows are an inference anchor and are never read. The snippet below
> predates the carrier; the shipped call form is in [`docs/1-state/filters.md`](../../../../filters.md).

**R10 — `createFilters()` is standalone, not a `withFiltering()` config field** (resolves Q7).
Forced by server mode, not chosen on taste: there, the filters feed the request that _produces_
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

> **⚠️ Superseded by R35 (2026-09-14, re-grill).** Data is accepted when it exists —
> `createFilters(rows, schema)` takes a row carrier, and `rowOf<Row>()` is the server-mode escape
> hatch rather than a separate API, so "takes no `data` argument" is no longer the shape.
> **Its closing claim is factually wrong.** Recovery through the _callback_ was never the
> mechanism: R35 anchors `TRow` on a value in argument position, exactly as `createTable(data, …)`
> and `form(model, …)` do — the two APIs R11 itself names as better off. Compiled evidence:
> [research-typescript-inference-probes.md](../filters-inferred-state/research-typescript-inference-probes.md).
> The accepted-cost block below is what R35 removed, and it stays on the page. Shipped shape:
> [`docs/1-state/filters.md`](../../../../filters.md).

**R11 — `createFilters` takes no `data` argument; it is parameterised by `TRow` only**
(resolves Q2).

Consequence of R10: in server mode the data does not exist when the filters are declared. The
data signal _is_ `this.invoices.value`, which depends on the resource, which depends on the
filters — so `createFilters(this.data, schema)` is a circular reference. Data cannot be a
**required** argument.

Two things were dropped in that step, and only one was forced:

- **Reading rows to derive filter options** — AG-Grid-style set filters, whose dropdown values
  come from the distinct values in the loaded rows. Genuinely impossible in server mode, since
  the rows arrive already filtered. Correctly dropped; the consumer computes options from their
  own data and passes them to their own control.
- **Type inference** — only needs the data in client mode, where it _does_ exist. Not forced.

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

**They are not dead fields today, so deleting them is not free.** Issue #6's framing ("typed but
unconsumed") no longer holds: both are declared at `api/types.ts:78-79` and actively consumed by
the superseded `api/features/with-filtering.ts` — `const match = column.filterFn ??
defaultFilterMatch;` and `if (column.enableFiltering === false) { return false; }`. Removing the
two fields therefore means removing that feature file and its spec as well. That is the same
open user decision the handoff already records; R12 does not settle it unilaterally.

**R13 — Issue #6 is left untouched until the spec is written.** Roughly 7 of its 12 requirements
are contradicted — every one that names an API symbol — and it still refers to `createTableStore()`
and `store.setData()`, both renamed in shipped code. Its behavioral half survives: filtering runs
first in the pipeline, filters AND together (refined by R8 to _across filters_ AND, _within a
group_ OR), `manual: true` skips the client stage, no built-in debounce, tests through the public
surface only. Whether to close-and-replace or rewrite it is deferred to spec time.

**R14 — Empty criteria skip their predicate but stay in the aggregate.** Two halves:

_Skipping is forced._ `isContaining(cell, '')` would match everything and
`inRange(cell, {min:null,max:null})` would throw, so an empty criterion must skip evaluation.
What counts as empty is **per-predicate** — `''`, `null`, `{min:null,max:null}`, `[]` — so each
shipped predicate declares its own emptiness test, and `filter()` must let a custom predicate
declare one too. This is TanStack's `autoRemove` factoring, chosen over PrimeNG's (which repeats
the check inside all twenty match functions, subtly divergently). See
[research-generic-filter-utilities.md](research-generic-filter-utilities.md), Finding 5.

_Visibility is not one choice — there are two shapes, and both ship._ This came out of a
pushback that was right: filters were compared to the Signal Forms **model** (always complete),
but they are equally comparable to `errors()` (only what is active). Signal Forms has both, and
so do we.

Verified from the docs: a validator returns `null`/`undefined` when it passes, so `errors()`
carries only failures; and the model "always contains every declared field regardless of
validity" — the structure is fixed, validity travels in separate signals
([validation guide](https://angular.dev/guide/forms/signals/validation)).

| Signal Forms | Shape           | Filter analogue                       |
| ------------ | --------------- | ------------------------------------- |
| model        | always complete | the criteria the user edits           |
| `errors()`   | only active     | which filters are currently narrowing |

A criterion is user-editable input, two-way bound to a control — that is the **model**. "Which
filters are active" is derived output of evaluation — that is **`errors()`**. Different things,
both needed:

```ts
filters().value(); // { status: null, amount: { min: null, max: null }, search: 'acme' }
filters().active(); // { search: 'acme' }
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
`readonly` / `hidden` take `{ when }`, and _"Like disabled fields, hidden fields also skip
validation"_ with values preserved
([form logic](https://angular.dev/guide/forms/signals/form-logic)). Same `{ when }` vocabulary
this repo already adopted for `applyVisible`.

```ts
createFilters<Invoice>((path) => {
  equals(path.category);

  applyWhen(
    path,
    ({ valueOf }) => valueOf(path.category) !== null,
    (path) => {
      equals(path.subCategory); // only applies once a category is chosen
    },
  );
});
```

It belongs at the rule level, not inside the predicate, because of R14's two shapes. A condition
written into the predicate as a pass-through:

```ts
filter(path.subCategory, (cell, c) => (!hasCategory() ? true : cell === c)); // ✗
```

…still reports the filter as active, so it reaches the URL and the "N filters applied" chip while
matching every row. `when` switches it off at the right level: the criterion stays in `value()`,
disappears from `active()`. Precisely the disabled/hidden semantics Signal Forms already defines
— value preserved, evaluation skipped.

**R16 — No per-filter `encode`. The consumer maps `active()` to their transport.** Server APIs
differ irreconcilably (`?amount_min=&amount_max=`, `?amount=100..900`, `{amount:{gte,lte}}`), and
`active()` is a plain object, so mapping it is a pure function the consumer owns:

```ts
params: () => toQuery(this.filters.active());
```

An `encode` option would sit next to the declaration that knows the criterion's shape, which is
appealing — but it couples the schema to _one_ transport, and a filter set feeding both an HTTP
API and the URL bar needs two encodings. One slot cannot hold both. Revisit only if writing those
mapping functions proves repetitive across tables.

**R17 — One `reset(value?)`, in the reactive-forms shape** (resolves Q1).

```ts
filters().reset(); // → source (or empty when no source is declared)
filters().reset(null); // → empty
filters.amount().reset({ min: 0, max: 500 }); // → an arbitrary value
filters.amount().reset(); // per-filter, same three forms
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
_"Resets the touched and dirty state of the field and its descendants"_ — with no argument it
does **not** change the value ([angular/angular#65949](https://github.com/angular/angular/issues/65949):
_"takes an optional value to set to the form, and if not passed, the value will not be changed"_),
which is the sharp edge this repo already records at `row-editing.md:583`. Our `reset()` changes
the **value** — back to source, to empty, or to an argument. Same word, different operation, and
both are reachable at once when a form is layered over the filters
(`filterForm.search().reset()` clears flags; `filters.search().reset()` changes the criterion).

Delegating reset to the form entirely was considered and rejected: its no-argument form cannot
express "back to source", its value form needs a value the library holds and the consumer does
not, and a consumer using plain `<input>`s would have no reset at all — which would make R18's
optional form wiring mandatory.

Verified wrinkle in the other borrowed precedent: Angular's reactive-forms `reset()` defaults to `null`, and
returns to the initial value only when the control is `nonNullable: true` — _"By default, the
control will reset to null"_ ([FormControl](https://angular.dev/api/forms/FormControl)). Since
`nonNullable: true` is the recommended modern usage, reset-to-declared-value is what most Angular
developers actually experience, so the borrowed shape reads correctly despite the inverted
default.

Interaction with R14: after `reset()` a sourced filter is non-empty, so it stays in `active()`
and in the request URL. After `reset(null)` it drops out of both.

**R18 — The model is one `WritableSignal`, so a consumer can put a real Signal Form over it.**
Signal Forms never copies state — the developer's `WritableSignal` _is_ the source of truth
([research-filter-state-ownership.md](research-filter-state-ownership.md)) — so exposing the
criteria model as one writable signal makes form wiring free:

```ts
readonly filterForm = form(this.filters().value, (path) => {
  required(path.search);
  min(path.amount.min, 0);          // validate the criteria themselves
});
```

```html
<input [formField]="filterForm.search" />
```

No adapter, no sync effect, no duplicated state. The model is plain data (R2), which is exactly
what `form()` accepts.

> **Implementation note, 2026-09-14.** R18 was _specified_ here but not _delivered_: the shipped
> `buildFiltersRoot()` made root `value` a plain getter, so `form(filters().value, …)` could not
> be constructed, and the first consumer (the filtering stories) reintroduced exactly the
> duplicated model and sync effect this decision exists to remove. Now closed —
> `createRootValueSignal()` in `api/filters/state.ts` makes root `value` a writable view over
> the child nodes.
>
> One sub-claim below is also wrong and worth correcting, because it drove the storage layout:
> per-filter handles are **not** views onto keys of one root signal. Each node owns its signal
> and the root is the view over them. `form()` does not care which direction the view points —
> it needs a callable carrying a reactive node plus `set`/`update`/`asReadonly`, which is
> exactly what Angular's own `deepSignal` synthesizes. Node-first keeps each node's
> `source`/`dirty` reconciliation local to the node that owns it instead of making it a per-key
> merge the root has to arbitrate.

No separate `filters.model` is needed: `filters().value` **is** the `WritableSignal`, verified as
_"A writable signal containing the value for this field. Updating this signal will update the
data model that the field is bound to"_
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
dirty = () => !equalsCriterion(value(), sourceValue());
```

Any write updates it automatically — the user typing, a form writing through, a snapshot restore,
`reset(v)`. There is no flag to keep in sync, which removes a whole class of desync between the
filters and a Signal Form layered over them (R18). Stored flags on both sides would be two facts
that can diverge; one derived value cannot.

One semantic difference from Signal Forms, and it is harmless: theirs is dirty _"even if the
current value matches the initial value"_; ours reads false when the user happens to type exactly
the source value. `dirty` exists only to answer "may the source overwrite this?" — and when the
value already equals the source, overwriting is a no-op. No observable effect.

```ts
filters.amount().dirty(); // false → follows the server default as it arrives and changes
// true  → the written value holds; source arrivals do not overwrite
filters.amount().reset(); // clears dirty → follows the source again
```

Verified: Signal Forms defines `dirty()` as _"User has modified an interactive field (even if
they never blurred it, and even if the current value matches the initial value)"_, `touched()` as
focus/blur, and `reset()` _"clears the touched and dirty flags"_
([field state](https://angular.dev/guide/forms/signals/field-state-management)). The same word
for the same idea — but load-bearing here rather than informational: in a form `dirty` drives an
"unsaved changes" prompt; here it decides who wins when the config request lands.

Restoring counts as a write because that value _was_ a user's earlier choice — and with the
derived form it needs no special handling; a restored value that differs from the source is dirty
by construction. Nothing is permanently detached, though: a genuinely updated server default
reaches the user the moment they reset.

`overridden` describes the mechanism more literally and would remove a name collision with the
form's own `dirty`. `dirty` was kept on familiarity, so the distinction must be documented — the
two are different facts:

|                               | means                                                                      |
| ----------------------------- | -------------------------------------------------------------------------- |
| `filterForm.amount().dirty()` | user edited this control since the last form reset — a UI concern          |
| `filters.amount().dirty()`    | this criterion is no longer following its source — the reconciliation gate |

**Values cannot desync between the two; flags can.** Per R18 the form's model _is_
`filters().value` — one storage location, two views — so a write through either is the same
write. Only the flags are separately owned. The residue to document: `filters.amount().reset()`
changes the value but does not clear the _form's_ `touched`/`dirty`; a consumer who cares calls
`filterForm.amount().reset()` as well.

Distinct from `active()`:

|                                     | `dirty`                     | in `active()` |
| ----------------------------------- | --------------------------- | ------------- |
| untouched, no source                | false                       | no            |
| untouched, source gave `{0, 10000}` | false                       | **yes**       |
| user typed a value                  | **true**                    | yes           |
| user typed exactly the source value | false — harmless, see above | yes           |
| user cleared it (`reset(null)`)     | **true**                    | no            |

Signal Forms has no equivalent for the conflict itself — the docs _"[do] not address
asynchronous server defaults or value reconciliation"_. It supplies the mechanism, not the
policy.

**R20 — Every node is callable for state, navigable for children** (resolves Q5). The Signal
Forms shape, adopted whole: **property access = child, call = state**, root included.

```ts
filters(); // root state
filters().value(); // whole criteria model
filters().active(); // R14
filters().reset(); // R17
filters().dirty(); // R19

filters.status; // a filter node
filters.status().value(); // its criterion
filters.status().value.set('open');
filters.status().reset();
```

Chosen because it removes a real collision structurally rather than by convention. A flat
`filters.status.value()` shape puts the library's members in the same namespace as the consumer's
column names, and `value`, `active`, `reset` and `dirty` are all plausible column names — an
invoice's `value` is the obvious one. Under R20, `filters.value` is _always_ the handle for a
column named `value` and `filters().value` is _always_ the model. No reserved words, no
sub-namespace.

Note this reverses, for filters only, the table's own choice recorded in
[`../with-mutations/2-decisions.md`](../../../row-editing/archive/with-mutations/2-decisions.md) (D-block at :436–449),
which rejected "the full callable-plus-`.value` `Field` shape" in favour of flat members. That
rejection turned on the table having _three independent slices and no single root model_,
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

What a shipped mechanism _would_ buy is the fiddly part, and it is not the storage abstraction:
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
_"The injector to use for dependency injection. If this is not provided, the injector for the
current injection context, will be used."_
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
not a spec-time edit** (resolves Still-open #5, and the deletion half of R12).

`src/api/features/with-filtering.ts`, its spec, `FilterRule` in `api/types.ts`, the
`src/index.ts` barrel line, and `ColumnDef.filterFn` / `ColumnDef.enableFiltering` are all left
untouched while the specs are written. The specs describe `createFilters()` only; they do not
describe the code currently in the tree, and they do not pretend the two fields are already gone.

Reasoning: the specs and the deletion are separable units of work, and deleting first would leave
the library with no filtering at all for the whole spec-writing window. R12 is unchanged as a
_decision_ — the fields go — but it is executed as a step in the implementation plan, sequenced
with the code that replaces them, so filtering never regresses to nothing.

**Corrected 2026-09-10 — the code is committed, not untracked.** This decision was first recorded
while `with-filtering.ts` was an untracked file, on the reasoning that nothing would be lost.
`be39054 feat(shared-table): add withFiltering() feature plugin` has since committed it, and
`index.ts:13` exports it, so `withFiltering()`, `FilterRule`, `setColumnFilter()`,
`clearColumnFilter()`, `setGlobalFilter()` and `clearFilters()` are **published public API**.
The decision stands and is in fact stronger — deleting them is now a breaking change to the
public surface, not a cleanup — but the removal step must be planned as one:

- It is a `feat!`/`BREAKING CHANGE` commit, not a chore.
- `docs/1-state/features/filtering.md`'s competitive-verdict block currently reads "still
  missing" on the grounds that the code implements a superseded shape. That framing predates the
  commit and should be re-checked when the spec is rewritten.

Consequences for the spec pipeline:

- `/to-tasks` must emit an explicit removal step: delete `with-filtering.ts` + `.spec.ts`, remove
  `FilterRule` and the `index.ts` export, and drop `filterFn` / `enableFiltering` from
  `ColumnDef`. It depends on `createFilters()` landing first.
- Until that step runs, `features/filtering.md`'s superseded banner stays accurate and must keep
  saying the code exists.

**R27 — Null/undefined cells are handled inside the matchers, with no consumer-facing option**
(resolves Still-open #2).

The policy, in full:

> A null or undefined cell value fails every positive matcher (`equals`, `contains`, `inRange`,
> `inDateRange`, `hasAny`) and passes every negative one (`hasNone`) — a row with no tags has
> none of them. Custom `filter()` predicates receive the cell unguarded and own their own
> handling.

```ts
// positive — a null/undefined cell fails
equals = (cell, c) => cell != null && cell === c;
contains = (cell, c) => cell != null && String(cell).toLowerCase().includes(c.toLowerCase());
inRange = (cell, c) =>
  cell != null && (c.min == null || cell >= c.min) && (c.max == null || cell <= c.max);
inDateRange = (cell, c) =>
  cell != null && (c.from == null || cell >= c.from) && (c.to == null || cell <= c.to);
hasAny = (cell, c) => cell != null && c.some((v) => cell.includes(v));

// negative — a null/undefined cell passes
hasNone = (cell, c) => cell == null || !c.some((v) => cell.includes(v));
```

**The positive/negative split is not symmetry for its own sake.** PrimeNG returns `false` for a
null field in every operator _except_ `notEquals`, which returns `true`
([research-generic-filter-utilities.md](research-generic-filter-utilities.md), Finding 5). That
carve-out reads as an inconsistency until you write out the sentence: "this row's tags do not
include 'draft'" is _true_ of a row with no tags. A blanket "null always fails" rule would ship
that as a silent bug in the one negative matcher we have.

Order of evaluation — the null check is third, not first:

```
criterion empty (R14)?  → skip the filter entirely; absent from active()
      ↓ no
read the cell via its path
      ↓
matcher runs; it owns its own null branch
```

So a null cell is only ever reached by an _active_ filter. `equals(path.status)` with criterion
`null` evaluates nothing.

**The guard is in the matchers, never in the runner.** A runner-level short-circuit would produce
the same result for shipped matchers while making one whole class of filter unwritable — "show me
only the rows where this is blank", which is an ordinary table feature (AG Grid ships
blank/notBlank operators). Guarding per matcher keeps it expressible with no library feature at
all:

```ts
filter(path.notes, (cell, want: boolean) => want === (cell == null || cell === ''));
```

`''` gets no special status: it is a normal value that positive matchers happen to return `false`
for. Deliberately unlike `applySortNulls()`'s `emptyString: 'is-empty'` opt-in
(`schema/column-rules.ts:49`) — sorting needs it because `''` must be _placed_ somewhere in an
order, and filtering has no equivalent need.

**Four alternatives were prototyped and deferred, not rejected on merit.** Sketches kept because
the exploration is the expensive part:

| Sketch                      | Shape                                                                                   | Why deferred                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `matchEmpty: boolean`       | `contains(path.notes, { matchEmpty: true })` — an empty cell passes                     | Solves a case no consumer has asked for. Library must also fix one definition of "empty"                          |
| `cell: (v) => v`            | `inRange(path.amount, { cell: (v) => v === 0 ? null : v })` — normalize before matching | More reach than the boolean (sentinels, trimming, and R8's cell-type problem), but every null case costs a lambda |
| `isBlank()` / `isPresent()` | named rules, toggle-shaped criterion                                                    | The one case a user actually raised — but nothing in this repo needs it yet                                       |
| `orEmpty()` / `onlyEmpty()` | combinators over the exported matchers (R7)                                             | Most consistent with R6/R7; pushes the non-default case out of the named-rule syntax R3 was built for             |

All four are **purely additive to a rule's opts object or to the exported-matcher set**, so
shipping any of them later is non-breaking — the same reversibility test R6 used to defer
`{ as: }`. The forced part of this decision is only that shipped matchers must not crash on real
data (`null.includes()` throws); everything past that sentence is configurability, and
`general-mechanism-over-enumerated-cases`
cuts against shipping a mechanism nobody has extended yet.

Revisit when a real screen needs blank filtering. That day it is a custom `filter()` predicate;
sugar the day after.

**R28 — `toggle()` is dropped; a boolean column uses `equals()`.**

`toggle(path.isArchived)` and `equals(path.isArchived)` are the same predicate — `cell === c`.
The only difference `toggle` could carry is a different emptiness rule, treating criterion `false`
as empty rather than as "show unarchived rows". That reading was never decided, and deciding it
would make one matcher's R14 emptiness test disagree with every other matcher's for no gain.

```ts
equals(path.isArchived); // null → filter off; false → show unarchived; true → show archived
```

Dropping it removes a shipped matcher and closes the open question about criterion `false` in the
same step. The consumer's UI control is still a toggle; the rule behind it is `equals`.

**R29 — A throwing predicate deactivates its filter; it never takes the table down**
(resolves Still-open #3). Full reasoning in
[ADR-0014](../../../../../adr/0014-runtime-error-policy.md), which this decision produced and which
governs every consumer callback in the library, not just filter predicates.

The filter-specific half:

- A predicate that throws → **that filter does not apply for this evaluation**. Other filters
  still narrow; the table still renders.
- Reported once per filter per evaluation (not per row), with the filter key, the predicate, and
  the offending cell — in production as well as dev.
- Wrapped **per filter**, not per row. Per-row catching yields an inconsistent row set (some rows
  tested, some skipped) and puts a `try` in the hot loop.
- Construction-time errors are unaffected and still throw: a duplicate filter on one path (R5),
  an unknown path, an `anyOf` without a key.

Why this came up here rather than in sorting, which has the same exposure: R27 hands custom
`filter()` predicates an unguarded cell **by design**, so that matching nulls stays writable. That
makes a consumer predicate the likeliest thing in the library to throw, and R21's
consumer-owned `JSON.parse` persistence makes a stale criterion the likeliest reason.

Residue, carried into the specs: a filter that failed still appears in `active()`, because
`active()` describes which criteria are _set_ (R14), not which evaluations succeeded.

**R30 — Rules keep the bare verb; matchers take a boolean-guard prefix** (resolves Still-open #8,
unblocks #4).

R7 shipped both forms under one name, which cannot compile: `equals(path.status)` registers a
filter (one argument, a path, returns `void`), while `equals(cell, criterion)` tests a value (two
arguments, returns `boolean`). One identifier, two functions.

Resolved by the repo's naming convention rather than by namespacing: **a function returning a
boolean guard is named `is*` / `has*`**; a bare verb is reserved for a function that _does_
something — here, registering a filter.

| Rule (declares, returns `void`) | Matcher (tests, returns `boolean`) |
| ------------------------------- | ---------------------------------- |
| `equals(path)`                  | `isEqual(cell, criterion)`         |
| `contains(path)`                | `isContaining(cell, criterion)`    |
| `inRange(path)`                 | `isInRange(cell, criterion)`       |
| `inDateRange(path)`             | `isInDateRange(cell, criterion)`   |
| `hasAny(path)`                  | `hasAnyOf(cell, criterion)`        |
| `hasNone(path)`                 | `hasNoneOf(cell, criterion)`       |

```ts
// rule form — declaration
contains(path.customer);

// matcher form — assembling a custom predicate from shipped parts
filter(path.tags, (cell, c) => hasAnyOf(cell, c.include) && hasNoneOf(cell, c.exclude));
```

Both arguments of a matcher arrive at **evaluation** time — the cell from the row, the criterion
from filter state. A matcher never carries a constant; it is the same function the library calls
internally per row.

Rejected: namespacing the matchers (`matchers.equals`) — it reads as a second-class surface and
makes the assembled-predicate case, which R6's affordability argument depends on, wordier at
exactly the point it needs to be cheap. Also rejected: discriminating on arity — one overloaded
export whose meaning flips on argument count is the kind of API a reader has to memorise.

Note `hasAny`/`hasNone` were already boolean-shaped names in the rule position; `hasAnyOf` /
`hasNoneOf` moves the guard reading to the matcher and leaves the rule reading as a declaration.

> **✅ Stands, and is finally enforceable (2026-09-14, re-grill).** R45 gave the literal-key guard
> a real inference site, so the string-literal requirement below is now rejected at compile time
> instead of being advice.

**R31 — `as` overrides a borrowed key; it does not license a second filter on the path.**

R9 borrows the key from the path when there is one, and `anyOf` takes a key positionally because
a group has none to borrow. `as` completes that symmetry: the key is _available_ from the path
but is not always the right name to expose.

```ts
equals(path.customerAccountName, { as: 'customer' }); // → filters.customer
inDateRange(path.dueDate, { as: 'due' }); // → filters.due, ?due=…
```

The model's field name, the URL parameter, the persisted snapshot key and the binding-site name
are four different concerns that happen to coincide most of the time. When they don't, renaming
at the declaration is cheaper than the mapping function R16 otherwise leaves to the consumer.

Typing: the `as` value must be a **string literal** so it can flow into `Filters<TRow>`. A
`string`-typed variable widens the handle map and is rejected at compile time.

**Deliberately does not reopen R6.** An `as` makes two rules on one path produce two distinct
keys, which is mechanically the `{ as: 'name' }` escape hatch R6 rejected. That is not what this
ships:

- **R5 is unchanged and checked on the _path_, not the key.** Two rules on one path throw at
  construction whether or not their `as` names differ.
- **Duplicate keys also throw** — two rules given the same `as`, or an `as` colliding with
  another filter's borrowed key.

So the single-occupancy rule survives intact, and combining operators on one column still means
dropping to `filter()` with a compound criterion. Removing the path check later — and thereby
granting R6's escape hatch — remains additive and non-breaking, which is the same reversibility
argument R6 itself was decided on.

> **⚠️ Superseded by R34/R36 (2026-09-14, re-grill).** The criterion map is inferred from the
> schema's returned array; the caller-supplied type parameter is gone. The argument below rests on
> `schema: (path) => void` having no return channel to observe — sound on its own premise, and the
> premise is what moved: R34 made every rule return its record, R36 made the schema return them.
> Shipped shape: [`docs/1-state/filters.md`](../../../../filters.md).

**R32 — `Filters<TRow, TState>` takes a second, caller-supplied type parameter.**

`createFilters<TRow>(schema)`'s single-param signature (R11) assumed `TState` — the flat
criterion map, one key per declared filter — could be derived from the schema fn's recorded rule
calls, the way `ComposedFeatureMembers` derives a table's member type from its `features` array.
It can't: `features` is a value with its own static tuple type for TypeScript to read back;
`schema: (path) => void` returns `void`, so there is no channel to observe which keys a
void-returning function's body touched. `createFilters<TRow, TState extends Record<string,
unknown> = Record<string, unknown>>(...)` is the fallback: correct, precise per-key typing once
`TState` is supplied, at the cost of writing it out once at each call site (on top of R11's
existing `TRow` cost). A consequence, not separately decided: enforcing `as` as a string literal
(R31) needs the same missing channel — `TState`'s shape isn't derived from `as` calls either, so
nothing currently rejects a `string`-typed `as` value at compile time. Revisit if TypeScript
gains a way to invert an imperative builder into an inferred return type; until then this is
accepted the same way R11 accepted `TRow`'s cost.

> **⚠️ Ceases to exist (2026-09-14, re-grill).** Nothing took this decision's job over — the job
> stopped existing. The ambient recorder stack is deleted with the recorder itself (R34): every
> rule builds and returns its own record, so there is no enclosing session to recover. Both riders
> go with it — the non-reentrancy caveat, and the "Known gap" that forced
> `anyOf<Invoice>('search', …)`, since `anyOf(key, children)` takes already-built rules and has no
> inner callback to infer `TRow` for. Shipped shape: [`docs/1-state/filters.md`](../../../../filters.md).

**R33 — `anyOf`/`applyWhen` recover their enclosing recorder from an ambient stack, not a parameter.**

Every single-path rule (`equals`, `contains`, …) gets its recorder from the `FilterHandle` it's
called with — the handle carries it. `anyOf(key, schema)` and `applyWhen(path, condition,
schema)` both need to push one compiled record into the _outer_ schema's recorder once their own
nested schema fn finishes, but neither has a path argument built for that purpose (`anyOf` has no
path at all; `applyWhen`'s `path` argument only anchors `TRow` for inference, mirroring how a
single-path rule's argument does the same). A stack of "whichever recorder is synchronously
running right now" (pushed by `createFilters()` and by each nested `anyOf`/`applyWhen` call,
popped in a `finally`) stands in for the missing parameter. Sound only because schema functions
are synchronous by contract (R24's own premise) — an `await` inside one before its session
closes would interleave with a concurrent call's stack frame. Not reentrant-safe by design,
because nothing about `createFilters()` is meant to run concurrently with itself.

**Known gap — `anyOf`'s inner schema callback cannot infer `TRow` from context.** Unlike
`applyWhen`, `anyOf(key, schema)` carries no argument typed by the outer `TRow`, so
`anyOf('search', (path) => { … })` written bare — as shown above — does not compile; call sites
need `anyOf<Invoice>('search', (path) => { … })`. `applyWhen` doesn't have this gap, since its
`path` parameter anchors `TRow` the same way a single-path rule's argument does. Filed here
rather than reopened as a design question: fixing it would mean changing `anyOf`'s parameter
order or count, which is out of scope for the primitive as specified.

## Re-grill — inferred `TState` (2026-09-14)

Grounded in
[research-typescript-inference-probes.md](../filters-inferred-state/research-typescript-inference-probes.md)
— every claim there is a compiled assertion under the repo's own TypeScript 6.0.3, `--strict`,
exact-match `Equal<X, Y>`. R32 ("`TState` cannot be inferred") was correct about the _then_
signature and wrong as a limit of TypeScript: the channel is missing only because rules record
by side effect.

**Dependency ranking** (`decompose-by-dependency-graph`):

```
[1 rules return records] ──┬─> [3 array vs object] ─┬─> [4 anyOf flattening]
                           │                        ├─> [5 applyWhen spread]
                           │                        └─> [9 `as` literal enforcement]
                           └─> [8 bare-statement lint]
[2 TRow carrier arg] ──────────> [7 TRow=never guard]
[6 key-uniqueness validate] (independent)
                           all ─> [10 migration + supersede R10/R11/R31/R32/R33]
```

Core: 1, 2. Independent: 6. Everything else sequenced behind them.

**R34 — Rules return their record; the side-effect recorder is deleted.** Hard cutover, no
dual-mode overload. `equals`/`contains`/`inRange`/`inDateRange`/`hasAny`/`hasNone`/`filter`
return a `FilterRule<TKey, TCriterion>` instead of `void`, and the schema function returns the
collection of them — that return _is_ the inference channel R32 found missing. At a call site it
is a concise arrow, so no `return` keyword is visible.

Deleted outright: `filters/recorder.ts` (ambient stack, session,
`withActiveFilterRecorder`, `assertFilterPathIsCurrent`), the `FILTER_RECORDER` symbol,
`FilterHandle`'s recorder field, `FilterSchemaRecorder`. **R33 does not get superseded — it
ceases to exist**, along with its non-reentrancy caveat and its `anyOf`-can't-infer-`TRow` gap.

Dual-mode (rules return _and_ record, with a `void`-schema overload so nothing migrates) was
rejected on a correctness argument, not on migration cost: a braces-bodied schema that returns
some rules while calling others bare would run the bare one and omit it from `TState` — the type
lying about runtime, silently. Under the cutover the same bare statement is merely inert, which
is a lint problem, not a divergence. Migration cost is not a factor either way: 13 call sites, all
inside `libs/shared/table`, no external consumers.

**R35 — `createFilters(rows, schema)` takes a wide first slot: data _or_ a `rowOf<TRow>()` token.**
One argument serves both modes, with no named carrier/evidence type:

```ts
declare function createFilters<TRow, S extends readonly unknown[]>(
  rows: readonly TRow[] | (() => readonly TRow[] | undefined) | RowToken<TRow>,
  schema: (path: FiltersPath<TRow>) => S,
): Filters<TRow, StateOf<S>>;
```

All seven carriers infer `TRow` exactly (§3): arrays and readonly arrays, `Signal`/
`WritableSignal`, a signal of `T[] | undefined` (a resource's value pre-load), a bare
`() => TRow[]` store method, and `rowOf<TRow>()`. Non-row values (`42`, `{ foo: 1 }`) are
rejected. The middle union member — _any callable returning rows_ — covers the four
signal-shaped cases on its own; an earlier recursive `RowOf<E>` conditional plus a named
`RowEvidence` constraint was discarded as machinery re-deriving what one union member states
directly, for identical coverage.

**`rows` is an inference anchor and is never read at runtime.** Under R10 `createFilters` is
standalone; data reaches the engine through `withFiltering(table, filters)`. The wide slot was
chosen over a token-only slot for ergonomics — passing data already to hand beats constructing a
token — accepting that `createFilters(this.invoices, …)` reads as if it binds. That must be
stated at the top of the signature's docs, not left to be discovered.

This supersedes R11's "no `data` argument": data is accepted when it exists, and `rowOf()` is the
server-mode escape hatch rather than a separate API. It also corrects R11's closing claim that
TypeScript cannot recover `TRow` from a callback parameter — it can (§2); it is merely fragile,
which is why the carrier, not the annotation, is the mechanism.

**R36 — The schema returns an **array** of rules; keys stay implicit, borrowed from paths.**
Channel 1 of the three TypeScript offers. `StateOf<S>` folds the returned tuple into the
criterion map:

```ts
type StateOf<T extends readonly unknown[]> = {
  [R in Extract<T[number], AnyRule> as R['key']]: CriterionOf<R>;
};
```

```ts
createFilters(this.invoices, (path) => [
  equals(path.status),
  inRange(path.amount),
  contains(path.customer, { as: 'client' }),
  anyOf('search', [contains(path.note), filter(path.id, matchesInvoiceNumber)]),
]);
// → Filters<Invoice, { status: …; amount: {min;max}; client: string; search: string }>
```

Criteria infer exactly, including `filter()`'s, taken from the predicate's own annotation — so a
hand-written `tags: TagCriterion` entry disappears. The array keeps today's ergonomics: one key
space, keys borrowed from paths, `as` renaming (R31 survives), `anyOf`'s key positional (R9
survives).

The object form (`(path) => ({ status: equals(path.status) })`) infers equally exactly and was
rejected on cost, not capability: it would make every key a property name, deleting `as` and
`anyOf`'s positional key and turning duplicate keys into ts1117 — at the price of writing
`status:` beside every `path.status`, i.e. restating in the key what the path already says.

**Rejected: a third `model` argument (Signal Forms' own mechanism).** `form(model, schema)` needs
no return channel because `model` already _is_ the form's type and `path` walks that same model.
Filters have two key spaces — rules read row paths and write criterion keys, and the row does not
determine the criterion (`amount: number` → `{min,max}`; `note` + `id` → one `search`). So a model
would be a _third_ argument beside the carrier, stating every key a second time with nothing
cross-checking the two. Channel 1 states each key once.

> **Implementation constraint, non-negotiable (§5).** Never name the key type in the schema's
> constraint. `S extends readonly FilterRule<string, unknown>[]` contextually types the array
> elements and pushes `string` down onto every rule's key parameter, widening all of them; the
> tuple survives, so it reads like tuple widening and sends you after the wrong cause. Use
> `S extends readonly unknown[]` and `Extract` inside `StateOf`. `as const`, the `const` type
> parameter modifier, and a variadic `[...T[]]` constraint all fail to fix it — none addresses
> contextual typing. This bit `createFilters` and `applyWhen` identically; every future rule
> combinator takes the same constraint.

> **⚠️ Corrected in implementation (2026-09-14).** The closing claim below — that `applyWhen(…)`
> and `...applyWhen(…)` "both work and neither can be got wrong" — is not what shipped. The node
> deliberately has no `[Symbol.iterator]`, so a spread is a `TS2488` compile error rather than a
> second working form (`rules.ts`'s `applyWhen`, `types.ts`'s `ConditionalRule`). The decision
> itself stands: the node is what removes the silent-drop failure, and failing loudly on the
> spread is how. Shipped shape: [`docs/1-state/filters.md`](../../../../filters.md).

**R37 — `applyWhen` returns one nestable node; `StateOf` recurses into nested rule collections.**
The research doc's shape — `applyWhen` returns an array the caller spreads — introduces a silent
failure the current void API cannot have: a forgotten `...` leaves a nested array in the tuple,
`Extract<T[number], AnyRule>` skips it, and those filters disappear from `TState` _and_ from the
runtime with no error at either level. Instead `applyWhen` returns a single value carrying its
children and `StateOf` flattens nested collections, so `applyWhen(…)` and `...applyWhen(…)` both
work and neither can be got wrong. Cost: one recursive conditional in `StateOf`, paid once in the
library, against a silent data-loss failure paid at every call site.

Each gated rule still keeps its own key and still lands as a top-level entry in `TState` — the
nesting is syntax, not structure. R15's semantics are unchanged: every rule inside shares the one
gate, none references the others.

> **Correction to [research-typescript-inference-probes.md](../filters-inferred-state/research-typescript-inference-probes.md)'s
> "Known holes" #2.** Key collision is _not_ an open hole. `filters/validate.ts` already throws at
> construction on a duplicate key ("Two filters both resolve to the key …"), alongside the
> path-uniqueness check — both shipped with R5/R31. The type-level merge the research doc
> describes is real but unobservable: construction throws before anyone reads `TState`. Node 6 of
> the ranking needs no work.

**R38 — `path` stays a callback parameter; no standalone `pathOf<TRow>()`, no `filtersSchema()`
value.** R36's callback is upheld against two alternatives raised during the re-grill.

_Rest arguments instead of an array_ — `filtersSchema(equals(invoice.status), inRange(invoice.amount))`
— is newly possible only because of R34: once rules stop recording, a `FilterHandle` is purely
structural (an `id` and a phantom `TRow`), so a free-standing `pathOf<TRow>()` is sound where
today `assertFilterPathIsCurrent` forbids it. Rest params infer as a tuple, so `StateOf` and the
§5 constraint work identically. Rejected anyway: rules are evaluated eagerly as arguments, so the
path must be bound to a name before any rule is written. That buys a module-scope, reusable,
independently unit-testable schema value at the cost of a binding line and a path that can be
paired with the wrong carrier. The callback scopes the path to exactly the schema that uses it and
costs nothing.

_String keys_ — `equals('status')`, needing no path value at all — is rejected outright: it drops
`path.` autocomplete, drops `keyof TRow` checking where the rule is written, and leaves
`filter(path.id, (cell, c) => …)` without `cell`'s type until the `createFilters` call.

A shared schema therefore stays a plain exported function, `(path: FiltersPath<Invoice>) => [...]`.
It carries no inferred `S` of its own until applied — accepted; `createFilters` is where `TState`
materialises, and there is no second shape to document or keep in sync.

**R39 — `FiltersPath<never>` resolves to an error-shaped type.** R35's wide carrier slot has one
degenerate case: an empty untyped carrier (`createFilters([], …)`, `createFilters(signal([]), …)`)
infers `TRow = never`, and because `keyof never` is `PropertyKey`, `FiltersPath<never>` collapses
to an index signature — `path.anythingAtAll` compiles, every criterion degrades, nothing errors.
Realistic wherever a spec or story starts from an empty list.

```ts
type FiltersPath<TRow> = [TRow] extends [never]
  ? {
      readonly __rowTypeCouldNotBeInferred_useRowOf: 'createFilters: the first argument is empty, so the row type is unknown. Pass rowOf<Row>() instead.';
    }
  : { readonly [K in Extract<keyof TRow, string>]: FilterHandle<TRow, K> };
```

The error lands on the first `path.x` and its text names the fix. Guarding the schema parameter
instead (`schema: [TRow] extends [never] ? never : …`) fails earlier but blames the schema
argument rather than the empty carrier that caused it, so the path branding wins. No correct call
is affected.

**R40 — A schema that doesn't return its rules throws at construction.** Under R34 a bare
`equals(path.status);` statement is inert — the returned record is discarded and nothing is
declared. `createFilters` therefore rejects a schema whose result isn't a rule collection:

```ts
'[createFilters] The schema function must return its rules. A body that calls rules as
 statements declares nothing — return an array: (path) => [equals(path.status)]'
```

Construction-time, deterministic, fires on first run before data flows — the throw class of
ADR-0014, same as the duplicate-key and duplicate-path checks. It catches the whole-body mistake,
which is the one a reader migrating from the old void shape will actually make. It does not catch
a mixed body that returns some rules and bare-calls others; that residue is accepted rather than
paid for with a custom lint rule.

> **Correction to the research doc's "Known holes" #4.** Its proposed fix — the
> `no-unused-expressions` lint rule — does not fire here. That rule deliberately permits bare call
> expressions, on the assumption a call has side effects. After R34 these calls have none, so the
> rule sees nothing to report. A runtime guard, or a purpose-written lint rule, are the only two
> options; the guard was taken.

**R41 — `TState` loses its `Record<string, unknown>` default.** `Filters<TRow, TState>` and
`WithFilteringConfig<TRow, TState>` both require the second argument once it is always inferred.
The default existed only because `TState` was optional to supply; kept, it is a silent-widening
trap — `filters.types.ts` already documents that `Filters<TRow, TState>` is _not_ assignable to
`Filters<TRow>`, because `FilterNode<T>` holds an invariant `WritableSignal<T>`, so a helper
annotated `Filters<MockRow>` receives `unknown` criteria and cannot read them.

No consumer ever writes `TState`: `readonly filters = createFilters(this.invoices, (path) => […])`
infers it, and `withFiltering({ filters: this.filters })` infers it again from the object. The
default only reaches code that spells `Filters<…>` by hand.

> **Site list corrected 2026-09-14, after the decoupling.** Both original entries have moved:
>
> - `api/features/selection.utils.spec.ts:23,27` — `buildFilters`/`makeFilteredStore` do **not**
>   become generic in `S`. Under the decoupling that spec stops building a `createFilters` schema
>   at all and narrows with a bare predicate, so the site deletes rather than widens. Same for
>   `with-grouping.spec.ts`'s four schemas — cross-feature specs were never testing filtering.
> - `stories/grouping/fixtures/schema.ts:96` — stands: `createDealFilters(): Filters<DealRow,
DealFilterState>` drops its return annotation, along with `DealFilterState`.
>
> **And the count was wrong: five exported `*FilterState` types delete, not three** —
> `CompositionFilterState` (`stories/composition/fixtures/types.ts:17`),
> `ClientInvoiceFilterState` / `ServerInvoiceFilterState` / `SelectionInvoiceFilterState`
> (`stories/filtering/fixtures/types.ts:52,62,69`) and `DealFilterState`
> (`stories/grouping/fixtures/types.ts:34`). Two more are spec-local and go the same way
> (`create-filters.spec.ts:35`, `with-filtering.spec.ts:516`).
>
> **Open conflict with `WithFilteringConfig` — see R47's open question.** Removing the default
> from `WithFilteringConfig<TRow, TState>` breaks a `predicates`-only call, which supplies no
> `filters` for `TState` to infer from. The two are no longer one decision.

**R42 — The server-mode token is `rowOf<TRow>()`, exported publicly.** A phantom value carrying
only a row type, for the case R11 was built around: filters declared before any data exists.

```ts
import { createFilters, rowOf } from '@acme/table';
createFilters(rowOf<Invoice>(), (path) => [equals(path.status)]);
```

The near-collision with `RowOf<S>` (`engine/types.ts:105`), which runs the opposite direction —
extracting a row type _out of_ a store shape — is accepted: casing separates them, and `rowOf` is
the name the research doc established. `rowType<TRow>()` was the alternative considered.

Not viable, and closed out here: dropping the token and writing `createFilters<Invoice>([], schema)`.
Per §1 partial type-argument inference does not exist, so naming `TRow` forces `TState` to be named
too — which is the cost this whole change removes.

> **⚠️ R43 is obsolete — the gap closed itself on 2026-09-14, before this was implemented.**
> `matcher(): (row: TRow) => boolean` on `FiltersRoot<TRow, TState>` (#68, `fded966` — S1 of
> [migration-decouple-filters-from-table.md](migration-decouple-filters-from-table.md)) puts
> `TRow` in the type body for a reason that isn't a brand: the root compiles a real row
> predicate, so it genuinely consumes the row type. **Build no phantom member.** The spec below
> is retained because its reasoning is what the migration then acted on, and because its closing
> claim about the spec site is now a description of shipped code, not of work.
>
> Everything R43 wanted is already true and already asserted:
> `create-filters.spec.ts:711` (`@ts-expect-error` — "TRow is no longer phantom") and
> `with-filtering.spec.ts:458` (a matcher over `OtherRow` cannot stand in for one over `Row`).
> The line numbered `:256` below moved; the assertion it was to be inverted into exists at `:458`.

**R43 — `Filters` brands `TRow`.** `TRow` is declared on `Filters<TRow, TState>` today but never
appears in the type body, so it is phantom: `with-filtering.spec.ts:256` asserts outright that a
`Filters<OtherRow>` is _not_ rejected. A `Deal` table can be wired to invoice filters and every
predicate silently reads fields that aren't there. Masked until now because a defaulted `TState`
made most filter sets the same widened type; after R41 they are distinct per call site, leaving
this as the last structural gap in the pair.

One internal phantom member puts `TRow` in the body. It enforces only what `FiltersPath<TRow>`
already requires — that **paths** come from the row. **Keys** stay free-form: `as` invents one,
`anyOf` names one positionally, and neither has to exist on `TRow`. The brand constrains `TRow`,
never `TState`.

Structural typing is preserved, which keeps this from being over-tight: an identically shaped
`InvoiceDto`, or a wider `InvoiceRow` carrying extra fields, still accepts the same filter set.
Only a genuinely unrelated row type is rejected. R10 is untouched — the brand records which row
type the paths were read from; no table is involved, and `createFilters` still constructs
standalone.

`with-filtering.spec.ts:256` inverts as part of this: from documenting the gap to asserting the
rejection.

**R44 — `anyOf` takes a non-empty tuple of children, and its shared criterion is now checked.**

```ts
export function anyOf<TKey extends string, C extends readonly [unknown, ...unknown[]]>(
  key: TKey,
  children: C,
): GroupRule<TKey, CriterionOf<C[number]>>;
```

Two things follow, neither of which the void API could express:

- **Empty groups are a compile error**, not just a construction throw. The constraint names no key
  type, so §5's contextual-typing trap does not apply. The runtime throw stays as a backstop for
  untyped callers.
- **A mixed-criterion group stops compiling.** `rules.ts:213` borrows `isEmpty`/`emptyValue` from
  the group's first child while every child keeps its own predicate, so a group pairing a `string`
  child with a `{ min: number }` child compiles today and misbehaves at runtime — the first
  child's emptiness test applied to the other's criterion. With one inferred shared `TCriterion`
  the pair is rejected: `Type '{ min: number; }' is not assignable to type 'string'`. Borrowing
  from the first child becomes sound rather than merely conventional, so it stays.

R33's known gap disappears with R33 itself: `anyOf`'s nested callback is gone, so there is no
inner schema function left to fail to infer `TRow`, and `anyOf<Invoice>('search', …)` no longer
needs its explicit type argument.

**R45 — `as` becomes genuinely enforceable, closing R31's residue.** `EnforceLiteralKey`
(`filters.types.ts:10`) already rejects a widened `string`, but R32 recorded that nothing made it
bite: `TAs` had no real inference site, so `{ as: someStringVar }` produced an untyped key
silently. With rules returning their record, `TAs` is inferred per rule call from `FilterOptions.as`
itself and the guard finally fires. No API change — a consequence of R34, recorded so the R31/R32
residue is closed rather than left dangling.

> **⚠️ Superseded by R47.** R46 was written the same day as, but independently of,
> [migration-decouple-filters-from-table.md](migration-decouple-filters-from-table.md), and the
> two plans rewrite the same call sites — every story host and cross-feature spec would be edited
> twice, once for `predicates` and once for the array schema. R47 merges them into one ranking.
> The three-way split by reviewable unit below survives inside it; the sequencing does not.

**R46 — Three issues, with the first two sequenced on one branch.** Split by reviewable unit:

1. **Library** — `rules.ts` returns records; `create-filters.ts` takes `(rows, schema)` and gains
   the return guard; `filters.types.ts` gains `StateOf`, the `FiltersPath<never>` branding, the
   `TRow` brand, and loses the `TState` default; `anyOf`'s non-empty tuple; `applyWhen`'s nestable
   node; `rowOf()` added and exported; `filters/recorder.ts` deleted.
2. **Call sites** — 3 story hosts, 2 story fixtures, 8 spec sites; three `*FilterState` types
   deleted; `selection.utils.spec.ts:27` made generic in `S`; `with-filtering.spec.ts:256`
   inverted.
3. **Docs** — `docs/1-state/filters.md` and `docs/1-state/features/filtering.md` rewritten;
   R10/R11/R31/R32/R33 marked superseded where they stand.

Issues 1 and 2 are tracked separately for review size but are **not independently shippable** —
the library change breaks every call site until 2 lands, so they share one branch (or stack) and
the build is green only at the end of 2. Issue 3 is genuinely parallel-safe once 1's signature is
settled.

`Depends on: 1` for 2. `Parallel-safe with: 1, 2` for 3, once the signature is fixed.

### What the re-grill supersedes

|                           |                                                                                                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R10                       | stands — `createFilters` is still standalone, and the carrier involves no table                                                                                                                                               |
| R11                       | superseded by R35 — data is accepted when it exists; `rowOf()` is the server-mode escape hatch, not a separate API. Its closing claim (TypeScript cannot recover `TRow` from a callback parameter) is factually wrong; see §2 |
| R31                       | stands, and R45 finally makes `as` enforceable as a string literal                                                                                                                                                            |
| R32                       | **superseded by R34/R36** — `TState` is inferred; the caller-supplied type parameter goes                                                                                                                                     |
| R33                       | **ceases to exist** — deleted with the recorder (R34), taking its non-reentrancy caveat and its `anyOf` `TRow` gap with it                                                                                                    |
| R5, R8, R9, R15, R18, R24 | stand unchanged — the mechanism moved, the semantics did not                                                                                                                                                                  |

## Sync with the decoupling migration (2026-09-14)

R34–R46 were written against the pre-decoupling shape, in which `withFiltering({ filters })` held
a `Filters` object and imported the filters closure. That shape is already gone in `src/`:
[migration-decouple-filters-from-table.md](migration-decouple-filters-from-table.md)'s S1 and S2
shipped as **#68** (`fded966`) and **#69** (`8184df5`) while this section was being written.
This is the reconciliation.

**R47 — One merged plan, re-ranked; R46's sequencing and R43 both go.** The two plans were
decomposed independently and collide on their middle layer: R46's issue 2 ("3 story hosts, 2 story
fixtures, 8 spec sites") and the migration's S3a/S3b are _the same files_. Rewriting them for
`predicates` and then again for the array schema is the rework
[decompose-by-dependency-graph](../../../../../../../.claude/rules/decompose-by-dependency-graph.md)
exists to catch — an edge that was real and unmapped, because neither ranking knew about the
other.

```
[R34 rules return records] ──┬─> [R36 array schema + StateOf] ─┬─> [R44 anyOf tuple]
                             │                                 ├─> [R37 applyWhen nestable]
                             │                                 ├─> [R45 `as` literal]
                             │                                 └─> [R41 TState default]
                             └─> [R40 schema-return guard]
[R35 carrier arg] ───────────┴─> [R39 TRow=never guard]
                             └─> [R42 rowOf() export]
                                                              all ─> [call sites: specs + stories]
                                                                            └─> [S4 move to src/filters/]
                                                                                      └─> [S6 barrel split]
[S5 docs + ADR-0016] — parallel-safe once the signature is settled
```

Core: R34, R35. Parallel-safe: `[S5]` once the signature is fixed. Chain:
`R34,R35 → … → call sites → S4 → S6`.

Three consequences for the implementation order:

- **The call-site layer is one pass, not two.** Every site that gets `{ filters }` →
  `{ predicates: () => [filters().matcher()] }` also gets its void schema → array schema, in the
  same edit. Both halves are mechanical; doing them together halves the diff and the review.
- **S4 stays last among the code steps.** It is pure churn that conflicts with every other diff —
  unchanged from the migration doc's own reasoning, and now load-bearing for two plans instead of
  one.
- **R46's three-way split by reviewable unit survives** — library, call sites, docs. It is the
  _sequencing_ that was wrong, not the cut.

### What the decoupling supersedes

|                                                               |                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R43                                                           | **obsolete — do not build.** `matcher()` (#68) consumes `TRow` for a real reason; the phantom brand is unnecessary. Its spec-site claim now describes shipped code (`with-filtering.spec.ts:458`, `create-filters.spec.ts:711`)                                                                          |
| #69's dual input                                              | superseded by **R48** — `filters` leaves `WithFilteringConfig`; `predicates` is the only way in, and AND-ing both is the consumer's own array                                                                                                                                                            |
| R46                                                           | superseded by R47 — the split stands, the sequencing merges with S3a–S6                                                                                                                                                                                                                                  |
| R41                                                           | **site list and count corrected** in place; its `WithFilteringConfig` half is now an open question, below                                                                                                                                                                                                |
| R42                                                           | `rowOf()` is exported from `index.ts` today, but S6 splits the barrel — it lands in the filters barrel, not the table's                                                                                                                                                                                  |
| R34                                                           | its migration-cost note ("13 call sites, all inside `libs/shared/table`") still holds in shape. Actual `createFilters()` calls: 5 story hosts/fixtures, 9 spec sites — of which the 5 cross-feature ones (`selection.utils.spec.ts`, `with-grouping.spec.ts` ×4) **delete** rather than migrate, per S3a |
| R35, R36, R37, R39, R40, R44, R45                             | stand unchanged — the decoupling moved what the _table_ takes, not how a filter set is declared                                                                                                                                                                                                          |
| S3b's "worth adding one story with no `createFilters` at all" | **already shipped** — `stories/filtering/predicate-filtering/`                                                                                                                                                                                                                                           |

### `WithFilteringConfig`'s `TState` — resolved by R48

> **✅ Resolved 2026-09-14 — option 1, finish S2.** See [R48](#r48) below. The framing is kept
> because it is what the decision was made against.

The two plans answered it differently and only one could hold.

R41 removes the `Record<string, unknown>` default from **both** `Filters<TRow, TState>` and
`WithFilteringConfig<TRow, TState>`, on the grounds that `TState` is always inferred. That was
true when `filters` was the config's only field. It no longer is: S2 shipped `predicates` as a
peer, and `filters` became optional —

```ts
export interface WithFilteringConfig<TRow, TState extends Record<string, unknown> = …> {
  filters?: Filters<TRow, TState>;
  predicates?: () => readonly ((row: TRow) => boolean)[];
  manual?: boolean;
}
```

— so `withFiltering({ predicates: () => [...] })` offers `TState` no inference site at all.
Drop the default and that call has nothing to infer from.

S2's own answer was to delete `filters` from the config outright, which deletes `TState` with it
and makes the question disappear: a filter model would reach the table only as
`predicates: () => [this.filters().matcher()]`. The implementation kept `filters`, documenting
"either input alone is enough; supplying both ANDs the filter model with the predicate terms" —
a deliberate divergence from the plan, not an oversight.

The three live options, in the order they should be considered:

1. **Finish S2 — delete `filters` from the config.** One way in (`predicates`), `TState` and its
   two documented call-site landmines go, R41 applies cleanly to `Filters` alone, and
   [#56](https://github.com/DvirMon/ng-table/issues/56) closes as fixed-by-design. Costs the
   convenience form at every story host.
2. **Keep `filters`, keep the default on `WithFilteringConfig` only.** R41 applies to `Filters`
   where the widening trap actually bites, and the config keeps a default nothing infers.
   Asymmetric, and the asymmetry needs a comment saying why.
3. **Keep both, require `TState`.** Rejected on inspection: it makes `predicates`-only calls
   annotate a type parameter they have no filter set for.

<a id="r48"></a>

**R48 — S2 is finished: `filters` leaves `WithFilteringConfig`, and `predicates` becomes
required.** Option 1. The table takes a predicate list and nothing else; a filter model reaches it
only as `predicates: () => [this.filters().matcher()]`.

```ts
export interface WithFilteringConfig<TRow> {
  /** One call = one evaluation. Terms AND'd; a term that throws is dropped for that pass. */
  predicates: () => readonly ((row: TRow) => boolean)[];
  manual?: boolean;
}
```

What this settles, beyond the config itself:

- **R41 applies to `Filters<TRow, TState>` alone**, which is where the widening trap actually
  bites (`FilterNode<T>` holds an invariant `WritableSignal<T>`). No asymmetric default to explain,
  and no type parameter left on the table side to infer.
- **Both documented call-site landmines delete** — "`TState` must be a `type`, not an `interface`"
  and "never pass `In` explicitly as a type argument". Neither has anything left to constrain.
  [#56](https://github.com/DvirMon/ng-table/issues/56) closes as **fixed-by-design**, not as work.
- **`with-filtering.ts` imports nothing from the filters closure** — `createFilterEvaluator` and
  `type Filters` both go, which was S2's stated requirement and the actual test of the decoupling.
  `applyFilterModel()` goes with them; `applyPredicateTerms()` becomes the whole stage.
- **The convenience form is the cost, and it is accepted.** Five story hosts and the surviving
  spec sites each write `predicates: () => [this.filters().matcher()]` instead of
  `{ filters: this.filters }` — one line, visible at the seam, and it is the line that makes the
  two objects' independence legible rather than merely structural.

Superseding #69's "either input alone is enough; supplying both ANDs the filter model with the
predicate terms": AND-ing was never the point of keeping `filters` — a consumer wanting both
writes `predicates: () => [this.filters().matcher(), ...myTerms]`, which is the same AND, stated
once, in the consumer's own array. The general mechanism absorbs the enumerated case
([general-mechanism-over-enumerated-cases](../../../../../../../.claude/rules/general-mechanism-over-enumerated-cases.md)).

Lands in R47's **library** unit, and hard-blocks the call-site pass — every `withFiltering` site
changes shape, so it must settle before the story hosts and specs are rewritten.

**R49 — `active()` splits into a value member and a boolean: `criterion()` / `criteria()` /
`isActive()`.** Decided in [#62](https://github.com/DvirMon/ng-table/issues/62), recorded here because
it changes the public member set this document specifies. `active()` read as a predicate and
returned data — on a node, the criterion or `undefined`; on the root, a `Partial<TState>` — so
every consumer asking "is this filter narrowing?" tested a returned object for emptiness at the
call site.

|               | before                              | after                                                          |
| ------------- | ----------------------------------- | -------------------------------------------------------------- |
| `FilterNode`  | `active(): TCriterion \| undefined` | `criterion(): TCriterion \| undefined` + `isActive(): boolean` |
| `FiltersRoot` | `active(): Partial<TState>`         | `criteria(): Partial<TState>` + `isActive(): boolean`          |

`value()` is untouched: the model stays complete, and R14's "why both" reasoning survives the
rename intact — only the derived half is renamed and split.

**Documented ahead of its code.** #62 is code-only (`filters/types.ts`, `state.ts`,
`evaluator.ts`, the three story hosts); [`docs/1-state/filters.md`](../../../../filters.md) already
describes this shape, because the doc half was absorbed into #79 to stop the two issues rewriting
the same sections twice.

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

|     | Decision                                                                               | Status under E                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Global filter match is case-insensitive, not configurable                              | **Gone.** It described the auto-scan over every filterable column. `anyOf` lists its paths and predicates explicitly (R8), so case sensitivity is whatever the chosen predicate does |
| D2  | No built-in debounce; the consumer debounces their own input                           | **Stands** — reaffirmed by R25, which routes debouncing through the Signal Form over the model                                                                                       |
| D3  | Missing `filterFn` falls back to an auto-detected default (string-contains / equality) | **Gone.** Every filter names its predicate; there is no "missing predicate" case left to fall back from                                                                              |

See [../../features/filtering.md](../../../../features/filtering.md), whose banner carried the same
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

| Library              | Ships filter kinds? | Evidence                                                                                                                                                        |
| -------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AG Grid              | **yes**             | verified `initialState` example is `{ year: { filterType: 'set', values: ['2012'] } }` — `filterType` is first-class, and whole filter components ship per kind |
| PrimeNG              | **yes**             | verified source types filters as `{ [s: string]: FilterMetadata \| FilterMetadata[] }`; `FilterMetadata` carries a match mode                                   |
| TanStack             | no                  | `columnFilters` is `{ id, value: unknown }[]`; matching is `filterFn` per column                                                                                |
| `MatTableDataSource` | no                  | single `filter: string` + consumer-supplied `filterPredicate`                                                                                                   |

Shipping `equals`/`dateRange`/`numberRange` is joining the majority, not over-reaching.

## Half 2 — the standalone primitive: novel, 0 of 4 ship it

No surveyed library exposes filter state usable _without_ its table. Honest reasons it may not
exist:

- Decoupled filters can't do table-aware things — derive `select` options from column data, know
  which columns exist, respect visibility.
- Two objects to wire rather than one.
- In local mode filter state's only consumer _is_ the table, so the table is its natural owner.

Counter-argument: all four libraries predate fine-grained reactivity. A standalone reactive
filter object was expensive in the hooks/provider era and is nearly free with signals — which is
why Signal Forms could decouple form state from the form component. Absence of precedent is
partly chronology, not purely judgment. But it is still unvalidated.

## The flexibility objection — and it cuts at Half 1, not Half 2

Ship `dateRange()` and the library has decided what a date range _means_: inclusive bounds?
timezone? null handling? A product whose semantics differ then fights the abstraction instead of
writing three lines. TanStack's `value: unknown` + `filterFn` is deliberately unopinionated for
exactly this reason.

Note this is `general-mechanism-over-enumerated-cases`
cutting _against_ parts of E, having been cited _for_ it earlier. Both readings are available,
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

> **♻️ Overridden by R10 (same day), reinstated by R50 (2026-09-16).** R10's premise turned out
> to be false — a table-owned filter object _can_ be constructed in server mode, because the
> pipeline reads rows through a thunk. Nothing ever proved filters were needed without a table,
> which is the exact condition this resolution set for extraction. See
> [Re-grill — table-owned filtering](#re-grill--table-owned-filtering-2026-09-16).
>
> **⚠️ Overridden by R10 (same day).** The resolution below — build the typed kinds inside
> `withFiltering()` and extract `createFilters()` standalone only once something proves it needs
> filters without a table — rests on extraction being cheap and deferral being free. It is not:
> in server-side mode the filters feed the request that _produces_ the data, so a table-owned
> filter object cannot be constructed at all (R10). There is no working alternative to defer to.
> The reasoning below is retained because the _other_ half of its argument — the acceptance test
> for whether shipped kinds are genuinely sugar — still holds and fed R7.

Split the halves and defer the novel one:

1. Build typed kinds **inside `withFiltering`** — precedented, delivers the DX, low risk.
2. Extract `createFilters` as a standalone primitive **only when something genuinely needs
   filters without a table**. Server-side mode is the candidate, but that should be proven, not
   assumed.

Extraction later is mechanical. Un-shipping a public standalone primitive is not — so this
ordering keeps the expensive decision reversible. Consistent with promote-on-evidence in
[file-organization](../../../../../../../../../.claude/rules/file-organization.md): give something its own
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

The question to answer is not "what do they ship" but "what did they find is the _irreducible_
core of the filtering problem" — the smallest general mechanism that supports overriding, with
sugar layered on for the common cases. That is what should drive the API, not the four table
libraries' historical shapes.

---

## Re-grill — table-owned filtering (2026-09-16)

The question that opened it: **is `createFilters` over-engineered?** It is not — but it is
_mis-placed_. The audit below moves ownership, and the machinery that existed only to work around
the standalone shape falls out with it.

**What moved.** R10 rests on one claim: in server mode the filters feed the request that produces
the data, so a table-owned filter object "cannot be constructed at all". That claim is false, and
`create-table.ts:28` is why — the pipeline reads rows through a thunk inside a `computed()`, so a
`resource()` whose `params` read `table.filters().criteria()` wires with no construction cycle and
no eager read. Verified against the shipped server story, which builds its table on
`signal<InvoiceRow[]>([])` _before_ the first fetch
(`server-filtering-story-host.component.ts:126-128`).

With that gone, the survey in [research-filter-state-ownership.md](research-filter-state-ownership.md)
decides it. Its rule — ownership tracks **who originates the value** — plus the constraint stated
during this re-grill: _filters are always born with a table_. No filter set is provided by DI,
seeded by a route resolver before a table exists, or shared between two tables. That puts
filtering with the 4-of-7 majority (AG Grid, PrimeNG, NgRx, `MatTableDataSource`).

This vindicates [Suggested resolution](#suggested-resolution) above, written 2026-09-09 and
overridden by R10 the same day: _build the typed kinds inside `withFiltering`, extract a
standalone primitive only once something proves it needs filters without a table_. Nothing ever
proved it.

**Dependency ranking** ([decompose-by-dependency-graph](../../../../../../../.claude/rules/decompose-by-dependency-graph.md)):

```
[R50 ownership] ──┬─> [R52 carrier deleted] ──> [R55 standalone schema]
                  ├─> [R56 member audit]
                  └─> [R51 object schema] ──┬─> [R53 `when` in options]
                                            └─> [R54 no predicate hatch]
```

Core: R50. Everything else is downstream of it. R51 is independently arguable but migrates the
same call sites, so it lands in the same epic rather than twice.

### R50 — The filter model moves into `withFiltering`; `createFilters` leaves the public surface

`withFiltering(config, schema)` builds the model and exposes it as a feature member. The engine —
`rules.ts`, `matchers.ts`, `state.ts`, `evaluator.ts` — survives unchanged and becomes internal.

```ts
readonly table = createTable(
  () => this.invoices.value() ?? [],
  config,
  withFiltering({ manual: true }, invoiceFilters),
);

readonly invoices = resource({
  params: () => this.table.filters().criteria(),
  loader: ({ params }) => this.api.fetchInvoices(params),
});
```

No cycle: `criteria()` never reads rows, so the graph stays
`filters → criteria → params → resource → rows → pipeline`. Filters sit upstream of rows while
living inside the table. Declaration order is free — both references are thunks.

This is _more_ declarative than the shipped server story, which needs
`signal([]) + effect + untracked + load()` to break a cycle that turns out not to exist.

**Cost, accepted:** `withFiltering` regains the `TState` generic apparatus the decoupling deleted,
including its two documented landmines — `TState` must be a `type` not an `interface`, and `In` is
never passed explicitly ([review-filters-table-coupling.md](review-filters-table-coupling.md) §B.3).
The standalone-filters-lib trajectory that review asked about is closed: the answer is no.

### R51 — The schema returns an **object literal**; keys are written, never derived

Supersedes R36's array. `StateOf` collapses to a plain mapped type:

```ts
type StateOf<S> = { [K in keyof S]: CriterionOf<S[K]> };
```

Verified exact by compiled probe before this re-grill —
[research-typescript-inference-probes.md](../filters-inferred-state/research-typescript-inference-probes.md)
§4 asserts both the array and object forms infer criteria exactly, `filter()`'s included.

Deleted with the key-derivation layer: `FilterOptions.as`, `RuleKey<K, TAs>`,
`EnforceLiteralKey`, `FilterRule`'s `TKey`, the `__key` phantom, `Flatten`/`FlattenItem`,
`flattenRules`, and the runtime duplicate-**key** throw — an object literal cannot repeat a key,
so the compiler catches it. The duplicate-**path** throw stays: two keys over `path.status` is
legal to write and still wrong.

`anyOf` loses its positional key (`search: anyOf([...])`); its non-empty and
homogeneous-criterion compile checks (R44) are unaffected.

### R52 — `TRow` comes from the table; the carrier and `rowOf()` are deleted

R35's wide first slot existed only because a standalone `createFilters` had nothing else to infer
`TRow` from, and it shipped with a documented lie — _"the call reads as if it binds data; it does
not."_ Under R50 `TRow` is `RowOf<In>`, already known. `rowOf()`, `RowToken`, and
`FiltersPath`'s `[TRow] extends [never]` brand all go.

### R53 — `when` moves into the rule options; `applyWhen` is deleted

`gateByCondition` (`state.ts:97`) already wraps **one** node — `applyWhen`'s grouping was
declaration-site sugar that the flattener fanned back out per child. Moving the gate into the
options matches what the runtime already did.

```ts
readonly when?: (ctx: FilterValueOfContext<TRow>) => boolean;
```

Returns `boolean`, **not** grouping's `boolean | undefined`. The tri-state exists there because
`applyGroupingAsync` produces a pending state (D13); filtering has no async rule and therefore no
producer for it. Adopting it would mean speccing and testing an abstain semantic with no caller —
add it the day an async filter gate lands.

A shared condition is a hoisted `const`, restated per rule. Same trade `applyGrouping(path, { when })`
already accepted, and it makes the two features spell the concept identically.

Gate semantics are unchanged: `criterion()` and `isActive()` go dark; `value`, `reset` and the
internal dirty tracking do not. The two-pass build stays — a `when` may read a filter declared
after it, so gating runs once every node exists, reading `record.options.when` instead of a
re-tagged `record.condition`. Deleted with it: `ConditionalRule`, `ConditionalNode`,
`isConditionalNode`, the `kind: 'conditional'` re-tag, and the "returns one node, never spread it"
rule.

### R54 — No raw-predicate escape hatch. A scope is not a filter

`predicates: () => ((row) => boolean)[]` is deleted and no `where()` replaces it. Both were
considered; the test that killed them is **does it put a key in `TState`?**

`filter(path.x, fn)` is custom _matching logic_ for a **declared** filter — its criterion is
library-managed state that resets, tracks emptiness and serializes into a request. A predicate
with no criterion declares no filter at all. It is a **scope**, and a scope is already
expressible:

```ts
createTable(() => this.invoices.value().filter((r) => r.ownerId === me()), …)
```

`filter` precedes `group`/`sort`/`expand` in `PIPELINE_ORDER` (`engine/pipeline.ts:6`), so
narrowing the input signal and narrowing in the stage produce identical pipeline output —
`rowsOf(group)` sees the same rows either way. It is arguably more correct: under `manual: true`
the stage is skipped entirely, so an in-stage scope term would silently stop applying, while a
pre-narrowed signal keeps working.

**Accepted loss:** the stage-level `try/catch` around consumer predicates. A throwing pre-filter
takes down the rows `computed()` rather than degrading to unnarrowed rows. ADR-0014's
per-filter/per-evaluation reporting is unaffected — it lives in the evaluator, which only ever saw
declared rules.

### R55 — A standalone schema is a hoisted arrow, not a new primitive

```ts
export const invoiceFilters = (path: FiltersPath<Invoice>) => ({
  status: equals(path.status),
  amount: inRange(path.amount, { source: () => bounds() }),
});

withFiltering({}, invoiceFilters);
```

**R50 is what makes this safe.** The probe doc's §2 marks the param-annotation form ⚠️ — it
degrades silently to `TRow = unknown` when the annotation is an alias. That hazard is about
_inferring_ `TRow` from the annotation. Here `TRow` is fixed by the table, so the annotation is
only checked for assignability and `type P = FiltersPath<Invoice>` passes. `S` still infers from
the const's return type.

Composition is object spread — no `apply()`/`applyEach()` equivalent needed, because these schemas
are plain objects where Signal Forms' are opaque:

```ts
export const auditFilters = (path: FiltersPath<Invoice>) => ({
  ...invoiceFilters(path),
  reviewedBy: equals(path.reviewer),
});
```

**Cost: one type export.** `FiltersPath<TRow>` stops being `@internal`.

Rejected: a `filterSchema()` helper. Beating the annotation requires currying
(`filterSchema<Invoice>()(fn)`) because partial type-argument inference does not exist (probe §1)
— a new export and `()()` to avoid one annotation.

### R56 — Eight members. The test is derivability without rule internals

A member earns its place when a consumer **cannot** reconstruct it without knowing `isEmpty`,
`emptyValue` or `source` — all rule-internal.

|                                      | Root                            | Per key                                |
| ------------------------------------ | ------------------------------- | -------------------------------------- |
| Writable criterion                   | `value: WritableSignal<TState>` | `value: WritableSignal<TCriterion>`    |
| Effective criterion, empties omitted | `criteria(): Partial<TState>`   | `criterion(): TCriterion \| undefined` |
| Narrowing right now                  | `isActive()`                    | `isActive()`                           |
| Back to the declared source          | `reset(value?)`                 | `reset()`                              |

**Made internal:**

- `matcher()` — R47 promoted it to public only to bridge a decoupled feature. R50 deletes the
  bridge; `withFiltering` consumes the evaluator directly.
- `dirty()` — non-derivable, and kept internally because `source` needs it to decide whether an
  arriving default overwrites a typed value. Public exposure had one consumer: the server story,
  which exists to _demonstrate_ the late-default race. Re-expose the day a filter bar wants a
  "you've overridden the default — reset?" affordance.

`isActive()` is the one piece of sugar retained deliberately (`Object.keys(criteria()).length > 0`
at the root). Every library in the survey ships it — AG Grid `isAnyFilterPresent()`, TanStack
`getIsFiltered()` — because "clear filters" is the most common filter-bar affordance there is.

Root `value` stays a real `WritableSignal` view over the nodes (R18): it is what lets
`form(this.table.filters().value, schema)` bind with no adapter and no sync effect.

### What this re-grill supersedes

|                            |                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| R10                        | **superseded by R50** — its premise (a table-owned filter object cannot be constructed in server mode) is false; rows are read through a thunk |
| R11                        | already superseded by R35; **now moot** — there is no first argument to debate                                                                 |
| R15                        | **superseded by R53** — `applyWhen` becomes `when` in options                                                                                  |
| R24                        | **moot** — no standalone construction, so no `{ injector }` escape of its own; `createTable`'s context governs                                 |
| R35                        | **superseded by R52** — the carrier existed only to feed a standalone primitive                                                                |
| R36                        | **superseded by R51** — array becomes object literal                                                                                           |
| R40                        | **stands, message changes** — a schema that returns nothing still throws; the message names the object form                                    |
| R44                        | **amended by R51** — `anyOf` keeps its checks, loses its positional key                                                                        |
| R47                        | **superseded by R50** — the public `matcher()` bridge has no consumer once the feature owns the model                                          |
| R48                        | **moot** — it resolved `WithFilteringConfig`'s `TState` for a decoupled feature                                                                |
| R7, R8, R18, R49, ADR-0014 | **stand unchanged** — rule semantics, OR groups, the writable view, the `active()` split, and degradation are untouched                        |

### Migration surface

One epic. The ownership move forces the carrier deletion, and the object-literal rework touches
the same call sites, so splitting them migrates every consumer twice.

- `src/filters/` — `create-filters.ts` folds into the feature; `row-of.ts` deleted; `types.ts`
  loses ~90 LOC of key machinery; `rules.ts` loses `TKey` and `as`; `validate.ts` loses the
  duplicate-key throw.
- `src/api/features/with-filtering.ts` — gains the schema parameter, the model, the member and
  the `TState` apparatus; loses `predicates`.
- `index.ts` — drops `createFilters`, `rowOf`, `RowToken`, `applyWhen`; adds `FiltersPath`.
- Specs — `create-filters.types.spec.ts` (253 LOC) is the inference contract and is rewritten, not
  deleted; `create-filters.spec.ts` (657 LOC) mostly survives with a new construction preamble;
  `with-filtering.spec.ts` gains the member cases.
- Stories — 5 hosts plus `filtering/fixtures/` and `grouping/fixtures/schema.ts`. The server host
  loses its `effect`/`untracked` loop for a `resource()`.
- Docs — `filters.md` stops being a primitive spec and folds into `features/filtering.md`;
  `0-product/filtering.md` and `3-ui/stories.md` reference the moved surface; ADR-0016 gets a
  successor note.
