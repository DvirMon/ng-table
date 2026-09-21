import type { Injector, Signal, WritableSignal } from '@angular/core';
import type { ColumnMetaKey, ColumnSchema, ColumnsSchemaFn } from '../columns-schema/types';
import type { Feature } from '../engine/types';
import type { WritableView } from '../engine/writable-view';

export type RowId = string | number;

/**
 * Reactive row-data source handed to `createTable(data, ...)`. The consumer's
 * `WritableSignal<TRow[]>` is the single source of truth — the pipeline reads it directly via
 * `computed()`, there is no internal copy to fall out of sync.
 */
export type TableDataInput<TRow> = WritableSignal<TRow[]>;

export type SortDirection = 'asc' | 'desc';

export interface SortRule {
  columnId: string;
  direction: SortDirection;
}

export type TrackByFn<TRow> = (row: TRow) => RowId;

export type TrackByConfig<TRow> = keyof TRow | TrackByFn<TRow>;

/**
 * Render-layer row: `rows()`'s pipeline output flattened for template/virtual-scroll
 * consumption. `kind: 'group'` rows are synthetic — no `TRow` backs them, hence `data: null`
 * — introduced by `withGrouping()`'s `'group'` render stage.
 */
export type RowKind = 'row' | 'group';

export interface RenderRow<TRow> {
  readonly id: RowId;

  // `depth` is 0 for a normal `kind: 'row'`, and increments for each level of nesting.
  readonly depth: number;
  readonly kind: RowKind;
  readonly data: TRow | null;

  // Position in the final `renderRows()` array, assigned centrally after the whole
  // `RENDER_ORDER` stage chain runs (`engine/core.ts`) — never set by a stage itself. Feeds
  // `aria-rowindex` on `ngpTableRow`, since a `<div>`-hosted grid loses the free DOM-order
  // inference native `<table>` gives for free.
  readonly index: number;

  // The field, value and resolved label a `group` row was clustered on, so a header can render
  // itself without parsing anything back out of the composite `id`. `label` resolves explicit ->
  // a column whose id matches `columnId` -> the raw field name. Set only for `kind: 'group'`.
  readonly groupKey?: { columnId: string; value: unknown; label: string };

  // `aggregates` holds data for a `group` row's template, e.g. output of `withAggregation()`.
  readonly aggregates?: Record<string, unknown>;

  // Derived by `flattenVisible`'s walk: `undefined` unless a feature contributed to the
  // unioned `expandedRows` slot *and* this row has children — a table with no expansion
  // feature composed never stamps this, even on a row that has children.
  readonly isExpanded?: boolean;

  // Derived by `flattenVisible`'s walk from the node's `children`, unless a stage overrides it
  // via `RenderNode.hasChildren` (e.g. a lazy row whose children haven't loaded yet).
  readonly hasChildren?: boolean;

  // Index into `data()` for the `TRow` this render row was built from, resolved by trackBy
  // id (`engine/core.ts`). `undefined` for synthesized rows (`kind: 'group'`, or any row a
  // render stage fabricates) — there is no `data()` entry to point to.
  readonly sourceIndex?: number;

  // The id of the render row this one was synthesized beneath — the group header for a cluster
  // member, the parent row for a tree child. Derived by `flattenVisible`'s walk from the node
  // tree's own nesting; `undefined` on a top-level row and whenever nothing nests. Opaque:
  // never parsed back apart, since a group id's separators differ from a tree id's.
  readonly parentId?: RowId;

  // The resolved value per column, keyed by declared column id — `accessor` output for a
  // `kind: 'row'`, the group's own aggregates for a `kind: 'group'`. Stamped centrally in
  // `engine/core.ts` after the whole RENDER_ORDER chain runs, alongside `index`/`sourceIndex`
  // (ADR-0011). Does not follow column visibility or order: the consumer's own visible-column
  // loop still decides what renders (ADR-0022). Values are raw — format with a pipe.
  readonly cells: Readonly<Record<string, unknown>>;
}

export interface ColumnDef<TRow = unknown, TId extends string = string> {
  id: TId;
  accessor: (row: TRow) => unknown;
  visible: boolean;
  order: number;
  label: string;

  // Feature-contributed fields, populated when the corresponding feature is registered.
  sortFn?: (a: TRow, b: TRow) => number;
  enableSorting?: boolean;
  aggregateFn?: (rows: TRow[]) => unknown;

  // Consumer-registered side-channel data, keyed by `ColumnMetaKey<T>` identity — never
  // interpreted by the engine. Read via `readColumnMeta()`, written via `metadata()`
  // (`columns-schema/metadata.ts`).
  meta?: ReadonlyMap<ColumnMetaKey<unknown>, unknown>;
}

