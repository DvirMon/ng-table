import { resolveIndex } from '../engine/rows';
import type { RowId, RowUpdater } from '../api/types';

/** `at` is `Array.prototype.splice(at, 0, row)` semantics. Never throws — an out-of-range or
 * stale `at` clamps instead of crashing. */
function clampSpliceIndex(at: number | undefined, length: number): number {
  if (at === undefined) return length;
  const resolved = at < 0 ? length + at : at;
  return Math.min(Math.max(resolved, 0), length);
}

export function insertRow<TRow>(row: NoInfer<TRow>, opts?: { at?: number }): RowUpdater<TRow> {
  return (rows) => {
    const next = rows.slice();
    next.splice(clampSpliceIndex(opts?.at, next.length), 0, row);
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
