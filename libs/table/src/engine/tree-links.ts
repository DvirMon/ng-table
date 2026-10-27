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

/** The parent link and row identity that tree links resolve from. */
export interface TreeLinkSource<TRow> {
  readonly parentOf: ParentLink<TRow>;
  readonly trackBy: TrackByFn<TRow>;
}

interface DeclaredParents {
  readonly effectiveParent: ReadonlyMap<RowId, RowId | null>;
  readonly self: readonly RowId[];
  readonly absent: readonly RowId[];
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
  ctx: TreeLinkSource<TRow>,
): TreeLinks {
  const ids = rows.map((row) => ctx.trackBy(row));
  const inputIndex = indexFirstOccurrence(ids);
  const { effectiveParent, self, absent } = declareEffectiveParents(rows, ids, inputIndex, ctx);

  const cycle: RowId[] = [];
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

  for (const startId of ids) {
    const isAlreadyResolved = resolved.has(startId);
    if (isAlreadyResolved) {
      continue;
    }

    // Walk the chain of declared links, recording visit order, until it reaches a root, a
    // node already resolved by an earlier walk, or a repeat within this walk (a cycle).
    const path: RowId[] = [];
    const positionInPath = new Map<RowId, number>();
    const canStepInto = (id: RowId | null): id is RowId =>
      id !== null && !resolved.has(id) && !positionInPath.has(id);
    let currentId: RowId | null = startId;
    while (canStepInto(currentId)) {
      positionInPath.set(currentId, path.length);
      path.push(currentId);
      currentId = effectiveParent.get(currentId) ?? null;
    }

    const hasReachedRoot = currentId === null;
    const hasReachedResolvedNode = currentId !== null && resolved.has(currentId);
    const hasReachedResolvedOrRoot = hasReachedRoot || hasReachedResolvedNode;
    if (hasReachedResolvedOrRoot) {
      resolveSafePath(path);
      continue;
    }

    // `currentId` repeats a node already in `path` — everything from that position on is the
    // cycle; anything before it is a tail hanging off the cycle and keeps its own link.
    const cycleStart = positionInPath.get(currentId!)!;
    resolveSafePath(path.slice(0, cycleStart));

    const cycleMembers = path.slice(cycleStart);
    const brokenId = pickCycleBreak(cycleMembers, inputIndex);
    for (const id of cycleMembers) {
      const isBrokenLink = id === brokenId;
      if (isBrokenLink) {
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

function indexFirstOccurrence(ids: readonly RowId[]): ReadonlyMap<RowId, number> {
  const inputIndex = new Map<RowId, number>();
  ids.forEach((id, index) => {
    const isFirstOccurrence = !inputIndex.has(id);
    if (isFirstOccurrence) {
      inputIndex.set(id, index);
    }
  });
  return inputIndex;
}

// `effectiveParent` mirrors the row's declared parent, except a self-parent or an absent
// parent is forced to `null` — those rows already resolved to root, so a chain walking
// through one terminates there instead of chasing the invalid raw value.
function declareEffectiveParents<TRow>(
  rows: readonly TRow[],
  ids: readonly RowId[],
  inputIndex: ReadonlyMap<RowId, number>,
  ctx: TreeLinkSource<TRow>,
): DeclaredParents {
  const effectiveParent = new Map<RowId, RowId | null>();
  const self: RowId[] = [];
  const absent: RowId[] = [];

  rows.forEach((row, index) => {
    const id = ids[index];
    const isDuplicateId = effectiveParent.has(id);
    if (isDuplicateId) {
      return; // duplicate row id — out of scope (#156), keep the first declaration
    }
    const parent = ctx.parentOf(row);
    const hasParent = parent !== null;
    const isSelfParent = hasParent && parent === id;
    const isMissingFromRows = hasParent && !inputIndex.has(parent);
    const isAbsentParent = !isSelfParent && isMissingFromRows;
    if (isSelfParent) {
      self.push(id);
      effectiveParent.set(id, null);
    } else if (isAbsentParent) {
      absent.push(id);
      effectiveParent.set(id, null);
    } else {
      effectiveParent.set(id, parent);
    }
  });

  return { effectiveParent, self, absent };
}

/** The cycle member that appears first in the input — the one whose link is cut. */
function pickCycleBreak(
  cycleMembers: readonly RowId[],
  inputIndex: ReadonlyMap<RowId, number>,
): RowId {
  let brokenId = cycleMembers[0];
  for (const id of cycleMembers) {
    const appearsBeforeCurrentBreak = inputIndex.get(id)! < inputIndex.get(brokenId)!;
    if (appearsBeforeCurrentBreak) {
      brokenId = id;
    }
  }
  return brokenId;
}
