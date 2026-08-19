import {
  applyColumnOrder,
  resolveColumnDefs,
  toggleColumnVisible,
} from '../engine/columns';
import type { ColumnDefInput, ColumnsUpdater } from './types';

/** Replaces the full column list, resolving sparse `ColumnDefInput`s to full `ColumnDef`s. */
export function setColumns<TRow>(
  defs: ColumnDefInput<TRow>[]
): ColumnsUpdater<TRow> {
  return () => resolveColumnDefs(defs);
}

/** Rewrites column order from an id sequence. Ids absent from the list keep their current order. */
export function reorderColumns<TRow>(ids: string[]): ColumnsUpdater<TRow> {
  return (columns) => applyColumnOrder(columns, ids);
}

/** Flips one column's `visible` flag by id. Unknown id is a no-op. */
export function toggleColumnVisibility<TRow>(id: string): ColumnsUpdater<TRow> {
  return (columns) => toggleColumnVisible(columns, id);
}
