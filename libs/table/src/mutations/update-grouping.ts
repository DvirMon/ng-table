import type { GroupingUpdater } from '../api/types';

/** Replaces the full ordered level list. */
export function setGroupLevels<TRow>(levels: string[]): GroupingUpdater<TRow> {
  return () => levels;
}

/** Appends (or inserts at `index`) a level. Already-present id is a no-op — a level can only
 * be active once. */
export function addGroupLevel<TRow>(id: string, index?: number): GroupingUpdater<TRow> {
  return (grouping) => {
    if (grouping.includes(id)) {
      return grouping;
    }
    const next = [...grouping];
    next.splice(index ?? next.length, 0, id);
    return next;
  };
}

/** Removes a level by id. Id not present is a no-op. */
export function removeGroupLevel<TRow>(id: string): GroupingUpdater<TRow> {
  return (grouping) => grouping.filter((level) => level !== id);
}

/** Moves the level at `from` to `to`. Out-of-range indices are a no-op — never throws: this is
 * a runtime write path, not construction-time config, and the throw/degrade split applies only
 * to column ids, not index bounds. */
export function reorderGroupLevels<TRow>(from: number, to: number): GroupingUpdater<TRow> {
  return (grouping) => {
    const inBounds = from >= 0 && from < grouping.length && to >= 0 && to < grouping.length;
    if (!inBounds) {
      return grouping;
    }
    const next = [...grouping];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };
}
