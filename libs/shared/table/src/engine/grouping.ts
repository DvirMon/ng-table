import type {
  ClusterSummary,
  ColumnDef,
  GroupSummary,
  GroupWhen,
  RenderRow,
  RowId,
} from '../api/types';

export interface ClusterNode<T> {
  readonly columnId: string;
  readonly value: unknown;
  readonly items: T[]; // every leaf under this node, at any depth
  readonly children: ClusterNode<T>[]; // empty ⇒ this node is the deepest clustered level
  /** Set by `admitClusters`. `buildClusters` leaves it `true` — an unjudged tree is fully
   * admitted, which is what makes a table with no `groupWhen` byte-identical to today. */
  readonly admitted: boolean;
}

/** Distinguishes `1` from `"1"` and normalizes `Date` — plain `String(value)` would collide the
 * first and stringify the second inconsistently across engines. */
function toGroupKey(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (value instanceof Date) return `date:${value.getTime()}`;
  return `${typeof value}:${String(value)}`;
}

/** The one place `parentPath>columnId:key` is built — `emitGroupRows` and `findClusterByPath`
 * both call this instead of reconstructing the format, so the two can never silently drift out
 * of sync (the id an emitted header carries vs. the id a lookup resolves). */
function buildGroupPath(parentPath: string, columnId: string, value: unknown): string {
  return `${parentPath}>${columnId}:${toGroupKey(value)}`;
}

function toGroupId(path: string): RowId {
  return `group:${path}`;
}

/** Internal engine surface, not public API — collapses the two optional callbacks shared by
 * `clusterRows`/`buildGroupRenderRows`/`collectGroupIds` into one trailing parameter. */
export interface ClusterOpts<TRow> {
  readonly groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number;
  readonly groupWhen?: GroupWhen<TRow>;
}

/** Runtime degrade: an id naming no known column is dropped, not thrown on — "group by the
 * rest." Construction-time validation (a bad `initial` id) is `withGrouping()`'s job,
 * not this. */
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
    admitted: true,
  }));
}

function reportGroupWhenError(columnId: string): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    `[withGrouping] groupWhen threw for column "${columnId}". Admitting the cluster (rendering ` +
      'it as a group) for the affected cluster(s) in this evaluation.'
  );
}

/**
 * Marking pass — decides `admitted` per node via `groupWhen`, before ordering or emission runs.
 * A rejected node's descendants are never judged, since a dissolved cluster's rows never render
 * as its own group. Reports a throwing predicate once per column per caller evaluation, matching
 * `computeAggregates`.
 */
export function admitClusters<T, TRow>(
  nodes: ClusterNode<T>[],
  groupWhen: GroupWhen<TRow> | undefined,
  toRows: (items: T[]) => TRow[],
  reportedColumns: Set<string>
): ClusterNode<T>[] {
  if (!groupWhen) {
    return nodes;
  }
  return nodes.map((node) => {
    const summary: ClusterSummary<TRow> = {
      columnId: node.columnId,
      key: node.value,
      rows: toRows(node.items),
    };
    let admitted: boolean;
    try {
      admitted = groupWhen(summary);
    } catch {
      admitted = true;
      if (!reportedColumns.has(node.columnId)) {
        reportedColumns.add(node.columnId);
        reportGroupWhenError(node.columnId);
      }
    }
    const children = admitted
      ? admitClusters(node.children, groupWhen, toRows, reportedColumns)
      : node.children;
    return { ...node, admitted, children };
  });
}

/** Narrows a render row's `data` from `TRow | null` to `TRow` — true for every item the `'group'`
 * render stage sees, since it runs first in `RENDER_ORDER` and only ever receives the plain 1:1
 * seed (no `kind: 'group'` header exists yet to carry a `null`). */
function isRowData<TRow>(data: TRow | null): data is TRow {
  return data !== null;
}