/**
 * Author-facing column shape, accepted by `createTable()`'s `columns` config and
 * `setColumns()`. `accessor`/`visible`/`order`/`label` are optional here and resolved to a
 * full `ColumnDef` at store construction — `accessor` defaults to `(row) => row[id]`,
 * `visible` defaults to `true`, `order` defaults to the column's index in the array,
 * `label` defaults to `id`. Only `id` is required. The resolved store state
 * (`store.columns()`) is always a full `ColumnDef[]`. `TId` defaults to `string` so every
 * existing reference compiles untouched; `createTable()`'s overloads infer the literal union
 * declared in `columns` (ADR-0019).
 */
export type ColumnDefInput<TRow = unknown, TId extends string = string> = Pick<
  ColumnDef<TRow, TId>,
  'id'
> &
  Partial<Omit<ColumnDef<TRow, TId>, 'id'>>;

/**
 * Known row keys autocomplete; any other string still compiles, so derived columns
 * (`accessor`-only, no matching `keyof TRow`) and columns added later via `setColumns()` stay
 * expressible.
 */
export type ColumnId<TRow> = Extract<keyof TRow, string> | (string & {});

export type GroupingUpdater<TRow> = (grouping: string[]) => string[];

/** A group's raw clustering value, opaque to consumers. See `withGrouping()`'s decisions doc. */
export type GroupKey = unknown;

/** What `when` judges: a built cluster's own contents, before admission is decided. */
export interface ClusterSummary<TRow> {
  readonly columnId: string;
  readonly key: GroupKey;
  readonly rows: readonly TRow[];
}

/** What `groupOrder` compares: the same cluster, after admission is decided. `admitted: false`
 * ⇒ this cluster emits flat, no header. */
export interface GroupSummary<TRow> extends ClusterSummary<TRow> {
  readonly admitted: boolean;
}

export type GroupWhen<TRow> = (cluster: ClusterSummary<TRow>) => boolean;

/** What `applyGroupOrder` compares: two siblings from the same level, after admission is
 * decided. `admitted: false` ⇒ that cluster emits flat, no header. */
export type GroupOrder<TRow> = (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number;

export type DerivedDict = Record<string, Signal<unknown>>;

/** The derive block's parameter — every `WritableView` loses `.update`; everything else
 * passes through. Mutating methods are statically indistinguishable from queries and stay.
 * The `any` below is an `infer` slot, not a constraint slot — it does not widen the result. */
export type ReadonlyStore<S> = {
  readonly [K in keyof S]: S[K] extends WritableView<infer T, any> ? Signal<T> : S[K];
};

export interface TableConfig<TRow, TId extends string = string> {
  trackBy: TrackByConfig<TRow>;
  columns: ColumnDefInput<TRow, TId>[];
  columnsSchema?: ColumnsSchemaFn<TRow, TId> | ColumnSchema<TRow>;
  injector?: Injector;
}

// The erased element type the engine folds at runtime — a dynamic-length list, not a
// per-position generic. Consumers never name this: `createTable()`'s per-arity overloads
// (Step 2) type each feature argument's `In`/`Out` individually.
export type AnyTableFeature = Feature<any, any>;

export type ColumnsUpdater<TRow, TId extends string = string> = (
  columns: ColumnDef<TRow, TId>[]
) => ColumnDef<TRow, TId>[];

/**
 * Pure row transform. `ctx.trackBy` is supplied by `table.value.update(...)` so id-based
 * updaters (`removeRow`, `patchRow`) can resolve identity without needing a store reference
 * themselves — keeps them tree-shakeable and unit-testable standalone. The raw-lambda form
 * `rows => rows.filter(...)` satisfies this type too; it just ignores `ctx`.
 */
export type RowUpdater<TRow> = (
  rows: TRow[],
  ctx: { trackBy: TrackByFn<TRow>; indexById: ReadonlyMap<RowId, number> }
) => TRow[];

/**
 * Public surface of a store returned by `createTable()`. This is the contract consumers
 * program against — it never references engine types, so swapping the internal
 * state-management implementation is not a breaking change.
 */
export interface TableStore<TRow, TId extends string = string> {
  /** Read: the folded, rule-applied column list. Write: `.update(updater)` — e.g.
   * `table.columns.update(reorderColumns(ids))`. */
  readonly columns: WritableView<ColumnDef<TRow, TId>[], ColumnsUpdater<TRow, TId>>;
  readonly rows: Signal<TRow[]>;
  readonly renderRows: Signal<RenderRow<TRow>[]>;
  readonly trackBy: TrackByFn<TRow>;

  /** Maps a row's trackBy id to its position in `data()`; read-only. Feeds `RowUpdater` ctx
   * and editing features. */
  readonly indexById: Signal<ReadonlyMap<RowId, number>>;

  // Total row count feeding `aria-rowcount` on `ngpTable` — distinct from
  // `renderRows().length` once virtualization/pagination renders fewer rows than exist.
  // Equals `rows().length` until a virtualization feature overrides it.
  readonly totalRowCount: Signal<number>;

  /** Read: the row data — the consumer's own signal, single source of truth. Write:
   * `.update(updater)` — e.g. `table.value.update(insertRow(row, { at: 0 }))`. */
  readonly value: WritableView<TRow[], RowUpdater<TRow>>;
}
