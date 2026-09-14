---
title: State Layer Reference — withFiltering()
type: architecture
version: 3.1
date: 2026-09-14
capability: filtering
spec: drilled
code: shipped
audience: developers
parent: ../architecture.md
---

# withFiltering()

## Executive Summary

The client-side half of filtering, and **only** that half. It applies a list of row predicates
to the rows in the pipeline's `filter` stage.

```ts
readonly filters = createFilters(this.data, (path) => [
  equals(path.status),
  inRange(path.amount),
]);

readonly table = createTable(
  this.data,
  { trackBy: 'id', columns: [...] },
  withFiltering({ predicates: () => [this.filters().matcher()] }),
);
```

`this.data` appears in both calls and is not shared state: the table reads the rows,
`createFilters` only takes the row type from them.

It owns no filter state, and it does not know what a filter is. A predicate is the whole
contract: the feature imports nothing from the filters domain and names no filter type
([ADR-0016](../../adr/0016-filtering-takes-a-predicate-list.md)). The snippet above is ordinary
composition the consumer writes — [`createFilters()`](../filters.md) is one way to produce a
term, a hand-written `(row) => boolean` is another, and the model works with no table at all.

**In server mode this feature is not composed at all.** The filters feed the request that
produces the data; the table renders rows that arrive already filtered (R10).

## Config

```ts
interface WithFilteringConfig<TRow> {
  predicates: () => readonly ((row: TRow) => boolean)[];
  manual?: boolean;
}
```

`TRow` infers from the enclosing `createTable()` config — no per-call generic (`5a3a09d`).

| Field | Purpose |
|---|---|
| `predicates` | a thunk returning the row predicates to apply. Required — the feature's only input |
| `manual` | skip the client-side filter stage |

Two facts the thunk shape carries:

- **One call is one evaluation.** The thunk is invoked once per pass, not once per row, so every
  row in a pass sees the same term list.
- **It is read reactively.** Filtering recomputes when a signal the thunk reads changes — which is
  what makes the `matcher()` term in the snippet above track the criteria with no wiring of its
  own. A filter model is one way to produce a term, not a config option.

## Behavior

- Claims the `filter` pipeline stage. Filtering runs **first**, before group/sort/expand
  (unchanged), so `aggregateFn` never sees unfiltered rows.
- Applies the terms in order, **AND**'d — each narrows the survivors further. An empty list never
  narrows.
- **AND is the only combinator the table assumes.** OR lives inside a term, because the table has
  no vocabulary for expressing which terms group with which (ADR-0016).
