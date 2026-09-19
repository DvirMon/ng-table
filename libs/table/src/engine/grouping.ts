import type {
  ClusterSummary,
  ColumnDef,
  GroupOrder,
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
   * admitted, which is what makes a table with no `when` byte-identical to today. */
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

/** Internal engine surface, not public API — collapses the optional callbacks shared by
 * `clusterRows`/`buildGroupRenderRows`/`collectGroupIds` into one trailing parameter. */
export interface ClusterOpts<TRow> {
  readonly groupOrderByColumn?: ReadonlyMap<string, GroupOrder<TRow>>;
  readonly when?: GroupWhen<TRow>;
  /** Per-column admission, AND'd with `when`. A columnId with no active level is inert. */
  readonly columnWhen?: ReadonlyMap<string, GroupWhen<TRow>>;
  /** Per-field value extractors (D7) — `row[levelKey]` runs through the matching entry, if any,
   * before it becomes a cluster's group key. Absent entries read the raw field value. */
  readonly extractValueByColumn?: ReadonlyMap<string, (fieldValue: unknown) => unknown>;
  /** Per-field explicit group-header labels (D7a). Resolution beyond this map (falling back to
   * a matching column's own label, then the raw field name) happens in `emitGroupRows`. */
  readonly labelByColumn?: ReadonlyMap<string, string>;
}

/**
 * Recursive stable partition. `accessor(item, columnId)` is supplied by the caller so this
 * builder never needs to know whether `T` is a raw `TRow` or a wrapped render row.
 * `Map` preserves insertion order, which is what gives "first-occurrence order when no
 * `groupOrder` is supplied" for free — do not swap for a plain object or a sort.
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
    `[withGrouping] when threw for column "${columnId}". Admitting the cluster (rendering ` +
      'it as a group) for the affected cluster(s) in this evaluation.'
  );
}

/** One predicate's vote on one cluster — `undefined` predicate is vacuously admitting (no floor
 * from that side). A throw admits (ADR-0014's visible fallback) and reports once per column per
 * `reportedColumns` set. */
function evaluateGroupWhen<TRow>(
  predicate: GroupWhen<TRow> | undefined,
  summary: ClusterSummary<TRow>,
  columnId: string,
  reportedColumns: Set<string>
): boolean {
  if (!predicate) {
    return true;
  }
  try {
    return predicate(summary);
  } catch {
    if (!reportedColumns.has(columnId)) {
      reportedColumns.add(columnId);
      reportGroupWhenError(columnId);
    }
    return true;
  }
}

/**
 * Marking pass — decides `admitted` per node via `when` AND'd with `columnWhen`'s
 * per-column predicate for that node's own column, before ordering or emission runs. A rejected
 * node's descendants are never judged, since a dissolved cluster's rows never render as its own
 * group. Reports a throwing predicate once per column per caller evaluation, matching
 * `computeAggregates`.
 */
export function admitClusters<T, TRow>(
  nodes: ClusterNode<T>[],
  when: GroupWhen<TRow> | undefined,
  toRows: (items: T[]) => TRow[],
  reportedColumns: Set<string>,
  columnWhen?: ReadonlyMap<string, GroupWhen<TRow>>
): ClusterNode<T>[] {
  if (!when && !columnWhen?.size) {
    return nodes;
  }
  return nodes.map((node) => {
    const summary: ClusterSummary<TRow> = {
      columnId: node.columnId,
      key: node.value,
      rows: toRows(node.items),
    };
    const admittedByTable = evaluateGroupWhen(when, summary, node.columnId, reportedColumns);
    const admittedByColumn = evaluateGroupWhen(
      columnWhen?.get(node.columnId),
      summary,
      node.columnId,
      reportedColumns
    );
    const admitted = admittedByTable && admittedByColumn;
    const children = admitted
      ? admitClusters(node.children, when, toRows, reportedColumns, columnWhen)
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
 * Recursively re-orders each node list's own siblings, resolving the comparator per list by its
 * own `columnId` (every node in one list shares one, per `buildClusters`'s invariant). `toRows`
 * bridges `T` (raw `TRow` for the pipeline stage, a render-row wrapper for the render stage) to
 * `GroupSummary.rows`. `reported` is shared across the whole recursive walk for one caller's
 * evaluation. See `withGrouping()`'s decisions doc.
 */
export function sortClusters<T, TRow>(
  nodes: ClusterNode<T>[],
  groupOrderByColumn: ReadonlyMap<string, GroupOrder<TRow>> | undefined,
  toRows: (items: T[]) => TRow[],
  reported: { done: boolean }
): ClusterNode<T>[] {
  const comparator =
    nodes.length > 0 ? groupOrderByColumn?.get(nodes[0].columnId) : undefined;
  if (!comparator) {
    return partitionAndRecurse(nodes, groupOrderByColumn, toRows, reported);
  }
  const ordered = orderWithComparator(nodes, comparator, toRows, reported);
  return ordered.map((node) => ({
    ...node,
    children: sortClusters(node.children, groupOrderByColumn, toRows, reported),
  }));
}

/** Stable partition — admitted siblings in first-occurrence order, then dissolved siblings in
 * first-occurrence order — the default sibling order for any level with no comparator of its
 * own. Recurses so the same rule applies at every depth, but returns `nodes` itself, and each
 * untouched node itself, when nothing in the subtree is dissolved: reference-preserving, which
 * is load-bearing for "composing `withGrouping()` with no extra config changes nothing". */
function partitionAndRecurse<T, TRow>(
  nodes: ClusterNode<T>[],
  groupOrderByColumn: ReadonlyMap<string, GroupOrder<TRow>> | undefined,
  toRows: (items: T[]) => TRow[],
  reported: { done: boolean }
): ClusterNode<T>[] {
  const recursed = nodes.map((node) => {
    const children = sortClusters(node.children, groupOrderByColumn, toRows, reported);
    return children === node.children ? node : { ...node, children };
  });
  const unchanged = recursed.every((node, index) => node === nodes[index]);
  return partitionByAdmission(unchanged ? nodes : recursed);
}

// Only reached when this node list's own column has a comparator. A throwing comparator falls
// back to `nodes`' pre-sort order and reports once per evaluation.
function orderWithComparator<T, TRow>(
  nodes: ClusterNode<T>[],
  comparator: GroupOrder<TRow>,
  toRows: (items: T[]) => TRow[],
  reported: { done: boolean }
): ClusterNode<T>[] {
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
    return [...summaries]
      .sort((a, b) => comparator(a.summary, b.summary))
      .map((entry) => entry.node);
  } catch {
    if (!reported.done) {
      reported.done = true;
      reportGroupOrderError();
    }
    return nodes;
  }
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

/** The raw field value at `key` on `row`, run through `extractValueByColumn`'s matching extractor
 * when one is declared (D7). `row` is read by bracket access, not a column's `accessor` — a
 * grouping level names a row field, not a column. */
function readGroupFieldValue<TRow>(
  row: TRow,
  key: string,
  extractValueByColumn?: ReadonlyMap<string, (fieldValue: unknown) => unknown>
): unknown {
  const raw = (row as Record<string, unknown>)[key];
  const extractValue = extractValueByColumn?.get(key);
  return extractValue ? extractValue(raw) : raw;
}

/** Shared by `clusterRows` and `rowsBeneathGroup` — both cluster a raw `TRow[]` by the same
 * resolved levels via the same field-value extraction; only what they do with the resulting
 * tree differs. */
function buildClusterNodes<TRow>(
  rows: TRow[],
  levels: readonly string[],
  extractValueByColumn?: ReadonlyMap<string, (fieldValue: unknown) => unknown>
): ClusterNode<TRow>[] {
  return buildClusters(rows, levels, (row, key) =>
    readGroupFieldValue(row, key, extractValueByColumn)
  );
}

/**
 * The `group` pipeline stage (`PIPELINE_ORDER`, `engine/pipeline.ts`) — `TRow[] => TRow[]`,
 * stable clustering, contiguous at every depth. Empty/all-unknown `grouping` is a reference-
 * preserving no-op, matching `withSorting()`'s empty-rules case.
 */
export function clusterRows<TRow>(
  rows: TRow[],
  grouping: readonly string[],
  opts?: ClusterOpts<TRow>
): TRow[] {
  if (grouping.length === 0) {
    return rows;
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

function emitGroupRows<TRow>(
  nodes: ClusterNode<Omit<RenderRow<TRow>, 'index'>>[],
  depth: number,
  parentPath: string,
  columns: ColumnDef<TRow>[],
  reportedColumns: Set<string>,
  labelByColumn: ReadonlyMap<string, string> | undefined,
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
  rows: Omit<RenderRow<TRow>, 'index'>[],
  grouping: readonly string[],
  columns: ColumnDef<TRow>[],
  opts?: ClusterOpts<TRow>
): Omit<RenderRow<TRow>, 'index'>[] {
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
  const toRows = (items: Omit<RenderRow<TRow>, 'index'>[]): TRow[] =>
    items.map((item) => item.data).filter(isRowData);
  const admitted = admitClusters(nodes, opts?.when, toRows, new Set(), opts?.columnWhen);
  const ordered = sortClusters(admitted, opts?.groupOrderByColumn, toRows, { done: false });
  return emitGroupRows(ordered, 0, '', columns, new Set(), opts?.labelByColumn);
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
