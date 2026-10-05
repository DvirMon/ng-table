---
title: Research — how other libraries order groups (not rows within a group)
type: research
status: complete
date: 2026-09-09
audience: developers
issue: null
---

# How other libraries control the order groups render in

Spawned while redesigning `withGrouping()` (spec: [../../features/grouping.md](../../../../features/grouping.md),
`code: none`, not yet implemented). Today's spec only defines **stable clustering** — group order
is first-occurrence order of the grouped column's value in `rows()` — with no way to override it.
A real user scenario needs group order driven by an external explicit list (a category-management
UI's own drag-and-drop order) or by a computed criterion (row-count-per-group, descending). This is
additive to the existing "Grouping & aggregation" comparison in
[../state-feature-competitive-audit/audit.md](../../../meta/archive/state-feature-competitive-audit/audit.md), which
covers aggregation functions and correctness but not group _order_.

Every claim below was read from published package sources (versions pinned per row), not from
memory. Tarballs pulled with `npm pack` and read from `dist`/`src`, same method as
[../with-selection/research-row-selectability.md](../../../selection/archive/with-selection/research-row-selectability.md).

## Findings

| Library              | Version read                                                                                                                                                                                                                                                                                                                       | Where it lives                                                                                                                                                                                                                                                                                    | Shape                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TanStack Table v8    | `@tanstack/table-core@8.21.3` (`src/utils/getGroupedRowModel.ts`, `src/utils/getSortedRowModel.ts`)                                                                                                                                                                                                                                | **No dedicated group-order API.** Default order = `Map` insertion order (first-occurrence). The only override is the existing `sorting` state, applied **recursively** to both the top-level (group) rows and each group's `subRows`, via the same `sortingFn`                                    | reuse of `SortingState`, not a grouping concept                                                                                                              |
| TanStack Table v9    | `@tanstack/table-core@9.2.4` (`dist/features/column-grouping/createGroupedRowModel.js`, `dist/core/row-models/coreRowModelsFeature.utils.js`)                                                                                                                                                                                      | Same — own doc comment states it outright: _"Sorting runs after grouping, so this aliases `table.getGroupedRowModel()`."_ Grouping split into its own `column-grouping` feature (separate from a new `row-aggregation` feature) but order behavior unchanged                                      | same                                                                                                                                                         |
| Material React Table | `material-react-table@3.2.1` (`dist/index.d.ts`)                                                                                                                                                                                                                                                                                   | Imports `GroupingState`/`SortingState` directly from `@tanstack/react-table` — no `MRT_*` grouping-order type exists in its export list                                                                                                                                                           | none; inherits TanStack unchanged                                                                                                                            |
| AG Grid              | `ag-grid-community@36.1.0` (`dist/types/src/entities/gridOptions.d.ts:2076`, `:1254`; `dist/types/src/interfaces/iCallbackParams.d.ts:287`) — **row grouping is Enterprise-only** (`RowGroupingModule`; confirmed zero references to that module in the actual Community runtime bundle, only in the shared `.d.ts` types package) | Dedicated config: `initialGroupOrderComparator?: (params: {nodeA, nodeB}) => number` sets default group order. Separate `groupMaintainOrder: boolean` (`@default false`) decouples "user clicked sort on a data column" from "groups get reordered"                                               | comparator over **full `IRowNode` pairs** (`nodeA.allLeafChildren`, `.childrenAfterGroup` — count-based ordering is directly expressible) + one boolean flag |
| PrimeNG `p-table`    | `primeng@22.1.1` (`fesm2022/primeng-table.mjs:1448`, `:2033-2035`; `types/primeng-table.d.ts:792,812`)                                                                                                                                                                                                                             | `groupRowsBy: string` + `groupRowsByOrder: number` (default `1`). Row grouping is implemented by **sorting the whole dataset** by `groupRowsBy`/`groupRowsByOrder` through the same single-sort code path, then rendering contiguous runs as a group header/rowspan — not a separate stage at all | plain asc/desc int, no comparator, no group-specific hook                                                                                                    |

## Reading

### 1. Three of four libraries have no group-order concept — they reuse column sort, or _are_ column sort

TanStack and MRT apply the existing `sorting` state recursively to group rows and their `subRows`
alike:

```js
// tanstack v8 src/utils/getSortedRowModel.ts
return {
  rows: sortData(rowModel.rows),   // top-level = group rows when grouped
  ...
}
// inside sortData(): sortedData.forEach(row => { if (row.subRows?.length) row.subRows = sortData(row.subRows) })
```

PrimeNG goes further and doesn't distinguish "group order" from "sort order" as concepts at all —
`groupRowsBy`/`groupRowsByOrder` are fed straight into the same field/order the regular
single-column sort uses (`fesm2022/primeng-table.mjs:2033-2035`):

```js
let field = this.sortField || this.groupRowsBy();
let order = this.sortField ? this.sortOrder : this.groupRowsByOrder();
```

Only AG Grid treats "which group renders first" as its own configurable concept, independent of
column sort — and it's the one library here whose row-grouping is Enterprise-gated.

### 2. AG Grid's `groupMaintainOrder` is direct precedent for keeping group order and sort separate

```
// gridOptions.d.ts:1238-1251
When `true`, sorting on non-group columns does not reorder groups; only the rows within
each group are sorted. Group order remains the structural order set at grouping time
(data-insertion order, or `initialGroupOrderComparator` if configured) and is preserved
across filter changes and transactions. ...
With multi-level row grouping, the order is maintained per level: a sort on a group
column at one level only re-orders that level's groups; sibling levels keep their
structural order.
```

This is the answer to research question 4 (does any library separate group order from
within-group row order): yes, but only as an **opt-in flag** (`@default false`) — AG Grid's
un-flagged default still lets a column sort reorder groups, same entanglement TanStack has
unconditionally.

### 3. The "AG Grid defaults to alphabetical" anecdote does not match this version's source

AG Grid's own doc string for `groupMaintainOrder` states the _unflagged_ default is **data-insertion
order, or `initialGroupOrderComparator` if configured** — not alphabetical. No alphabetical default
was found anywhere in the grouping-related `.d.ts` surface. The library whose behavior actually _is_
"sort the data by the group field" (which reads as alphabetical for a string category field with no
explicit order) is **PrimeNG**, via `groupRowsBy`/`groupRowsByOrder`. Flagging this as a likely
source mix-up rather than asserting AG Grid changed — not verified against older AG Grid versions.

### 4. Count-based group ordering has real precedent, but needs row/child access the group _key_ alone doesn't carry

AG Grid's comparator receives full `IRowNode` objects, not bare group values:

```ts
// iCallbackParams.d.ts:287-291
export type InitialGroupOrderComparator<TData = any, TContext = any> = (
  params: InitialGroupOrderComparatorParams<TData, TContext>,
) => number;
export interface InitialGroupOrderComparatorParams<TData = any, TContext = any>
  extends AgGridCommon<TData, TContext> {
  nodeA: IRowNode<TData>;
  nodeB: IRowNode<TData>;
}
```

`IRowNode` exposes `allLeafChildren: IRowNode[] | null` and `childrenAfterGroup: IRowNode[] | null`
(`iRowNode.d.ts:200,204`) — `nodeA.allLeafChildren.length - nodeB.allLeafChildren.length` is a
real, directly-expressible count comparator. No other library offers this at all (TanStack/MRT only
offer it indirectly, by sorting on an aggregate _column's_ value per finding 1).

### 5. External-explicit-list ordering has no dedicated construct anywhere — always "supply your own comparator"

None of the four libraries ship a config that takes an ordered id/value list directly. Every
"order groups by this external list" case is the consumer closing over their own array inside
whichever comparator/sort hook exists (AG Grid's `initialGroupOrderComparator`, or a TanStack
`sortingFn` on the grouped column). No new construct to borrow here beyond "a comparator is the
right shape."

## Bearing on `withGrouping()`

- **Real precedent for a comparator-shaped group-order hook exists, but in only one of four
  libraries, and it's Enterprise-gated there.** Three of four ship nothing dedicated. Building
  `compareGroups` puts us ahead of TanStack/MRT/PrimeNG's free tiers and matches AG Grid's paid
  tier — a legitimate differentiator, not an obvious/required feature to copy.
- **Our sketched shape is under-powered relative to the only working precedent.** `compareGroups?:
(a: GroupKey, b: GroupKey) => number` with `GroupKey = { columnId, value }` cannot express the
  count-based case the user actually asked for — there's no row count on a bare key. AG Grid's
  comparator works because it receives full nodes with child access. Our comparator needs the same:
  either the cluster's rows, or its already-computed `aggregates` (from `aggregateFn`), not just the
  key. This needs its own decision — pass rows (duplicates what `aggregateFn` already saw) vs. pass
  computed aggregates (couples comparator timing to aggregation having run first).
- **Our fixed pipeline may already have AG Grid's `groupMaintainOrder: true` behavior baked in,
  for free.** `grouping.md` already specifies `sort` running after `group` and reordering only
  _within_ each cluster (clustering stays contiguous because sort is stable) — that's the
  non-default, opt-in AG Grid behavior, as our only behavior. Unlike TanStack/PrimeNG, a column sort
  in our pipeline was never going to reorder groups in the first place. Worth stating explicitly in
  the spec as a deliberate consequence of the fixed `filter → group → sort → expand` order, not an
  accident — no separate flag needed to get it.
- **The external-list use case (category dialog's drag-drop order) has no ready-made construct to
  copy from anywhere** — confirms a plain comparator closing over the consumer's own array is the
  right shape, not a novel gap we're failing to find prior art for.

## Open questions

- Does `compareGroups` receive the cluster's `TRow[]`, its computed `aggregates`, or both? Affects
  whether `compareGroups` can run before or only after `aggregateFn`.
- Is `compareGroups` per-column (like `sortFn`/`aggregateFn`) or a single `withGrouping()`-level
  config? Single-level grouping (one active `grouping` column at a time, per existing spec) means
  only one comparator is ever active regardless — a per-column field still lets each groupable
  column carry its own default, consistent with how `sortFn`/`aggregateFn` are already scoped.
- Should the spec state the "sort only reorders within clusters, never across them" behavior as an
  explicit decision (with rationale) rather than an implicit consequence of stage ordering, so a
  future reader doesn't mistake it for an oversight the way AG Grid needed a flag to fix?

## Not researched

- Whether AG Grid Community ships any lesser grouping-adjacent feature (e.g. row spanning without
  full `RowGroupingModule`) that might carry its own order behavior.
- PrimeNG's `customSort`/`sortFunction` escape hatch as an indirect way to fake independent group
  ordering — not traced through.
- AG Grid's multi-level per-level order semantics beyond the single doc quote in finding 2 — not
  relevant while grouping stays single-level (existing decision), kept here only as forward context.
- Older AG Grid versions' default group-order behavior, to chase down the alphabetical anecdote's
  actual origin.
