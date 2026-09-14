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
*state* (active sort direction, active filter value) stays store-owned. Ship last. Read
[Ownership model](ownership-model.md) first — as of 2026-07-25, this tier splits along the same
line as Tier 1/2: functions duplicating an existing `ColumnDef` field (`sortFn`, `enableSorting`,
`filterFn`, `enableFiltering`, `aggregateFn`) are **reactive/async only**, static goes on the array
literal instead; functions with no `ColumnDef` equivalent (`applyDefaultSort`, `applyGroup` — the
seeded state lives entirely in `withSorting()`/`withGrouping()`, not on the column) **keep their
static seed input**, same as `applyPinned` in Tier 2.

> **Dead without the feature.** `applySortFn(path, {when})` does nothing unless `withSorting()` is
> composed as a positional argument to `createTable()`. Whether that mismatch is a compile error or a silent no-op is an open decision below.

## Sorting — feeds [`withSorting()`](../../1-state/features/sorting.md)

```ts
applyEnableSorting<TRow, K>(path, enabled: { when: (ctx) => boolean }): void;   // reactive only — static: array `enableSorting` field
applySortFn<TRow, K>(path, sortFn: { when: (ctx) => (a: TRow, b: TRow) => number }): void;   // reactive only — static: array `sortFn` field
applyDefaultSort<TRow, K>(path, sort: { direction: 'asc' | 'desc'; index?: number }): void;   // seed — no ColumnDef equivalent, static stays
```

- `applyDefaultSort` seeds `withSorting()`'s initial sort state (multi-column order via `index`) —
  there's no array field for "default sort direction," so this keeps its static form.
- **AG-Grid analog:** `sort` / `sortType` / `sortIndex`; `sortSvc.updateColSort`.

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
  when the signal changes, same wiring pattern as `applySortFn`/`applyFilterFn`, just targeting
  feature state instead of a `ColumnDef` field. Consumer flips a signal; no direct store-method call
  needed from the UI layer. Static form still supported for construction-time defaults.
  `applyAggregateFn` duplicates the existing `ColumnDef.aggregateFn` field, so it narrows to
  reactive-only like the sorting/filtering functions above.
- **AG-Grid analog:** `rowGroup` / `rowGroupIndex` + `aggFunc`.

## Summary

| Function | Static? | Seeds / duplicates | AG-Grid analog |
|---|---|---|---|
| `applyEnableSorting` / `applySortFn` / `applyAggregateFn` | ❌ reactive/async only | duplicates `ColumnDef` field — array literal for static | `sortType`, `aggFunc` |
| `applyDefaultSort` | ✅ seed keeps static | no `ColumnDef` field — seeds `withSorting()` state | `sort` / `sortIndex` |
| `applyEnableFiltering` / `applyFilterFn` | ❌ reactive/async only | duplicates `ColumnDef` field — array literal for static | `filter` + filter model |
| `applyGroup` | ✅ static seed + reactive `{when}` | no `ColumnDef` field — seeds/toggles `withGrouping()` state | `rowGroup` / `rowGroupIndex` |

> Pivot-only AG-Grid fields (`pivot`, `pivotIndex`, `pivotSort`, `showValuesAs`, `valueIndex`)
> excluded — no pivot feature in this table.

## Open questions (Tier 3)

- [x] **Feature-absent handling** — RESOLVED 2026-07-31: compile error. `applyGroup` on a column
  rejects at type-check time when `withGrouping()` is not composed — matching how the store now
  expresses a dependency, as an F-bounded `Feature<In, Out>` input slice typed by argument order
  (#67), not the removed ngrx `type<>` marker. Requires threading feature presence into the `columnsSchema` /
  `columnSchema()` generic. Same resolution should apply to the analogous case in
  [`1-state/architecture.md`](../../1-state/architecture.md).
- [x] **Reusable archetypes** — RESOLVED 2026-07-31: deferred. No confirmed repeated-bundle use
  case yet; ship Tier 1-3 `apply*` functions first, revisit `apply(path, schema)` composability
  (a `moneyColumn`-style archetype) once a real case surfaces. See
  [Signal Forms techniques §5](signal-forms-techniques.md#5--applypath-schema--schema-reuse--defer--revisits-no-composability).
