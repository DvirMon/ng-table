import type { ColumnDef, RowId } from '../../api/types';
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
  targetId: RowId,
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
  columns: ColumnDef<TRow>[],
  groupId: RowId,
  opts?: Pick<ClusterOpts<TRow>, 'extractValueByColumn' | 'treeLinks'>,
): TRow[] {
  if (grouping.length === 0) {
    return [];
  }
  const nodes = buildClusterNodes(rows, grouping, columns, opts);
  const node = findClusterByPath(nodes, '', groupId);
  return node ? flattenLeaves([node]) : [];
}

// Every node's id, depth-first, regardless of `expandedRows` — unlike `render.ts`'s
// `emitGroupRows`, which only descends into an expanded node's children. Reuses
// `buildGroupPath`/`toGroupId` so the id format can never drift from what a header actually
// renders.
function collectClusterGroupIds<T>(
  nodes: ClusterNode<T>[],
  parentPath: string,
): RowId[] {
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
  columns: ColumnDef<TRow>[],
  opts?: ClusterOpts<TRow>,
): RowId[] {
  if (grouping.length === 0) {
    return [];
  }
  const nodes = buildClusterNodes(rows, grouping, columns, opts);
  const admitted = admitClusters(
    nodes,
    opts?.when,
    (items) => items,
    new Set(),
    opts?.columnWhen,
    () => columns,
    opts?.knownIds ?? new Set(columns.map((column) => column.id)),
    opts?.label ?? 'withGrouping',
  );
  const ordered = sortClusters(
    admitted,
    opts?.groupOrderByColumn,
    (items) => items,
    {
      done: false,
    },
  );
  return collectClusterGroupIds(ordered, '');
}

/**
 * The prefix of `declaredLevels` whose clusters actually admitted at least one node.
 *
 * @remarks
 * Partial admission at a level still counts it as applied; only total rejection drops it and
 * everything beneath, since an unreached level is never itself judged. Backs `withGrouping()`'s
 * `grouping()`/`groupingLevels()`/`isGroupedBy()` reads — `declaredLevels` itself still owns
 * clustering, `groupIds` and `rowsOf`. `[]` when `declaredLevels` is empty.
 */
export function collectAppliedLevels<TRow>(
  rows: TRow[],
  declaredLevels: readonly string[],
  columns: ColumnDef<TRow>[],
  opts?: ClusterOpts<TRow>,
): string[] {
  if (declaredLevels.length === 0) {
    return [];
  }
  const nodes = buildClusterNodes(rows, declaredLevels, columns, opts);
  const admitted = admitClusters(
    nodes,
    opts?.when,
    (items) => items,
    new Set(),
    opts?.columnWhen,
    () => columns,
    opts?.knownIds ?? new Set(columns.map((column) => column.id)),
    opts?.label ?? 'withGrouping',
  );

  const applied: string[] = [];
  let frontier = admitted;
  for (const level of declaredLevels) {
    if (!frontier.some((node) => node.admitted)) {
      break;
    }
    applied.push(level);
    frontier = frontier
      .filter((node) => node.admitted)
      .flatMap((node) => node.children);
  }
  return applied;
}
