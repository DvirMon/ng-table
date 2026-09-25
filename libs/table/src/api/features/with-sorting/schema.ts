import {
  createPathProxy,
  PATH_RECORDER,
  recorderOf,
  type PathRecorder,
} from '../../../schema/path-proxy';
import { runRecordedSchema } from '../../../schema/run';
import type { ColumnValueMap } from '../../types';
import type {
  AnySortingRule,
  SortableOpts,
  SortingHandle,
  SortingPath,
  SortingSchemaFn,
  SortNullsOpts,
} from './types';

// Fabricates a `SortingHandle` for any string property; never reads row data.
// Mirrors `with-grouping/schema.ts`'s proxy shape but imports nothing from it.
function buildSortingPath<TRow, TValues extends ColumnValueMap>(
  recorder: PathRecorder<TRow, AnySortingRule<TRow>>
): SortingPath<TRow, TValues> {
  return createPathProxy(
    (id): SortingHandle<TRow> => ({ id, [PATH_RECORDER]: recorder })
  ) as SortingPath<TRow, TValues>;
}

/**
 * Runs a sorting schema fn once, synchronously, and returns the rules it
 * recorded.
 *
 * @remarks
 * The per-feature wrapper around the shared `runRecordedSchema` mechanism,
 * using a fresh recorder session each call.
 */
export function runSortingSchemaFn<TRow, TValues extends ColumnValueMap>(
  fn: SortingSchemaFn<TRow, TValues>
): readonly AnySortingRule<TRow>[] {
  return runRecordedSchema<TRow, AnySortingRule<TRow>, SortingPath<TRow, TValues>>(
    (recorder) => buildSortingPath<TRow, TValues>(recorder),
    fn
  );
}

/**
 * Declares this column's null/empty placement override.
 *
 * @remarks
 * Empty values land on one end regardless of sort direction — `order` picks
 * which end (default `'last'`). `emptyString: 'is-empty'` opts `''` into the
 * same treatment; by default `''` sorts as an ordinary string.
 */
export function sortNulls<TRow>(path: SortingHandle<TRow>, opts: SortNullsOpts): void {
  recorderOf<TRow, AnySortingRule<TRow>>(path).record({
    kind: 'sort-nulls',
    columnId: path.id,
    opts,
  });
}

/**
 * Declares this column's sort comparator.
 *
 * @remarks
 * Standard `Array.prototype.sort` semantics: negative if `a` precedes `b`,
 * positive if after, `0` if equal. A throwing comparator degrades to `0` for
 * that comparison and reports once per column per evaluation (ADR-0014).
 */
export function sortFn<TRow>(
  path: SortingHandle<TRow>,
  compare: (a: TRow, b: TRow) => number
): void {
  recorderOf<TRow, AnySortingRule<TRow>>(path).record({
    kind: 'sort-fn',
    columnId: path.id,
    comparator: compare,
  });
}

/**
 * Declares this column's sortability gate.
 *
 * @remarks
 * `enable` reads no row data, unlike grouping's paired `when`/`enable`
 * (ADR-0018). A throw degrades to `true` (still sortable) and reports once
 * per column per evaluation (ADR-0014).
 */
export function sortable<TRow>(path: SortingHandle<TRow>, opts: SortableOpts): void {
  recorderOf<TRow, AnySortingRule<TRow>>(path).record({
    kind: 'sortable',
    columnId: path.id,
    enable: opts.enable,
  });
}

/**
 * Types a reusable per-column sorting schema function.
 *
 * @remarks
 * Identity at runtime — call the result on a handle to apply it, e.g.
 * `money(path.total)`.
 *
 * @example
 * ```ts
 * const money = sortingSchema<Row>((col) => sortNulls(col, { order: 'last' }));
 * schema: (path) => {
 *   money(path.total);
 *   money(path.balance);
 * }
 * ```
 */
export function sortingSchema<TRow>(
  fn: (column: SortingHandle<TRow>) => void
): (column: SortingHandle<TRow>) => void {
  return fn;
}
