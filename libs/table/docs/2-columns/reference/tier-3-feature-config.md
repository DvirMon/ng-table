---
title: Columns Schema — Tier 3 Feature Config (store-owned, column-seeded)
type: architecture
version: 0.1
date: 2026-07-24
status: drafted — spec only, not yet implemented
audience: developers
parent: ../architecture.md
---

# Tier 3 — Feature Config (store-owned, column-seeded)

**Each seeds an opt-in store feature; dead unless that feature is composed.** The runtime
_state_ (active sort direction, active filter value) stays store-owned. Ship last. Read
[Ownership model](ownership-model.md) first — as of 2026-07-25, this tier split functions
duplicating an existing `ColumnDef` field (`filterFn`, `enableFiltering`, `aggregateFn`) as
**reactive/async only**, static goes on the array literal instead; functions with no `ColumnDef`
equivalent (`applyDefaultSort`, `applyGroup` — the seeded state lives entirely in
`withSorting()`/`withGrouping()`, not on the column) **keep their static seed input**, same as
`applyPinned` in Tier 2. **Sorting no longer fits this split at all** — as of #100,
`ColumnDef` carries no feature config, so `sortFn`/`enableSorting` are not "an existing field to
duplicate reactively" any more; see the Sorting section below.

> **Dead without the feature.** A rule declared through a feature's `schema` does nothing unless
> that feature (e.g. `withSorting()`) is composed as a positional argument to `createTable()` — an
> unknown/undeclared column id throws at construction instead (ADR-0014, `assertDeclarationsAreKnown`).

## Sorting — superseded by #100's shipped surface

**This section described a speculative, never-implemented API.** [#100](https://github.com/DvirMon/ng-table/issues/100)
shipped the actual per-column sorting surface as `withSorting({ schema })`, with three bare-named
declarators (`docs/decisions/sorting.md` SO19/21/22/25):

```ts
sortNulls<TRow>(path, opts: { order?: 'first' | 'last'; emptyString?: 'is-empty' }): void;
sortFn<TRow>(path, compare: (a: TRow, b: TRow) => number): void;   // positional comparator, not `{ when }`
sortable<TRow>(path, opts: { enable: () => boolean }): void;
```

None of the three duplicate a `ColumnDef` field — `ColumnDef` carries no feature config at all as
of #100 (superseding this doc's "static goes on the array literal instead" framing for sorting).
Reuse across columns goes through `sortingSchema<Row>(fn)`, not an `apply(path, schema)`
archetype (see the Open Questions note below, and SO26). See
[`1-state/features/sorting.md`](../../1-state/features/sorting.md) for the full contract.

## Filtering — feeds [`withFiltering()`](../../1-state/features/filtering.md)

```ts
applyEnableFiltering<TRow, K>(path, enabled: { when: (ctx) => boolean }): void;   // reactive only — static: array `enableFiltering` field
applyFilterFn<TRow, K>(path, filterFn: { when: (ctx) => (value: unknown, filterValue: unknown) => boolean }): void;   // reactive only — static: array `filterFn` field
```

- Per-column opt-out + custom predicate. Both fields already exist on `ColumnDef`, so static
  authoring is array-only; schema only for a filter predicate that itself needs to change reactively
  (rare, but a real case — e.g. locale-dependent comparator).
- **AG-Grid analog:** `filter` colDef field + filter model.

## Grouping & Aggregation — feeds [`withGrouping()`](../../1-state/features/grouping.md)

```ts
applyGroup<TRow, K>(path, group: boolean | { index?: number } | { when: (ctx) => boolean | { index?: number } }): void;   // seed + reactive — no ColumnDef equivalent
applyAggregateFn<TRow, K>(path, aggregateFn: { when: (ctx) => (rows: TRow[]) => unknown }): void;   // reactive only — static: array `aggregateFn` field
```

- `applyGroup` seeds `withGrouping()`'s grouped-columns/order state directly — no `ColumnDef` field
  for group membership. RESOLVED 2026-07-31: unlike `applyDefaultSort`/`applyPinned`, `applyGroup`
  also accepts a reactive `{ when }` form — a store `effect()` calls into `withGrouping()`'s toggle
  when the signal changes, same wiring pattern as `sortFn`/`applyFilterFn`, just targeting
  feature state instead of a `ColumnDef` field. Consumer flips a signal; no direct store-method call
  needed from the UI layer. Static form still supported for construction-time defaults.
  `applyAggregateFn` duplicates the existing `ColumnDef.aggregateFn` field, so it narrows to
  reactive-only like the sorting/filtering functions above.
- **AG-Grid analog:** `rowGroup` / `rowGroupIndex` + `aggFunc`.
- **Looking for "is this column a grouping level" or "what level is this"?** That relation lives
  on `withGrouping()`, not `ColumnDef` — `table.groupingLevels(): Signal<ColumnDef<TRow>[]>` and
  `table.isGroupedBy(columnId): boolean` (issue #81). `ColumnDef` gained no new field for it: the
  levels are dynamic (edited at runtime via `table.grouping.update(...)`), so a per-column value
  set at construction can't track them. See [grouping.md](../../1-state/features/grouping.md).

## Summary

| Function                                                                        | Static?                                 | Seeds / duplicates                                                | AG-Grid analog               |
| ------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------- | ---------------------------- |
| `sortNulls` / `sortFn` / `sortable` (shipped — #100, `withSorting({ schema })`) | n/a — no `ColumnDef` field to duplicate | superseded, see above                                             | `sortType`                   |
| `applyAggregateFn`                                                              | ❌ reactive/async only                  | duplicates `ColumnDef` field — array literal for static           | `aggFunc`                    |
| `applyDefaultSort` (still speculative, unbuilt — product's OQ-sort-4)           | ✅ seed keeps static                    | no `ColumnDef` field — seeds `withSorting()`'s initial sort state | `sort` / `sortIndex`         |
| `applyEnableFiltering` / `applyFilterFn`                                        | ❌ reactive/async only                  | duplicates `ColumnDef` field — array literal for static           | `filter` + filter model      |
| `applyGroup`                                                                    | ✅ static seed + reactive `{when}`      | no `ColumnDef` field — seeds/toggles `withGrouping()` state       | `rowGroup` / `rowGroupIndex` |

> Pivot-only AG-Grid fields (`pivot`, `pivotIndex`, `pivotSort`, `showValuesAs`, `valueIndex`)
> excluded — no pivot feature in this table.

## Open questions (Tier 3)

- [x] **Feature-absent handling** — RESOLVED 2026-07-31: compile error. `applyGroup` on a column
      rejects at type-check time when `withGrouping()` is not composed — matching how the store now
      expresses a dependency, as an F-bounded `Feature<In, Out>` input slice typed by argument order
      (#33), not the removed ngrx `type<>` marker. Requires threading feature presence into the
      schema fn's / `columnSchema()` generic. Same resolution should apply to the analogous case in
      [`1-state/architecture.md`](../../1-state/architecture.md).
- [x] **Reusable archetypes** — RESOLVED 2026-07-31: deferred. No confirmed repeated-bundle use
      case yet; ship Tier 1-3 `apply*` functions first, revisit `apply(path, schema)` composability
      (a `moneyColumn`-style archetype) once a real case surfaces. See
      [Signal Forms techniques §5](signal-forms-techniques.md#5--applypath-schema--schema-reuse--defer--revisits-no-composability).
