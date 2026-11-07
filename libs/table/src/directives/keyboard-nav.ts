import type {
  BodyCell,
  GridBodyCell,
  GridCell,
  GridNavOptions,
  HeaderCell,
  NavKey,
  NavOrder,
  RowTarget,
  TreegridNavOrder,
  TreegridTarget,
} from './keyboard-nav.types';

/**
 * Returns the body cell a navigation key press moves to, computed from ids only.
 *
 * @remarks
 * At an edge it returns the current cell (handled, no wrap), so the caller should call
 * `preventDefault()` only on a non-null result. Returns `null` for an unhandled key or a
 * current cell that is not in the order.
 */
export function nextBodyTarget(order: NavOrder, current: BodyCell, event: NavKey): BodyCell | null {
  const rowIndex = order.rowIds.indexOf(current.rowId);
  const columnIndex = order.columnIds.indexOf(current.columnId);
  const isCurrentInOrder = rowIndex !== -1 && columnIndex !== -1;
  if (!isCurrentInOrder) return null;

  // Alt/Shift combinations belong to the browser and assistive tech, so they are not handled.
  const hasUnhandledModifier = event.altKey === true || event.shiftKey === true;
  if (hasUnhandledModifier) return null;

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

/**
 * Returns the grid cell a navigation key press moves to, reaching the header row, paging by
 * rows and swapping left/right under RTL.
 *
 * @remarks
 * At an edge it returns the current cell (handled, no wrap), so the caller should call
 * `preventDefault()` only on a non-null result. Returns `null` for an unhandled key, a
 * Ctrl/Cmd + Arrow, an Alt/Shift combination, or a current cell not in the order.
 */
export function nextGridTarget(
  order: NavOrder,
  current: GridCell,
  event: NavKey,
  options: GridNavOptions,
): GridCell | null {
  const hasUnhandledModifier = event.altKey === true || event.shiftKey === true;
  if (hasUnhandledModifier) return null;

  const isCtrl = event.ctrlKey || event.metaKey === true;
  if (isCtrl && event.key.startsWith('Arrow')) return null;

  const key = options.isRtl ? swapHorizontal(event.key) : event.key;
  return current.area === 'header'
    ? nextFromHeader(order, current, key, isCtrl)
    : nextFromBody(order, current, withKey(event, key), isCtrl, options.pageSize);
}

// Note: copies the fields by name; spreading a real `KeyboardEvent` loses its prototype getters.
function withKey(event: NavKey, key: string): NavKey {
  return {
    key,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
  };
}

function nextFromHeader(
  order: NavOrder,
  current: HeaderCell,
  key: string,
  isCtrl: boolean,
): GridCell | null {
  const columnIndex = order.columnIds.indexOf(current.columnId);
  if (columnIndex === -1) return null;

  const lastColumn = order.columnIds.length - 1;
  const lastRow = order.rowIds.length - 1;
  const hasRows = lastRow >= 0;

  switch (key) {
    case 'ArrowLeft':
      return headerAt(order, Math.max(columnIndex - 1, 0));
    case 'ArrowRight':
      return headerAt(order, Math.min(columnIndex + 1, lastColumn));
    case 'ArrowDown':
      return hasRows ? { area: 'body', ...cellAt(order, 0, columnIndex) } : current;
    case 'ArrowUp':
    case 'PageUp':
    case 'PageDown':
      return current;
    case 'Home':
      return headerAt(order, 0);
    case 'End':
      if (isCtrl && hasRows) return { area: 'body', ...cellAt(order, lastRow, lastColumn) };
      return headerAt(order, lastColumn);
    default:
      return null;
  }
}

function nextFromBody(
  order: NavOrder,
  current: GridBodyCell,
  event: NavKey,
  isCtrl: boolean,
  pageSize: number,
): GridCell | null {
  const rowIndex = order.rowIds.indexOf(current.rowId);
  const columnIndex = order.columnIds.indexOf(current.columnId);
  const isCurrentInOrder = rowIndex !== -1 && columnIndex !== -1;
  if (!isCurrentInOrder) return null;

  const lastRow = order.rowIds.length - 1;
  const isFirstRow = rowIndex === 0;

  if (event.key === 'ArrowUp' && isFirstRow) return headerAt(order, columnIndex);
  if (event.key === 'Home' && isCtrl) return headerAt(order, 0);
  if (event.key === 'PageUp') {
    return { area: 'body', ...cellAt(order, Math.max(rowIndex - pageSize, 0), columnIndex) };
  }
  if (event.key === 'PageDown') {
    return { area: 'body', ...cellAt(order, Math.min(rowIndex + pageSize, lastRow), columnIndex) };
  }

  const target = nextBodyTarget(order, { rowId: current.rowId, columnId: current.columnId }, event);
  return target === null ? null : { area: 'body', ...target };
}

function swapHorizontal(key: string): string {
  if (key === 'ArrowLeft') return 'ArrowRight';
  if (key === 'ArrowRight') return 'ArrowLeft';
  return key;
}

function headerAt(order: NavOrder, columnIndex: number): HeaderCell {
  return { area: 'header', columnId: order.columnIds[columnIndex] };
}

function cellAt(order: NavOrder, rowIndex: number, columnIndex: number): BodyCell {
  return { rowId: order.rowIds[rowIndex], columnId: order.columnIds[columnIndex] };
}

/**
 * Returns the treegrid target a navigation key press moves to, adding row focus to the grid map.
 *
 * @remarks
 * A row is a focus target: up, down, Home, End and paging move between rows, right enters the
 * first cell and left goes to the parent row. Cell keys behave as in grid, except left on a
 * first cell returns to its row. At an edge it returns the current target. Returns `null` for
 * an unhandled key, a Ctrl/Cmd + Arrow, an Alt/Shift combination, or a target not in the order.
 */
export function nextTreegridTarget(
  order: TreegridNavOrder,
  current: TreegridTarget,
  event: NavKey,
  options: GridNavOptions,
): TreegridTarget | null {
  const hasUnhandledModifier = event.altKey === true || event.shiftKey === true;
  if (hasUnhandledModifier) return null;

  const isCtrl = event.ctrlKey || event.metaKey === true;
  if (isCtrl && event.key.startsWith('Arrow')) return null;

  const key = options.isRtl ? swapHorizontal(event.key) : event.key;
  // Note: the key is already swapped for RTL, so the grid map must not swap it again.
  const gridOptions: GridNavOptions = { isRtl: false, pageSize: options.pageSize };

  if (current.area === 'header') {
    const isHeaderKnown = order.columnIds.includes(current.columnId);
    const hasRows = order.rowIds.length > 0;
    if (key === 'ArrowDown' && isHeaderKnown && hasRows) return rowAt(order, 0);
    return nextGridTarget(order, current, withKey(event, key), gridOptions);
  }

  if (current.columnId === null) return nextFromRow(order, current, key, options.pageSize);

  const rowIndex = order.rowIds.indexOf(current.rowId);
  const isFirstColumn = order.columnIds[0] === current.columnId;
  if (key === 'ArrowLeft' && isFirstColumn && rowIndex !== -1) return rowAt(order, rowIndex);
  return nextGridTarget(order, current, withKey(event, key), gridOptions);
}

function nextFromRow(
  order: TreegridNavOrder,
  current: RowTarget,
  key: string,
  pageSize: number,
): TreegridTarget | null {
  const rowIndex = order.rowIds.indexOf(current.rowId);
  if (rowIndex === -1) return null;

  const lastRow = order.rowIds.length - 1;
  const hasColumns = order.columnIds.length > 0;
  switch (key) {
    case 'ArrowUp':
      if (rowIndex > 0) return rowAt(order, rowIndex - 1);
      return hasColumns ? headerAt(order, 0) : current;
    case 'ArrowDown':
      return rowAt(order, Math.min(rowIndex + 1, lastRow));
    case 'Home':
      return rowAt(order, 0);
    case 'End':
      return rowAt(order, lastRow);
    case 'PageUp':
      return rowAt(order, Math.max(rowIndex - pageSize, 0));
    case 'PageDown':
      return rowAt(order, Math.min(rowIndex + pageSize, lastRow));
    case 'ArrowRight':
      return hasColumns ? { area: 'body', ...cellAt(order, rowIndex, 0) } : current;
    case 'ArrowLeft':
      return rowAt(order, parentIndexOf(order, rowIndex));
    default:
      return null;
  }
}

// The parent is the nearest earlier row with a smaller depth; a top-level row has none and stays.
function parentIndexOf(order: TreegridNavOrder, rowIndex: number): number {
  const depth = order.rowDepths[rowIndex];
  for (let index = rowIndex - 1; index >= 0; index--) {
    if (order.rowDepths[index] < depth) return index;
  }
  return rowIndex;
}

function rowAt(order: NavOrder, rowIndex: number): RowTarget {
  return { area: 'body', rowId: order.rowIds[rowIndex], columnId: null };
}
