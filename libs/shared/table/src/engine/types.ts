import type { Signal } from '@angular/core';
import type {
  ColumnDef,
  ColumnDefInput,
  ColumnsUpdater,
  RenderRow,
  RowId,
  RowUpdater,
  TableDataInput,
  TrackByConfig,
  TrackByFn,
} from '../api/types';
import type { ColumnRuleRegistry } from './columns';
import type { PipelineStages } from './pipeline';
import type { RenderStages } from './render-stages';
import type { WritableView } from './writable-view';

/** Core config `composeTable()` needs. Resolved by `createTable()` from the public config. */
export interface TableEngineConfig<TRow> {
  columns: ColumnDefInput<TRow>[];
  trackBy: TrackByConfig<TRow>;
  data: TableDataInput<TRow>;
}

/**
 * The engine handle internal features receive — no longer handed to consumer feature
 * factories, which instead receive the accumulating store typed as `Feature<In, Out>`'s
 * `In`. Currently held only by the internally-spliced column-schema wiring (D25, ADR-0010).
 *
 * `rows` is the pipeline output, safe to close over during composition: it is a lazy
 * `computed` that reads the stage registry at evaluation time, and the registry is
 * complete before any consumer can read it.
 */
export interface TableCore<TRow> {
  /** Read: the folded, rule-applied column list. Write: `.update(updater)` targets the
   * underlying `baseColumns` — never the fold itself. */
  readonly columns: WritableView<ColumnDef<TRow>[], ColumnsUpdater<TRow>>;
  /**
   * Engine-internal only: the pre-fold declared columns `columns` overlays rules onto.
   * Read-only here — `wireColumnsSchemaAsync` rule wiring reads against this (not the folded
   * `columns`) to avoid a rule observing its own output. Never assigned to publicly on
   * `TableStore`; writes go through `TableCore.columns.update(...)`.
   */
  readonly baseColumns: Signal<ColumnDef<TRow>[]>;
  readonly rows: Signal<TRow[]>;
  /** The render-layer output every render stage chain produced, `index`/`sourceIndex` already
   * stamped. Same lazy-computed safety as `rows`: reading it from a member function or
   * `computed()` sees the complete stage registry. */
  readonly renderRows: Signal<RenderRow<TRow>[]>;
  readonly trackBy: TrackByFn<TRow>;
  /** Maps a row's trackBy id to its position in `data()`. Also exposed publicly on
   * `TableStore` (D25). Feeds the removal-reconciliation effect (ADR-0006) so it can diff
   * ids without recomputing them a second time. */
  readonly indexById: Signal<ReadonlyMap<RowId, number>>;
  /** Read: the consumer's own row data — the table never copies it. Write:
   * `.update(updater)` writes through to that same signal, resolving `trackBy` internally
   * for id-based updaters. */
  readonly value: WritableView<TRow[], RowUpdater<TRow>>;
}

/**
 * What a feature contributes. Features **declare** rather than mutate the store — the
 * return type is the whole contract, so a stage or render-row override can't be injected
 * by convention alone.
 */
export interface TableFeatureSpec<TRow, Members extends object = {}> {
  /** Signals and methods merged onto the public store. */
  members?: Members;

  /**
   * Pure row transforms. The engine folds registered stages in the fixed order
   * `filter -> group -> sort -> expand`, never in `features` array order. Two features
   * claiming the same key is a composition error.
   */
  stages?: PipelineStages<TRow>;

  /**
   * Render-row transforms over the pipeline output, once wrapped as `RenderRow[]`. The engine
   * folds registered stages in the fixed order `group -> tree -> paginate` (`RENDER_ORDER`),
   * never in `features` array order. Two features claiming the same key is a composition error
   * (ADR-0011).
   */
  renderStages?: RenderStages<TRow>;

  /**
   * Rule entries this feature contributes to the `columns` fold (`foldColumnRules`). Additive
   * only — not claimed via `SlotRegistry`: two features contributing rules to the same column
   * both apply. Read by `composeTable()`'s `foldFeatures()` and concatenated onto the core's
   * `columnRules` registry.
   */
  columnRules?: ColumnRuleRegistry<TRow>;

  /** Runs after every feature is composed, inside the owner's injection context. */
  setup?: () => void;
  onDestroy?: () => void;
  /** Called with ids that just left `data` (ADR-0006). A feature storing `RowId`-keyed state
   * declares this and prunes its own state — the engine never reaches into feature state
   * itself. Fires for every removal, including a full `data.set(...)` replacement. */
  onRowsRemoved?: (ids: readonly RowId[]) => void;
}

// `unknown`, not `any`: Signal<TRow[]> is assignable to Signal<readonly unknown[]> and RowOf
// still infers through it (review finding 9).
export type Shape = { rows: Signal<readonly unknown[]> };
export type RowOf<S> = S extends { rows: Signal<readonly (infer R)[]> } ? R : never;

/** A composable feature: a function of the store built so far. Row type recovered as `RowOf<In>`. */
export interface Feature<In extends Shape, Out extends object> {
  (input: In): TableFeatureSpec<RowOf<In>, Out>;
}
