import {
  applyColumnOrder,
  resolveColumnDefs,
  toggleColumnVisible,
} from '../engine/columns';
import type { ColumnDef, ColumnsUpdater, ColumnWrite } from '../api/types';

// Every updater below only reorders/flips flags on the elements it's handed — it never
// fabricates an id — so re-asserting the engine's string-keyed result back to `TId` is sound
// even though `applyColumnOrder`/`toggleColumnVisible` can't themselves prove it structurally.
// Same static/dynamic boundary as `create-table.ts`'s trailing assertion (ADR-0019).

/** Replaces the full column list. Accepts `id` plus optional `accessor`/`visible`/`label` per
 * column — `order` and `meta` are not writable here. `id` is checked against the table's
 * declared column ids, so an unknown or mistyped id is a compile error; a shorter list drops
 * the columns it omits. */
// `TWriteId` is inferred from `defs` and constrained to extend `TId`, so a shorter `defs` array
// (a subset of the declared union) doesn't narrow the returned `ColumnsUpdater`'s own `TId` —
// that stays the full union, bound from the call site's expected type.
export function setColumns<TRow, TId extends string = string, TWriteId extends TId = TId>(
  defs: readonly ColumnWrite<TRow, TWriteId>[]
): ColumnsUpdater<TRow, TId> {
  return () => resolveColumnDefs(defs, 'setColumns') as ColumnDef<TRow, TId>[];
}

/** Rewrites column order from an id sequence. Ids absent from the list keep their current order. */
export function reorderColumns<TRow, TId extends string = string>(
  ids: string[]
): ColumnsUpdater<TRow, TId> {
  return (columns) => applyColumnOrder(columns, ids) as ColumnDef<TRow, TId>[];
}

/** Flips one column's `visible` flag by id. Unknown id is a no-op. */
export function toggleColumnVisibility<TRow, TId extends string = string>(
  id: string
): ColumnsUpdater<TRow, TId> {
  return (columns) => toggleColumnVisible(columns, id) as ColumnDef<TRow, TId>[];
}
