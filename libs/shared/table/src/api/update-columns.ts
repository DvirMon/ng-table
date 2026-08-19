import type { WritableSignal } from '@angular/core';
import {
  applyColumnOrder,
  resolveColumnDefs,
  toggleColumnVisible,
} from '../engine/columns';
import type {
  ColumnDef,
  ColumnDefInput,
  ColumnsUpdater,
  TableStore,
} from './types';

/**
 * The one general write: applies `updater` to the store's writable `baseColumns` signal.
 * `columns` is a derived overlay (`foldColumnRules`) — writes always target the base, never
 * the derivation.
 *
 * Two overloads: a public `TableStore<TRow>` (its `columns` is a readonly `Signal` —
 * consumers never write it directly) and the minimal structural shape engine-internal
 * callers already hold a genuine `WritableSignal` through. Both branches close over the same
 * runtime object; the cast below just recovers the write capability `TableStore`'s public
 * type intentionally hides.
 */
export function updateColumns<TRow>(
  table: TableStore<TRow>,
  updater: ColumnsUpdater<TRow>
): void;
export function updateColumns<TRow>(
  table: { baseColumns: WritableSignal<ColumnDef<TRow>[]> },
  updater: ColumnsUpdater<TRow>
): void;
export function updateColumns<TRow>(
  table:
    | TableStore<TRow>
    | { baseColumns: WritableSignal<ColumnDef<TRow>[]> },
  updater: ColumnsUpdater<TRow>
): void {
  (
    table as { baseColumns: WritableSignal<ColumnDef<TRow>[]> }
  ).baseColumns.update(updater);
}

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
