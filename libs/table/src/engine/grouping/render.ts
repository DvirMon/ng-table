import type { ColumnDef } from '../../api/types';
import type { RenderNode } from '../render-stages';
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

/** Explicit label -> a column whose id matches `columnId` -> the raw field name. */
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
 * Depth-first header + leaf walk over a `buildClusters` tree. Returns one `kind: 'group'` header
 * per admitted node, nesting its children beneath it. A node with `admitted: false` inlines its
 * `items` at the parent's level instead — no header, no recursion into `children`. Collapse/
 * expand visibility is not this function's concern: `flattenVisible` decides what renders from
 * the nested tree this produces.
 */
function buildGroupNodes<TRow>(
  nodes: ClusterNode<RenderNode<TRow>>[],
  parentPath: string,
  columns: ColumnDef<TRow>[],
  reportedColumns: Set<string>,
  labelByColumn: ReadonlyMap<string, string> | undefined
): RenderNode<TRow>[] {
  return nodes.flatMap((node) => {
    if (!node.admitted) {
      return node.items;
    }
    const path = buildGroupPath(parentPath, node.columnId, node.value);
    const header: RenderNode<TRow> = {
      id: toGroupId(path),
      kind: 'group',
      data: null,
      groupKey: {
        columnId: node.columnId,
        value: node.value,
        label: resolveGroupLabel(node.columnId, columns, labelByColumn),
      },
      aggregates: computeAggregates(
        node.items.map((item) => item.data).filter(isRowData),
        columns,
        reportedColumns
      ),
      children:
        node.children.length > 0
          ? buildGroupNodes(node.children, path, columns, reportedColumns, labelByColumn)
          : node.items,
    };
    return [header];
  });
}

/**
 * The `'group'` render stage (`RENDER_ORDER`, `engine/render-stages.ts`) — runs first, so its
 * input is always the plain 1:1 seed from `buildDefaultRenderNodes`, every `item.data` a real
 * `TRow`. Reuses `buildClusters` for the same tree the pipeline `group` stage builds, so header
 * insertion and `computeAggregates` read from one tree, never two divergent walks.
 */
export function buildGroupRenderRows<TRow>(
  rows: readonly RenderNode<TRow>[],
  grouping: readonly string[],
  columns: ColumnDef<TRow>[],
  opts?: ClusterOpts<TRow>
): readonly RenderNode<TRow>[] {
  if (grouping.length === 0) {
    return rows;
  }
  const nodes = buildClusters([...rows], grouping, (item, key) => {
    if (!isRowData(item.data)) {
      throw new Error(
        "[withGrouping] buildGroupRenderRows received a row with null data — the 'group' render " +
          "stage must run first in RENDER_ORDER, before anything can synthesize a null-data row."
      );
    }
    return readGroupFieldValue(item.data, key, opts?.extractValueByColumn);
  });
  const toRows = (items: RenderNode<TRow>[]): TRow[] =>
    items.map((item) => item.data).filter(isRowData);
  const admitted = admitClusters(nodes, opts?.when, toRows, new Set(), opts?.columnWhen);
  const ordered = sortClusters(admitted, opts?.groupOrderByColumn, toRows, { done: false });
  return buildGroupNodes(ordered, '', columns, new Set(), opts?.labelByColumn);
}
