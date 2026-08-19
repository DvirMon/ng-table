import type { TableStore } from './types';
import type { TableCore } from '../engine/types';
import type { RowId, RowUpdater } from './types';

/** D27: `at` is `Array.prototype.splice(at, 0, row)` semantics. Never throws — an
 * out-of-range or stale `at` clamps instead of crashing. */
function clampSpliceIndex(at: number | undefined, length: number): number {
  if (at === undefined) return length;
  const resolved = at < 0 ? length + at : at;
  return Math.min(Math.max(resolved, 0), length);
}

export function addRow<TRow>(row: TRow, opts?: { at?: number }): RowUpdater<TRow> {
  return (rows) => {
    const next = rows.slice();
    next.splice(clampSpliceIndex(opts?.at, next.length), 0, row);
    return next;
  };
}

export function removeRow<TRow>(id: RowId): RowUpdater<TRow> {
  return (rows, { trackBy }) => rows.filter((row) => trackBy(row) !== id);
}

export function patchRow<TRow>(id: RowId, partial: Partial<TRow>): RowUpdater<TRow> {
  return (rows, { trackBy }) =>
    rows.map((row) => (trackBy(row) === id ? { ...row, ...partial } : row));
}

/** Free function, store first — mirrors `patchState(store, updater)` (D6). Writes through
 * to the consumer's `WritableSignal` (D3/D4); the store gains no write method of its own. */
export function updateRows<TRow>(
  table: TableStore<TRow>,
  updater: RowUpdater<TRow>
): void {
  const { data, trackBy } = table as TableStore<TRow> & Pick<TableCore<TRow>, 'data'>;
  data.update((rows) => updater(rows, { trackBy }));
}
