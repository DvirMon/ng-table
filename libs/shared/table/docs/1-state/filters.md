---
title: State Layer Reference — createFilters()
type: architecture
version: 1.2
date: 2026-09-14
capability: filters
spec: drilled
code: shipped
audience: developers
parent: ./architecture.md
---

# createFilters()

## Executive Summary

Filter criteria as a standalone, consumer-held object. **Not a `with-*()` feature** — the same
D8 reasoning that keeps [row-mutations.md](row-mutations.md) and
[state-persistence.md](state-persistence.md) out of `features/`, and forced here by server mode:
filters feed the request that *produces* the data, so they cannot live inside a store built from
that data (R10).

```ts
readonly filters = createFilters<Invoice>((path) => {
  equals(path.status);
  inRange(path.amount);
  contains(path.customer);
});
```

> **The domain lives in `src/filters/`** — a top-level sibling of `api/`, `engine/` and
> `directives/`, with its own barrel (`#106`, [ADR-0004](../adr/0004-table-source-layout.md)'s
> 2026-09 amendment). `create-filters.ts` plus `evaluator`, `matchers`, `recorder`, `rules`,
> `state` and `validate` are on disk, with `create-filters.spec.ts`, `matchers.spec.ts` and
> `state.spec.ts` covering them. Four Storybook stories exercise the surface end to end
> (`filtering/client-filtering/`, `server-filtering/`, `selection-filtering/`,
> `predicate-filtering/`); coverage per product story is in
> [`0-product/filtering.md`](../0-product/filtering.md).

Declared like `createTable()` and Signal Forms' `form()`, and deliberately shaped after the
latter: named rules called on a typed path, one general rule underneath, property access for
children and a call for state.

Full design and rationale: [work/with-filtering/design-options-hybrid-api.md](work/with-filtering/design-options-hybrid-api.md)
(R1–R31). This spec is the contract; that document is why.

## Signature

```ts
function createFilters<TRow, TState extends Record<string, unknown> = Record<string, unknown>>(
  schema: (path: FiltersPath<TRow>) => void,
  opts?: { injector?: Injector }
): Filters<TRow, TState>;
```

- **`TRow` must be annotated.** There is no value argument to infer from — `createFilters` takes
  no `data`, because in server mode the data does not exist yet and depending on it would be a
  construction cycle (R10, R11). This is the one place the API is worse than `createTable(data, …)`
  and `form(model, …)`, and it is accepted knowingly.
