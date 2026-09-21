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

// Currently held only by the internally-spliced column-schema wiring — consumer feature
// factories instead receive the accumulating store typed as `Feature<In, Out>`'s `In`.
/** The engine handle internal features receive. */
export interface TableCore<TRow, TId extends string = string> {
  /** Read: the folded, rule-applied columns. Write: `.update()` targets `baseColumns`, never the fold. */
  readonly columns: WritableView<ColumnDef<TRow, TId>[], ColumnsUpdater<TRow, TId>>;
  /**
   * Engine-internal only — the pre-fold declared columns `columns` overlays rules onto;
   * read-only here so a rule never observes its own output.
   */
  readonly baseColumns: Signal<ColumnDef<TRow, TId>[]>;
  // Lazy `computed` reading the stage registry at evaluation time; the registry is complete
  // before any consumer can read it, so this and `renderRows` below are safe to close over
  // during composition.
  readonly rows: Signal<TRow[]>;
  /** The render-layer output every render stage chain produced, `index`/`sourceIndex` already stamped. */
  readonly renderRows: Signal<RenderRow<TRow>[]>;
  readonly trackBy: TrackByFn<TRow>;
  /** Maps a row's trackBy id to its position in `data()`. Feeds the removal-reconciliation diff. */
  readonly indexById: Signal<ReadonlyMap<RowId, number>>;
  /** Read: the consumer's row data, never copied. Write: `.update()` writes through, resolving `trackBy` for id-based updaters. */
  readonly value: WritableView<TRow[], RowUpdater<TRow>>;
}

/**
 * What a feature contributes — features declare rather than mutate the store; this return
 * type is the whole contract.
 */
export interface TableFeatureSpec<TRow, Members extends object = {}> {
  /** Signals and methods merged onto the public store. */
  members?: Members;

  /**
   * Pure row transforms, folded in the fixed pipeline order (`engine/pipeline.ts`), never in
   * `features` array order. Two features claiming the same key throws.
   */
  stages?: PipelineStages<TRow>;

  /**
   * Render-node transforms over the pipeline output. Folded in the fixed order in
   * `engine/render-stages.ts` (`RENDER_ORDER`), never `features` array order. Two features
   * claiming the same key throws.
   */
  renderStages?: RenderStages<TRow>;

  /**
   * Ids this feature currently considers expanded, exposed read-only for `flattenVisible`.
   * This slot accumulates by design rather than single-claim — `withTree()` is its only
   * contributor today. See ADR-0012.
   */
  expandedRows?: Signal<ReadonlySet<RowId>>;

  /**
   * Rule entries this feature contributes to the `columns` fold. Additive only — not claimed
   * via `SlotRegistry`, so two features touching the same column both apply.
   */
  columnRules?: ColumnRuleRegistry<TRow>;

  /** Runs after every feature is composed, inside the owner's injection context. */
  setup?: () => void;
  onDestroy?: () => void;
  /**
   * Called with ids that just left `data`. A feature storing `RowId`-keyed state declares this
   * and prunes its own — the engine never reaches into feature state. Fires for every removal,
   * including a full `data.set()` replacement.
   */
  onRowsRemoved?: (ids: readonly RowId[]) => void;
}

// `unknown`, not `any`: `Signal<TRow[]>` is assignable to `Signal<readonly unknown[]>`, and
// `RowOf` still infers through it.
export type Shape = { rows: Signal<readonly unknown[]> };
export type RowOf<S> = S extends { rows: Signal<readonly (infer R)[]> } ? R : never;

/** Recovers the declared column-id union from a store shape, mirroring `RowOf`. Falls back to
 * `string` when the shape has no `columns` member — a test double, or `Shape` itself (ADR-0019). */
// Both `any`s are `infer`/wildcard slots, not `unknown`: `Updater`'s contravariant `columns`
// param and `ColumnDef`'s contravariant `accessor` param both reject `unknown` in this position.
export type ColumnIdOf<S> = S extends {
  columns: WritableView<ColumnDef<any, infer I>[], any>;
}
  ? I
  : string;

/** A composable feature: a function of the store built so far. Row type recovered as `RowOf<In>`. */
export interface Feature<In extends Shape, Out extends object> {
  (input: In): TableFeatureSpec<RowOf<In>, Out>;
  /** Shown in collision messages after the argument position, e.g. `feature 3 (withComputed)`. */
  readonly displayName?: string;
}
