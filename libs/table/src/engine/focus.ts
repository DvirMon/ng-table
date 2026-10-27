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

/** The rendered rows and column ids at one moment, as `recoverFocus` compares them. */
export interface FocusSnapshot {
  readonly rows: readonly RenderRow<unknown>[];
  readonly columnIds: readonly string[];
}

/** The newer snapshot, which also carries the `rows()` id set that collapse recovery reads. */
export interface NextFocusSnapshot extends FocusSnapshot {
  readonly rowIds: ReadonlySet<RowId>;
}

/** What the closed-panel rule needs: which rows have an open panel, and whether the table is a treegrid. */
export interface PanelRecoveryContext {
  /** `undefined` when `withExpansion()` is not composed; panel targets are then left alone. */
  readonly openPanelRowIds: ReadonlySet<RowId> | undefined;
  readonly isTreegrid: boolean;
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

// Returns the nearest rendered ancestor of a row that a collapse hid, or `undefined` when the
// row was not hidden by a collapse (deleted, filtered, regrouped, or still rendered).
// Note: a data row counts as hidden when its id is still in `next.rowIds` but not rendered.
// A group header is never in `rows()`, so it counts only when its nearest rendered ancestor in
// `prev` now has `isExpanded === false`. The walk's depth bound is strict `<` and tightens to
// each skipped (unrendered) ancestor's depth.
function findCollapseAncestorId(
  rowId: RowId,
  prev: FocusSnapshot,
  next: NextFocusSnapshot,
): RowId | undefined {
  const nextById = new Map(next.rows.map((row) => [row.id, row]));
  const oldIndex = prev.rows.findIndex((row) => row.id === rowId);
  const oldRow = prev.rows[oldIndex];
  if (oldRow === undefined || nextById.has(rowId)) {
    return undefined;
  }

  let depthBound = oldRow.depth;
  for (let i = oldIndex - 1; i >= 0; i--) {
    const candidate = prev.rows[i];
    if (candidate === undefined || candidate.depth >= depthBound) {
      continue;
    }
    const rendered = nextById.get(candidate.id);
    if (rendered === undefined) {
      depthBound = candidate.depth;
      continue;
    }
    const isHiddenByCollapse =
      oldRow.data !== null ? next.rowIds.has(rowId) : rendered.isExpanded === false;
    return isHiddenByCollapse ? rendered.id : undefined;
  }
  return undefined;
}

/**
 * Repairs a focus target after rows or columns changed.
 *
 * @remarks
 * Row half (body and panel): the row follows its id; a vanished row yields the row now at its
 * old index in `prev`, clamped. No rows left falls back to the first header cell. Column half
 * runs independently the same way. A panel target whose row has no open panel then becomes a
 * body target on that row: the first render column in a grid, row focus in a treegrid. Returns
 * `null` when nothing valid remains. Never throws.
 */
export function recoverFocus(
  current: FocusTarget | null,
  prev: FocusSnapshot,
  next: NextFocusSnapshot,
  panels?: PanelRecoveryContext,
): FocusTarget | null {
  if (current === null) {
    return null;
  }
  const rowRecovered = recoverTarget(current, prev, next);
  if (rowRecovered === null) {
    return null;
  }
  const recovered = recoverClosedPanel(rowRecovered, next, panels);
  const unrendered = findUnrenderedId(
    recovered,
    new Set(next.rows.map((row) => row.id)),
    new Set(next.columnIds),
  );
  return unrendered === undefined ? recovered : null;
}

// A closed panel is never mounted, so focus moves to its row.
function recoverClosedPanel(
  target: FocusTarget,
  next: NextFocusSnapshot,
  panels: PanelRecoveryContext | undefined,
): FocusTarget {
  const open = panels?.openPanelRowIds;
  if (target.area !== 'panel' || open === undefined || open.has(target.rowId)) {
    return target;
  }
  const columnId = panels?.isTreegrid ? null : (next.columnIds[0] ?? null);
  return { area: 'body', rowId: target.rowId, columnId };
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

  const ancestorId = findCollapseAncestorId(current.rowId, prev, next);
  if (ancestorId !== undefined) {
    return current.area === 'panel'
      ? { area: 'panel', rowId: ancestorId }
      : { area: 'body', rowId: ancestorId, columnId: null };
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
