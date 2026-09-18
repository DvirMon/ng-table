import type { Resource, Signal } from '@angular/core';
import type { GroupOrder, GroupWhen } from '../api/types';
import { assertPathIsCurrent } from './column-schema';
import type { ColumnHandle } from './column-schema.types';
import type { AnyGroupingRule, GroupingAsyncRule } from './grouping-schema.types';

/**
 * Declares one grouping level. `enable`, when passed, gates activation — returning `undefined`
 * (pending) makes the *whole* rule set abstain, not just this level. Omitting `enable` declares a
 * `when`-only rule that contributes no activation. Call order = level order: the Nth
 * `applyGrouping`/`applyGroupingAsync` call **that declares `enable`** in a schema fn becomes the
 * Nth entry in the resulting grouping array, when active.
 */
export function applyGrouping<TRow, K extends Extract<keyof TRow, string>>(
  path: ColumnHandle<TRow, K, AnyGroupingRule<TRow>>,
  opts: { enable?: () => boolean | undefined; when?: GroupWhen<TRow> }
): void {
  assertPathIsCurrent(path).record({
    kind: 'grouping',
    columnId: path.id,
    enable: opts.enable,
    when: opts.when,
  });
}

/**
 * Resource-backed counterpart — the rule owns fetching/re-querying. `onError` is required: an
 * errored resource must produce an explicit boolean, never silent abstention. `when` decides
 * admission for this column only, independent of `onSuccess`/`onError`'s level activation.
 */
export interface GroupingAsyncOpts<TRow, TParams, TResult> {
  params: () => TParams | undefined;
  factory: (params: Signal<TParams | undefined>) => Resource<TResult | undefined>;
  onSuccess: (result: TResult) => boolean;
  onError: (error: unknown) => boolean;
  when?: GroupWhen<TRow>;
}

export function applyGroupingAsync<
  TRow,
  K extends Extract<keyof TRow, string>,
  TParams,
  TResult
>(
  path: ColumnHandle<TRow, K, AnyGroupingRule<TRow>>,
  opts: GroupingAsyncOpts<TRow, TParams, TResult>
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
  // Same generic-erasure boundary documented in `column-schema.ts`'s `record()`
  // (`MetadataAsyncRule`'s contravariant `factory`/`onSuccess` positions defeat plain
  // assignability against the fixed `AnyGroupingRule<TRow>` union member) — `kind:
  // 'grouping-async'` never matches record()'s `MetadataAsyncRule` arm, so TS falls through to
  // the `TRule` arm here instead, which needs the same double-cast bridge.
  assertPathIsCurrent(path).record(rule as unknown as AnyGroupingRule<TRow>);
}

/**
 * Declares the sibling-ordering comparator for one grouping level. Unlike `applyGrouping`, this
 * does not activate or deactivate the level — a `GroupOrderRule` on a column with no active
 * level is a silent no-op. Comparator receives `GroupSummary` (post-admission, `admitted`
 * included), so it can place a dissolved cluster's flat rows anywhere among its siblings.
 */
export function applyGroupOrder<TRow, K extends Extract<keyof TRow, string>>(
  path: ColumnHandle<TRow, K, AnyGroupingRule<TRow>>,
  comparator: GroupOrder<TRow>
): void {
  assertPathIsCurrent(path).record({
    kind: 'group-order',
    columnId: path.id,
    comparator,
  });
}