- **`TState`, the flat criterion map, is also caller-supplied** — a second type parameter, not
  derived from `schema`'s rule calls (R32). One entry per declared filter/`anyOf` group, matching
  [Keys](#keys). Omitting it degrades to `Record<string, unknown>` — the object still builds and
  works at runtime, just without per-key typing.
- **`anyOf(key, schema)` needs its own explicit `TRow` at the call site** (`anyOf<Invoice>(…)`,
  not bare `anyOf(…)`) — unlike every single-path rule, it has no path argument for TypeScript to
  infer `TRow` from (R33). `applyWhen` doesn't have this gap; its `path` argument anchors `TRow`
  the same way a single-path rule's does.
- **Requires an injection context**, with `{ injector }` as the escape route for construction
  outside a field initializer — same contract as `createTable()` and `form()` (R24). Needed
  because source reconciliation (see [Sources](#sources)) is reactive work with a lifetime.

## The schema

The schema body runs once, at construction. Each call registers one filter.

### Rules

| Rule | Criterion | Notes |
|---|---|---|
| `equals(path)` | the cell's own type | covers boolean columns too — there is no `toggle()` (R28) |
| `contains(path)` | `string` | case-insensitive substring |
| `inRange(path)` | `{ min, max }` | one filter, not two (R2) |
| `inDateRange(path)` | `{ from, to }` | one filter, not two |
| `hasAny(path)` | `T[]` | array cell intersects the criterion |
| `hasNone(path)` | `T[]` | array cell is disjoint from the criterion |
| `filter(path, predicate)` | whatever the predicate takes | the general rule — peer of Signal Forms' `validate()`, not a layer beneath the others (R7) |
| `anyOf(key, schema)` | shared across the group | one criterion, several paths, each with its own predicate; OR'd (R8) |
| `applyWhen(path, condition, schema)` | — | conditional activation, taken from Signal Forms directly (R15) |

Every single-path rule takes an optional trailing `{ source, as, emptyValue }` — see
[Sources](#sources), [Keys](#keys) and [Empty criteria](#empty-criteria). `anyOf` takes its key
positionally instead, because a group has no path to borrow one from.

```ts
readonly filters = createFilters<Invoice>((path) => {
  equals(path.status);                                 // key `status`, reads row.status
  equals(path.isArchived);
  inRange(path.amount, { source: () => bounds() });
  inDateRange(path.dueDate);

  anyOf<Invoice>('search', (path) => {                 // one criterion, several predicates, OR'd
    contains(path.customer);
    contains(path.notes);
    filter(path.amount, (cell, q) => cell > Number(q));
  });

  applyWhen(path, ({ valueOf }) => valueOf(path.category) !== null, (path) => {
    equals(path.subCategory);                          // only applies once a category is chosen
  });

  filter(path.tags, (cell, c: { include: string[]; exclude: string[] }) =>
    hasAnyOf(cell, c.include) && hasNoneOf(cell, c.exclude));   // matcher form — see below
});
```

### Matchers

Every rule has a matcher twin: the plain binary function the library calls per row. Rules keep
the bare verb because they *do* something (register a filter); matchers take a boolean-guard
prefix because they *return* something (R30).

| Rule — declares, returns `void` | Matcher — tests, returns `boolean` |
|---|---|
| `equals(path)` | `isEqual(cell, criterion)` |
| `contains(path)` | `isContaining(cell, criterion)` |
| `inRange(path)` | `isInRange(cell, criterion)` |
| `inDateRange(path)` | `isInDateRange(cell, criterion)` |
| `hasAny(path)` | `hasAnyOf(cell, criterion)` |
| `hasNone(path)` | `hasNoneOf(cell, criterion)` |

Both of a matcher's arguments arrive at **evaluation** time — the cell from the row, the
criterion from filter state. A matcher never carries a constant.

Matchers are exported so a custom predicate is assembled from shipped parts rather than written
from scratch, which is what makes [one filter per path](#one-filter-per-path) affordable:

```ts
filter(path.tags, (cell, c) => hasAnyOf(cell, c.include) && hasNoneOf(cell, c.exclude));
```

### Keys

A filter's key is borrowed from its path when there is exactly one (`equals(path.status)` →
`filters.status`, reading `row.status`). A group has no single path to borrow from, so `anyOf`
takes its key positionally (R3, R9). State stays flat — one entry per criterion, never nested by
group:

```ts
{ status: 'open', amount: { min: 100, max: null }, search: 'acme' }
```

`filters.search` is an ordinary handle at the binding site; the three predicates behind it are
invisible, exactly as `filters.amount` hides `{ min, max }` behind one pair of controls.

**`as` overrides the borrowed key** (R31). The same need `anyOf` answers with a mandatory
positional key, offered optionally wherever a key *was* available but the path's name is the
wrong one to expose:

```ts
equals(path.customerAccountName, { as: 'customer' });   // → filters.customer
inDateRange(path.dueDate, { as: 'due' });               // → filters.due, ?due=…
```

Useful when the model's field name is not the name the URL, the persisted snapshot, or the
binding site should carry — and it shortens the mapping R16 leaves to the consumer.

The `as` value must be a **string literal** for the handle to be typed; a `string`-typed variable
widens `Filters<TRow>` and is rejected at compile time.

Two constraints, both enforced at construction:

- **One filter per path still throws** (R5) — `as` renames a filter, it does not license a
  second one on the same path. Declaring two rules on one path is an error whether or not their
  `as` names differ. See [One filter per path](#one-filter-per-path) for what to write instead.
- **Duplicate keys throw** — two rules given the same `as`, or an `as` colliding with
  another filter's borrowed key.

### One filter per path

A duplicate throws at construction, matching `SlotRegistry`'s single-occupancy rule for member
keys and pipeline stages (R5).

**`as` does not change this** — the check is on the **path**, not the key:

```ts
hasAny(path.tags,  { as: 'included' });
hasNone(path.tags, { as: 'excluded' });   // ✗ throws — one path, two filters

filter(path.tags, (cell, c: { include: string[]; exclude: string[] }) =>
  hasAnyOf(cell, c.include) && hasNoneOf(cell, c.exclude));   // ✓ one filter, compound criterion
```

Combining operators on one column means dropping to `filter()` with one predicate over a compound
criterion (R6). The trade is knowing: include/exclude is a genuinely common pattern and it costs a
custom predicate.

Chosen on reversibility — moving R5's check from the path to the key would grant the second
filter, and that is additive and non-breaking; taking it back is not. Revisit if the workaround
proves to be reached for repeatedly (R6, upheld under R31).

## State

**Property access is a child; a call is state.** The Signal Forms shape, adopted whole, root
included (R20).

```ts
filters()                       // root state
filters().value()               // { status: null, amount: {min,max}, search: 'acme' } — complete
filters().value.set(next)       // writable — fans out per key to the child nodes
filters().active()              // { search: 'acme' } — empties omitted
filters().reset(v?)             // no arg → source; null → empty; partial → those keys
filters().dirty()               // derived: value differs from source
filters().matcher()             // (row: TRow) => boolean, compiled from the current criteria

filters.status                  // a filter node
filters.status().value()        // its criterion
filters.status().value.set('open')
filters.status().reset()
filters.status().dirty()
```

| Member | Purpose |
|---|---|
| `value` | a `WritableSignal<TState>` — one entry per declared filter, read with `value()`, written with `value.set`/`.update`. The complete model, no optional-key handling (R14), and the model a Signal Form binds to directly |
| `active()` | derived, empties omitted — request params, "N filters applied", `hasFilters` (R14) |
| `reset(value?)` | one verb, three behaviors (R17); takes a `Partial<TState>`. `clear()` does not exist — it is `reset(null)` |
| `dirty()` | **derived, never stored** — gates whether a source may overwrite (R19) |
| `matcher()` | a row predicate compiled from the model's current criteria — the model's answer to "does this row match?", usable with or without a table |

**Why `matcher()` is on the root rather than a top-level member.** `Filters` is an intersection
whose second half is a mapped type over the criterion keys, so a top-level `matcher` would collide
with a filter literally keyed `matcher`. The root is a plain interface with no such hazard — the
same reasoning that put `value`, `active`, `reset` and `dirty` there.

**It also puts `TRow` in the type body.** `matcher(): (row: TRow) => boolean` means `TRow` is no
longer phantom, so a filter set built for an unrelated row type is now a compile error instead of
a silently empty table. A public type-behavior change, with its compatibility carve-out and the
fix for the error it produces:
[ADR-0016](../adr/0016-filtering-takes-a-predicate-list.md) §4.

Why both `value()` and `active()`: a criterion is user-editable input two-way bound to a control
— that is the Signal Forms *model*, always complete. "Which filters are currently narrowing" is
derived output — that is `errors()`, only what is active. Different things, both needed.

`filters().value` is a real `WritableSignal` — a writable view over the child nodes, which stay
the single storage location. That is what makes [Forms](#forms) free.

### `reset(value?)`

```ts
filters().reset();                             // → source (or empty when no source is declared)
filters().reset(null);                         // → empty
filters().reset({ status: 'open' });           // → that key; every other key back to its source
filters.amount().reset({ min: 0, max: 500 });  // → an arbitrary value
```

`null` is a **sentinel meaning "this filter's empty value"**, not a literal — `''` for text,
`{ min: null, max: null }` for a range, `[]` for a multi-select.

**The value form takes a `Partial<TState>`.** A key the object omits is reset to its declared
source, which is what makes restoring a partial snapshot a complete state. Restoring *untrusted*
persisted JSON is therefore a two-step job — validate it into a `Partial<TState>`, then reset —
and the type is what says so: an unvalidated snapshot is not filter state.

**`reset` and `value.set` treat an omitted key oppositely, and deliberately.** `reset` is a
*restore*: what you leave out goes back to its source. `value.set` is a *model write*: it takes a
complete `TState`, because that is what a Signal Form hands it on every edit. One is "put this
back how it was", the other is "this is the model now" — they sit one property apart, so read the
verb, not the shape of the argument.

**Diverges from Signal Forms deliberately.** `FieldState.reset(value?)` resets *touched and
dirty flags* and, with no argument, does not change the value. Ours changes the **value**. Same
word, different operation, and both are reachable at once when a form is layered over the
filters: `filterForm.search().reset()` clears flags, `filters.search().reset()` changes the
criterion. Document this wherever both appear together.

### Sources

`{ source }` declares a default the user can override — typically server-supplied and arriving
after construction.

```ts
inRange(path.amount, { source: () => bounds() });
```

One mechanism covers all three origins of a default (R19): a resolved DI token or route value, an
HTTP response landing later, and a constant (a source that never changes). The handle's public
shape is identical with or without it — no API bifurcation at the binding site.

`dirty` decides who wins when a source arrives late:

```ts
dirty = () => !equalsCriterion(value(), sourceValue())
```

| | `dirty` | in `active()` |
|---|---|---|
| untouched, no source | false | no |
| untouched, source gave `{0, 10000}` | false | **yes** |
| user typed a value | **true** | yes |
| user typed exactly the source value | false — harmless | yes |
| user cleared it (`reset(null)`) | **true** | no |

Derived, never stored, so any write updates it automatically — the user typing, a form writing
through, a snapshot restore, `reset(v)`. There is no flag to keep in sync, which removes a class
of desync between the filters and a Signal Form layered over them.

**`filters.amount().dirty()` is not `filterForm.amount().dirty()`.** The form's means "user
edited this control since the last form reset" — a UI concern. Ours means "this criterion is no
longer following its source" — the reconciliation gate. Values cannot desync between the two
(they share one storage location per [Forms](#forms)); only the flags are separately owned.

### Empty criteria

Every rule declares what counts as *no filter*: `''` for `contains`, `null` for `equals`,
`{min:null,max:null}` for `inRange`, `[]` for `hasAny`/`hasNone`. An empty criterion is skipped
before evaluation and omitted from `active()`.

`{ emptyValue }` replaces that default for one filter. The declared value is what `reset(null)`
writes and what the skip-when-empty check compares against — structurally (`equalsCriterion`),
so an object or array empty value works as well as a scalar.

```ts
equals(path.status, { emptyValue: '' });
```

**Why a rule's default is not always right: the control has a say.** A criterion's empty value
is a binding contract as much as a matching one. A native `<select>` can express empty only as
`''` — Signal Forms drives it through `element.value`, a string — so a `<select>` bound to an
`equals` filter with its default `null` empty would write `''` on the "any" option, which is not
empty: the filter stays permanently active while matching no row. Declaring `emptyValue: ''`
lines the criterion up with the control, and `<option value="">` deactivates the filter through
plain `[formField]`, with no accessor and no story-local handler (#97).

`number`/`date` inputs need nothing here — Signal Forms already maps an empty box to `null`,
which is exactly what `inRange`/`inDateRange` call empty.

`filter()` also takes `isEmpty`, since emptiness cannot be inferred for an arbitrary criterion
shape. An explicit `isEmpty` wins over `emptyValue`; with neither, a `filter()` rule is never
empty.

**Set-valued controls stay hand-wired, and that is not a gap in this mechanism.** A checkbox
group is several elements, not one control value, so nothing about the criterion's empty value
would make `[formField]` bind it. A consumer wanting one writes a component implementing
Signal Forms' `FormValueControl<T>` (a `value` model of the criterion's own shape), or writes
through `filters.<key>().value` directly.

## Wiring — three modes

### Client

The feature filters the rows, over a predicate the model supplies. See
[features/filtering.md](features/filtering.md).

```ts
createTable(data, { trackBy: 'id', columns },
  withFiltering({ predicates: () => [this.filters().matcher()] }));
```

**Neither side imports the other.** The table never learns what a criterion is, the filter model
never learns what a pipeline stage is, and the line above is the whole of the wiring — ordinary
composition the consumer writes ([ADR-0016](../adr/0016-filtering-takes-a-predicate-list.md)).

### Server

The feature is **not composed**. Filters feed the request that produces the data.

```ts
readonly filters  = createFilters<Invoice>((path) => { … });
readonly invoices = resource({
  params: () => this.filters().active(),           // active(), not value()
  loader: ({ params }) => fetchInvoices(toQuery(params)),
});
readonly table    = createTable(this.invoices.value, { trackBy: 'id', columns: [...] });
```

Filters → request → data → table. The store is not involved.

**`active()`, not `value()`, is the URL shape.** A dynamic param set is correct: `status=` forces
the server to disambiguate "no filter" from "status is empty"; `?search=acme` and
`?search=acme&status=` are two cache entries for one query; omitting unset optional params is the
REST convention. An API demanding a fixed param set reads `value()` instead.

**No per-filter `encode`** (R16). Server APIs differ irreconcilably (`?amount_min=&amount_max=`,
`?amount=100..900`, `{amount:{gte,lte}}`), and one slot cannot hold both an HTTP encoding and a
URL-bar encoding for the same filter set. `active()` is a plain object; mapping it is a pure
function the consumer owns.

### Forms

Optional. The form's model **is** the filter model — no adapter, no sync effect, no duplicated
state (R18).

```ts
readonly filterForm = form(this.filters().value, (path) => {
  required(path.search);
  debounce(path.search, 300);
  min(path.amount.min, 0);
});
```
```html
<input [formField]="filterForm.search" />
<select [formField]="filterForm.status">
  <option value="">any</option>
  ...
</select>
```

A `<select>` binds only when its filter's empty criterion is `''` — see
[Empty criteria](#empty-criteria).

Signal Forms never copies state — the developer's `WritableSignal` is the source of truth — and
`filters().value` is one.

**Which way the view points.** Each filter node owns its own signal; the root is a writable view
composed over them — a read gathers every node, a write fans back out per key. Storage is still
one location per criterion, so nothing is copied and the two cannot desync.

This is the inverse of what this section originally specified (one root signal, per-filter
handles as views onto its keys), and the premise behind that — "`form()` cannot take a
synthesized object" — is false. `form()` needs a callable carrying a reactive node plus
`set`/`update`/`asReadonly`; it does not care whether storage sits above or below. Angular's own
Signal Forms builds precisely such an object in `deepSignal` (`Object.assign` onto a
`computed()`), which is the shape `createRootValueSignal()` (`filters/state.ts`) mirrors —
the same shape the repo already uses for `WritableView` (`engine/writable-view.ts`).

Node-first is what keeps per-filter `source`/`dirty` reconciliation local to the node that owns
it: a node with a declared `source` is a `linkedSignal` whose late-arrival rule is its own
business, not a merge the root has to arbitrate across keys.

One consequence worth knowing: `WritableSignal` is branded with a type-only `ɵWRITABLE_SIGNAL`
symbol that has no runtime counterpart, so the root view claims the type by assertion. Angular
does the same and is simply untyped at that spot.

**Debounce lives here** (R25). No debounce in `createFilters` — the form is built over the filter
model, so Signal Forms' `debounce()` applies to the criteria directly. A consumer not using
Signal Forms debounces their own signal. Shipping a third way would duplicate a mechanism the
composition already provides.

## Semantics

- **Combination:** within an `anyOf` group, **OR**; across filters, **AND** (R8).
- **Empty criteria skip their predicate.** What counts as empty is per-predicate — `''`, `null`,
  `{min:null,max:null}`, `[]` — declared beside the predicate (`autoRemove`-shaped) and applied
  before evaluation, so an empty filter never reaches persisted state or a query string (R14).
  `filter()` must let a custom predicate declare one too, and any rule may override its own with
  `{ emptyValue }` — see [Empty criteria](#empty-criteria).
- **Null/undefined cell values** (R27): a null or undefined cell **fails every positive matcher**
  (`isEqual`, `isContaining`, `isInRange`, `isInDateRange`, `hasAnyOf`) and **passes every
  negative one** (`hasNoneOf`) — a row with no tags has none of them. Guarded inside each shipped matcher, never
  in the runner, so a custom `filter()` predicate receives the cell unguarded and can match nulls:

  ```ts
  filter(path.notes, (cell, want: boolean) => want === (cell == null || cell === ''));
  ```

  `''` has no special status — it is a normal value that positive matchers happen to return
  `false` for. Deliberately unlike `applySortNulls()`'s `emptyString: 'is-empty'` opt-in, which
  exists because `''` must be *placed* somewhere in a sort order.
- **Order of evaluation:** empty-criterion check (skip the filter entirely) → read the cell →
  matcher, which owns its own null branch. A null cell is only ever reached by an *active* filter.

### One `matcher()` call is one evaluation

The returned predicate compiles the narrowing records once — gating and emptiness resolve per
call, not per row — and per-filter error reporting is deduped within that one instance. Calling
`matcher()` again produces a fresh predicate with fresh dedup state.

Two consequences worth holding:

- A consumer who holds one predicate across several passes gets **one pass's** semantics, dedup
  included. Call `matcher()` per pass to get per-pass reporting.
- The table calls it once per pass, so each pass reports independently — see
  [Errors](#errors) for what "dropped for the rest of the evaluation" means row by row.

Because the predicate is a plain function, the model narrows things that are not tables at all:

```ts
const visible = rows.filter(filters().matcher());
```

That is the point of the model being standalone, not a shorthand for the table case.

## Errors

Per [ADR-0014](../adr/0014-runtime-error-policy.md).

**Construction throws** — a duplicate filter on one path (R5), an unknown path, an `anyOf`
without a key. Deterministic, fires before data flows, no sane degraded reading.

**Runtime never throws.** A predicate that throws drops *that filter* for the rest of the
evaluation; other filters still narrow and the table still renders. Reported once per filter per
evaluation — not per row — with the filter key, the predicate and the offending cell, in
production as well as dev. Wrapped per filter, never per row: per-row catching yields an
inconsistent row set (some rows tested, some skipped) and puts a `try` in the hot loop.

**"For the rest of the evaluation" is literal.** The predicate answers row by row, so rows it
already answered for keep that filter's narrowing; only rows from the throwing one onward skip it.
A row-set entry point could discard the filter whole, and the one that did was deleted with the
coupling — see [ADR-0016](../adr/0016-filtering-takes-a-predicate-list.md) §2, which records the
trade and why it is accepted.

Custom predicates are the likeliest thing here to throw, because R27 hands them an unguarded
cell by design. The likeliest *reason* is a stale criterion — persistence is consumer-owned
`JSON.parse` (see [Persistence](#persistence)), so a snapshot written by an older schema revives
with a shape the predicate never expected.

**Residue:** a filter that failed still appears in `active()`. `active()` describes which criteria
are *set*, not which evaluations succeeded.

## Persistence

Consumer-owned. `createFilters` ships no storage adapter (R21).

```ts
localStorage.setItem('f', JSON.stringify(this.filters().value()));
this.filters().reset(JSON.parse(localStorage.getItem('f') ?? 'null'));
```

`value()` and `reset(value)` are both halves already; swapping `sessionStorage`, a URL, or a
server-side profile is a one-word change.

What a shipped mechanism would buy is the fiddly part — debounced writes, a version stamp plus
migration, revival for non-JSON criteria (the `Date` problem), and the drift rule (unknown key →
ignore, missing key → leave at default). Those are the *same four problems* for sort and column
state, so **a shared persistence feature is designed separately**, taking the table's snapshot
and a filters model as separate inputs. Not owned by `createFilters`, and not by the table
either.

> **Conflict to resolve there, not here:** [state-persistence.md](state-persistence.md) declares
> `filters?: { columnFilters: FilterRule[]; globalFilter: string }` inside `LayoutSnapshot`. Under
> R10 the table does not own filters and cannot populate that slice, and its shape is superseded
> besides. Deferred to the persistence feature's own design (R22).

## Deliberately not shipped

| Not shipped | Instead | Decision |
|---|---|---|
| Runtime operator picker (AG Grid / PrimeNG column menu) | operators are fixed at declaration | R1 |
| A *second* filter on one path (`as` renames, it does not duplicate) | one predicate over a compound criterion | R6, R31 |
| `toggle()` | `equals()` over a boolean column | R28 |
| `ColumnDef.filterFn` / `enableFiltering` | predicates live in the schema | R12 |
| Per-filter `encode` for server params | consumer maps `active()` | R16 |
| Debounce | Signal Forms' `debounce()` over the model | R25 |
| Persistence / storage adapter | consumer's `JSON.stringify` + `reset(value)` | R21 |
| Data-derived filter options (set filters) | consumer computes them | R11 |
| Any null/empty-cell option (`matchEmpty`, `cell:`, `isBlank`, `orEmpty`) | one internal policy; `filter()` for anything else | R27 |

Each is additive if revisited — none of them is foreclosed by shipping without it.

## Public API

Everything below is exported from `src/filters/index.ts` — the domain's own barrel, which the
library's `src/index.ts` re-exports wholesale. Anything under `src/filters/` **not** listed here
is internal, which is what makes `evaluator.ts`, `recorder.ts`, `state.ts` and `validate.ts`
private to the domain.

| Symbol | From | Kind |
|---|---|---|
| `createFilters` | `filters/create-filters.ts` | factory |
| `Filters`, `FilterNode`, `FilterOptions` | `filters/types.ts` | types |
| `equals`, `contains`, `inRange`, `inDateRange`, `hasAny`, `hasNone` | `filters/rules.ts` | declaration rules |
| `filter` | `filters/rules.ts` | the general rule |
| `anyOf`, `applyWhen` | `filters/rules.ts` | grouping / conditional rules |
| `isEqual`, `isContaining`, `isInRange`, `isInDateRange`, `hasAnyOf`, `hasNoneOf` | `filters/matchers.ts` | matchers (R30) |

`withFiltering` and `WithFilteringConfig` are deliberately **not** here — they are the table's
surface, documented in [features/filtering.md](features/filtering.md). Listing them in this file
was the doc-level version of the coupling `#105` removed.

Rules and matchers are split across two files rather than one because they are consumed at
different times — rules only inside a schema body, matchers only inside a custom predicate — and
because the split is what keeps the two naming conventions visibly separate.

**Removed in the same change** (R12, R26), a breaking public-API change: `FilterRule`,
`ColumnDef.filterFn`, `ColumnDef.enableFiltering`, and the imperative `withFiltering()` surface
(`setColumnFilter`, `clearColumnFilter`, `setGlobalFilter`, `clearFilters`, `columnFilters`,
`globalFilter`, `filterChanged`).

## Competitive position

**Verdict: novel.** No surveyed library (AG Grid, PrimeNG, TanStack, `MatTableDataSource`)
exposes filter state usable without its table; all four predate fine-grained reactivity, which is
what makes a standalone reactive filter object nearly free. Absence of precedent is partly
chronology, not purely judgment — but it is unvalidated, and that is the accepted risk of R10.

The typed filter *kinds* are the opposite — precedented, 2 of 4 ship them. Acceptance test they
must keep meeting: **a consumer can ignore every shipped rule and lose nothing but typing
convenience.** If the kinds accrete options until bypassing them means losing real capability,
they have become the contract rather than sugar over `filter()`.

Full survey: [work/with-filtering/research-generic-filter-utilities.md](work/with-filtering/research-generic-filter-utilities.md).
