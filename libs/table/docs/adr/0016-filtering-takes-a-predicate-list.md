# ADR-0016 — The filter model is the consumer's; the table takes a predicate list

**Status:** superseded 2026-09-14 by R50–R56 (`#89`) — the predicate list this ADR shipped was
replaced by a table-owned model within the same day. See [Successor](#successor) below.
**Related:** [ADR-0014](0014-runtime-error-policy.md) (runtime error policy), [ADR-0004](0004-table-source-layout.md) (layout by contract boundary). Current shipped surface: [`../1-state/features/filtering.md`](../1-state/features/filtering.md).

`withFiltering()` used to accept a whole `Filters<TRow, TState>` object and read its compiled
state back out through a module-private symbol — an import edge into the filters domain, a
criterion-map type parameter, and a side channel that existed only because the public `Filters`
surface didn't expose what the feature needed. A filter model's whole output, from the table's
point of view, is one function (row → survives?). So `withFiltering()` now takes `predicates: ()
=> readonly ((row: TRow) => boolean)[]` and imports nothing from the filters domain;
`createFilters()` is a standalone primitive the consumer owns, and the two meet only in an
expression the consumer writes:

```ts
withFiltering({ predicates: () => [this.filters().matcher()] });
```

Either side is usable without the other — already the shipped reality in server mode, where the
table composes no filtering feature at all. AND is the only combinator the table assumes; OR
lives inside a term (`anyOf`, or a hand-written predicate) — the table has no vocabulary for
which terms group with which. An anonymous predicate that throws is dropped for that pass and
reported once, by its index, per [ADR-0014](0014-runtime-error-policy.md).

## Alternatives considered

- **Keep `filters` as a second accepted input, for convenience.** Rejected — re-establishes the
  import edge and the criterion-map type parameter this ADR removes, to save one expression.
- **A `mode: 'and' | 'or'` combinator field on the config.** Rejected — wrong altitude, a flat
  mode can't express nesting, and nesting already has a complete answer one level down (a
  hand-written predicate).
- **Per-row error wrapping instead of per-term.** Rejected — yields a half-filtered set, harder
  to diagnose than a term uniformly not applying, and puts a `try` in the hot loop.

## Consequences

- **Source-breaking.** `filters` is gone from `WithFilteringConfig`, `predicates` is required —
  any call passing a filter set, or neither input, stops compiling. `withFiltering({ manual: true
})` alone no longer compiles; the server-mode-symmetry call is now `withFiltering({ predicates:
() => [], manual: true })`.
- `matcher(): (row: TRow) => boolean` puts `TRow` in the type body (previously phantom on
  `Filters<TRow, TState>`), so a filter set built for an unrelated row type is now a compile
  error instead of a silently empty table. This behavior survived the successor redesign
  unchanged — see
  [`../1-state/features/filtering.md`](../1-state/features/filtering.md#state) for the fix if you
  hit this error.

## Successor

Decided the same day this ADR was accepted, superseded before its first release. R50 reopened
R10's premise — filters feed the request that produces server-mode data, which was read as
meaning a table-owned filter object couldn't be constructed at all. The premise was false: a
table's row-data signal is read through a thunk, so a `resource()` (or `rxResource`) whose params
read `table.filters().criteria()` wires with no construction cycle. With that blocker gone,
ownership tracks who originates the value, and filters are always born with a table — so
`withFiltering(config)` now builds and owns the model directly, exposed as `table.filters`.

Concretely: `predicates: () => readonly ((row: TRow) => boolean)[]` is gone from
`WithFilteringConfig`, replaced by `schema: (path: FiltersPath<TRow>) => S`. Server mode still
composes `withFiltering()` — now with `manual: true` — instead of composing nothing. The
**raw-predicate escape hatch this ADR enabled has no replacement** (R54): a predicate with no
criterion is a _scope_, not a filter, and a scope is expressed by narrowing the rows signal
passed into `createTable()` — `filter` runs first in `PIPELINE_ORDER`, so the pipeline output is
identical either way. This ADR's per-term error-degradation reasoning (one throwing term reported
once, by key, dropped for the rest of the evaluation) carried forward unchanged into the
successor's per-filter reporting.

Current contract: [`../1-state/features/filtering.md`](../1-state/features/filtering.md). Full
decision log: [`design-options-hybrid-api.md`](../1-state/work/filtering/archive/with-filtering/design-options-hybrid-api.md)
(R50–R56).
