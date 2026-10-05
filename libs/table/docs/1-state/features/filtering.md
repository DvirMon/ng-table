---
title: State Layer Reference — withFiltering()
type: architecture
version: 5.0
date: 2026-09-25
capability: filtering
spec: drilled
code: shipped
audience: developers
parent: ../architecture.md
---

# withFiltering()

## Executive Summary

Filtering is table-owned. `withFiltering(config)` builds the filter model from a `schema` and
exposes it as `table.filters` — the same feature applies the model's criteria to the pipeline's
`filter` stage (client mode) or builds the model without applying it (`manual: true`, server
mode, where the criteria drive the request that produces the data instead).

```ts
readonly table = createTable(
  this.data,
  { trackBy: 'id', columns },
  withFiltering({
    schema: (path: FiltersPath<Row, ColumnValues<Row, typeof columns.columns>>) => ({
      status: equals(path.status),
      amount: inRange(path.amount, { source: () => bounds() }),
      search: contains(path.customer),
    }),
  }),
);

table.filters().criteria();          // { status: 'open', search: 'acme' } — empties omitted
table.filters.status().value.set('open');
```

`TRow` is inferred from the table's own row data — `RowOf<In>`, recovered from the enclosing
`createTable()` config, never annotated at the call site. **`path` itself must still be annotated
explicitly**, even written inline: `withFiltering` resolves its `schema` callback's parameter
type against one of its four overloads before the surrounding `createTable()` call has supplied
`In`, so an unannotated `path` silently falls back to the wide `ColumnValueMap` and every
criterion reads back as `unknown` — it does not error. Spell it
`FiltersPath<Row, ColumnValues<Row, typeof columns.columns>>`, off the same `columns` the table
composes.

