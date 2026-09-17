import { resolveIndex } from '../engine/rows';
import type { RowId, RowUpdater } from '../api/types';

/** `at` is `Array.prototype.splice(at, 0, row)` semantics. Never throws — an out-of-range or
 * stale `at` clamps instead of crashing. */
function clampSpliceIndex(at: number | undefined, length: number): number {
  if (at === undefined) return length;
  const resolved = at < 0 ? length + at : at;
  return Math.min(Math.max(resolved, 0), length);
}

/**
 * `at` is `Array.prototype.splice(at, 0, ...rows)` semantics either way — the array form inserts
 * every row as one contiguous block, in array order, in a single write. Assumes `TRow` is never
 * itself an array type; a table row is always a record in this library's usage, so `Array.isArray`
 * is a safe discriminant in practice.
 */
export function insertRow<TRow>(row: NoInfer<TRow>, opts?: { at?: number }): RowUpdater<TRow>;
export function insertRow<TRow>(rows: NoInfer<TRow>[], opts?: { at?: number }): RowUpdater<TRow>;
export function insertRow<TRow>(
  rowOrRows: NoInfer<TRow> | NoInfer<TRow>[],
  opts?: { at?: number },
): RowUpdater<TRow> {
  return (rows) => {
    const next = rows.slice();
    const toInsert = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
    next.splice(clampSpliceIndex(opts?.at, next.length), 0, ...toInsert);
    return next;
  };
}

export function removeRow<TRow>(id: RowId): RowUpdater<TRow> {
  return (rows, { trackBy, indexById }) => {
    const at = resolveIndex(rows, id, { trackBy, indexById });
    if (at === -1) return rows;
    const next = rows.slice();
    next.splice(at, 1);
    return next;
  };
}

export function patchRow<TRow>(id: RowId, partial: Partial<TRow>): RowUpdater<TRow> {
  return (rows, { trackBy, indexById }) => {
    const at = resolveIndex(rows, id, { trackBy, indexById });
    if (at === -1) return rows;
    const next = rows.slice();
    next[at] = { ...next[at], ...partial };
    return next;
  };
}
