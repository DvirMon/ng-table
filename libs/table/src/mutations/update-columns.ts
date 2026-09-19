import {
  applyColumnOrder,
  resolveColumnDefs,
  toggleColumnVisible,
} from '../engine/columns';
import type { ColumnDef, ColumnDefInput, ColumnsUpdater } from '../api/types';

// Every updater below only reorders/flips flags on the elements it's handed — it never
// fabricates an id — so re-asserting the engine's string-keyed result back to `TId` is sound
// even though `applyColumnOrder`/`toggleColumnVisible` can't themselves prove it structurally.
// Same static/dynamic boundary as `create-table.ts`'s trailing assertion (ADR-0019).

/** Replaces the full column list, resolving sparse `ColumnDefInput`s to full `ColumnDef`s. */
export function setColumns<TRow, TId extends string = string>(
  defs: ColumnDefInput<TRow, TId>[]
): ColumnsUpdater<TRow, TId> {
  return () => resolveColumnDefs(defs) as ColumnDef<TRow, TId>[];
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
