import type { ColumnDef, GroupSummary, RenderRow } from '../api/types';

export interface ClusterNode<T> {
  readonly columnId: string;
  readonly value: unknown;
  readonly items: T[]; // every leaf under this node, at any depth
  readonly children: ClusterNode<T>[]; // empty ⇒ this node is the deepest clustered level
}

/** Distinguishes `1` from `"1"` and normalizes `Date` — plain `String(value)` would collide the
 * first and stringify the second inconsistently across engines. */
function toGroupKey(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (value instanceof Date) return `date:${value.getTime()}`;
  return `${typeof value}:${String(value)}`;
}

/** D14 runtime degrade: an id naming no known column is dropped, not thrown on — "group by the
 * rest." Construction-time validation (a bad `initialGrouping` id) is Step 4's job, not this. */
export function resolveGroupingLevels<TRow>(
  grouping: readonly string[],
  columns: ColumnDef<TRow>[]
): string[] {
  const knownIds = new Set(columns.map((c) => c.id));
  return grouping.filter((id) => knownIds.has(id));
}

/**
 * Recursive stable partition. `accessor(item, columnId)` is supplied by the caller so this
 * builder never needs to know whether `T` is a raw `TRow` or a wrapped render row.
 * `Map` preserves insertion order, which is what gives "first-occurrence order when no
 * `groupOrder` is supplied" (#58) for free — do not swap for a plain object or a sort.
 */
export function buildClusters<T>(
  items: T[],
  levels: readonly string[],
  accessor: (item: T, columnId: string) => unknown
): ClusterNode<T>[] {
  const [columnId, ...rest] = levels;
  if (columnId === undefined) {
    return [];
  }
  const buckets = new Map<string, { value: unknown; items: T[] }>();
  for (const item of items) {
    const value = accessor(item, columnId);
    const key = toGroupKey(value);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.items.push(item);
    } else {
      buckets.set(key, { value, items: [item] });
    }
  }
  return Array.from(buckets.values()).map(({ value, items: bucketItems }) => ({
    columnId,
    value,
    items: bucketItems,
    children: buildClusters(bucketItems, rest, accessor),
  }));
}

/** Narrows a render row's `data` from `TRow | null` to `TRow` — true for every item the `'group'`
 * render stage sees, since it runs first in `RENDER_ORDER` and only ever receives the plain 1:1
 * seed (no `kind: 'group'` header exists yet to carry a `null`). */
function isRowData<TRow>(data: TRow | null): data is TRow {
  return data !== null;
}

function flattenLeaves<T>(nodes: ClusterNode<T>[]): T[] {
  return nodes.flatMap((node) =>
    node.children.length > 0 ? flattenLeaves(node.children) : node.items
  );
}

function reportGroupOrderError(): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    '[withGrouping] groupOrder threw while ordering group siblings. Falling back to stable ' +
      'first-occurrence order for the affected level(s) in this evaluation.'
  );
}

/**
 * Recursively re-orders each node list's own siblings by `groupOrder`, never against a
 * different parent's children. `toRows` bridges `T` (raw `TRow` for the pipeline stage, a
 * render-row wrapper for the render stage) to `GroupSummary.rows`. `reported` is shared across
 * the whole recursive walk for one caller's evaluation. See `withGrouping()`'s decisions doc,
 * D4/D9/D15.
 */
