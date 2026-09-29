import type { RowId, TrackByFn } from '../api/types';
import type { ParentLink } from './types';

// Pure parent-link resolution for flat tree data — no signals, no Angular.

/** How a row's declared parent failed to resolve to a usable link. */
export type BrokenLinkKind = 'self' | 'absent' | 'cycle';

/** Every row's resolved parent id (or `null` for a root), plus broken links grouped by kind. */
export interface TreeLinks {
  readonly parentById: ReadonlyMap<RowId, RowId | null>;
  readonly broken: Readonly<Record<BrokenLinkKind, readonly RowId[]>>;
}

/**
 * Resolves each row's parent over `rows`.
 *
 * @remarks
 * A self-parent, an absent parent, or a cycle (broken at the cycle's first row in input order)
 * maps that row to `null` and files its id under the matching `broken` kind; the rest of that
 * subtree keeps its own links.
 */
export function resolveTreeLinks<TRow>(
  rows: readonly TRow[],
  ctx: { parentOf: ParentLink<TRow>; trackBy: TrackByFn<TRow> }
): TreeLinks {
  const { parentOf, trackBy } = ctx;

  const ids = rows.map((row) => trackBy(row));
  const idSet = new Set<RowId>(ids);
  const inputIndex = new Map<RowId, number>();
  ids.forEach((id, index) => {
    if (!inputIndex.has(id)) {
      inputIndex.set(id, index);
    }
  });

  // `effectiveParent` mirrors the row's declared parent, except a self-parent or an absent
  // parent is forced to `null` — those rows already resolved to root, so a chain walking
  // through one terminates there instead of chasing the invalid raw value.
  const effectiveParent = new Map<RowId, RowId | null>();
  const self: RowId[] = [];
  const absent: RowId[] = [];
  const cycle: RowId[] = [];

  for (const row of rows) {
    const id = trackBy(row);
    if (effectiveParent.has(id)) {
      continue; // duplicate row id — out of scope (#156), keep the first declaration
    }
    const parent = parentOf(row);
    const isSelfParent = parent !== null && parent === id;
    const isAbsentParent = parent !== null && !isSelfParent && !idSet.has(parent);
    if (isSelfParent) {
      self.push(id);
      effectiveParent.set(id, null);
    } else if (isAbsentParent) {
      absent.push(id);
      effectiveParent.set(id, null);
    } else {
      effectiveParent.set(id, parent);
    }
  }

  const parentById = new Map<RowId, RowId | null>();
  const resolved = new Set<RowId>();
  for (const id of [...self, ...absent]) {
    parentById.set(id, null);
    resolved.add(id);
  }

  const resolveSafePath = (path: readonly RowId[]): void => {
    for (const id of path) {
      parentById.set(id, effectiveParent.get(id)!);
      resolved.add(id);
    }
  };

  for (const row of rows) {
    const startId = trackBy(row);
    if (resolved.has(startId)) {
      continue;
    }

    // Walk the chain of declared links, recording visit order, until it reaches a root, a
    // node already resolved by an earlier walk, or a repeat within this walk (a cycle).
    const path: RowId[] = [];
    const positionInPath = new Map<RowId, number>();
    let currentId: RowId | null = startId;
    while (currentId !== null && !resolved.has(currentId) && !positionInPath.has(currentId)) {
      positionInPath.set(currentId, path.length);
      path.push(currentId);
      currentId = effectiveParent.get(currentId) ?? null;
    }

    const hasReachedResolvedOrRoot = currentId === null || resolved.has(currentId);
    if (hasReachedResolvedOrRoot) {
      resolveSafePath(path);
      continue;
    }

    // `currentId` repeats a node already in `path` — everything from that position on is the
    // cycle; anything before it is a tail hanging off the cycle and keeps its own link.
    const cycleStart = positionInPath.get(currentId!)!;
    resolveSafePath(path.slice(0, cycleStart));

    const cycleMembers = path.slice(cycleStart);
    let brokenId = cycleMembers[0];
    for (const id of cycleMembers) {
      if (inputIndex.get(id)! < inputIndex.get(brokenId)!) {
        brokenId = id;
      }
    }
    for (const id of cycleMembers) {
      if (id === brokenId) {
        parentById.set(id, null);
        cycle.push(id);
      } else {
        parentById.set(id, effectiveParent.get(id)!);
      }
      resolved.add(id);
    }
  }

  return { parentById, broken: { self, absent, cycle } };
}
