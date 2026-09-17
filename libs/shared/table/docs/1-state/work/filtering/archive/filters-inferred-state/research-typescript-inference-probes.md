# Research — can `createFilters` infer `TState`?

**Date:** 2026-09-14 · **Status:** grilled — decisions taken as R34–R46 in
[with-filtering/design-options-hybrid-api.md](../with-filtering/design-options-hybrid-api.md) ·
**Feeds:** the filtering spec

> **Two "Known holes" below are wrong and are corrected in the decisions.** #1 (key collision)
> is already closed — `filters/validate.ts` throws on a duplicate key at construction, so the
> type-level merge is never observed. #3's proposed fix, the `no-unused-expressions` lint rule,
> does not fire: it deliberately permits bare call expressions. A construction-time throw (R40)
> was taken instead.

Every claim below is a compiled assertion, not a recollection. This doc replaces the 12 scratch
probe files that produced it — each compiled with the repo's own TypeScript (6.0.3) under
`--strict`. Assertions use an exact-match `Equal<X, Y>` helper — a pass means the inferred type
is structurally identical to the expected one, not merely assignable.

## The question

`createFilters<InvoiceRow, ClientInvoiceFilterState>(schema)` requires both type parameters to be
written by hand. R32 concluded `TState` cannot be inferred because `schema: (path) => void`
returns `void`, leaving "no channel to observe which keys a void-returning function's body
touched."

That reasoning is correct about the *current signature*. It is not a limit of TypeScript. The
channel is missing because rules record via side effect; if rules **return** and the schema
returns the collection, the channel exists.

## What was verified

### 1. Partial type-argument inference does not exist

`createFilters<InvoiceRow>(schema)` with a second inferred parameter is **illegal TypeScript** —
`Expected 2 type arguments, but got 1`. Specify one, you must specify all.

This invalidates any signature of the form `createFilters<TRow, S>(schema)` called with only
`TRow`. It applies equally to the object-map and array-return shapes. Something at the call site
must change no matter which direction is taken.

### 2. Four ways to supply `TRow`

| Shape | Result |
|---|---|
| `createFilters(rowOf<Row>(), schema)` — token value | ✅ exact |
| `createFilters(this.data, schema)` — real data | ✅ exact |
| `createFilters<Row>()(schema)` — curried | ✅ exact |
| `createFilters((path: FiltersPath<Row>) => …)` — param annotation | ⚠️ works, but fragile |

The annotation form silently degrades to `TRow = unknown` if the annotation is an alias
(`type P = FiltersPath<Row>`) or an interface extending it. The error names missing properties on
`FiltersPath<unknown>`, pointing at the wrong cause entirely. Not recommended.

> This also corrects R11's closing claim — *"TypeScript cannot recover `TRow` from a callback
> whose parameter is `ColumnsPath<TRow>`"*. It can. It is merely fragile.

### 3. One argument serves both modes, with no named carrier type

```ts
declare function createFilters<TRow, S extends readonly unknown[]>(
  rows: readonly TRow[] | (() => readonly TRow[] | undefined) | RowToken<TRow>,
  schema: (path: FiltersPath<TRow>) => S,
): Filters<TRow, StateOf<S>>;
```

All seven carriers infer `TRow` exactly:

| Carrier | |
|---|---|
| `InvoiceRow[]`, `readonly InvoiceRow[]` | ✅ |
| `Signal<readonly InvoiceRow[]>`, `WritableSignal<InvoiceRow[]>` | ✅ |
| `Signal<InvoiceRow[] \| undefined>` — a resource's value pre-load | ✅ |
| `() => InvoiceRow[]` — a bare store method | ✅ |
| `rowOf<InvoiceRow>()` — server mode, no data yet | ✅ |
| `42`, `{ foo: 1 }` | ✅ rejected |

