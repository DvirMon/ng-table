import type { RowId, TrackByConfig, TrackByFn } from '../api/types';
import type { RenderRowsBuilder } from './pipeline';

/** Pure row-identity and render-row helpers. No signals, no Angular. */

/** Collapses the `keyof TRow | fn` config into a single call shape, once at construction. */
export function normalizeTrackBy<TRow>(
  trackBy: TrackByConfig<TRow>
): TrackByFn<TRow> {
  if (typeof trackBy === 'function') {
    return trackBy;
  }
  const key = trackBy;
  return (row: TRow) => row[key] as RowId;
}

/** 1:1 wrap, no grouping — the render-row builder every table starts with. */
export function buildDefaultRenderRows<TRow>(
  trackBy: TrackByFn<TRow>
): RenderRowsBuilder<TRow> {
  return (rows) =>
    rows.map((row) => ({ id: trackBy(row), depth: 0, kind: 'row', data: row }));
}
