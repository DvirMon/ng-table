import type { ColumnIdIn, ColumnValueMap } from '../../types';
import { PATH_RECORDER, type PathRecorder } from '../../../schema/path-proxy';

/** One `sortNulls(path.x, opts)` declaration — this column's null/empty placement
 *  override, independent of sort direction and the comparator. */
export interface SortNullsRule {
  readonly kind: 'sort-nulls';
  readonly columnId: string;
  readonly opts: SortNullsOpts;
}

/** One `sortFn(path.x, compare)` declaration — a comparator overriding the
 *  built-in string/number/date auto-detection for this column. */
export interface SortFnRule<TRow = unknown> {
  readonly kind: 'sort-fn';
  readonly columnId: string;
  readonly comparator: (a: TRow, b: TRow) => number;
}

/** One `sortable(path.x, { enable })` declaration — a gate deciding whether the
 *  column responds to `toggleSort()`; reads no row data. */
export interface SortableRule {
  readonly kind: 'sortable';
  readonly columnId: string;
  readonly enable: () => boolean;
}

export type AnySortingRule<TRow> = SortNullsRule | SortFnRule<TRow> | SortableRule;

export interface SortNullsOpts {
  /** Which end empty values land on regardless of sort direction. Default `'last'`. */
  order?: 'first' | 'last';
  /** Opt `''` into the empty branch. By default `''` sorts as a normal string value. */
  emptyString?: 'is-empty';
}

export interface SortableOpts {
  /** Gate deciding whether a column accepts sort toggles; reads no row data. */
  // See ADR-0018 (the `enable`/`when` naming split).
  enable: () => boolean;
}

/** Handle fabricated by `SortingPath`'s `get` trap for one declared column id. */
// Same recorder shape as `GroupingHandle` (`schema/path-proxy.ts` is key-space agnostic),
// but records `AnySortingRule`, not `AnyGroupingRule`.
export interface SortingHandle<TRow, K extends string = string, V = unknown> {
  readonly id: K;
  /** @internal — phantom carrying the column's resolved value type. */
  readonly __value?: V;
  /** @internal */
  readonly [PATH_RECORDER]: PathRecorder<TRow, AnySortingRule<TRow>>;
}

/** Structural `path` proxy for a sorting schema fn — a property access fabricates
 *  a `SortingHandle` per declared column id, typed to that column's resolved value. */
// Mirrors `FiltersPath` (`with-filtering/types.ts`).
export type SortingPath<TRow, TValues extends ColumnValueMap> = {
  readonly [K in ColumnIdIn<TValues>]: SortingHandle<TRow, K, TValues[K]>;
};

/** Schema fn passed as `WithSortingConfig.schema`. */
export type SortingSchemaFn<TRow, TValues extends ColumnValueMap> = (
  path: SortingPath<TRow, TValues>
) => void;
