---
title: State Layer Reference — withFiltering()
type: architecture
version: 1.1
date: 2026-09-09
capability: filtering
spec: drafted
code: partial
audience: developers
parent: ../architecture.md
---

# withFiltering()

> **⚠️ Superseded design — do not implement from this file as-is (2026-09-09).**
> Everything below describes an imperative, store-owned API (`setColumnFilter()` /
> `setGlobalFilter()`). That design was walked back during the grill; the direction is now a
> standalone `createFilters()` primitive. See
> [work/with-filtering/design-options-hybrid-api.md](../work/with-filtering/design-options-hybrid-api.md)
> (Option E) and [work/with-filtering/research-filter-state-ownership.md](../work/with-filtering/research-filter-state-ownership.md).
>
> **Only D2 survives.** An earlier version of this banner claimed D1–D3 all still held
> behaviorally; that was wrong. D1 (case-insensitive global match) and D3 (auto-detected default
> predicate) describe the auto-scanning global filter and the missing-`filterFn` fallback — both
> removed by the redesign, which lists search paths and predicates explicitly and requires every
> filter to name its predicate. D2 (no built-in debounce) stands. See R12 and R25 in the design
> doc.
>
> `src/api/features/with-filtering.ts` + its spec exist on disk implementing this superseded
> shape. Whether to keep, rewrite, or delete them is an open decision.

## Executive Summary

Supports both per-column filters and a single global/quick-search filter. Per-column matching uses a custom predicate function; global search defaults to string-contains across all column accessors. Multiple active filters combine with AND logic.

## State Shape

```ts
interface FilterRule {
  columnId: string;
  value: unknown;
}

interface FilteringState {
  columnFilters: FilterRule[];
  globalFilter: string;
}
```

## Behavior

- **Both per-column and global filtering are supported** simultaneously.
- **Per-column match logic:** custom predicate per column — `filterFn(value, filterValue) => boolean`, TanStack-style, consistent with `sortFn`/`aggregateFn`.
- **Global filter match logic:** default behavior is a case-insensitive string-contains match against every column's `accessor(row)` value, across all columns (D1). No custom `globalFilterFn` override was specified — default-only, not configurable.
- **Debounce:** `withFiltering()` owns no debounce (D2). `setColumnFilter`/`setGlobalFilter` apply immediately on every call, consistent with other `with-*()` setters. Consumers debounce their own input handler (e.g. a search box) before calling the setter.
- **Combining logic:** when multiple per-column filters are active at once, a row must pass **all** of them (AND). The global filter is applied as an additional condition alongside column filters (also AND'd — a row must satisfy every active column filter AND match the global filter).
- **Per-column opt-out:** `enableFiltering: boolean` (default `true`) on the column def — `filterFn`/global matching skip a column when `enableFiltering: false`.
- **Default column filter (no `filterFn`, D3):** when a column has an active column filter but no `filterFn`, fall back to an auto-detected default — case-insensitive string-contains when `accessor(row)` yields a string, strict equality (`===`) otherwise. Mirrors `withSorting()`'s `detectComparator` auto-detect pattern.

## Methods

| Method | Description |
|---|---|
| `setColumnFilter(columnId: string, value: unknown)` | Set or update a single column's filter value |
| `clearColumnFilter(columnId: string)` | Remove one column's active filter |
| `setGlobalFilter(query: string)` | Set the global/quick-search query |
| `clearFilters()` | Clear all column filters and the global filter |

## `manual` Contract

```ts
withFiltering({ manual: true })
```

- State (`columnFilters`, `globalFilter`) updates normally on every call.
- Pipeline **skips the client-side filter stage** entirely (both column and global).
- `filterChanged` event fires; consumer's own `effect()` fetches filtered data from the server and writes it into their own `data` signal.
- Consistent with the `manual` contract used by `withSorting()` / `withGrouping()` / `withExpansion()`.

## Compile-Time Dependencies

None as a separate feature. Reads `filterFn` / `enableFiltering` from the core `columns` config directly (see [../columns.md](../columns.md)) — no feature dependency to declare.

## Events Owned

- `filterChanged` — fires on any column filter or global filter change.

## Decisions

- **D1 (2026-09-09):** Global filter match is case-insensitive, not configurable per table.
- **D2 (2026-09-09):** No built-in debounce. Immediate-apply setters; debounce is a consumer concern.
- **D3 (2026-09-09):** Missing `filterFn` on an actively-filtered column falls back to an auto-detected default (string-contains / equality), not a no-op and not a throw.

## Resolved Questions

- [x] ~~Exact interaction with `withGrouping()`'s aggregation~~ — resolved 2026-07-31 (see `architecture.md`, Compile-Time Dependency Graph section): `aggregateFn` runs over filtered rows. The `group` pipeline stage clusters after `filter` (fixed order `filter → group → sort → expand`), so `aggregateFn` never sees unfiltered rows. This spec predates that resolution; backported here.
- [x] ~~Global filter case-sensitivity / debounce~~ — resolved 2026-09-09, see D1/D2 above.

## Competitive position

**Verdict: still missing** — code exists on disk (`api/features/with-filtering.ts`) but
implements the superseded imperative shape flagged in the banner above, so the baseline gap is
not closed.

Assessed 2026-09-05 against TanStack Table v8, AG Grid, Material React Table, and PrimeNG —
column + global filtering is baseline in all four competitors' free tier. Full reasoning:
[gap-analysis.md](../work/state-feature-competitive-audit/gap-analysis.md).
