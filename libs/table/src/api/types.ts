import type { Injector, Signal, WritableSignal } from '@angular/core';
import type { ColumnMetaKey, ColumnRule } from '../columns-schema/types';
import type { Feature } from '../engine/types';
import type { WritableView } from '../engine/writable-view';

export type RowId = string | number;

/** Reactive row-data source for `createTable(data, ...)`; the pipeline reads the consumer's
 * signal directly — sole source of truth, no internal copy. */
export type TableDataInput<TRow> = WritableSignal<TRow[]>;

export type SortDirection = 'asc' | 'desc';

export interface SortRule {
  columnId: string;
  direction: SortDirection;
}

export type TrackByFn<TRow> = (row: TRow) => RowId;

export type TrackByConfig<TRow> = keyof TRow | TrackByFn<TRow>;

/** Discriminates a `RenderRow` as sourced from `TRow` data (`'row'`) or synthesized by a
 * feature, e.g. `withGrouping()`'s group header (`'group'`). */
export type RowKind = 'row' | 'group';

export interface RenderRow<TRow> {
  readonly id: RowId;

  /** Nesting depth — `0` for a top-level `kind: 'row'`, +1 per level. */
  readonly depth: number;
  readonly kind: RowKind;

  /** The source `TRow`, or `null` for a synthetic `kind: 'group'` row. */
  readonly data: TRow | null;

  /** Position in the final `renderRows()` array, assigned once the whole render-stage chain
   * runs. Feeds `aria-rowindex` on `ngpTableRow`. */
  readonly index: number;

  /** The field, value and resolved label a `group` row was clustered on, so a header can
   * render without parsing the composite `id`. Set only for `kind: 'group'`. */
  readonly groupKey?: { columnId: string; value: unknown; label: string };

  /** Data for a `group` row's template, e.g. output of `withAggregation()`. */
  readonly aggregates?: Record<string, unknown>;

  /** Whether an expanded row is open. `undefined` unless a tree feature is composed and this
   * row has children. */
  readonly isExpanded?: boolean;

  /** Whether this row has children, per the tree. May be overridden by a stage for a lazily-
   * loaded row. */
  readonly hasChildren?: boolean;

  /** Index into `data()` for the `TRow` this row was built from. `undefined` for synthesized
   * rows (`kind: 'group'` or any fabricated row). */
  readonly sourceIndex?: number;

  /** The id of the render row this one nests beneath — a group header or tree parent.
   * `undefined` for a top-level row. Opaque: never parse it apart. */
  readonly parentId?: RowId;

  // See docs/adr/0022-render-row-cell-values.md.
  /** The resolved value per column, keyed by declared column id. Values are raw and ignore
   * column visibility/order — format with a pipe. */
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

  /** Consumer-registered side-channel data, keyed by `ColumnMetaKey<T>` identity; never read
   * by the engine. Read via `readColumnMeta()`, written via `metadata()`. */
  meta?: ReadonlyMap<ColumnMetaKey<unknown>, unknown>;
}

/** Author-facing column shape for `createTable()`'s `columns` config and `setColumns()`. Only
 * `id` is required — `accessor`, `visible`, `order` and `label` default to `(row) => row[id]`,
 * `true`, the array index, and `id`; resolved to a full `ColumnDef` at construction. */
export type ColumnDefInput<TRow = unknown, TId extends string = string> = Pick<
  ColumnDef<TRow, TId>,
  'id'
> &
  Partial<Omit<ColumnDef<TRow, TId>, 'id'>>;

// Type-only, never assigned at runtime: `createColumns()` receives declarations only from its
// own `col()` builder, so nothing needs to ask "is this mine?" of an unknown value.
declare const COLUMN_DECL: unique symbol;

/** A single column declaration minted by `createColumns()`'s `col()` builder. Not hand-built —
 * the brand member has no runtime counterpart. */
export interface ColumnDecl<TRow, K extends string, V> {
  readonly [COLUMN_DECL]: true;
  readonly id: K;
  readonly label?: string;
  readonly visible?: boolean;
  readonly accessor?: (row: TRow) => V;
}

/** Presentation-only column options — no id, no value source. */
export interface Presentation {
  readonly label?: string;
  readonly visible?: boolean;
}

/** Builder handed to `createColumns(data, build)`'s `build` callback. */
export interface ColumnBuilder<TRow> {
  <K extends string, V>(
    id: K,
    opts: Presentation & { accessor: (row: TRow) => V }
  ): ColumnDecl<TRow, K, V>;
  <K extends string>(
    id: K,
    opts?: Presentation
  ): ColumnDecl<TRow, K, K extends keyof TRow ? TRow[K] : unknown>;
  /** Re-declares `decl` under a new id/accessor/presentation. Returns a fresh declaration —
   * `decl` itself is untouched. */
  from<K extends string, V>(
    decl: ColumnDecl<TRow, string, unknown>,
    opts: Presentation & { id?: K; accessor?: (row: TRow) => V }
  ): ColumnDecl<TRow, K, V>;
}

/** `createColumns()`'s return: the declared columns plus any rules their schema recorded. */
export interface ColumnSet<
  TRow,
  TCols extends readonly ColumnDecl<TRow, string, unknown>[],
> {
  readonly columns: TCols;
  readonly rules: readonly ColumnRule<TRow>[];
}

/** The declared column-id → value map a table's columns derive. */
export type ColumnValueMap = Record<string, unknown>;

/** The declared column-id union carried by a value map — `string` for the default
 * `Record<string, unknown>`. */
export type ColumnIdIn<TValues extends ColumnValueMap> = keyof TValues & string;

