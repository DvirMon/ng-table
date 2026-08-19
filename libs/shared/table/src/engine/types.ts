import type { Signal } from '@angular/core';
import type {
  ColumnDef,
  ColumnDefInput,
  ColumnsUpdater,
  RowUpdater,
  TableDataInput,
  TrackByConfig,
  TrackByFn,
} from '../api/types';
import type { ColumnRuleRegistry } from './columns';
import type { PipelineStages, RenderRowsBuilder } from './pipeline';
import type { WritableView } from './writable-view';

/** Core config `composeTable()` needs. Resolved by `createTable()` from the public config. */
export interface TableEngineConfig<TRow> {
  columns: ColumnDefInput<TRow>[];
  trackBy: TrackByConfig<TRow>;
  data: TableDataInput<TRow>;
}

/**
 * The slice of the store every feature can read, handed to feature factories as their
 * first argument. Fixed and feature-independent — a feature that needs *another
 * feature's* members reads the second argument instead.
 *
 * `rows` is the pipeline output, safe to close over during composition: it is a lazy
 * `computed` that reads the stage registry at evaluation time, and the registry is
 * complete before any consumer can read it.
 */
export interface TableCore<TRow> {
  /** Read: the folded, rule-applied column list. Write: `.update(updater)` targets the
   * underlying `baseColumns` — never the fold itself (D30). */
  readonly columns: WritableView<ColumnDef<TRow>[], ColumnsUpdater<TRow>>;
  /**
   * Engine-internal only: the pre-fold declared columns `columns` overlays rules onto.
   * Read-only here — `with-columns-schema` rule wiring reads against this (not the folded
   * `columns`) to avoid a rule observing its own output. Never assigned to publicly on
   * `TableStore`; writes go through `TableCore.columns.update(...)`.
   */
  readonly baseColumns: Signal<ColumnDef<TRow>[]>;
  readonly rows: Signal<TRow[]>;
  readonly trackBy: TrackByFn<TRow>;
  /** Read: the consumer's own row data (D3/D4 — table never copies it). Write:
   * `.update(updater)` writes through to that same signal, resolving `trackBy` internally
   * for id-based updaters (D30). */
  readonly value: WritableView<TRow[], RowUpdater<TRow>>;
}

/**
 * What a feature contributes. Features **declare** rather than mutate the store — the
 * return type is the whole contract, so a stage or render-row override can't be injected
 * by convention alone.
 */
export interface TableFeatureSpec<TRow, Members extends object = object> {
  /** Signals and methods merged onto the public store. */
  members?: Members;

  /**
   * Pure row transforms. The engine folds registered stages in the fixed order
   * `filter -> group -> sort -> expand`, never in `features` array order. Two features
   * claiming the same key is a composition error.
   */
  stages?: PipelineStages<TRow>;

  /** Builds `renderRows()` from the pipeline output. At most one feature may provide it. */
  renderRows?: RenderRowsBuilder<TRow>;

  /**
   * Rule entries this feature contributes to the `columns` fold (`foldColumnRules`). Additive
   * only — not claimed via `SlotRegistry`: two features contributing rules to the same column
   * both apply. Read by `composeTable()`'s `foldFeatures()` and concatenated onto the core's
   * `columnRules` registry.
   */
  columnRules?: ColumnRuleRegistry<TRow>;

  /** Runs after every feature is composed, inside the owner's injection context. */
  onInit?: () => void;
  onDestroy?: () => void;
}

/**
 * A composed feature. `composed` is the feature-to-feature seam: a stable reference to
 * the accumulating member object. Read at factory time it holds only earlier features
 * (so `features` array order matters); read later — inside a method or computed — it
 * holds everything. Untyped by design; a feature author narrows it themselves.
 */
export type TableFeature<TRow, Members extends object = object> = (
  core: TableCore<TRow>,
  composed: Record<string, unknown>
) => TableFeatureSpec<TRow, Members>;
