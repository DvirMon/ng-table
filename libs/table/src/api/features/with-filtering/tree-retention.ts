import type { ParentLink } from '../../../engine/types';
import { resolveTreeLinks } from '../../../engine/tree-links';
import type { RowId, TrackByFn } from '../../types';

/**
 * Keeps each matching row together with its ancestors, in input order.
 *
 * @remarks
 * `contextIds` holds the kept rows that neither match nor sit under a match kept by
 * `includeDescendants`. Ancestors follow `resolveTreeLinks`, so broken links end the walk
 * where the rendered tree ends it.
 */
export function retainTreeMatches<TRow>(
  rows: readonly TRow[],
  opts: {
    matches: (row: TRow) => boolean;
    parentOf: ParentLink<TRow>;
    trackBy: TrackByFn<TRow>;
    includeDescendants: boolean;
  }
): { rows: TRow[]; contextIds: ReadonlySet<RowId> } {
  const { matches, parentOf, trackBy, includeDescendants } = opts;
  const { parentById } = resolveTreeLinks(rows, { parentOf, trackBy });

  const matchedIds = new Set<RowId>();
  for (const row of rows) {
    if (matches(row)) {
      matchedIds.add(trackBy(row));
    }
  }

  const keptIds = new Set<RowId>(matchedIds);
  for (const id of matchedIds) {
    let ancestor = parentById.get(id) ?? null;
    while (ancestor !== null && !keptIds.has(ancestor)) {
      keptIds.add(ancestor);
      ancestor = parentById.get(ancestor) ?? null;
    }
  }

  const descendantIds = new Set<RowId>();
  if (includeDescendants) {
    for (const row of rows) {
      const id = trackBy(row);
      let ancestor = parentById.get(id) ?? null;
      while (ancestor !== null) {
        if (matchedIds.has(ancestor)) {
          descendantIds.add(id);
          break;
        }
        ancestor = parentById.get(ancestor) ?? null;
      }
    }
  }

  const contextIds = new Set<RowId>();
  for (const id of keptIds) {
    if (!matchedIds.has(id) && !descendantIds.has(id)) {
      contextIds.add(id);
    }
  }

  const kept = rows.filter((row) => {
    const id = trackBy(row);
    return keptIds.has(id) || descendantIds.has(id);
  });

  return { rows: kept, contextIds };
}