export function sortClusters<T, TRow>(
  nodes: ClusterNode<T>[],
  groupOrder: ((a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number) | undefined,
  toRows: (items: T[]) => TRow[],
  reported: { done: boolean }
): ClusterNode<T>[] {
  if (!groupOrder) {
    return nodes;
  }
  let ordered = nodes;
  try {
    const summaries = nodes.map((node) => ({
      node,
      summary: { key: node.value, rows: toRows(node.items) } satisfies GroupSummary<TRow>,
    }));
    ordered = [...summaries]
      .sort((a, b) => groupOrder(a.summary, b.summary))
      .map((entry) => entry.node);
  } catch {
    if (!reported.done) {
      reported.done = true;
      reportGroupOrderError();
    }
    ordered = nodes;
  }
  return ordered.map((node) => ({
    ...node,
    children: sortClusters(node.children, groupOrder, toRows, reported),
  }));
}

/**
 * The `group` pipeline stage (`PIPELINE_ORDER`, `engine/pipeline.ts`) — `TRow[] => TRow[]`,
 * stable clustering, contiguous at every depth. Empty/all-unknown `grouping` is a reference-
 * preserving no-op, matching `withSorting()`'s empty-rules case.
 */
export function clusterRows<TRow>(
  rows: TRow[],
  grouping: readonly string[],
  columns: ColumnDef<TRow>[],
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number
): TRow[] {
  const levels = resolveGroupingLevels(grouping, columns);
  if (levels.length === 0) {
    return rows;
  }
  const columnById = new Map(columns.map((c) => [c.id, c]));
  const nodes = buildClusters(rows, levels, (row, columnId) =>
    columnById.get(columnId)!.accessor(row)
  );
  const ordered = sortClusters(nodes, groupOrder, (items) => items, { done: false });
  return flattenLeaves(ordered);
}

/** Per-cluster aggregate row: `rows` is always a cluster's own leaves — see D9. */
function computeAggregates<TRow>(
  rows: TRow[],
  columns: ColumnDef<TRow>[]
): Record<string, unknown> {
  const aggregates: Record<string, unknown> = {};
  for (const column of columns) {
    if (column.aggregateFn) {
      aggregates[column.id] = column.aggregateFn(rows);
    }
  }
  return aggregates;
}

/**
 * Depth-first header + leaf walk over a `buildClusters` tree. Emits one `kind: 'group'` header
 * per node, immediately followed by its nested headers/leaves — contiguous at every depth,
 * unconditionally expanded (no `expandedRows` read here, that's #59's job).
 */
function emitGroupRows<TRow>(
  nodes: ClusterNode<Omit<RenderRow<TRow>, 'index'>>[],
  depth: number,
  parentPath: string,
  columns: ColumnDef<TRow>[]
): Omit<RenderRow<TRow>, 'index'>[] {
  return nodes.flatMap((node) => {
    const path = `${parentPath}>${node.columnId}:${toGroupKey(node.value)}`;
    const header: Omit<RenderRow<TRow>, 'index'> = {
      id: `group:${path}`,
      depth,
      kind: 'group',
      data: null,
      hasChildren: node.items.length > 0,
      aggregates: computeAggregates(
        node.items.map((item) => item.data).filter(isRowData),
        columns
      ),
    };
    const nested =
      node.children.length > 0
        ? emitGroupRows(node.children, depth + 1, path, columns)
        : node.items.map((item) => ({ ...item, depth: depth + 1 }));
    return [header, ...nested];
  });
}

/**
 * The `'group'` render stage (`RENDER_ORDER`, `engine/render-stages.ts`) — runs first, so its
 * input is always the plain 1:1 seed from `buildDefaultRenderRows`, every `item.data` a real
 * `TRow`. Reuses `buildClusters` (Step 1) for the same tree the pipeline `group` stage builds,
 * so header insertion and `computeAggregates` read from one tree, never two divergent walks.
 */
export function buildGroupRenderRows<TRow>(
  rows: Omit<RenderRow<TRow>, 'index'>[],
  grouping: readonly string[],
  columns: ColumnDef<TRow>[],
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number
): Omit<RenderRow<TRow>, 'index'>[] {
  const levels = resolveGroupingLevels(grouping, columns);
  if (levels.length === 0) {
    return rows;
  }
  const columnById = new Map(columns.map((c) => [c.id, c]));
  const nodes = buildClusters(rows, levels, (item, columnId) => {
    if (!isRowData(item.data)) {
      throw new Error(
        "[withGrouping] buildGroupRenderRows received a row with null data — the 'group' render " +
          "stage must run first in RENDER_ORDER, before anything can synthesize a null-data row."
      );
    }
    return columnById.get(columnId)!.accessor(item.data);
  });
  const ordered = sortClusters(
    nodes,
    groupOrder,
    (items) => items.map((item) => item.data).filter(isRowData),
    { done: false }
  );
  return emitGroupRows(ordered, 0, '', columns);
}