**`path` keys by declared column id, not row field, and reads through the accessor** (#115,
[ADR-0024](../../adr/0024-single-value-source-accessor.md)). `path.status` above is a handle onto
the column declared `id: 'status'` in `columns`; the value a criterion narrows against is whatever
that column's `accessor` resolves per row — the same value the cell displays, not necessarily
`row.status`. A carrier column (`visible: false`, declared for its accessor alone) is filterable
like any other. Naming a column id that is not declared throws at construction (see
[Errors](#errors)); a column present at construction but later removed by `setColumns()` degrades
at evaluation time (see [Semantics](#semantics)).

There is one feature, one call, one member. There is no standalone `createFilters()` and no
separate filter object to wire up — that split existed for one release
([ADR-0016](../../adr/0016-filtering-takes-a-predicate-list.md)) and is gone (R50). Everything a
consumer needs — the eight members, the eight rules, the resource wiring for server mode — is in
this file.

## Signature

```ts
export interface WithFilteringConfig<
  TRow,
  TValues extends ColumnValueMap,
  S extends Record<string, AnyRule> = {},
> {
  /** Skips the `filter` stage — rows pass through untouched, but the model still builds and
   * `filters` is still exposed. For server-driven filtering via `filters().criteria()`. */
  manual?: boolean;
  /** With a tree composed, a matched row also keeps its whole branch, not only its ancestors. */
  includeDescendants?: boolean;
  /** Declares the owned filter model, exposed as `filters`. Built once at construction; its
   * criteria narrow the pipeline's `filter` stage through `matcher()`. */
  schema?: (path: FiltersPath<TRow, TValues>) => S;
}

export interface FilteringMembers<TRow, TState extends Record<string, unknown>> {
  readonly filters: Filters<TRow, TState>;
}

export function withFiltering<In extends FilteringInput<In>>(
  config?: WithFilteringConfig<RowOf<In>, ColumnValuesOf<In>, {}> & { schema?: undefined },
): Feature<In, {}>;

export function withFiltering<In extends FilteringInput<In>, S extends Record<string, AnyRule>>(
  config: WithFilteringConfig<RowOf<In>, ColumnValuesOf<In>, S> & {
    schema: (path: FiltersPath<RowOf<In>, ColumnValuesOf<In>>) => S;
  },
): Feature<In, FilteringMembers<RowOf<In>, StateOf<S>>>;
```

(A third and fourth overload accept a trailing `derive` block, the same `createTableFeature`
composition seam every feature shares — not filtering-specific, see `architecture.md`.)

- **With `schema`**, the feature builds the model and contributes `filters`.
- **Without `schema`**, the feature contributes no member at all — `table.filters` is a compile
  error, not `undefined` (asserted in `with-filtering.types.spec.ts`). `withFiltering()` with no
  arguments composes only to keep the `filter` pipeline stage a documented no-op; there is no
  reason to write it.
- `TRow` comes from the table (`RowOf<In>`), not a generic the caller supplies.
- **`FilteringInput<In>` widens the feature's own input to `Pick<TableStore<RowOf<In>,
ColumnValuesOf<In>>, 'columns' | 'rows' | 'trackBy'>`** (#115, #168) — filtering reads
  `columns` to resolve accessors and to check declared ids at construction, the same shape
  `withGrouping()` already takes, and `trackBy` to key [tree retention](#trees--matches-keep-their-ancestors). `TValues` (`ColumnValuesOf<In>`) is the declared column-value map `createColumns()`
  derives; it is recovered from `In`, never a type parameter a caller writes.
- **The criterion map is inferred from the schema's returned object.** `StateOf<S>` folds one
  entry per declared filter or `anyOf` group, keyed **verbatim** by the object's own property
  names — see [Keys](#keys). It is never a type parameter a caller writes. A rule's own criterion
  type now comes off the column's resolved value in `TValues`, not off `TRow[K]` — `equals(path.owner)`
  over a column declared `accessor: (r) => r.owner.name` infers `string | null`, matching what the
  cell displays, not the row's raw `owner` object.

## The schema

The schema runs once, at construction, inside `withFiltering`'s own factory — no injection
context of its own, no separate construction call. **It returns its rules as an object
literal**, keyed by whatever property names the consumer chooses:

```ts
withFiltering({
  schema: (path: FiltersPath<Row, ColumnValues<Row, typeof columns.columns>>) => ({
    status: equals(path.status),
    isArchived: equals(path.isArchived),
    amount: inRange(path.amount, { source: () => bounds() }),
    dueDate: inDateRange(path.dueDate),

    search: anyOf([
      // one criterion, several predicates, OR'd
      contains(path.customer),
      contains(path.notes),
      filter(path.id, (cell, q: string) => String(cell).includes(q)),
    ]),

    subCategory: equals(path.subCategory, {
      when: ({ criterionOf }) => criterionOf(path.category) !== null, // gated: only narrows once a category is chosen
    }),

    tags: filter(
      path.tags,
      (cell, c: { include: string[]; exclude: string[] }) =>
        hasAnyOf(cell, c.include) && hasNoneOf(cell, c.exclude),
    ), // matcher form — see below
  }),
});
```

A body that calls rules as statements instead of returning them declares nothing and throws —
see [Errors](#errors).

### Rules

| Rule                      | Criterion                    | Notes                                                                                                                                                                                                                                                                                       |
| ------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `equals(path)`            | the cell's own type          | covers boolean columns too — there is no `toggle()` (R28)                                                                                                                                                                                                                                   |
| `contains(path)`          | `string`                     | case-insensitive substring                                                                                                                                                                                                                                                                  |
| `inRange(path)`           | `{ min, max }`               | one filter, not two (R2)                                                                                                                                                                                                                                                                    |
| `inDateRange(path)`       | `{ from, to }`               | one filter, not two                                                                                                                                                                                                                                                                         |
| `hasAny(path)`            | `T[]`                        | array cell intersects the criterion                                                                                                                                                                                                                                                         |
| `hasNone(path)`           | `T[]`                        | array cell is disjoint from the criterion                                                                                                                                                                                                                                                   |
| `filter(path, predicate)` | whatever the predicate takes | the general rule — peer of the others, not a layer beneath them (R7)                                                                                                                                                                                                                        |
| `anyOf(children)`         | shared across the group      | one criterion, several paths, each with its own predicate; OR'd (R8). `children` is a non-empty tuple of already-built rules, not a nested schema callback. The key comes from the schema object property it's assigned to, same as any rule — there is no separate positional key argument |

Every single-path rule takes an optional trailing `{ source, emptyValue, isEmpty, when }` — see
[Sources](#sources), [Empty criteria](#empty-criteria) and [`when`](#when). `anyOf`'s children are
themselves rule calls, each carrying their own path and predicate.

### Matchers

Every rule has a matcher twin: the plain binary function the library calls per row. Rules keep
the bare verb because they _do_ something (register a filter); matchers take a boolean-guard
prefix because they _return_ something (R30).

| Rule — declares, returns its record | Matcher — tests, returns `boolean` |
| ----------------------------------- | ---------------------------------- |
| `equals(path)`                      | `isEqual(cell, criterion)`         |
| `contains(path)`                    | `isContaining(cell, criterion)`    |
| `inRange(path)`                     | `isInRange(cell, criterion)`       |
| `inDateRange(path)`                 | `isInDateRange(cell, criterion)`   |
| `hasAny(path)`                      | `hasAnyOf(cell, criterion)`        |
| `hasNone(path)`                     | `hasNoneOf(cell, criterion)`       |

Both of a matcher's arguments arrive at **evaluation** time — the cell from the row, the
criterion from filter state. A matcher never carries a constant.

Matchers are exported so a custom predicate is assembled from shipped parts rather than written
from scratch, which is what makes [one filter per path](#one-filter-per-path) affordable:

```ts
filter(path.tags, (cell, c) => hasAnyOf(cell, c.include) && hasNoneOf(cell, c.exclude));
```

### Keys

**A filter's key is the schema object's own property name, verbatim** (R51). There is no key
derivation from the path and no rename option — the key you write is the key `table.filters`
exposes and the key `criteria()`/`value()` use:

```ts
{
  status: equals(path.status),                    // → filters.status
  customerAccountName: equals(path.customerAccountName, { as: 'customer' }),   // ✗ `as` no longer exists
}
```

An object literal cannot repeat a key, so the duplicate-**key** throw from the array-schema era
is gone — that is now a compile error, not a runtime check (R51). What still throws at
construction is a duplicate **path**: two different keys targeting the same underlying field.
See [One filter per path](#one-filter-per-path).

### One filter per path

Two keys filtering the same path throws at construction, matching `SlotRegistry`'s
single-occupancy rule for member keys and pipeline stages (R5):

```ts
withFiltering({
  schema: (path: FiltersPath<Row, ColumnValues<Row, typeof columns.columns>>) => ({
    included: hasAny(path.tags),
    excluded: hasNone(path.tags), // ✗ throws — one path, two filters
  }),
});
```

> `[withFiltering] "included" and "excluded" both filter path "tags". Only one filter may target
a given path — two keys may not target one path. Combine with filter() over a compound
criterion instead.`

Combining operators on one column means dropping to `filter()` with one predicate over a compound
criterion (R6):

```ts
tags: filter(path.tags, (cell, c: { include: string[]; exclude: string[] }) =>
  hasAnyOf(cell, c.include) && hasNoneOf(cell, c.exclude)),   // ✓ one filter, compound criterion
```

The trade is knowing: include/exclude is a genuinely common pattern and it costs a custom
predicate. Chosen on reversibility (R6, upheld under R31) — revisit if the workaround proves to
be reached for repeatedly. `client-filtering/`'s Tags filter is exactly this workaround, on
canvas.

### `when`

Gates a filter off without touching its stored value:

```ts
interface FilterOptions<TSource = unknown, TRow = unknown> {
  readonly source?: () => TSource;
  readonly emptyValue?: TSource;
  readonly isEmpty?: (criterion: NoInfer<TSource>) => boolean;
  readonly when?: (ctx: FilterValueOfContext<TRow>) => boolean;
}
```

```ts
subCategory: equals(path.subCategory, {
  when: ({ criterionOf }) => criterionOf(path.category) !== null,   // only applies once a category is chosen
}),
```

`when` returns `boolean`, not a tri-state — filtering has no async rule that would need a pending
state (R53). Gated off, `criterion()` and `isActive()` go dark (`criterion()` reads `undefined`,
as if the filter were empty); `value` and `reset` are unaffected — the stored value survives being
gated off and reappears once the condition is true again. `when`'s `criterionOf` reads any other
filter's current value, including one declared later in the same schema — gating resolves in a
second pass, once every node exists, so declaration order never matters.

**`valueOf` was renamed to `criterionOf` (#117).** #115 loosened
`FilterValueOfContext.valueOf`'s generic to match the column-id-keyed `FilterHandle`, but did not
touch the method's name. #117 introduced a second, _unbound_-tier `valueOf(path, row)` resolver
for grouping's `when` and sorting's `sortFn` (see [grouping.md](grouping.md#group-admission-when),
[sorting.md](sorting.md#per-column-configuration--withsortingschema)) — a name collision with
this _bound_-tier "what did the user ask for?" resolver, per
[ADR-0027 Rule 3](../../adr/0027-schema-declaration-surface.md#rule-3--resolvers-come-in-two-tiers-and-the-tier-decides-the-arity).
`FilterValueOfContext.valueOf` is renamed to `criterionOf`, gone rather than deprecated.

**Superseded:** the array-schema era's `applyWhen(path, condition, children)` — a separate node
kind wrapping a whole group of rules — is gone. `when` is a per-rule option instead, which is
strictly more granular (each rule in a would-be group can gate independently) and removes the
"placed, never spread" footgun `applyWhen` had (R15's array-return shape doesn't exist to be
spread wrong).

## State

**Property access is a child; a call is state** — the Signal Forms shape (R20).

```ts
table.filters()                       // root state
table.filters().value()               // { status: null, amount: {min,max}, search: 'acme' } — complete
table.filters().value.set(next)       // writable — fans out per key to the child nodes
table.filters().criteria()            // { search: 'acme' } — empties omitted
table.filters().isActive()            // true — at least one criterion is set
table.filters().reset(v?)             // no arg → source; null → empty; partial → those keys

table.filters.status                  // a filter node
table.filters.status().value()        // its criterion, always — the model
table.filters.status().criterion()    // its criterion, or undefined when empty
table.filters.status().isActive()     // whether this filter is narrowing
table.filters.status().value.set('open')
table.filters.status().reset()
```

### Members — eight (R56)

|                                      | Root `filters()`                | Per key `filters.status()`             |
| ------------------------------------ | ------------------------------- | -------------------------------------- |
| Writable criterion                   | `value: WritableSignal<TState>` | `value: WritableSignal<TCriterion>`    |
| Effective criterion, empties omitted | `criteria(): Partial<TState>`   | `criterion(): TCriterion \| undefined` |
| Narrowing right now                  | `isActive()`                    | `isActive()`                           |
| Back to the declared source          | `reset(value?)`                 | `reset()`                              |

`matcher()` (root) and `dirty()` (root and node) exist and are exercised in `create-filters.spec.ts` /
`state.spec.ts`, but are `@internal` — not part of the eight, not part of the public contract a
consumer writes against.

| Member          | Purpose                                                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`         | a `WritableSignal<TState>` — one entry per declared filter, read with `value()`, written with `value.set`/`.update`. The complete model, no optional-key handling (R14), and the model a Signal Form binds to directly |
| `criteria()`    | derived, empties omitted — request params and anything else that consumes the set criteria (R14)                                                                                                                       |
| `isActive()`    | derived boolean — "N filters applied", `hasFilters`, an empty-state message (R49)                                                                                                                                      |
| `reset(value?)` | one verb, three behaviors (R17); takes a `Partial<TState>`. `clear()` does not exist — it is `reset(null)`                                                                                                             |

A filter node carries the same split: `criterion()` returns its criterion or `undefined` when
empty, `isActive()` answers the boolean (R49). There is no `active()` on either — a name that
read as a predicate while returning data was the reason for the split.

**Every derived member is a `computed`** — `criterion` and `isActive` on a node, `criteria` and
`isActive` on the root. Reading one in a template per row, per chip or per field costs a cache
hit, not a recomputation.

Why both `value()` and `criteria()`: a criterion is user-editable input, two-way bound to a
control — that is the Signal Forms _model_, always complete. "Which filters are currently
narrowing" is derived output — that is `criteria()`, only what is set. Different things, both
needed.

`table.filters().value` is a real `WritableSignal` — a writable view over the child nodes, which
stay the single storage location. That is what makes [Forms](#forms) free.

### `reset(value?)`

```ts
table.filters().reset(); // → source (or empty with no source)
table.filters().reset(null); // → empty
table.filters().reset({ status: 'open' }); // → that key; every other key back to its source
table.filters.amount().reset(); // → a node's own source (no argument on a node)
```

`null` is a **sentinel meaning "this filter's empty value"**, not a literal — `''` for text,
`{ min: null, max: null }` for a range, `[]` for a multi-select.

**The value form takes a `Partial<TState>`.** A key the object omits is reset to its declared
source, which is what makes restoring a partial snapshot a complete state. Restoring _untrusted_
persisted JSON is therefore a two-step job — validate it into a `Partial<TState>`, then reset —
and the type is what says so: an unvalidated snapshot is not filter state.

**`reset` and `value.set` treat an omitted key oppositely, and deliberately.** `reset` is a
_restore_: what you leave out goes back to its source. `value.set` is a _model write_: it takes a
complete `TState`, because that is what a Signal Form hands it on every edit.

**Diverges from Signal Forms deliberately.** `FieldState.reset(value?)` resets _touched and
dirty flags_ and, with no argument, does not change the value. Ours changes the **value**. Both
are reachable at once when a form is layered over the filters: `filterForm.search().reset()`
clears flags, `table.filters.search().reset()` changes the criterion.

### Sources

`{ source }` declares a default the user can override — typically server-supplied and arriving
after construction.

```ts
inRange(path.amount, { source: () => bounds() });
```

One mechanism covers all three origins of a default (R19): a resolved DI token or route value, an
HTTP response landing later, and a constant. `dirty` (internal) decides who wins when a source
arrives late — a typed value is never overwritten by a late-arriving default. `server-filtering/`
demonstrates this: type into the amount box before the server's default range resolves and the
typed value wins.

### Empty criteria

Every rule declares what counts as _no filter_: `''` for `contains`, `null` for `equals`,
`{min:null,max:null}` for `inRange`, `[]` for `hasAny`/`hasNone`. An empty criterion is skipped
before evaluation and omitted from `criteria()`.

`{ emptyValue }` **adds** to that default for one filter — it does not replace it. `{ isEmpty }`
is the total override, the only way to **subtract** — to make `null` a meaningful, non-empty
criterion again. Precedence: **`isEmpty` replaces; `emptyValue` extends and seeds; with neither,
the rule's own holds.**

```ts
equals(path.status, { emptyValue: '' }); // both '' and null deactivate
equals(path.status, { emptyValue: '', isEmpty: (c) => c === '' }); // null now filters
```

**Why a rule's default is not always right: the control has a say.** A native `<select>` can
express empty only as `''` — a `<select>` bound to an `equals` filter with its default `null`
empty would write `''` on the "any" option, which is not empty. Declaring `emptyValue: ''` lines
the criterion up with the control.

`filter()` is the one rule with no declared empty of its own — with neither `isEmpty` nor
`emptyValue`, a `filter()` rule is never empty.

## Wiring — three modes

### Client

```ts
readonly table = createTable(
  this.data,
  { trackBy: 'id', columns },
  withFiltering({
    schema: (path: FiltersPath<Row, ColumnValues<Row, typeof columns.columns>>) => ({
      status: equals(path.status, { emptyValue: '' }),
      customer: contains(path.customer),
      amount: inRange(path.amount, { source: () => DEFAULT_AMOUNT_RANGE }),
    }),
  }),
);
```

The feature claims the pipeline's `filter` stage, running **first** — before group/sort/expand
(unchanged) — so an `aggregateFn` never sees unfiltered rows. Each pass compiles one matcher from
the current criteria (`table.filters().matcher()`, internal) and filters the rows through it.

### Server

**The feature is still composed** — unlike the predicate-list era — but `manual: true` skips the
client-side `filter` stage. The model exists purely to drive the request:

```ts
protected readonly table: TableStore<Invoice> & FilteringMembers<Invoice, ServerCriteria> =
  createTable(
    someRowsSignal,
    config,
    withFiltering({ manual: true, schema: serverInvoiceFilters }),
  );

protected readonly invoices = rxResource({
  params: () => toQueryParams(this.table.filters().criteria()),   // criteria(), not value()
  stream: ({ params }) => this.invoiceApi.fetchInvoices(params),
});
```

There is no construction cycle: `table` reads its rows from a signal that is itself derived from
`invoices` (a `linkedSignal` bridging the resolved page, per `server-filtering-story-host.component.ts`)
— passed inline, never stored as a named field, so nothing needs `invoices` to exist before
`table` does. `withFiltering`'s own factory only needs `table.filters` to exist by the time
`invoices`' `params` first reads it, which is well after both fields are assigned.

**`criteria()`, not `value()`, is the request shape.** `status=` forces the server to
disambiguate "no filter" from "status is empty"; omitting unset optional params is the REST
convention. **No per-filter `encode`** (R16) — server APIs differ irreconcilably, and mapping
`criteria()` to query params is a pure function the consumer owns (`toQueryParams` in the story).

The server's own row total overrides the core `totalRowCount` member through a small
`createTableFeature()` composed alongside `withFiltering` — the one member ADR-0005 leaves
overridable.

### Forms

Optional. The form's model **is** the filter model — no adapter, no sync effect, no duplicated
state (R18).

```ts
readonly filterForm = form(table.filters().value, (path) => {
  required(path.search);
  debounce(path.search, 300);
  min(path.amount.min, 0);
});
```

```html
<input [formField]="filterForm.search" />
<select [formField]="filterForm.status">
  <option value="">any</option>
</select>
```

A `<select>` binds only when its filter's empty criterion is `''` — see
[Empty criteria](#empty-criteria).

**Which way the view points.** Each filter node owns its own signal; the root is a writable view
composed over them — a read gathers every node, a write fans back out per key. Storage is one
location per criterion, so nothing is copied and the two cannot desync.

Node-first is what keeps per-filter `source`/`dirty` reconciliation local to the node that owns
it: a node with a declared `source` is a `linkedSignal` whose late-arrival rule is its own
business, not a merge the root has to arbitrate across keys.

**Debounce lives here** (R25). No debounce inside `withFiltering` — the form is built over the
filter model, so Signal Forms' `debounce()` applies to the criteria directly. `server-filtering/`
is the one story that needs it (`debounce(path.search, 300)`); the client story is synchronous
and has no request to throttle.

## Semantics

- **Combination:** within an `anyOf` group, **OR**; across filters, **AND** (R8). **AND is the
  only combinator the pipeline stage assumes** — OR lives inside a term (`anyOf`, or a compound
  `filter()` predicate), because the stage has no vocabulary for expressing which criteria group
  with which.
- **Empty criteria skip their predicate.** What counts as empty is per-rule — declared beside the
  rule, extended with `{ emptyValue }` or replaced with `{ isEmpty }` — applied before evaluation,
  so an empty filter never reaches persisted state or a query string (R14).
- **Null/undefined cell values** (R27): a null or undefined cell **fails every positive matcher**
  (`isEqual`, `isContaining`, `isInRange`, `isInDateRange`, `hasAnyOf`) and **passes every
  negative one** (`hasNoneOf`) — a row with no tags has none of them. Guarded inside each shipped
  matcher, never in the runner, so a custom `filter()` predicate receives the cell unguarded and
  can match nulls:

  ```ts
  filter(path.notes, (cell, want: boolean) => want === (cell == null || cell === ''));
  ```

- **Order of evaluation:** `when` gate → empty-criterion check (skip the filter entirely) → read
  the cell → matcher, which owns its own null branch. A null cell is only ever reached by an
  _active, ungated_ filter.

### Trees — matches keep their ancestors

With [`withTree({ parentId })`](tree.md) composed, the stage sees the hierarchy through the
silent parent link (`ctx.parentOf`, ADR-0028) and filters by **tree retention** (#168, D5):

- Each matching row is kept **with every ancestor**, so a match deep in the tree still renders
  under its path. Kept rows stay in input order.
- `includeDescendants: true` also keeps every descendant of a match — its whole branch.
- An ancestor kept only for a match below it is a **context row**: the feature contributes it to
  the engine's `contextRows` slot, and the core stamps it `RenderRow.isContextRow: true`
  ([tree.md](tree.md#context-rows)). A match, or a row kept as a descendant of a match, is
  `false`.
- **`manual: true` computes none.** The stage passes rows through untouched, so no retention runs
  and no row is a context row — the server owns which rows arrive. The same holds with no
  `schema`, and clearing the filter drops every context flag.

Without a tree the stage is a plain `rows.filter(matcher)`, and `isContextRow` stays `false` on
every data row.

```ts
createTable(
  data,
  { trackBy: 'id', columns },
  withTree({ parentId: (row) => row.parentId }),
  withFiltering({
    includeDescendants: true, // omit to keep matches + ancestors only
    schema: (path) => ({ name: contains(path.name) }),
  }),
);
```

### One `matcher()` call is one evaluation

The internal evaluator compiles the narrowing records once per call — gating and emptiness
resolve per call, not per row — and per-filter error reporting is deduped within that one
instance. The feature calls it once per pipeline pass, so each pass reports independently.

## Errors

Per [ADR-0014](../../adr/0014-runtime-error-policy.md).

**Construction throws** — a duplicate filter on one path (R5), an `anyOf` with no children, and,
as of #115, a schema naming a column id that is not declared in `columns`. Deterministic, fires
before data flows, no sane degraded reading; the unknown-id check is dev-gated inside its own
body (`assertDeclarationsAreKnown`, `schema/validate.ts`), matching every other construction
check in this library:

> `[withFiltering] The schema function must return its rules as an object literal. A body that
calls rules as statements declares nothing — return an object: (path) => ({ status:
equals(path.status) })`

> `[withFiltering] anyOf(…) declared no rules.`

> `[withFiltering] "included" and "excluded" both filter path "tags". Only one filter may target
a given path — two keys may not target one path. Combine with filter() over a compound
criterion instead.`

> `[withFiltering] Unknown column id "territory" — no declared column has this id.`

**Runtime never throws.** A predicate that throws drops _that filter_ for the rest of the
evaluation; other filters still narrow and the table still renders. Reported once per filter per
evaluation — not per row — with the filter key and the offending cell, in production as well as
dev. Wrapped per filter, never per row: per-row catching yields an inconsistent row set (some
rows tested, some skipped) and puts a `try` in the hot loop. The catch unit is the same whether
the term came from `table.filters().matcher()` or a hand-written predicate elsewhere in the
pipeline — one term, one report, by key.

**A column present at construction but later removed by `setColumns()` degrades the same way**
(#115, same runtime classification as grouping's G72). That filter stops narrowing for the rest
of the evaluation it's first missing in, reported once per key per evaluation — other filters are
unaffected:

> `[withFiltering] The filter "territory" targets column "territory", which is not in the current
columns. This filter does not narrow for this evaluation.`

**"For the rest of the evaluation" is literal.** The predicate answers row by row, so rows it
already answered for keep that filter's narrowing; only rows from the throwing one onward skip
it. `client-filtering/`'s _Break the tags filter_ toggle makes this checkable rather than
asserted — the result set gets **wider**, never blank.

Custom predicates are the likeliest thing here to throw, because R27 hands them an unguarded
cell by design. The likeliest _reason_ is a stale criterion — persistence is consumer-owned, so a
snapshot written by an older schema revives with a shape the predicate never expected.

**Residue:** a filter that failed still appears in `criteria()`, and still counts toward
`isActive()`. Both describe which criteria are _set_, not which evaluations succeeded.

## Persistence

Consumer-owned. `withFiltering` ships no storage adapter (R21).

```ts
localStorage.setItem('f', JSON.stringify(table.filters().value()));

const saved: unknown = JSON.parse(localStorage.getItem('f') ?? 'null');
table.filters().reset(keepValidCriteria(saved));
```

`value()` and `reset(value)` are both halves already; swapping `sessionStorage`, a URL, or a
server-side profile is a one-word change.

**Validating the snapshot is consumer-owned too.** `reset()` takes `Partial<TState>`; a parsed
snapshot is `unknown`. It reaches `reset()` only because `JSON.parse` returns `any`, and what
follows is silent unless guarded first — as `keepValidCriteria()` does in
`stories/filtering/client-filtering/`.

What a shipped mechanism would buy — debounced writes, a version stamp plus migration, revival
for non-JSON criteria, the drift rule (unknown key → ignore, missing key → leave at default) —
are the same problems sort and column state have, so a shared persistence feature is designed
separately, taking the table's snapshot and the filter model as separate inputs. See
[state-persistence.md](../state-persistence.md).

## Deliberately not shipped

| Not shipped                                                              | Instead                                                                                                                                  | Decision |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Runtime operator picker (AG Grid / PrimeNG column menu)                  | operators are fixed at declaration                                                                                                       | R1       |
| A _second_ filter on one path                                            | one predicate over a compound criterion                                                                                                  | R5, R6   |
| A key-rename option (the old `as`)                                       | the schema's own property name is the key                                                                                                | R51      |
| `toggle()`                                                               | `equals()` over a boolean column                                                                                                         | R28      |
| `ColumnDef.filterFn` / `enableFiltering`                                 | predicates live in the schema                                                                                                            | R12      |
| A raw-predicate escape hatch (`predicates`)                              | narrow the rows signal passed into `createTable()` — `filter` is the first `PIPELINE_ANCHORS` stage, so the pipeline output is identical | R54      |
| Per-filter `encode` for server params                                    | consumer maps `criteria()`                                                                                                               | R16      |
| Debounce                                                                 | Signal Forms' `debounce()` over the model                                                                                                | R25      |
| Persistence / storage adapter, and any validating `restore(unknown)`     | consumer's `JSON.stringify` + a guard + `reset(value)`                                                                                   | R21      |
| Data-derived filter options (set filters)                                | consumer computes them                                                                                                                   | R11      |
| Any null/empty-cell option (`matchEmpty`, `cell:`, `isBlank`, `orEmpty`) | one internal policy; `filter()` for anything else                                                                                        | R27      |

Each is additive if revisited — none of them is foreclosed by shipping without it.

## Public API

`withFiltering`, `WithFilteringConfig`, `FilteringMembers`, the rules, the matchers and the
public types are all exported from `src/index.ts`, listed explicitly like every other feature
(ADR-0004's 2026-09 #93 amendment folded the standalone `filters/` domain back into the table's
own phases — there is no second barrel):

| Symbol                                                                           | From                                      | Kind              |
| -------------------------------------------------------------------------------- | ----------------------------------------- | ----------------- |
| `withFiltering`, `WithFilteringConfig`, `FilteringMembers`                       | `api/features/with-filtering/feature.ts`  | feature           |
| `Filters`, `FilterNode`, `FilterOptions`, `FiltersPath`                          | `api/features/with-filtering/types.ts`    | types             |
| `equals`, `contains`, `inRange`, `inDateRange`, `hasAny`, `hasNone`              | `api/features/with-filtering/rules.ts`    | declaration rules |
| `filter`                                                                         | `api/features/with-filtering/rules.ts`    | the general rule  |
| `anyOf`                                                                          | `api/features/with-filtering/rules.ts`    | the grouping rule |
| `isEqual`, `isContaining`, `isInRange`, `isInDateRange`, `hasAnyOf`, `hasNoneOf` | `api/features/with-filtering/matchers.ts` | matchers (R30)    |

Everything under `engine/filters/` is internal — `create-filters.ts` (the model builder, called
`buildFilterModel` internally), `evaluator.ts`, `state.ts` and `validate.ts` are private to the
feature. `withFiltering`'s `schema` config is the only entry point to the model; there is no
standalone constructor a consumer calls directly.

**Removed** (breaking changes across R26, R50–R56, both executed): the pre-`createFilters()`
imperative surface (`setColumnFilter`, `clearColumnFilter`, `setGlobalFilter`, `clearFilters`,
`columnFilters`, `globalFilter`, `filterChanged`, `ColumnDef.filterFn`,
`ColumnDef.enableFiltering`); the standalone-era surface (`createFilters`, `rowOf`, `RowToken`,
`applyWhen`, `ConditionalRule`, the array-schema shape, `FilterOptions.as`,
`WithFilteringConfig.predicates`).

## Decisions

Recorded in [design-options-hybrid-api.md](../work/filtering/archive/with-filtering/design-options-hybrid-api.md)
(R1–R56). The ones that shaped this file specifically:

- **R10, superseded by R50.** R10 held that server mode forces filters to live outside the table,
  because filters feed the request that _produces_ the data and a table-owned filter object
  supposedly couldn't be constructed before that data exists. **The claim was false** — a
  table's row-data signal is read through a thunk, so a `resource()` whose params read
  `table.filters().criteria()` wires with no construction cycle, and the shipped server story
  proves it. With the blocker gone, ownership tracks who originates the value (the survey rule
  in `research-filter-state-ownership.md`) and filters are always born with a table — so filtering
  moved table-owned, alongside AG Grid, PrimeNG, NgRx and `MatTableDataSource`.
- **R50–R56** — the table-owned redesign this file now documents in full: `withFiltering(config)`
  owns the model (R50); the schema returns an object literal, not an array (R51); `when` replaces
  `applyWhen` (R53); `matcher()`/`dirty()` become internal (R56); the raw-predicate escape hatch
  is deleted with no replacement, a scope is a narrowed rows signal instead (R54).
- **R23** — `manual` is kept on `withFiltering()` for cross-feature consistency with
  `withSorting()`'s own `manual` flag. Under R50 its meaning shifted: previously "skip the stage"
  was close to "do not compose the feature at all"; now the feature is _always_ composed when a
  schema exists (client or server), and `manual` is genuinely "build the model, skip only the
  local `filter` stage."
- **R26** — executed. The superseded imperative implementation (`setColumnFilter()` etc.) no
  longer exists; anything still naming those five members is stale.
- **#115** — `path` re-keys from row field to declared column id and reads through the accessor,
  the same move grouping made under ADR-0024. `WithFilteringConfig` and `FiltersPath` both gain a
  required `TValues`; `withFiltering`'s own input widens to also read `columns` (`FilteringInput<In>`,
  mirroring `GroupingInput`). Recorded in [`columns.md`](../decisions/columns.md) — see that log
  for the rulings this shipped alongside (`TValues` required, no default; a `ColumnValuesOfSet<>`
  alias deferred; a removed column's runtime classification).

**Superseding [ADR-0016](../../adr/0016-filtering-takes-a-predicate-list.md).** That ADR's
`predicates: () => readonly ((row: TRow) => boolean)[]` config field, and its claim that server
mode composes no filtering feature at all, describe a shape that no longer exists. Read
`ADR-0016`'s own successor note for what replaced it and why; this file is the current contract.

## Resolved Questions

- [x] ~~Interaction with `withGrouping()`'s aggregation~~ — `aggregateFn` runs over filtered rows,
      since `group` clusters after `filter` in the fixed pipeline order.
- [x] ~~Where filter state lives~~ — table-owned (R50), superseding the standalone-primitive
      answer this file gave from 2026-09-09 to 2026-09-14.
- [x] ~~Whether a raw predicate escape hatch should exist~~ — no (R54). A scope is expressed by
      narrowing the rows signal, not a predicate with no criterion.

## Competitive position

**Verdict: closed, and now precedented on the ownership question too.** No surveyed library
(AG Grid, PrimeNG, TanStack, `MatTableDataSource`) exposed a filter object usable with no table at
the time of the original survey — that absence motivated the standalone design this file
superseded. Table ownership itself, though, is the position 4 of the 4 surveyed libraries already
took (AG Grid, PrimeNG, NgRx, `MatTableDataSource`); what remains novel is the fine-grained
reactive shape (`table.filters.status().criterion()`), not the ownership boundary.

Column + global filtering is baseline in all four competitors' free tier. Full reasoning:
[gap-analysis.md](../work/meta/archive/state-feature-competitive-audit/gap-analysis.md).
