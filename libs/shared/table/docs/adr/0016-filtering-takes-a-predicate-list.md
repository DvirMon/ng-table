# ADR-0016 — The filter model is the consumer's; the table takes a predicate list

**Status:** accepted — decided 2026-09-14, implemented in `#105`
**Decision:** `withFiltering()` accepts one input — `predicates: () => readonly ((row: TRow) =>
boolean)[]` — and imports nothing from the filters domain. `createFilters()` is a standalone
primitive the consumer owns; the two meet only in an expression the consumer writes.
**Date:** 2026-09-14
**Related:** [ADR-0014](0014-runtime-error-policy.md) (the runtime error policy this step's
isolation unit follows), [ADR-0004](0004-table-source-layout.md) (layout by contract boundary),
epic `#101` / issue `#105`,
[spec](../1-state/work/decouple-filters/spec.md),
[decision record](../1-state/work/with-filtering/migration-decouple-filters-from-table.md)

> **Amendment note — 2026-09-14.** `#109` inferred the criterion map from the schema, so the
> `createFilters` calls quoted below now take a row carrier (`createFilters(rows, …)`, or
> `rowOf<Row>()` in server mode) and return their rules as an array. The decision this ADR records
> is unaffected — the table still takes a predicate list and names no filter type. The shipped
> filter surface is [`../1-state/filters.md`](../1-state/filters.md); the body below is left as
> the record of what was true when this was accepted.

## Context

`withFiltering()` used to accept a whole `Filters<TRow, TState>` object and read its compiled state
back out through a module-private symbol. That made the table feature depend on the filter model in
three ways at once: an import edge from `api/features/` into the filters domain, a criterion-map
type parameter threaded through the config and both overloads, and a side channel
(`attachFiltersInternal` / `getFiltersInternal`) that only existed so the feature could reach state
the public `Filters` surface did not expose.

None of that was load-bearing. A filter model's whole output, from the table's point of view, is one
function: given a row, does it survive. `matcher()` (`#102`) exposes exactly that, and `predicates`
(`#103`) accepts exactly that. `#104` migrated every call site. This ADR records the contract that
deletion leaves behind.

## Decision

### 1. The filter model is the consumer's; the table takes a predicate list

`WithFilteringConfig<TRow>` is `{ predicates: () => readonly ((row: TRow) => boolean)[]; manual?:
boolean }`. `predicates` is required — with `filters` gone it is the feature's only input, and an
optional sole input means composing the feature to do nothing.

Wiring the filter model to the table is ordinary composition, written at the call site:

```ts
withFiltering({ predicates: () => [this.filters().matcher()] })
```

The table no longer knows what a filter is; the filter model no longer knows a table exists. Either
is usable without the other — which is already the shipped reality in server mode, where the table
composes no filtering feature at all.

**Rejected:** keeping `filters` as a second accepted input "for convenience". It re-establishes both
the import edge and the criterion-map type parameter — precisely the cost being removed — in
exchange for saving the consumer one expression.

### 2. One term is the error-isolation unit

A predicate that throws is dropped for that pass and reported once, by its index. Consistent with
[ADR-0014](0014-runtime-error-policy.md): a consumer callback degrades, it does not take the table
down.

**Rejected — per row:** wrapping each row yields a half-filtered set, some rows tested and some
skipped, which is harder to diagnose than a term uniformly not applying, and puts a `try` in the hot
loop.

**Rejected — per pass:** one throwing term returns every row unfiltered. That is the silent,
unrecoverable direction — the screen looks plausible and the filter is simply gone.

The index-based report is the floor, for **anonymous** terms. A term produced by `matcher()` already
reports under its own filter key from inside the evaluator, and keeps doing so.

**Inside a `matcher()` term, isolation is per-row-onward, not whole-pass.** The evaluator's row
predicate drops a throwing filter from the row that threw onward; rows it already answered for keep
that filter's narrowing. The row-set entry point it replaced discarded a throwing filter whole, so
no row saw it. This is the cost of a row predicate being the seam, and it is accepted: the seam is
what makes the filter model composable with anything, and the weaker guarantee is still bounded,
reported once, and never silent. The table's own per-term isolation above is unaffected — a
throwing term is dropped for the whole pass.

### 3. AND is the only combinator the table may assume

Each term narrows further. OR lives *inside* a term — `anyOf` in the filter model, or a
hand-written predicate — because the table has no vocabulary for expressing which terms group with
which, and inventing one would re-import the filter model's grammar through the back door.

**Rejected:** a combinator field on the config (`mode: 'and' | 'or'`). It is the wrong altitude: a
flat mode cannot express nesting, and any consumer needing nesting already has a complete answer one
level down.

### 4. The row-type rejection is a public type-behavior change

`TRow` was phantom on `Filters<TRow, TState>` — it appeared in no member's type. `Filters<OtherRow>`
and `Filters<Row>` were therefore the same type once `TState` matched, so a filter set built for an
unrelated row type compiled, then read fields that did not exist. The failure was silent at every
level: no error, just an empty or unfiltered table.

`matcher(): (row: TRow) => boolean` puts `TRow` in the type body, so the mismatch is now a compile
error at the wiring expression.

**Structural compatibility is preserved.** An identically shaped row type still works, and so does a
wider one carrying extra fields. Only genuinely unrelated row types are rejected.

**If you hit this error:** give the filter set the row type the table actually holds, through its
first argument — the table's own row data, or `rowOf<InvoiceRow>()` where no data exists yet. The
error is reporting a real mismatch that previously ran silently; widening the carrier to make it
compile reintroduces the bug.

> **Corrected after #110.** This paragraph previously said to annotate with
> `createFilters<InvoiceRow>(…)`. That no longer compiles: the row type comes from the carrier
> argument, and naming `TRow` explicitly forces the schema's own type parameter to be named too.

## Consequences

- `withFiltering()` imports nothing from `api/filters/`, and the feature's config carries no
  criterion-map type parameter. The two undiscoverable call-site rules that parameter enforced —
  `TState` had to be a `type` and not an `interface`, and `In` must never be passed explicitly —
  cannot be violated any more, because there is nothing left to pass.
- `createFilterEvaluatorFrom` is the domain's only evaluator entry point and is not exported past
  the domain. The `FILTERS_INTERNAL` symbol and its two accessors are gone.
- The separately-specced inferred-criterion-map work drops its planned `TRow` branding member as
  dead work: `matcher()` consumes `TRow` already, so the brand has nothing left to fix.
- **This is a source-breaking API change.** `filters` is gone from `WithFilteringConfig` and
  `predicates` is now required, so any call passing a filter set — or passing neither input — stops
  compiling. Dropping the defaulted `TState` parameter is the one part that breaks nobody, since no
  caller ever passed it. Recorded here rather than in a later documentation pass because the break
  ships in this commit.
- `withFiltering({ manual: true })` alone no longer compiles. Server mode composes no filtering
  feature at all; where the symmetry with `withSorting()` is worth stating, the call is
  `withFiltering({ predicates: () => [], manual: true })`.