- Criterion-level semantics — OR within an `anyOf` group, empty criteria skipped before
  evaluation, the null/undefined cell policy (R27) — belong to whatever term the consumer
  supplies, and for a `matcher()` term they are the filter model's:
  [filters.md](../filters.md#semantics). The feature adds no policy of its own.

## `manual`

```ts
withFiltering({ predicates: () => [], manual: true })
```

- The pipeline **skips the client-side filter stage** entirely; the terms are not evaluated.
- Whatever produced the terms is untouched — a filter model's `value()`, `criteria()` and `dirty()`
  behave identically.

**Retained for symmetry, not necessity** (R23), and the argument is one step weaker than it was.
`predicates` is now required and consumer-supplied, so "skip the stage" is very close to "do not
compose the feature" — which is what the ordinary server-side path already does under R10. It is
kept because `withSorting` carries the same flag, and a table filtering server-side while sorting
client-side composes two features whose `manual` settings differ.

Precision on the precedent: `manual` is a **two-feature** convention, not a universal one. Only
`withSorting` and `withFiltering` accept it; `withExpansion`'s config has just
`childrenAccessor` / `isExpandable`, and `withGrouping` does not exist (it appears only as a
doc-comment in `api/types.ts`).

## Errors

Per [ADR-0014](../../adr/0014-runtime-error-policy.md) and
[ADR-0016](../../adr/0016-filtering-takes-a-predicate-list.md). **The catch unit is one term.** A
term that throws is dropped for that pass and reported once, by its index; its siblings keep
narrowing, and it never takes the table down.

The index is the floor, for anonymous terms. A term produced by `matcher()` already reports under
its own filter key from inside the evaluator — full statement in
[filters.md](../filters.md#errors).

## Compile-Time Dependencies

None. `with-filtering.ts` imports nothing from the filters domain and names no filter type (`#105`).
It reads nothing from other features and contributes no members.

It no longer reads anything from the columns config either: `ColumnDef.filterFn` and
`ColumnDef.enableFiltering` are removed (R12). `filterFn` has no criterion to pair with once
predicates live in the schema keyed by path, and `enableFiltering` existed only to exclude a
column from a global filter that auto-scanned every column — `anyOf` lists its paths explicitly
instead.

## Members Owned

**None.** Deliberate: there is no `table.filters`, no `table.setColumnFilter()`. Whatever produces
the predicates is the consumer's, and a table-side mirror would create a second path to state the
table does not own.

## Events Owned

**None.** The old `filterChanged` observable is gone. Criteria live wherever the consumer put
them — with `createFilters()` that is a signal, so a consumer who wants to react reads it and a
resource depending on `criteria()` re-runs on its own.

## Decisions

Recorded in [work/with-filtering/design-options-hybrid-api.md](../work/with-filtering/design-options-hybrid-api.md)
(R1–R31). The three that governed this file specifically:

- **R10** — `createFilters()` is standalone, not a config field of this feature. Forced by server
  mode: filters feed the request that produces the data, so a table-owned filter object cannot be
  constructed at all.
- **R23** — `manual` is kept for cross-feature consistency. Still holds, with the weaker rationale
  recorded under [`manual`](#manual) above.
- **R49** — `criteria()` is the filter model's set-criteria member, named `active()` in `src/`
  until `#96` lands. This file mentions it only in passing; the member set belongs to
  [filters.md](../filters.md#state).
- **R26** — **executed 2026-09-14.** The superseded imperative implementation is gone:
  `setColumnFilter()`, `setGlobalFilter()`, `clearFilters()`, `columnFilters` and `globalFilter`
  no longer exist. It was a planned breaking change, not a cleanup, and it is done — anything
  still naming those five members is stale.

**Superseded by [ADR-0016](../../adr/0016-filtering-takes-a-predicate-list.md) (`#105`).** The
options doc discusses this feature as an *adapter over a filter model*, with `filters` as its
config field and a criterion-map type parameter carried through. Both are gone; the feature takes
a predicate list and the wiring is composition the consumer writes. Any R-number describing the
`filters` config field, `createFilterEvaluator`, or a caller-supplied criterion map describes a
shape that no longer exists — read the ADR for what replaced it, not the options doc.

Superseded behavioral decisions from v1.1 of this file, kept here so the change is traceable:

| | Old decision | Status |
|---|---|---|
| D1 | Global filter match is case-insensitive, not configurable | **Gone.** It described an auto-scan over every filterable column. `anyOf` lists its paths and predicates explicitly, so case sensitivity is whatever the chosen predicate does |
| D2 | No built-in debounce | **Stands** — reaffirmed by R25, which routes debouncing through the Signal Form over the model |
| D3 | Missing `filterFn` falls back to an auto-detected default | **Gone.** Every filter names its predicate; there is no "missing predicate" case left |

## Resolved Questions

- [x] ~~Interaction with `withGrouping()`'s aggregation~~ — resolved 2026-07-31 (`architecture.md`):
  `aggregateFn` runs over filtered rows, since `group` clusters after `filter` in the fixed
  pipeline order.
- [x] ~~Global filter case-sensitivity / debounce~~ — resolved 2026-09-09 (D1/D2), then
  superseded as above.
- [x] ~~Where filter state lives~~ — resolved 2026-09-09, R10. Not here.

## Competitive position

**Verdict: closed.** `api/features/with-filtering.ts` implements the client-side filter stage over
a consumer-supplied predicate list (#62, reshaped by #105), replacing the superseded imperative
shape.

Assessed 2026-09-05 against TanStack Table v8, AG Grid, Material React Table and PrimeNG —
column + global filtering is baseline in all four competitors' free tier. Full reasoning:
[gap-analysis.md](../work/state-feature-competitive-audit/gap-analysis.md).