The middle union member — *any callable returning rows* — covers the four signal-shaped cases on
its own. An earlier attempt used a recursive `RowOf<E>` conditional type plus a named
`RowEvidence` constraint to keep the slot open-ended; it was discarded as machinery re-deriving
what one union member states directly, for identical coverage.

### 4. `TState` inference works in two shapes

Given rules that return `FilterRule<TKey, TCriterion>` instead of recording:

```ts
type StateOf<T extends readonly unknown[]> =
  { [R in Extract<T[number], AnyRule> as R['key']]: CriterionOf<R> };
```

- **Array form** — `(path) => [equals(path.status), inRange(path.amount)]`. Keys stay implicit,
  borrowed from each path as they are today. ✅ exact.
- **Object form** — `(path) => ({ status: equals(path.status) })`. Keys written explicitly. ✅
  exact.

Both infer criteria exactly, including `filter()`'s criterion taken from the predicate's own
annotation — so `tags: TagCriterion` no longer needs hand-writing.

### 5. Never name the key type in a constraint

This is the sharp edge, and it cost two separate debugging rounds.

```ts
S extends readonly FilterRule<string, unknown>[]   // ✗ every rule's key widens to `string`
S extends readonly unknown[]                       // ✓ literal keys survive
```

Naming `string` in the key position contextually types the array elements, pushing `string` down
onto each rule's key parameter. The tuple itself survives intact — only the keys widen, which
makes it look like tuple widening and sends you after the wrong cause. `as const`, the `const`
type-parameter modifier, and a variadic `[...T[]]` constraint all fail to fix it, because none of
them addresses contextual typing.

It bit `createFilters` and then `applyWhen` identically. Any future rule combinator takes the
same constraint.

### 6. `anyOf` and `applyWhen` both survive

`anyOf`'s synthetic key — one that is not a `keyof TRow` — lands in `TState` beside the
path-derived keys:

```ts
anyOf('search', [contains(path.note), filter(path.id, matchesInvoiceNumber)])
// → { status: InvoiceStatus | null; search: string }
```

**A mismatch that is silent today becomes a compile error.** `rules.ts:213` borrows
`isEmpty`/`emptyValue` from the group's first child while each child keeps its own predicate, so
a group mixing a `string` child with a `{ min: number }` child compiles and misbehaves at
runtime. With one inferred shared `TCriterion`, TypeScript rejects it:

```
Type '{ min: number; }' is not assignable to type 'string'
```

`applyWhen` returns its rules and the caller spreads them, each keeping its own key. ✅ exact.

## Known holes

| Hole | Consequence | Fix |
|---|---|---|
| Key collision — `equals(path.customer)` + `anyOf('customer', …)` | silently merges to one key with a union criterion | `validate.ts` checks path uniqueness; needs key uniqueness |
| `createFilters([], schema)` | `TRow = never`, compiles, useless object — `keyof never` widens to an index signature | make `FiltersPath<never>` resolve to an error-shaped type |
| A bare `equals(path.x);` statement | silently registers nothing once rules return instead of record | lint (`no-unused-expressions`) |
| Widened `as` — `{ as: someStringVar }` | today produces an untyped key silently | now rejectable: `TAs` becomes a real inference site, so `EnforceLiteralKey` finally bites |

## What this would supersede

| | |
|---|---|
| R10/R11 | data is accepted when it exists; `rowOf()` is the server-mode escape hatch, not a separate API |
| R31 | `as` becomes genuinely enforceable as a string literal |
| R32 | `TState` is inferred; the second type parameter goes |
| R33 | `anyOf`'s inner callback disappears, taking its `TRow` gap with it |
| R11's closing claim | factually wrong — see §2 |

## Migration surface

13 call sites, every one inside `libs/shared/table` — 3 story hosts, 2 story fixtures, 8 spec
sites. No consumers outside the library. Three `*FilterState` types delete outright.

The mechanical change is small: `{ }` → `[ ]`, commas between rules, a first argument, and
`anyOf`'s nested callback flattens to an array over the outer `path`.
