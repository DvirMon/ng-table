import type { Signal, WritableSignal } from '@angular/core';
import type { ColumnMetaKey, ColumnSchema, ColumnsSchemaFn } from './column-schema.types';
import type { TableFeature } from '../engine/types';
import type { WritableView } from '../engine/writable-view';

export type RowId = string | number;

/**
 * Reactive row-data source handed to `createTable(data, ...)`. The consumer's
 * `WritableSignal<TRow[]>` is the single source of truth (D3/D4) — the pipeline reads it
 * directly via `computed()`, there is no internal copy to fall out of sync.
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
 * consumption. `kind: 'group'` rows are synthetic — no `TRow` backs them, hence `data:
 * null` — introduced by `withGrouping()`'s `_buildRenderRows` override.
 */
export type RowKind = 'row' | 'group';

export interface RenderRow<TRow> {
  readonly id: RowId;

  // `depth` is 0 for a normal `kind: 'row'`, and increments for each level of nesting.
  readonly depth: number;
  readonly kind: RowKind;
  readonly data: TRow | null;

  // Position in the final `renderRows()` array, assigned centrally after any feature's
  // `renderRows` builder runs (`engine/core.ts`) — never set by a builder itself. Feeds
  // `aria-rowindex` on `ngpTableRow` (ADR-0005), since a `<div>`-hosted grid loses the free
  // DOM-order inference native `<table>` gives for free.
  readonly index: number;

  // `aggregates` holds data for a `group` row's template, e.g. output of `withAggregation()`.
  readonly aggregates?: Record<string, unknown>;

  // Set only when `withExpansion()` is composed.
  readonly isExpanded?: boolean;

  // `hasChildren` is true for a `group` row that has at least one child.
  readonly hasChildren?: boolean;

  // Index into `data()` for the `TRow` this render row was built from, resolved by trackBy
  // id (`engine/core.ts`). `undefined` for synthesized rows (`kind: 'group'`, or any row a
  // feature's `renderRows` builder fabricates) — there is no `data()` entry to point to.
  readonly sourceIndex?: number;
}

export interface ColumnDef<TRow = unknown> {
  id: string;
  accessor: (row: TRow) => unknown;
  visible: boolean;
  order: number;
  label: string;

  // Feature-contributed fields, populated when the corresponding feature is registered.
  sortFn?: (a: TRow, b: TRow) => number;
  enableSorting?: boolean;
  aggregateFn?: (rows: TRow[]) => unknown;
  filterFn?: (value: unknown, filterValue: unknown) => boolean;
  enableFiltering?: boolean;

  // Consumer-registered side-channel data, keyed by `ColumnMetaKey<T>` identity — never
  // interpreted by the engine. Read via `readColumnMeta()`, written via `metadata()`
  // (`api/column-metadata.ts`).
  meta?: ReadonlyMap<ColumnMetaKey<unknown>, unknown>;
}

/**
 * Author-facing column shape, accepted by `createTable()`'s `columns` config and
 * `setColumns()`. `accessor`/`visible`/`order`/`label` are optional here and resolved to a
 * full `ColumnDef` at store construction — `accessor` defaults to `(row) => row[id]`,
 * `visible` defaults to `true`, `order` defaults to the column's index in the array,
 * `label` defaults to `id`. Only `id` is required. The resolved store state
 * (`store.columns()`) is always a full `ColumnDef[]`.
 */
export type ColumnDefInput<TRow = unknown> = Pick<ColumnDef<TRow>, 'id'> &
  Partial<Omit<ColumnDef<TRow>, 'id'>>;

// Opaque handle for a `createTable()` feature (`withSorting()`, `withGrouping()`, etc.) —
// consumers never construct this by hand, it's the return type of the feature functions
// the design system exports.
//
// Consequence: consumers must repeat `<TRow>` on every feature call
// (`withExpansion<Department>()`), since a feature is called before it receives the store,
// so its call site has no argument to infer from. The fix — `features: (t) => [...]`, where
// each feature takes the core as an argument — became possible once `@ngrx/signals` was
// dropped, and is deliberately deferred. See ADR-0003 and `docs/1-state/architecture.md`,
// "Rejected: inferring TRow into with-*() calls".
export type AnyTableFeature = TableFeature<any, any>;

export interface TableStoreConfig<
  TRow,
  Features extends readonly AnyTableFeature[] = []
> {
  trackBy: TrackByConfig<TRow>;
  columns: ColumnDefInput<TRow>[];
  columnsSchema?: ColumnsSchemaFn<TRow> | ColumnSchema<TRow>;
  features?: Features;
}

// Distributes a union of feature outputs into an intersection, so composing N features
// surfaces the union of everything each one contributes as a single flat type. Computed
// independently of the runtime fold, because `createTable()` folds a dynamic-length
// `features` array rather than passing them positionally.
type UnionToIntersection<Union> = (
  Union extends unknown ? (member: Union) => void : never
) extends (member: infer Intersection) => void
  ? Intersection
  : never;

// `members` is optional on `TableFeatureSpec`, so it must be inferred through an optional
// property and un-widened — a feature contributing none (e.g. one that only wires an
// `onInit`) yields `object`, which is inert inside the intersection below.
type FeatureMembers<Feature> = Feature extends (...args: any[]) => infer Spec
  ? Spec extends { members?: infer Members }
    ? NonNullable<Members>
    : object
  : never;

export type ComposedFeatureMembers<Features extends readonly AnyTableFeature[]> =
  UnionToIntersection<FeatureMembers<Features[number]>>;

/**
 * Public surface of a store returned by `createTable()`. This is the contract consumers
 * program against — it never references engine types, so swapping the internal
 * state-management implementation is not a breaking change. Validated 2026-08-11: the
 * `@ngrx/signals` → `composeTable()` swap landed with zero consumer diff (ADR-0003).
 */
export type ColumnsUpdater<TRow> = (
  columns: ColumnDef<TRow>[]
) => ColumnDef<TRow>[];

/**
 * Pure row transform. `ctx.trackBy` is supplied by `table.value.update(...)` (D30) so
 * id-based updaters (`removeRow`, `patchRow`) can resolve identity without needing a store
 * reference themselves — this is what keeps them tree-shakeable and unit-testable standalone
 * (D6). The raw-lambda form `rows => rows.filter(...)` satisfies this type too; it just
 * ignores `ctx`.
 */
export type RowUpdater<TRow> = (
  rows: TRow[],
  ctx: { trackBy: TrackByFn<TRow>; indexById: ReadonlyMap<RowId, number> }
) => TRow[];

export interface TableStore<TRow> {
  /** Read: the folded, rule-applied column list. Write: `.update(updater)` (D30) — e.g.
   * `table.columns.update(reorderColumns(ids))`. */
  readonly columns: WritableView<ColumnDef<TRow>[], ColumnsUpdater<TRow>>;
  readonly rows: Signal<TRow[]>;
  readonly renderRows: Signal<RenderRow<TRow>[]>;
  readonly trackBy: TrackByFn<TRow>;

  // Total row count feeding `aria-rowcount` on `ngpTable` (ADR-0005) — distinct from
  // `renderRows().length` once virtualization/pagination renders fewer rows than exist.
  // Equals `rows().length` until a virtualization feature overrides it.
  readonly totalRowCount: Signal<number>;

  /** Read: the row data (D3/D4 — the consumer's own signal, single source of truth). Write:
   * `.update(updater)` (D30) — e.g. `table.value.update(addRow(row, { at: 0 }))`. */
  readonly value: WritableView<TRow[], RowUpdater<TRow>>;
}
