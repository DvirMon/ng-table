import type { ColumnDef } from '../../api/types';
import type { RenderNode } from '../render-stages';
import {
  admitClusters,
  buildClusters,
  buildGroupPath,
  readGroupValue,
  sortClusters,
  toGroupId,
  type ClusterNode,
  type ClusterOpts,
} from './clusters';

// Narrows a render row's `data` from `TRow | null` to `TRow` — true for every item the `'group'`
// render stage sees, since it runs first in `RENDER_ORDER` and only ever receives the plain 1:1
// seed (no `kind: 'group'` header exists yet to carry a `null`).
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

// A construction-time-valid level can still lose its column later — `setColumns()` is not
// gated by the same check `initial`/`schema`/`table.grouping`'s writer go through (ADR-0024
// only re-validates on a grouping write). Runtime, data-dependent, so it degrades and reports
// (ADR-0014), it does not throw. Shared by every caller that hits this one condition —
// `groupingLevels()` (`with-grouping/feature.ts`) and `resolveGroupLabel` below — so the
// message and its dedup live in one place.
export function reportOrphanedGroupingColumn(
  columnId: string,
  consequence: string,
  reported: Set<string>
): void {
  if (reported.has(columnId)) {
    return;
  }
  reported.add(columnId);
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    `[withGrouping] No column declares id "${columnId}" — it was likely removed via ` +
      `setColumns() while still an active grouping level. ${consequence}`
  );
}

// Per-cluster aggregate row: `rows` is always a cluster's own leaves. A throwing
// `aggregateFn` falls back to `undefined` for that column only; `reportedColumns` is shared
// across one `buildGroupRenderRows` call so the console.error dedupes to once per column across
// every group visited, not once per group.
function computeAggregates<TRow>(
  rows: TRow[],
  aggregateByColumn: ReadonlyMap<string, (rows: TRow[]) => unknown> | undefined,
  reportedColumns: Set<string>
): Record<string, unknown> {
  const aggregates: Record<string, unknown> = {};
  if (!aggregateByColumn) {
    return aggregates;
  }
  for (const [columnId, aggregateFn] of aggregateByColumn) {
    try {
      aggregates[columnId] = aggregateFn(rows);
    } catch {
      aggregates[columnId] = undefined;
      if (!reportedColumns.has(columnId)) {
        reportedColumns.add(columnId);
        reportAggregateError(columnId);
      }
    }
  }
  return aggregates;
}

// Explicit `labelByColumn` entry -> the column's own label. Every level names a real column at
// the point it was declared or written (ADR-0024); a miss here means its column was removed
// later via `setColumns()`. Falls back to the raw id, reported once per column per evaluation
// via `reportedLabels` — a runtime, data-dependent condition, so it degrades rather than
// throws (ADR-0014).
function resolveGroupLabel<TRow>(
  columnId: string,
  columnById: ReadonlyMap<string, ColumnDef<TRow>>,
  reportedLabels: Set<string>,
  labelByColumn?: ReadonlyMap<string, string>
): string {
  const explicit = labelByColumn?.get(columnId);
  if (explicit) {
    return explicit;
  }
  const column = columnById.get(columnId);
  if (!column) {
    reportOrphanedGroupingColumn(
      columnId,
      'Falling back to the raw id as the label for the affected group(s) in this evaluation.',
      reportedLabels
    );
    return columnId;
  }
  return column.label;
}

// Depth-first header + leaf walk over a `buildClusters` tree. Returns one `kind: 'group'` header
// per admitted node, nesting its children beneath it. A node with `admitted: false` inlines its
// `items` at the parent's level instead — no header, no recursion into `children`. Collapse/
// expand visibility is not this function's concern: `flattenVisible` decides what renders from
// the nested tree this produces.
function buildGroupNodes<TRow>(
  nodes: ClusterNode<RenderNode<TRow>>[],
  parentPath: string,
  columnById: ReadonlyMap<string, ColumnDef<TRow>>,
  reportedColumns: Set<string>,
  reportedLabels: Set<string>,
  labelByColumn: ReadonlyMap<string, string> | undefined,
  aggregateByColumn: ReadonlyMap<string, (rows: TRow[]) => unknown> | undefined
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
        label: resolveGroupLabel(node.columnId, columnById, reportedLabels, labelByColumn),
      },
      aggregates: computeAggregates(
        node.items.map((item) => item.data).filter(isRowData),
        aggregateByColumn,
        reportedColumns
      ),
      children:
        node.children.length > 0
          ? buildGroupNodes(
              node.children,
              path,
              columnById,
              reportedColumns,
              reportedLabels,
              labelByColumn,
              aggregateByColumn
            )
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
  const columnById = new Map(columns.map((column) => [column.id, column]));
  const reportedColumns = new Set<string>();
  const nodes = buildClusters([...rows], grouping, (item, columnId) => {
    if (!isRowData(item.data)) {
      throw new Error(
        "[withGrouping] buildGroupRenderRows received a row with null data — the 'group' render " +
          "stage must run first in RENDER_ORDER, before anything can synthesize a null-data row."
      );
    }
    return readGroupValue(item.data, columnId, columnById, reportedColumns, opts?.extractValueByColumn);
  });
  const toRows = (items: RenderNode<TRow>[]): TRow[] =>
    items.map((item) => item.data).filter(isRowData);
  const admitted = admitClusters(nodes, opts?.when, toRows, new Set(), opts?.columnWhen);
  const ordered = sortClusters(admitted, opts?.groupOrderByColumn, toRows, { done: false });
  return buildGroupNodes(
    ordered,
    '',
    columnById,
    new Set(),
    new Set(),
    opts?.labelByColumn,
    opts?.aggregateByColumn
  );
}
