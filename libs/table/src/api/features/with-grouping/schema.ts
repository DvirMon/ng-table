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

/**
 * Builds the structural `path` proxy handed to a grouping schema fn. The `get`
 * trap fabricates a `GroupingHandle<TRow, K>` for any string property
 * accessed — it never reads real row data.
 *
 * @remarks
 * Shares the schema-declare-phase Proxy+recorder mechanism
 * (`schema/path-proxy.ts`, key-space agnostic) with `columns-schema/schema.ts`;
 * the handle shape here is `GroupingHandle`, never `ColumnHandle` — this file
 * imports nothing from `columns-schema/`.
 */
function buildGroupingPath<TRow>(
  recorder: PathRecorder<TRow, AnyGroupingRule<TRow>>
): GroupingPath<TRow> {
  return createPathProxy(
    (id): GroupingHandle<TRow> => ({ id, [PATH_RECORDER]: recorder })
  ) as GroupingPath<TRow>;
}

/**
 * Runs a grouping schema fn once, synchronously, through a fresh recorder session and returns
 * the rules it recorded. Shares its body with `columns-schema/schema.ts`'s `runColumnsSchemaFn`
 * via `runRecordedSchema`, keyed by row field instead of declared column id.
 */
export function runGroupingSchemaFn<TRow>(
  fn: GroupingSchemaFn<TRow>
): readonly AnyGroupingRule<TRow>[] {
  return runRecordedSchema<TRow, AnyGroupingRule<TRow>, GroupingPath<TRow>>(
    (recorder) => buildGroupingPath<TRow>(recorder),
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
export function applyGrouping<TRow, K extends Extract<keyof TRow, string>>(
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

/**
 * Declares the key-derivation for one grouping level.
 *
 * @remarks
 * Positional, like `applyGroupOrder` — this is the only concern it carries.
 * The extractor must return a primitive; the engine does not defensively
 * normalize, stringify or deep-compare keys.
 */
export function applyGroupKey<TRow, K extends Extract<keyof TRow, string>>(
  path: GroupingHandle<TRow, K>,
  extractValue: (fieldValue: TRow[K]) => unknown
): void {
  recorderOf<TRow, AnyGroupingRule<TRow>>(path).record({
    kind: 'grouping-key',
    columnId: path.id,
    extractValue: extractValue as (fieldValue: unknown) => unknown,
  });
}

/**
 * Resource-backed grouping declaration — the rule owns fetching/re-querying.
 * `onError` is required so an errored resource always yields an explicit boolean, never silent
 * abstention; `when` gates admission for this column only.
 */
export interface GroupingAsyncOpts<TRow, K extends Extract<keyof TRow, string>, TParams, TResult> {
  params: () => TParams | undefined;
  factory: (params: Signal<TParams | undefined>) => Resource<TResult | undefined>;
  onSuccess: (result: TResult) => boolean;
  onError: (error: unknown) => boolean;
  when?: GroupWhen<TRow>;
}

export function applyGroupingAsync<TRow, K extends Extract<keyof TRow, string>, TParams, TResult>(
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

/**
 * Declares the sibling-ordering comparator for one grouping level. Unlike `applyGrouping`, this
 * does not activate or deactivate the level — a `GroupOrderRule` on a column with no active
 * level is a silent no-op. Comparator receives `GroupSummary` (post-admission, `admitted`
 * included), so it can place a dissolved cluster's flat rows anywhere among its siblings.
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