function flattenLeaves<T>(nodes: ClusterNode<T>[]): T[] {
  return nodes.flatMap((node) =>
    node.admitted && node.children.length > 0 ? flattenLeaves(node.children) : node.items
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
 * the whole recursive walk for one caller's evaluation. See `withGrouping()`'s decisions doc.
 */
export function sortClusters<T, TRow>(
  nodes: ClusterNode<T>[],
  groupOrder: ((a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number) | undefined,
  toRows: (items: T[]) => TRow[],
  reported: { done: boolean }
): ClusterNode<T>[] {
  if (!groupOrder) {
    return partitionAndRecurse(nodes);
  }
  let ordered = nodes;
  try {
    const summaries = nodes.map((node) => ({
      node,
      summary: {
        columnId: node.columnId,
        key: node.value,
        rows: toRows(node.items),
        admitted: node.admitted,
      } satisfies GroupSummary<TRow>,
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

/** Stable partition — admitted siblings in first-occurrence order, then dissolved siblings in
 * first-occurrence order — the default sibling order once nothing supplies `groupOrder`.
 * Recurses so the same rule applies at every depth, but returns `nodes` itself, and each
 * untouched node itself, when nothing in the subtree is dissolved: reference-preserving, which
 * is load-bearing for "composing `withGrouping()` with no extra config changes nothing". */
function partitionAndRecurse<T>(nodes: ClusterNode<T>[]): ClusterNode<T>[] {
  const recursed = nodes.map((node) => {
    const children = partitionAndRecurse(node.children);
    return children === node.children ? node : { ...node, children };
  });
  const unchanged = recursed.every((node, index) => node === nodes[index]);
  return partitionByAdmission(unchanged ? nodes : recursed);
}

function partitionByAdmission<T>(nodes: ClusterNode<T>[]): ClusterNode<T>[] {
  const hasDissolved = nodes.some((node) => !node.admitted);
  if (!hasDissolved) {
    return nodes;
  }
  const admitted = nodes.filter((node) => node.admitted);
  const dissolved = nodes.filter((node) => !node.admitted);
  return [...admitted, ...dissolved];
}

/** Shared by `clusterRows` and `rowsBeneathGroup` — both cluster a raw `TRow[]` by the same
 * resolved levels via the same `columnById` accessor; only what they do with the resulting
 * tree differs. */
function buildClusterNodes<TRow>(
  rows: TRow[],
  levels: readonly string[],
  columns: ColumnDef<TRow>[]
): ClusterNode<TRow>[] {
  const columnById = new Map(columns.map((c) => [c.id, c]));
  return buildClusters(rows, levels, (row, columnId) => columnById.get(columnId)!.accessor(row));
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
  opts?: ClusterOpts<TRow>
): TRow[] {
  const levels = resolveGroupingLevels(grouping, columns);
  if (levels.length === 0) {
    return rows;
  }
  const nodes = buildClusterNodes(rows, levels, columns);
  const admitted = admitClusters(nodes, opts?.groupWhen, (items) => items, new Set());
  const ordered = sortClusters(admitted, opts?.groupOrder, (items) => items, { done: false });
  return flattenLeaves(ordered);
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

/**
 * Depth-first header + leaf walk over a `buildClusters` tree. Emits one `kind: 'group'` header
 * per admitted node, immediately followed by its nested headers/leaves, each carrying its
 * parent's id. A node with `admitted: false` emits its `items` flat at the parent's depth and
 * `parentId` instead — no header, no recursion into `children`. Collapse/expand visibility is
 * not this function's concern: the engine-owned `'prune'` render stage (ADR-0017) hides a
 * header's descendants when its id is missing from the unioned `expandedRows` set.
 */
function emitGroupRows<TRow>(
  nodes: ClusterNode<Omit<RenderRow<TRow>, 'index'>>[],
  depth: number,
  parentPath: string,
  columns: ColumnDef<TRow>[],
  reportedColumns: Set<string>,
  parentId?: RowId
): Omit<RenderRow<TRow>, 'index'>[] {
  return nodes.flatMap((node) => {
    if (!node.admitted) {
      return node.items.map((item) => ({ ...item, depth, parentId }));
    }
    const path = buildGroupPath(parentPath, node.columnId, node.value);
    const id = toGroupId(path);
    const header: Omit<RenderRow<TRow>, 'index'> = {
      id,
      depth,
      kind: 'group',
      data: null,
      groupKey: { columnId: node.columnId, value: node.value },
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
        ? emitGroupRows(node.children, depth + 1, path, columns, reportedColumns, id)
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
  rows: Omit<RenderRow<TRow>, 'index'>[],
  grouping: readonly string[],
  columns: ColumnDef<TRow>[],
  opts?: ClusterOpts<TRow>
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
  const toRows = (items: Omit<RenderRow<TRow>, 'index'>[]): TRow[] =>
    items.map((item) => item.data).filter(isRowData);
  const admitted = admitClusters(nodes, opts?.groupWhen, toRows, new Set());
  const ordered = sortClusters(admitted, opts?.groupOrder, toRows, { done: false });
  return emitGroupRows(ordered, 0, '', columns, new Set());
}

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
  columns: ColumnDef<TRow>[],
  groupId: RowId
): TRow[] {
  const levels = resolveGroupingLevels(grouping, columns);
  if (levels.length === 0) {
    return [];
  }
  const nodes = buildClusterNodes(rows, levels, columns);
  const node = findClusterByPath(nodes, '', groupId);
  return node ? flattenLeaves([node]) : [];
}

/** Every node's id, depth-first, regardless of `expandedRows` — unlike `emitGroupRows`, which
 * only descends into an expanded node's children. Reuses `buildGroupPath`/`toGroupId` so the id
 * format can never drift from what a header actually renders. */
function collectClusterGroupIds<T>(nodes: ClusterNode<T>[], parentPath: string): RowId[] {
  return nodes.flatMap((node) => {
    if (!node.admitted) return [];
    const path = buildGroupPath(parentPath, node.columnId, node.value);
    return [toGroupId(path), ...collectClusterGroupIds(node.children, path)];
  });
}

/**
 * Every group header id that exists in the data, at every level — collapse-independent, so it
 * can seed "expand everything" (issue #131). `[]` when ungrouped.
 */
export function collectGroupIds<TRow>(
  rows: TRow[],
  grouping: readonly string[],
  columns: ColumnDef<TRow>[],
  opts?: ClusterOpts<TRow>
): RowId[] {
  const levels = resolveGroupingLevels(grouping, columns);
  if (levels.length === 0) {
    return [];
  }
  const nodes = buildClusterNodes(rows, levels, columns);
  const admitted = admitClusters(nodes, opts?.groupWhen, (items) => items, new Set());
  const ordered = sortClusters(admitted, opts?.groupOrder, (items) => items, { done: false });
  return collectClusterGroupIds(ordered, '');
}
