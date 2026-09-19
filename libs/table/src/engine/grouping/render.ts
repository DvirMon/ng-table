import type { ColumnDef, RowId } from '../../api/types';
import type { StagedRow } from '../render-stages';
import {
  admitClusters,
  buildClusters,
  buildGroupPath,
  readGroupFieldValue,
  sortClusters,
  toGroupId,
  type ClusterNode,
  type ClusterOpts,
} from './clusters';

/** Narrows a render row's `data` from `TRow | null` to `TRow` — true for every item the `'group'`
 * render stage sees, since it runs first in `RENDER_ORDER` and only ever receives the plain 1:1
 * seed (no `kind: 'group'` header exists yet to carry a `null`). */
function isRowData<TRow>(data: TRow | null): data is TRow {
  return data !== null;
}

function reportAggregateError(columnId: string): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    `[withGrouping] aggregateFn threw for column "${columnId}". Falling back to an undefined ` +
      'aggregate value for the affected group(s) in this evaluation.'
  );
}

/** Per-cluster aggregate row: `rows` is always a cluster's own leaves. A throwing
 * `aggregateFn` falls back to `undefined` for that column only; `reportedColumns` is shared
 * across one `buildGroupRenderRows` call so the console.error dedupes to once per column across
 * every group visited, not once per group. */
function computeAggregates<TRow>(
  rows: TRow[],
  columns: ColumnDef<TRow>[],
  reportedColumns: Set<string>
): Record<string, unknown> {
  const aggregates: Record<string, unknown> = {};
  for (const column of columns) {
    if (!column.aggregateFn) {
      continue;
    }
    try {
      aggregates[column.id] = column.aggregateFn(rows);
    } catch {
      aggregates[column.id] = undefined;
      if (!reportedColumns.has(column.id)) {
        reportedColumns.add(column.id);
        reportAggregateError(column.id);
      }
    }
  }
  return aggregates;
}

/** Explicit -> a column whose id matches `columnId` -> the raw field name (D7a). */
function resolveGroupLabel<TRow>(
  columnId: string,
  columns: ColumnDef<TRow>[],
  labelByColumn?: ReadonlyMap<string, string>
): string {
  const explicit = labelByColumn?.get(columnId);
  if (explicit) {
    return explicit;
  }
  const column = columns.find((c) => c.id === columnId);
  return column ? column.label : columnId;
}

/**
 * Depth-first header + leaf walk over a `buildClusters` tree. Emits one `kind: 'group'` header
 * per admitted node, immediately followed by its nested headers/leaves, each carrying its
 * parent's id. A node with `admitted: false` emits its `items` flat at the parent's depth and
 * `parentId` instead — no header, no recursion into `children`. Collapse/expand visibility is
 * not this function's concern: the engine-owned `'prune'` render stage (ADR-0017) hides a
 * header's descendants when its id is missing from the unioned `expandedRows` set.
 */
function emitGroupRows<TRow>(
  nodes: ClusterNode<StagedRow<TRow>>[],
  depth: number,
  parentPath: string,
  columns: ColumnDef<TRow>[],
  reportedColumns: Set<string>,
  labelByColumn: ReadonlyMap<string, string> | undefined,
  parentId?: RowId
): StagedRow<TRow>[] {
  return nodes.flatMap((node) => {
    if (!node.admitted) {
      return node.items.map((item) => ({ ...item, depth, parentId }));
    }
    const path = buildGroupPath(parentPath, node.columnId, node.value);
    const id = toGroupId(path);
    const header: StagedRow<TRow> = {
      id,
      depth,
      kind: 'group',
      data: null,
      groupKey: {
        columnId: node.columnId,
        value: node.value,
        label: resolveGroupLabel(node.columnId, columns, labelByColumn),
      },
      hasChildren: node.items.length > 0,
      aggregates: computeAggregates(
        node.items.map((item) => item.data).filter(isRowData),
        columns,
        reportedColumns
      ),
      parentId,
    };
    const nested =
      node.children.length > 0
        ? emitGroupRows(node.children, depth + 1, path, columns, reportedColumns, labelByColumn, id)
        : node.items.map((item) => ({ ...item, depth: depth + 1, parentId: id }));
    return [header, ...nested];
  });
}

/**
 * The `'group'` render stage (`RENDER_ORDER`, `engine/render-stages.ts`) — runs first, so its
 * input is always the plain 1:1 seed from `buildDefaultRenderRows`, every `item.data` a real
 * `TRow`. Reuses `buildClusters` for the same tree the pipeline `group` stage builds, so header
 * insertion and `computeAggregates` read from one tree, never two divergent walks.
 */
export function buildGroupRenderRows<TRow>(
  rows: StagedRow<TRow>[],
  grouping: readonly string[],
  columns: ColumnDef<TRow>[],
  opts?: ClusterOpts<TRow>
): StagedRow<TRow>[] {
  if (grouping.length === 0) {
    return rows;
  }
  const nodes = buildClusters(rows, grouping, (item, key) => {
    if (!isRowData(item.data)) {
      throw new Error(
        "[withGrouping] buildGroupRenderRows received a row with null data — the 'group' render " +
          "stage must run first in RENDER_ORDER, before anything can synthesize a null-data row."
      );
    }
    return readGroupFieldValue(item.data, key, opts?.extractValueByColumn);
  });
  const toRows = (items: StagedRow<TRow>[]): TRow[] =>
    items.map((item) => item.data).filter(isRowData);
  const admitted = admitClusters(nodes, opts?.when, toRows, new Set(), opts?.columnWhen);
  const ordered = sortClusters(admitted, opts?.groupOrderByColumn, toRows, { done: false });
  return emitGroupRows(ordered, 0, '', columns, new Set(), opts?.labelByColumn);
}
