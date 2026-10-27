import type { FocusTarget, RenderRow, RowId } from '../api/types';

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

/** What `recoverFocus` needs to know about one moment of the table. */
export interface FocusSnapshot {
  readonly rows: readonly RenderRow<unknown>[];
  readonly columnIds: readonly string[];
}

/** The newer snapshot also carries the `rows()` id set, which collapse recovery reads. */
export interface NextFocusSnapshot extends FocusSnapshot {
  readonly rowIds: ReadonlySet<RowId>;
}

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length - 1);
}

// Keeps the id when still present; otherwise takes whatever now sits at its old index, clamped.
function recoverId<TId>(id: TId, previous: readonly TId[], next: readonly TId[]): TId | undefined {
  if (next.includes(id)) {
    return id;
  }
  return next[clampIndex(previous.indexOf(id), next.length)];
}

/**
 * Repairs a focus target after rows or columns changed.
 *
 * @remarks
 * Row half (body and panel): the row follows its id; a vanished row yields the row now at its
 * old index in `prev`, clamped. No rows left falls back to the first header cell. Column half
 * runs independently the same way. Returns `null` when nothing valid remains. Never throws.
 */
export function recoverFocus(
  current: FocusTarget | null,
  prev: FocusSnapshot,
  next: NextFocusSnapshot,
): FocusTarget | null {
  if (current === null) {
    return null;
  }
  const recovered = recoverTarget(current, prev, next);
  if (recovered === null) {
    return null;
  }
  const unrendered = findUnrenderedId(
    recovered,
    new Set(next.rows.map((row) => row.id)),
    new Set(next.columnIds),
  );
  return unrendered === undefined ? recovered : null;
}

function recoverTarget(
  current: FocusTarget,
  prev: FocusSnapshot,
  next: NextFocusSnapshot,
): FocusTarget | null {
  if (current.area === 'header') {
    const columnId = recoverId(current.columnId, prev.columnIds, next.columnIds);
    return columnId === undefined ? null : { area: 'header', columnId };
  }

  if (next.rows.length === 0) {
    const firstColumnId = next.columnIds[0];
    return firstColumnId === undefined ? null : { area: 'header', columnId: firstColumnId };
  }

  const rowId = recoverId(
    current.rowId,
    prev.rows.map((row) => row.id),
    next.rows.map((row) => row.id),
  );
  if (rowId === undefined) {
    return null;
  }
  if (current.area === 'panel') {
    return { area: 'panel', rowId };
  }
  if (current.columnId === null) {
    return { area: 'body', rowId, columnId: null };
  }
  const columnId = recoverId(current.columnId, prev.columnIds, next.columnIds);
  return columnId === undefined ? null : { area: 'body', rowId, columnId };
}
