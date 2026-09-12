---
title: State Layer Reference — withFiltering()
type: architecture
version: 2.0
date: 2026-09-10
capability: filtering
spec: drilled
code: shipped
audience: developers
parent: ../architecture.md
---

# withFiltering()

## Executive Summary

The client-side half of filtering, and **only** that half. It applies a
[`createFilters()`](../filters.md) object to the rows in the pipeline's `filter` stage.

```ts
readonly filters = createFilters<Invoice>((path) => {
  equals(path.status);
  inRange(path.amount);
});

readonly table = createTable(this.data, () => ({
  trackBy: 'id',
  columns: [...],
  features: [withFiltering({ filters: this.filters })],
}));
```

It owns no filter state. Criteria, predicates, keys, `value()`, `active()`, `reset()` and
`dirty()` all belong to the filters object, which the consumer holds and which works with no
table at all — see [filters.md](../filters.md) for the whole contract. This feature is the
adapter that makes a table honour one.

**In server mode this feature is not composed at all.** The filters feed the request that
produces the data; the table renders rows that arrive already filtered (R10).

## Config

```ts
interface WithFilteringConfig<TRow> {
  filters: Filters<TRow>;
  manual?: boolean;
}
```

`TRow` infers from the enclosing `createTable()` config — no per-call generic (`5a3a09d`).

| Field | Purpose |
|---|---|
| `filters` | the object returned by `createFilters<TRow>()`. Required — the feature has nothing to do without one |
| `manual` | skip the client-side filter stage; state still updates normally |

## Behavior

- Claims the `filter` pipeline stage. Filtering runs **first**, before group/sort/expand
  (unchanged), so `aggregateFn` never sees unfiltered rows.
- Reads `filters().active()` and applies each active filter's predicate to each row.
- **Combination:** within an `anyOf` group, **OR**; across filters, **AND**.
- **Empty criteria** are skipped before evaluation and never reach the stage.
- **Null/undefined cells** follow the matcher policy in [filters.md](../filters.md#semantics)
  (R27) — the feature adds no policy of its own.

## `manual`

```ts
withFiltering({ filters: this.filters, manual: true })
```

- Criteria update normally; `value()`, `active()` and `dirty()` behave identically.
- The pipeline **skips the client-side filter stage** entirely.

**Retained for symmetry, not necessity** (R23). Under R10 the ordinary server-side path does not
compose this feature at all, which makes `manual` redundant for the common case. It is kept
because `withSorting` carries the same flag, and a table filtering server-side while sorting
client-side composes two features whose `manual` settings differ — dropping it from one would
make the contract irregular for no gain.

Precision on the precedent: `manual` is a **two-feature** convention, not a universal one. Only
`withSorting` and the superseded `withFiltering` accept it; `withExpansion`'s config has just
`childrenAccessor` / `isExpandable`, and `withGrouping` does not exist (it appears only as a
doc-comment in `api/types.ts`).

## Errors

Per [ADR-0014](../../adr/0014-runtime-error-policy.md). A predicate that throws deactivates that
filter for the evaluation and is reported once per filter per evaluation; it never takes the
table down. Full statement in [filters.md](../filters.md#errors).

## Compile-Time Dependencies

None. The feature reads nothing from other features and contributes no members.

It no longer reads anything from the columns config either: `ColumnDef.filterFn` and
`ColumnDef.enableFiltering` are removed (R12). `filterFn` has no criterion to pair with once
predicates live in the schema keyed by path, and `enableFiltering` existed only to exclude a
column from a global filter that auto-scanned every column — `anyOf` lists its paths explicitly
instead.

## Members Owned

**None.** Deliberate: there is no `table.filters`, no `table.setColumnFilter()`. The consumer
already holds the filters object, and adding a table-side mirror would create a second path to one
piece of state.

## Events Owned

**None.** The old `filterChanged` observable is gone — `filters().value` is a signal, so a
consumer who wants to react reads it, and a resource that depends on `active()` re-runs on its
own.

## Decisions

Recorded in [work/with-filtering/design-options-hybrid-api.md](../work/with-filtering/design-options-hybrid-api.md)
(R1–R31). The three that governed this file specifically:

- **R10** — `createFilters()` is standalone, not a config field of this feature. Forced by server
  mode: filters feed the request that produces the data, so a table-owned filter object cannot be
  constructed at all.
- **R23** — `manual` is kept for cross-feature consistency.
- **R26** — the superseded implementation stays on disk until `createFilters()` lands; its
  removal is a planned breaking change, not a cleanup.

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

**Verdict: closed.** `api/features/with-filtering.ts` now implements this adapter over
`createFilters()` (#62), replacing the superseded imperative shape.

Assessed 2026-09-05 against TanStack Table v8, AG Grid, Material React Table and PrimeNG —
column + global filtering is baseline in all four competitors' free tier. Full reasoning:
[gap-analysis.md](../work/state-feature-competitive-audit/gap-analysis.md).
