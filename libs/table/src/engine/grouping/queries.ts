import type { RowId } from '../../api/types';
import {
  admitClusters,
  buildClusterNodes,
  buildGroupPath,
  flattenLeaves,
  sortClusters,
  toGroupId,
  type ClusterNode,
  type ClusterOpts,
} from './clusters';

function findClusterByPath<T>(
  nodes: ClusterNode<T>[],
  parentPath: string,
  targetId: RowId
): ClusterNode<T> | undefined {
  for (const node of nodes) {
    const path = buildGroupPath(parentPath, node.columnId, node.value);
    if (toGroupId(path) === targetId) {
      return node;
    }
    const found = findClusterByPath(node.children, path, targetId);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/**
 * Every leaf row beneath a group id, at any depth — leaf rows, not immediate children.
 * Re-derives the cluster tree from the pipeline's `TRow[]` (post-filter, post-group-clustering,
 * never affected by collapse) rather than scanning `renderRows()`, so a collapsed group still
 * resolves its full leaf set. An id matching no cluster returns `[]` (runtime degrade, not a
 * throw).
 */
export function rowsBeneathGroup<TRow>(
  rows: TRow[],
  grouping: readonly string[],
  groupId: RowId,
  opts?: Pick<ClusterOpts<TRow>, 'extractValueByColumn'>
): TRow[] {
  if (grouping.length === 0) {
    return [];
  }
  const nodes = buildClusterNodes(rows, grouping, opts?.extractValueByColumn);
  const node = findClusterByPath(nodes, '', groupId);
  return node ? flattenLeaves([node]) : [];
}

/** Every node's id, depth-first, regardless of `expandedRows` — unlike `render.ts`'s
 * `emitGroupRows`, which only descends into an expanded node's children. Reuses
 * `buildGroupPath`/`toGroupId` so the id format can never drift from what a header actually
 * renders. */
function collectClusterGroupIds<T>(nodes: ClusterNode<T>[], parentPath: string): RowId[] {
  return nodes.flatMap((node) => {
    if (!node.admitted) return [];
    const path = buildGroupPath(parentPath, node.columnId, node.value);
    return [toGroupId(path), ...collectClusterGroupIds(node.children, path)];
  });
}

/**
 * Every group header id that exists in the data, at every level — collapse-independent, so it
 * can seed "expand everything". `[]` when ungrouped.
 */
export function collectGroupIds<TRow>(
  rows: TRow[],
  grouping: readonly string[],
  opts?: ClusterOpts<TRow>
): RowId[] {
  if (grouping.length === 0) {
    return [];
  }
  const nodes = buildClusterNodes(rows, grouping, opts?.extractValueByColumn);
  const admitted = admitClusters(
    nodes,
    opts?.when,
    (items) => items,
    new Set(),
    opts?.columnWhen
  );
  const ordered = sortClusters(admitted, opts?.groupOrderByColumn, (items) => items, {
    done: false,
  });
  return collectClusterGroupIds(ordered, '');
}

/**
 * D5's "applied" reading — the prefix of `declaredLevels` whose clusters actually admitted at
 * least one node, counting only clusters reached through an admitted ancestor chain (a rejected
 * node's children are never themselves judged by `admitClusters`, so they cannot count). Partial
 * admission at a level (some clusters kept, some dissolved) still counts that level as applied;
 * only *total* rejection at a level drops it, and every level beneath an unreached one is
 * unreachable too, hence the early stop rather than a per-level independent check. `[]` when
 * `declaredLevels` is empty. Backs `withGrouping()`'s public `grouping()`/`groupingLevels()`/
 * `isGroupedBy()` reads; `declaredLevels` itself still owns clustering, `groupIds` and `rowsOf`.
 */
export function collectAppliedLevels<TRow>(
  rows: TRow[],
  declaredLevels: readonly string[],
  opts?: ClusterOpts<TRow>
): string[] {
  if (declaredLevels.length === 0) {
    return [];
  }
  const nodes = buildClusterNodes(rows, declaredLevels, opts?.extractValueByColumn);
  const admitted = admitClusters(nodes, opts?.when, (items) => items, new Set(), opts?.columnWhen);

  const applied: string[] = [];
  let frontier = admitted;
  for (const level of declaredLevels) {
    if (!frontier.some((node) => node.admitted)) {
      break;
    }
    applied.push(level);
    frontier = frontier.filter((node) => node.admitted).flatMap((node) => node.children);
  }
  return applied;
}
