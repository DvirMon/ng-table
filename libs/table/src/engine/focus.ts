import type { FocusTarget, RowId } from '../api/types';

/** Pure `focus` helpers. No signals, no Angular. */

/**
 * Finds the first id in a focus target that is not currently rendered.
 *
 * @remarks
 * Note: the caller passes the `renderRows()` / `renderColumns()` ids, not `rows()`,
 * `indexById` or `columns()` — a row dropped from render or a hidden column is unrendered.
 * Body and panel targets check their row; header targets and body targets with a
 * non-null `columnId` check their column. Row is checked before column.
 */
export function findUnrenderedId(
  target: FocusTarget,
  renderedRowIds: ReadonlySet<RowId>,
  renderedColumnIds: ReadonlySet<string>,
): string | undefined {
  if (target.area !== 'header' && !renderedRowIds.has(target.rowId)) {
    return String(target.rowId);
  }
  if (target.area === 'panel') {
    return undefined;
  }
  const columnId = target.columnId;
  if (columnId !== null && !renderedColumnIds.has(columnId)) {
    return columnId;
  }
  return undefined;
}
