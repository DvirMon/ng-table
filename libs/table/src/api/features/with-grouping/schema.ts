import type { Resource, Signal } from '@angular/core';
import type { GroupOrder, GroupWhen } from '../../types';
import {
  createPathProxy,
  PATH_RECORDER,
  recorderOf,
  type PathRecorder,
} from '../../../schema/path-proxy';
import { runRecordedSchema } from '../../../schema/run';
import type {
  AnyGroupingRule,
  GroupingAsyncRule,
  GroupingHandle,
  GroupingPath,
  GroupingSchemaFn,
} from './types';

// Builds the structural `path` proxy for a grouping schema fn — the `get` trap fabricates a
// `GroupingHandle` for any string property, never reading real row data. Shares the
// Proxy+recorder mechanism with `columns-schema/schema.ts`; imports nothing from it.
function buildGroupingPath<TRow, TId extends string>(
  recorder: PathRecorder<TRow, AnyGroupingRule<TRow>>
): GroupingPath<TRow, TId> {
  return createPathProxy(
    (id): GroupingHandle<TRow> => ({ id, [PATH_RECORDER]: recorder })
  ) as GroupingPath<TRow, TId>;
}

/**
 * Runs a grouping schema fn once, synchronously, through a fresh recorder session and returns
 * the rules it recorded. Shares its body with `columns-schema/schema.ts`'s `runColumnsSchemaFn`
 * via `runRecordedSchema`, keyed by declared column id.
 */
export function runGroupingSchemaFn<TRow, TId extends string>(
  fn: GroupingSchemaFn<TRow, TId>
): readonly AnyGroupingRule<TRow>[] {
  return runRecordedSchema<TRow, AnyGroupingRule<TRow>, GroupingPath<TRow, TId>>(
    (recorder) => buildGroupingPath<TRow, TId>(recorder),
    fn
  );
}

/**
 * Declares one grouping level.
 *
 * @remarks
 * `enable`, when passed, gates activation — returning `undefined` (pending)
 * makes the *whole* rule set abstain, not just this level. Omitting `enable`
 * declares a `when`-only rule that contributes no activation. Call order
 * carries no meaning; nesting order comes from `initial`.
 */
export function applyGrouping<TRow, K extends string>(
  path: GroupingHandle<TRow, K>,
  opts: {
    enable?: () => boolean | undefined;
    when?: GroupWhen<TRow>;
  }
): void {
  recorderOf<TRow, AnyGroupingRule<TRow>>(path).record({
    kind: 'grouping',
    columnId: path.id,
    enable: opts.enable,
    when: opts.when,
  });
}

// ADR-0025: bare name, same function. Both names stay exported until the migration contracts.
// Flagged per #133: this bare name sits beside the grouping store member `table.grouping` — no
// compile collision (module export vs. store property), but worth a second look if it reads
// badly in the barrel.
export { applyGrouping as grouping };

/**
 * Declares the key-derivation for one grouping level.
 *
 * @remarks
 * `extractValue` receives the column's own `accessor` output, not the raw row field. Note: it
 * must return a primitive — the engine does not normalize, stringify, or deep-compare keys.
 */
export function applyGroupKey<TRow, K extends string>(
  path: GroupingHandle<TRow, K>,
  extractValue: (value: unknown) => unknown
): void {
  recorderOf<TRow, AnyGroupingRule<TRow>>(path).record({
    kind: 'grouping-key',
    columnId: path.id,
    extractValue,
  });
}

// ADR-0025: bare name, same function. Both names stay exported until the migration contracts.
export { applyGroupKey as groupKey };

/**
 * Resource-backed grouping declaration — the rule owns fetching/re-querying.
 * `onError` is required so an errored resource always yields an explicit boolean, never silent
 * abstention; `when` gates admission for this column only.
 */
export interface GroupingAsyncOpts<TRow, K extends string, TParams, TResult> {
  params: () => TParams | undefined;
  factory: (params: Signal<TParams | undefined>) => Resource<TResult | undefined>;
  onSuccess: (result: TResult) => boolean;
  onError: (error: unknown) => boolean;
  when?: GroupWhen<TRow>;
}

/**
 * Declares an async grouping rule, backed by a `Resource`.
 *
 * @remarks
 * Admission for this column follows the resource's own lifecycle — `onSuccess`/`onError`
 * resolve pending/settled states to an explicit boolean; `when` gates it further.
 */
export function applyGroupingAsync<TRow, K extends string, TParams, TResult>(
  path: GroupingHandle<TRow, K>,
  opts: GroupingAsyncOpts<TRow, K, TParams, TResult>
): void {
  const rule: GroupingAsyncRule<TRow, TParams, TResult> = {
    kind: 'grouping-async',
    columnId: path.id,
    params: opts.params,
    factory: opts.factory,
    onSuccess: opts.onSuccess,
    onError: opts.onError,
    when: opts.when,
  };
  recorderOf<TRow, AnyGroupingRule<TRow>>(path).record(rule);
}

// ADR-0025: bare name, same function. Both names stay exported until the migration contracts.
export { applyGroupingAsync as groupingAsync };

/**
 * Declares the sibling-ordering comparator for one grouping level.
 *
 * @remarks
 * Note: a rule on a column with no active level is a silent no-op — this never activates or
 * deactivates a level, unlike `applyGrouping`. The comparator receives `GroupSummary`
 * (post-admission), so it can place a dissolved cluster's rows anywhere among siblings.
 */
export function applyGroupOrder<TRow, K extends string>(
  path: GroupingHandle<TRow, K>,
  comparator: GroupOrder<TRow>
): void {
  recorderOf<TRow, AnyGroupingRule<TRow>>(path).record({
    kind: 'group-order',
    columnId: path.id,
    comparator,
  });
}

// ADR-0025: bare name, same function. Both names stay exported until the migration contracts.
export { applyGroupOrder as groupOrder };

/**
 * Declares one column's aggregate — a summary value computed per cluster,
 * over that cluster's own leaves at every depth. Positional, like
 * `applyGroupOrder`/`applyGroupKey` — one concern, no options bag. Never
 * activates a level: a rule on a column with no active level is inert.
 */
export function applyAggregate<TRow, K extends string>(
  path: GroupingHandle<TRow, K>,
  aggregateFn: (rows: TRow[]) => unknown
): void {
  recorderOf<TRow, AnyGroupingRule<TRow>>(path).record({
    kind: 'grouping-aggregate',
    columnId: path.id,
    aggregateFn,
  });
}

// ADR-0025: bare name, same function. Both names stay exported until the migration contracts.
export { applyAggregate as aggregate };
