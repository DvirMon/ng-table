import type { BodyCell, NavKey, NavOrder } from './keyboard-nav.types';

/**
 * Next body cell for a navigation key press, from ids only.
 *
 * An edge returns the current position (handled, no wrap); the caller calls
 * `preventDefault()` only on a non-null result.
 *
 * @returns the target cell, or `null` for an unhandled key or a current
 * position that is not in the order.
 */
export function nextBodyTarget(order: NavOrder, current: BodyCell, event: NavKey): BodyCell | null {
  const rowIndex = order.rowIds.indexOf(current.rowId);
  const columnIndex = order.columnIds.indexOf(current.columnId);
  const isCurrentInOrder = rowIndex !== -1 && columnIndex !== -1;
  if (!isCurrentInOrder) return null;

  const lastRow = order.rowIds.length - 1;
  const lastColumn = order.columnIds.length - 1;
  const isCtrl = event.ctrlKey || event.metaKey === true;
  const isArrow = event.key.startsWith('Arrow');
  if (isCtrl && isArrow) return null;

  switch (event.key) {
    case 'ArrowLeft':
      return cellAt(order, rowIndex, Math.max(columnIndex - 1, 0));
    case 'ArrowRight':
      return cellAt(order, rowIndex, Math.min(columnIndex + 1, lastColumn));
    case 'ArrowUp':
      return cellAt(order, Math.max(rowIndex - 1, 0), columnIndex);
    case 'ArrowDown':
      return cellAt(order, Math.min(rowIndex + 1, lastRow), columnIndex);
    case 'Home':
      return isCtrl ? cellAt(order, 0, 0) : cellAt(order, rowIndex, 0);
    case 'End':
      return isCtrl ? cellAt(order, lastRow, lastColumn) : cellAt(order, rowIndex, lastColumn);
    default:
      return null;
  }
}

function cellAt(order: NavOrder, rowIndex: number, columnIndex: number): BodyCell {
  return { rowId: order.rowIds[rowIndex], columnId: order.columnIds[columnIndex] };
}
