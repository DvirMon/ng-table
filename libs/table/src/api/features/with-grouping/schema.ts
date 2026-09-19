import type { Resource, Signal } from '@angular/core';
import type { GroupOrder, GroupWhen } from '../../types';
import {
  assertPathIsCurrent,
  createPathProxy,
  createRecorderSession,
  PATH_RECORDER,
  type PathRecorder,
} from '../../../schema/path-proxy';
import type {
  AnyGroupingRule,
  GroupingAsyncRule,
  GroupingHandle,
  GroupingPath,
  GroupingSchemaFn,
} from './types';

/**
 * Builds the structural `path` proxy handed to a grouping schema fn. The `get` trap fabricates a
 * `GroupingHandle<TRow, K>` for any string property accessed — it never reads real row data.
 * Shares the schema-declare-phase Proxy+recorder mechanism (`schema/path-proxy.ts`, key-space
 * agnostic) with `column-schema.ts`; the handle shape it produces is `GroupingHandle`, never
 * `ColumnHandle` (D7 — a different key space, and no import from `column-schema.ts` either).
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
 * the rules it recorded. Mirrors `column-schema.ts`'s `runColumnsSchemaFn`, keyed by row field
 * instead of declared column id.
 */
export function runGroupingSchemaFn<TRow>(
  fn: GroupingSchemaFn<TRow>
): readonly AnyGroupingRule<TRow>[] {
  const session = createRecorderSession<TRow, AnyGroupingRule<TRow>>();
  const path = buildGroupingPath<TRow>(session.recorder);
  fn(path);
  session.close();
  return session.rules;
}

/**
 * Declares one grouping level. `enable`, when passed, gates activation — returning `undefined`
 * (pending) makes the *whole* rule set abstain, not just this level. Omitting `enable` declares a
 * `when`-only rule that contributes no activation. Call order carries no meaning — nesting order
 * comes from `initial` (D2).
 */
export function applyGrouping<TRow, K extends Extract<keyof TRow, string>>(
  path: GroupingHandle<TRow, K>,
  opts: {
    enable?: () => boolean | undefined;
    when?: GroupWhen<TRow>;
  }
): void {
  assertPathIsCurrent<TRow, AnyGroupingRule<TRow>>(path).record({
    kind: 'grouping',
    columnId: path.id,
    enable: opts.enable,
    when: opts.when,
  });
}

/**
 * Declares the key-derivation for one grouping level (D9). Positional, like `applyGroupOrder` —
 * this is the only concern it carries. The extractor must return a primitive; the engine does not
 * defensively normalize, stringify or deep-compare keys (D7).
 */
export function applyGroupKey<TRow, K extends Extract<keyof TRow, string>>(
  path: GroupingHandle<TRow, K>,
  extractValue: (fieldValue: TRow[K]) => unknown
): void {
  assertPathIsCurrent<TRow, AnyGroupingRule<TRow>>(path).record({
    kind: 'grouping-key',
    columnId: path.id,
    extractValue: extractValue as (fieldValue: unknown) => unknown,
  });
}

/**
 * Resource-backed counterpart — the rule owns fetching/re-querying. `onError` is required: an
 * errored resource must produce an explicit boolean, never silent abstention. `when` decides
 * admission for this column only, independent of `onSuccess`/`onError`'s level activation.
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
  // Same generic-erasure boundary documented in `schema/path-proxy.ts`'s `record()`
  // (`MetadataAsyncRule`'s contravariant `factory`/`onSuccess` positions defeat plain
  // assignability against the fixed `AnyGroupingRule<TRow>` union member) — `kind:
  // 'grouping-async'` never matches record()'s `MetadataRule`/`MetadataAsyncRule` arm, so TS
  // falls through to the `TRule` arm here instead, which needs the same double-cast bridge.
  assertPathIsCurrent<TRow, AnyGroupingRule<TRow>>(path).record(
    rule as unknown as AnyGroupingRule<TRow>
  );
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
  assertPathIsCurrent<TRow, AnyGroupingRule<TRow>>(path).record({
    kind: 'group-order',
    columnId: path.id,
    comparator,
  });
}
