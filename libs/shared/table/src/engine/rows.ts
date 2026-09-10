import type { RenderRow, RowId, TrackByConfig, TrackByFn } from '../api/types';

/** Pure row-identity and render-row helpers. No signals, no Angular. */

/** Collapses the `keyof TRow | fn` config into a single call shape, once at construction. */
export function normalizeTrackBy<TRow>(
  trackBy: TrackByConfig<TRow>
): TrackByFn<TRow> {
  if (typeof trackBy === 'function') {
    return trackBy;
  }
  const key = trackBy;
  return (row: TRow) => {
    const value = row[key];
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    throw new Error(
      `trackBy key "${String(key)}" must resolve to a string or number RowId, got ${typeof value}`
    );
  };
}

/** 1:1 wrap, no grouping — the render-row seed every render stage chain starts from. */
export function buildDefaultRenderRows<TRow>(
  trackBy: TrackByFn<TRow>
): (rows: TRow[]) => Omit<RenderRow<TRow>, 'index'>[] {
  return (rows) =>
    rows.map((row) => ({ id: trackBy(row), depth: 0, kind: 'row', data: row }));
}

/**
 * Resolves `id`'s index in `rows`, O(1) via `indexById` when it still points at the right row,
 * falling back to a linear scan when it doesn't (e.g. a chained `writeData` inside one updater,
 * where `indexById` reflects the array *before* that write). The guard is one `trackBy` call —
 * cheap insurance against every staleness question, and always correct since the fallback never
 * trusts a stale hit.
 */
export function resolveIndex<TRow>(
  rows: TRow[],
  id: RowId,
  { trackBy, indexById }: { trackBy: TrackByFn<TRow>; indexById: ReadonlyMap<RowId, number> }
): number {
  const at = indexById.get(id);
  const isFreshCacheHit = at !== undefined && trackBy(rows[at]) === id;
  if (isFreshCacheHit) {
    return at;
  }
  return rows.findIndex((row) => trackBy(row) === id);
}

/** Ids present in `previous` but not `current` — what left `data` this recompute. */
export function diffRemovedIds(
  previous: ReadonlySet<RowId>,
  current: ReadonlySet<RowId>
): RowId[] {
  const removed: RowId[] = [];
  for (const id of previous) {
    if (!current.has(id)) {
      removed.push(id);
    }
  }
  return removed;
}

// `ReadonlySet` has no `get`, `ReadonlyMap` always does — narrows both arms of the union,
// unlike `instanceof Set`, which TS can't use to exclude `ReadonlySet` from the other arm
// (it isn't a structural subtype of `Set`, only a supertype of it).
function isMapContainer(
  container: ReadonlyMap<RowId, unknown> | ReadonlySet<RowId>
): container is ReadonlyMap<RowId, unknown> {
  return 'get' in container;
}

/**
 * Drops `removedIds` from a Map (except entries `keep` returns true for) or a Set. Returns the
 * same reference when nothing changed. One name, one mechanism: a Map and a Set here differ
 * only in whether they carry a payload, not in what "prune" means, so features reconciling
 * `RowId`-keyed state (ADR-0006) share this instead of each hand-rolling their own diff loop.
 */
export function pruneByIds<V>(
  container: ReadonlyMap<RowId, V>,
  removedIds: readonly RowId[],
  keep?: (value: V) => boolean
): ReadonlyMap<RowId, V>;
export function pruneByIds<V extends RowId = RowId>(
  container: ReadonlySet<RowId>,
  removedIds: readonly RowId[],
  keep?: (id: V) => boolean
): ReadonlySet<RowId>;
export function pruneByIds(
  container: ReadonlyMap<RowId, unknown> | ReadonlySet<RowId>,
  removedIds: readonly RowId[],
  keep?: (value: unknown) => boolean
): ReadonlyMap<RowId, unknown> | ReadonlySet<RowId> {
  if (isMapContainer(container)) {
    let next: Map<RowId, unknown> | undefined;
    for (const id of removedIds) {
      if (!container.has(id)) {
        continue;
      }
      if (keep?.(container.get(id))) {
        continue;
      }
      (next ??= new Map(container)).delete(id);
    }
    return next ?? container;
  }

  let next: Set<RowId> | undefined;
  for (const id of removedIds) {
    if (!container.has(id)) {
      continue;
    }
    if (keep?.(id)) {
      continue;
    }
    (next ??= new Set(container)).delete(id);
  }
  return next ?? container;
}