// Note: the `ColumnDecl` arm must run first — `ColumnDecl.accessor` is optional, so the
// plain-accessor arm below would otherwise match an accessor-less `ColumnDecl` and fall through
// to `TRow[id]`, losing the `V` resolved at the `col()` call site.
/** Maps each declared column id to its resolved value type: a `ColumnDecl`'s own `V`, else an
 * inferred `accessor` return, else `TRow[id]` (the engine's documented default accessor). */
export type ColumnValues<
  TRow,
  TCols extends readonly ColumnDefInput<any, string>[],
> = {
  [C in TCols[number] as C['id']]: C extends ColumnDecl<any, string, infer V>
    ? V
    : C extends { accessor: (row: any) => infer V }
      ? V
      : C['id'] extends keyof TRow
        ? TRow[C['id']]
        : unknown;
};

export type GroupingUpdater<TRow> = (grouping: string[]) => string[];

/** A group's raw clustering value, opaque to consumers. */
export type GroupKey = unknown;

/** What `when` judges: a built cluster's own contents, before admission is decided. */
export interface ClusterSummary<TRow> {
  readonly columnId: string;
  readonly key: GroupKey;
  readonly rows: readonly TRow[];
}

/** A cluster after admission is decided. `admitted: false` ⇒ it emits flat, with no header. */
export interface GroupSummary<TRow> extends ClusterSummary<TRow> {
  readonly admitted: boolean;
}

export type GroupWhen<TRow> = (cluster: ClusterSummary<TRow>) => boolean;

/** Compares two sibling clusters from the same level, after admission is decided — see
 * `GroupSummary.admitted`. */
export type GroupOrder<TRow> = (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number;

export type DerivedDict = Record<string, Signal<unknown>>;

// Note: the `any` below is an `infer` slot, not a constraint slot — it does not widen the
// result. Mutating methods are statically indistinguishable from queries, so they stay.
/** The derive block's parameter — every `WritableView` loses `.update`; everything else
 * passes through unchanged. */
export type ReadonlyStore<S> = {
  readonly [K in keyof S]: S[K] extends WritableView<infer T, any> ? Signal<T> : S[K];
};

// Note: `TCols` is what a call site infers; `TValues` is what downstream reads. Deriving at
// the config boundary keeps a `ColumnSet`'s declared id union inferring correctly — nothing
// infers a map from a `keyof` position, so a `TValues`-on-config shape would fall back to the
// constraint and lose the literal union.
/** Config accepted by `createTable()`: columns, trackBy, and optional injector. */
export interface TableConfig<
  TRow,
  TCols extends readonly ColumnDecl<TRow, string, unknown>[] = readonly ColumnDecl<
    TRow,
    string,
    unknown
  >[],
> {
  trackBy: TrackByConfig<TRow>;
  columns: ColumnSet<TRow, TCols>;
  injector?: Injector;
}

// The erased element type the engine folds at runtime — a dynamic-length list, not a
// per-position generic. Consumers never name this; `createTable()`'s per-arity overloads type
// each feature argument's `In`/`Out` individually.
export type AnyTableFeature = Feature<any, any>;

export type ColumnsUpdater<TRow, TId extends string = string> = (
  columns: ColumnDef<TRow, TId>[]
) => ColumnDef<TRow, TId>[];

/** Pure row transform. `ctx.trackBy` is supplied by `table.value.update(...)` so id-based
 * updaters (`removeRow`, `patchRow`) can resolve identity without a store reference. A raw
 * lambda `rows => rows.filter(...)` also satisfies this type — it just ignores `ctx`. */
export type RowUpdater<TRow> = (
  rows: TRow[],
  ctx: { trackBy: TrackByFn<TRow>; indexById: ReadonlyMap<RowId, number> }
) => TRow[];

/** Public surface of a store returned by `createTable()` — the contract consumers program
 * against. Never references engine types, so swapping the internal implementation is not a
 * breaking change. */
export interface TableStore<TRow, TValues extends ColumnValueMap = ColumnValueMap> {
  /** Read: the folded, rule-applied column list. Write: `.update(updater)` — e.g.
   * `table.columns.update(reorderColumns(ids))`. */
  readonly columns: WritableView<
    ColumnDef<TRow, ColumnIdIn<TValues>>[],
    ColumnsUpdater<TRow, ColumnIdIn<TValues>>
  >;
  readonly rows: Signal<TRow[]>;
  readonly renderRows: Signal<RenderRow<TRow>[]>;
  readonly trackBy: TrackByFn<TRow>;

  /** Maps a row's trackBy id to its position in `data()`; read-only. Feeds `RowUpdater` ctx
   * and editing features. */
  readonly indexById: Signal<ReadonlyMap<RowId, number>>;

  /** Row count feeding `aria-rowcount` on `ngpTable`; distinct from `renderRows().length`
   * under virtualization/pagination. Equals `rows().length` until a virtualization feature
   * overrides it. */
  readonly totalRowCount: Signal<number>;

  /** Read: the row data — the consumer's own signal, single source of truth. Write:
   * `.update(updater)` — e.g. `table.value.update(insertRow(row, { at: 0 }))`. */
  readonly value: WritableView<TRow[], RowUpdater<TRow>>;

  // Precedent: `FilterRule.__criterion` / `__row` (`engine/filters/types.ts`) use the same
  // phantom-property pattern.
  //
  // Note: `TValues` is otherwise unrecoverable — `columns` carries only `keyof TValues &
  // string`, and nothing infers a map from a `keyof`. Phantom, read by `ColumnValuesOf<S>`.
  readonly __columnValues?: TValues;
}
