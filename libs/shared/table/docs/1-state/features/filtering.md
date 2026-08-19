---
title: State Layer Reference — withFiltering()
type: architecture
version: 1.0
date: 2026-07-19
status: drafted
audience: developers
parent: ../1-state/architecture.md
---

# withFiltering()

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
- **Global filter match logic:** default behavior is a string-contains match against every column's `accessor(row)` value, across all columns. No custom `globalFilterFn` override was specified — default-only.
- **Combining logic:** when multiple per-column filters are active at once, a row must pass **all** of them (AND). The global filter is applied as an additional condition alongside column filters (also AND'd — a row must satisfy every active column filter AND match the global filter).
- **Per-column opt-out:** `enableFiltering: boolean` (default `true`) on the column def — `filterFn`/global matching skip a column when `enableFiltering: false`.

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

None as a separate feature. Reads `filterFn` / `enableFiltering` from the core `columns` config directly (see `columns.md`) — no feature dependency to declare.

## Events Owned

- `filterChanged` — fires on any column filter or global filter change.

## Open Questions

- [ ] Exact interaction with `withGrouping()`'s aggregation: does `aggregateFn` run over filtered rows within a group, or all rows regardless of active filters? (Flagged here and in `with-grouping.md` — needs one shared answer.)
- [ ] Global filter is string-contains only by default — no fuzzy matching, case-sensitivity option, or debounce behavior specified yet. Likely fine for v1 but worth confirming before implementation.
