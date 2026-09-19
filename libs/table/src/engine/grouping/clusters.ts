import type {
  ClusterSummary,
  GroupOrder,
  GroupSummary,
  GroupWhen,
  RowId,
} from '../../api/types';

export interface ClusterNode<T> {
  readonly columnId: string;
  readonly value: unknown;
  readonly items: T[]; // every leaf under this node, at any depth
  readonly children: ClusterNode<T>[]; // empty ⇒ this node is the deepest clustered level
  /** Set by `admitClusters`. `buildClusters` leaves it `true` — an unjudged tree is fully
   * admitted, which is what makes a table with no `when` byte-identical to today. */
  readonly admitted: boolean;
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
   * a matching column's own label, then the raw field name) happens in `render.ts`'s
   * `emitGroupRows`. */
  readonly labelByColumn?: ReadonlyMap<string, string>;
}

/** Distinguishes `1` from `"1"` and normalizes `Date` — plain `String(value)` would collide the
 * first and stringify the second inconsistently across engines. */
function toGroupKey(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (value instanceof Date) return `date:${value.getTime()}`;
  return `${typeof value}:${String(value)}`;
}

// True when `value` (post-`applyGroupKey`) has no dedicated `toGroupKey` branch and would
// collapse every distinct instance into one `"object:[object Object]"` bucket. `null`/
// `undefined`/`Date` each get their own branch and are not reportable.
function isCollapsingGroupValue(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !(value instanceof Date);
}

// Extends ADR-0014's throw-must-be-visible reasoning to a silent collapse. Reported once per
// field per `buildClusters` call tree — declaring `applyGroupKey` on the field is the fix,
// which is what makes this actionable rather than merely noisy.
function reportNonPrimitiveGroupValue(columnId: string): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    `[withGrouping] field "${columnId}" groups on a non-primitive value — every distinct ` +
      'object collapses into one group. Declare applyGroupKey on that field to key the group ' +
      'on a primitive.'
  );
}

/** The one place `parentPath>columnId:key` is built — `render.ts`'s `emitGroupRows` and
 * `queries.ts`'s `findClusterByPath` both call this instead of reconstructing the format, so
 * the two can never silently drift out of sync (the id an emitted header carries vs. the id a
 * lookup resolves). */
export function buildGroupPath(parentPath: string, columnId: string, value: unknown): string {
  return `${parentPath}>${columnId}:${toGroupKey(value)}`;
}

export function toGroupId(path: string): RowId {
  return `group:${path}`;
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
  accessor: (item: T, columnId: string) => unknown,
  reportedFields: Set<string> = new Set()
): ClusterNode<T>[] {
  const [columnId, ...rest] = levels;
  if (columnId === undefined) {
    return [];
  }
  const buckets = new Map<string, { value: unknown; items: T[] }>();
  for (const item of items) {
    const value = accessor(item, columnId);
    if (isCollapsingGroupValue(value) && !reportedFields.has(columnId)) {
      reportedFields.add(columnId);
      reportNonPrimitiveGroupValue(columnId);
    }
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
    children: buildClusters(bucketItems, rest, accessor, reportedFields),
    admitted: true,
  }));
}

/** The raw field value at `key` on `row`, run through `extractValueByColumn`'s matching extractor
 * when one is declared (D7). `row` is read by bracket access, not a column's `accessor` — a
 * grouping level names a row field, not a column. */
export function readGroupFieldValue<TRow>(
  row: TRow,
  key: string,
  extractValueByColumn?: ReadonlyMap<string, (fieldValue: unknown) => unknown>
): unknown {
  const raw = (row as Record<string, unknown>)[key];
  const extractValue = extractValueByColumn?.get(key);
  return extractValue ? extractValue(raw) : raw;
}

/** Shared by `pipeline.ts`'s `clusterRows` and `queries.ts`'s `rowsBeneathGroup`/`collectGroupIds`/
 * `collectAppliedLevels` — all cluster a raw `TRow[]` by the same resolved levels via the same
 * field-value extraction; only what the caller does with the resulting tree differs. */
export function buildClusterNodes<TRow>(
  rows: TRow[],
  levels: readonly string[],
  extractValueByColumn?: ReadonlyMap<string, (fieldValue: unknown) => unknown>
): ClusterNode<TRow>[] {
  return buildClusters(rows, levels, (row, key) =>
    readGroupFieldValue(row, key, extractValueByColumn)
  );
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
 * `render.ts`'s `computeAggregates`.
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

/** True for a leaf/dissolved node whose subtree contributes no further headers — used by
 * `pipeline.ts` and `queries.ts` to flatten a judged tree back to `T[]`. */
export function flattenLeaves<T>(nodes: ClusterNode<T>[]): T[] {
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
