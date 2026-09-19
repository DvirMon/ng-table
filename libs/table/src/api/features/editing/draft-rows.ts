import { linkedSignal, type WritableSignal } from '@angular/core';
import type { RowId, TrackByFn } from '../../types';

interface DraftRowsSource<TRow> {
  readonly data: TRow[];
  readonly open: ReadonlySet<RowId>;
}

/**
 * Per-row draft copy `form(table.draft, schema)` binds to, since Signal Forms' `debounce()`
 * can't hold a row-level commit boundary (blur/touch always force-flushes). Open rows keep their
 * in-progress draft (`previous.value`); closed rows re-derive from `data`, so Cancel/revert needs
 * no explicit reset. Stays index-parallel to `data` — `RenderRow.sourceIndex` depends on it.
 *
 * Two paths, split on whether `data` itself changed (open/close alone never writes `data`):
 * - **`data` unchanged** (a plain `beginEdit`/`endEdit` with no merge): opening a row needs no
 *   array change at all — it was already mirroring `data`. Only rows that just *closed* need
 *   resetting, an O(k) patch (k = ids that changed) via `indexById`, not an O(n) remap.
 * - **`data` changed** (a merge, insert, external write): full O(n) remap — no way around it,
 *   and the same cost the sort/filter pipeline already pays on any `data` change.
 */
function resetClosedRows<TRow>(
  source: DraftRowsSource<TRow>,
  previous: { source: DraftRowsSource<TRow>; value: TRow[] },
  indexById: () => ReadonlyMap<RowId, number>
): TRow[] {
  const closedIds = [...previous.source.open].filter((id) => !source.open.has(id));
  const hasNoClosedRows = closedIds.length === 0;
  if (hasNoClosedRows) {
    return previous.value;
  }

  const byId = indexById();
  const next = previous.value.slice();
  for (const id of closedIds) {
    const at = byId.get(id);
    const rowStillExists = at !== undefined;
    if (rowStillExists) {
      next[at] = source.data[at];
    }
  }
  return next;
}

function remapAllRows<TRow>(
  source: DraftRowsSource<TRow>,
  previousValue: TRow[],
  trackBy: TrackByFn<TRow>
): TRow[] {
  const draftById = new Map(previousValue.map((row) => [trackBy(row), row]));
  return source.data.map((row) => {
    const isOpen = source.open.has(trackBy(row));
    return isOpen ? (draftById.get(trackBy(row)) ?? row) : row;
  });
}

export function createDraftRows<TRow>(
  data: () => TRow[],
  editing: () => ReadonlySet<RowId>,
  trackBy: TrackByFn<TRow>,
  indexById: () => ReadonlyMap<RowId, number>
): WritableSignal<TRow[]> {
  return linkedSignal<DraftRowsSource<TRow>, TRow[]>({
    source: () => ({ data: data(), open: editing() }),
    computation: (source, previous) => {
      const isFirstRun = previous === undefined;
      if (isFirstRun) {
        return source.data.slice();
      }

      const isDataUnchanged = source.data === previous.source.data;
      return isDataUnchanged
        ? resetClosedRows(source, previous, indexById)
        : remapAllRows(source, previous.value, trackBy);
    },
  });
}
