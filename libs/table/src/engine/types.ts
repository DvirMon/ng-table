import type { Signal } from '@angular/core';
import type {
  ColumnDef,
  ColumnDefInput,
  ColumnIdIn,
  ColumnsUpdater,
  ColumnValueMap,
  RenderRow,
  RowId,
  RowUpdater,
  TableDataInput,
  TrackByConfig,
  TrackByFn,
} from '../api/types';
import type { StageRule } from '../schema/stage-rules';
import type { ColumnRuleRegistry } from './columns';
import type { RowTransform } from './pipeline';
import type { RenderNodeTransform } from './render-stages';
import type { WritableView } from './writable-view';

/** Core config `composeTable()` needs. Resolved by `createTable()` from the public config. */
export interface TableEngineConfig<TRow> {
  columns: readonly ColumnDefInput<TRow>[];
  trackBy: TrackByConfig<TRow>;
  data: TableDataInput<TRow>;
}

/** Every stage's second argument. `parentOf` is `undefined` unless a feature contributes `parentLink`. */
export type StageContext<TRow> = {
  readonly parentOf?: (row: TRow) => RowId | null;
};

// Currently held only by the internally-spliced column-schema wiring — consumer feature
// factories instead receive the accumulating store typed as `Feature<In, Out>`'s `In`.
/** The engine handle internal features receive. */
export interface TableCore<TRow, TValues extends ColumnValueMap = ColumnValueMap> {
  /** Read: the folded, rule-applied columns. Write: `.update()` targets `baseColumns`, never the fold. */
  readonly columns: WritableView<
    ColumnDef<TRow, ColumnIdIn<TValues>>[],
    ColumnsUpdater<TRow, ColumnIdIn<TValues>>
  >;
  /**
   * Engine-internal only — the pre-fold declared columns `columns` overlays rules onto;
   * read-only here so a rule never observes its own output.
   */
  readonly baseColumns: Signal<ColumnDef<TRow, ColumnIdIn<TValues>>[]>;
  // Lazy `computed` reading the stage registry at evaluation time; the registry is complete
  // before any consumer can read it, so this and `renderRows` below are safe to close over
  // during composition.
  readonly rows: Signal<TRow[]>;
  /** The render-layer output every render stage chain produced, `index`/`sourceIndex` already stamped. */
  readonly renderRows: Signal<RenderRow<TRow>[]>;
  /** The visible columns of `columns`, in render order. */
  readonly renderColumns: Signal<ColumnDef<TRow, ColumnIdIn<TValues>>[]>;
  readonly trackBy: TrackByFn<TRow>;
  /** Maps a row's trackBy id to its position in `data()`. Feeds the removal-reconciliation diff. */
  readonly indexById: Signal<ReadonlyMap<RowId, number>>;
  /** Read: the consumer's row data, never copied. Write: `.update()` writes through, resolving `trackBy` for id-based updaters. */
  readonly value: WritableView<TRow[], RowUpdater<TRow>>;

  /** Phantom. `TValues` is otherwise unrecoverable: `columns` carries only
   * `keyof TValues & string`, and nothing infers a map from a `keyof`. Read by
   * `ColumnValuesOf<S>`. Precedent: `FilterRule.__criterion` / `__row`
   * (`engine/filters/types.ts:61-73`). */
  readonly __columnValues?: TValues;
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
   * `features` array order. Two features claiming the same anchor throws.
   */
  stages?: readonly StageRule<RowTransform<TRow>>[];

  /**
   * Render-node transforms over the pipeline output. Folded in the fixed order in
   * `engine/render-stages.ts` (`RENDER_ANCHORS`), never `features` array order. Two features
   * claiming the same anchor throws.
   */
  renderStages?: readonly StageRule<RenderNodeTransform<TRow>>[];

  // Accumulates rather than single-claim; why: docs/adr/0012-split-expansion-into-panel-and-tree.md.
  /**
   * Ids this feature considers expanded, exposed read-only for `flattenVisible`. Accumulates
   * by design — `withTree()` is its only contributor today.
   */
  expandedRows?: Signal<ReadonlySet<RowId>>;

  // Single-claim; why: docs/adr/0028-tree-parent-link-slot.md.
  /**
   * A row's parent id, or `null` for a root row; stages read it as `ctx.parentOf`. A second
   * feature contributing it throws.
   */
  parentLink?: (row: TRow) => RowId | null;

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
 * `string` when the shape has no `columns` member — a test double, or `Shape` itself. */
// Both `any`s are infer/wildcard slots, not `unknown`: `Updater`'s contravariant `columns` param
// and `ColumnDef`'s contravariant `accessor` param both reject `unknown` here. `Shape` fallback:
// docs/adr/0019-columns-path-keyed-by-declared-column-ids.md.
export type ColumnIdOf<S> = S extends {
  columns: WritableView<ColumnDef<any, infer I>[], any>;
}
  ? I
  : string;

/** Recovers the declared column-value map off the `__columnValues` phantom, mirroring
 * `ColumnIdOf`. Falls back to `ColumnValueMap` (not `never`) so a partial store or test
 * double still behaves like the default `string` id space. */
export type ColumnValuesOf<S> = S extends { readonly __columnValues?: infer V }
  ? V extends ColumnValueMap
    ? V
    : ColumnValueMap
  : ColumnValueMap;

/** A composable feature: a function of the store built so far. Row type recovered as `RowOf<In>`. */
export interface Feature<In extends Shape, Out extends object> {
  (input: In): TableFeatureSpec<RowOf<In>, Out>;
  /** Shown in collision messages after the argument position, e.g. `feature 3 (withComputed)`. */
  readonly displayName?: string;
}
