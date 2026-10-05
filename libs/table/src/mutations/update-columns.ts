import { applyColumnOrder, resolveColumnDefs, toggleColumnVisible } from '../engine/columns';
import type { ColumnDef, ColumnsUpdater, ColumnWrite } from '../api/types';

// No updater below fabricates an id — `setColumns` only emits ids its `defs` were typed against
// `TId`, the others only reorder/flip flags on the elements they're handed — so re-asserting
// the engine's string-keyed result back to `TId` is sound even though the engine helpers can't
// prove it structurally. Same static/dynamic boundary as `create-table.ts`'s trailing
// assertion (ADR-0019).

/** Replaces the full column list; a shorter list drops the columns it omits. Ids are checked
 * against the table's declared ids only where the call has an expected type — inside
 * `table.columns.update(…)`; a standalone `setColumns([...])` accepts any string id. */
export function setColumns<TRow, TId extends string = string>(
  // `NoInfer`: `TId` binds from the call site's expected updater type, never from `defs` — a
  // shorter list would otherwise narrow `TId` and the updater (contravariant in `TId`) would
  // no longer fit the table's.
  defs: readonly ColumnWrite<TRow, NoInfer<TId>>[],
): ColumnsUpdater<TRow, TId> {
  return () => resolveColumnDefs(defs, 'setColumns') as ColumnDef<TRow, TId>[];
}

/** Rewrites column order from an id sequence. Ids absent from the list keep their current order. */
export function reorderColumns<TRow, TId extends string = string>(
  ids: string[],
): ColumnsUpdater<TRow, TId> {
  return (columns) => applyColumnOrder(columns, ids) as ColumnDef<TRow, TId>[];
}

/** Flips one column's `visible` flag by id. Unknown id is a no-op. */
export function toggleColumnVisibility<TRow, TId extends string = string>(
  id: string,
): ColumnsUpdater<TRow, TId> {
  return (columns) => toggleColumnVisible(columns, id) as ColumnDef<TRow, TId>[];
}
