# ADR-0016 — The filter model is the consumer's; the table takes a predicate list

**Status:** accepted — decided 2026-09-14, implemented in `#105`.
**Related:** [ADR-0014](0014-runtime-error-policy.md) (runtime error policy), [ADR-0004](0004-table-source-layout.md) (layout by contract boundary). Shipped surface: [`../1-state/filters.md`](../1-state/filters.md).

`withFiltering()` used to accept a whole `Filters<TRow, TState>` object and read its compiled
state back out through a module-private symbol — an import edge into the filters domain, a
criterion-map type parameter, and a side channel that existed only because the public `Filters`
surface didn't expose what the feature needed. A filter model's whole output, from the table's
point of view, is one function (row → survives?). So `withFiltering()` now takes `predicates: ()
=> readonly ((row: TRow) => boolean)[]` and imports nothing from the filters domain;
`createFilters()` is a standalone primitive the consumer owns, and the two meet only in an
expression the consumer writes:

```ts
withFiltering({ predicates: () => [this.filters().matcher()] })
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
  error instead of a silently empty table. See
  [`../1-state/filters.md`](../1-state/filters.md#matcher) for the fix if you hit this error.
