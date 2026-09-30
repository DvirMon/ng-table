import type { ColumnDef } from '../../api/types';
import { admitClusters, buildClusterNodes, flattenLeaves, sortClusters, type ClusterOpts } from './clusters';

/**
 * The `group` pipeline stage (`PIPELINE_ANCHORS`, `engine/pipeline.ts`) — `TRow[] => TRow[]`,
 * stable clustering, contiguous at every depth. Empty/all-unknown `grouping` is a reference-
 * preserving no-op, matching `withSorting()`'s empty-rules case.
 */
export function clusterRows<TRow>(
  rows: TRow[],
  grouping: readonly string[],
  columns: ColumnDef<TRow>[],
  opts?: ClusterOpts<TRow>
): TRow[] {
  if (grouping.length === 0) {
    return rows;
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
    opts?.label ?? 'withGrouping'
  );
  const ordered = sortClusters(admitted, opts?.groupOrderByColumn, (items) => items, {
    done: false,
  });
  return flattenLeaves(ordered);
}
