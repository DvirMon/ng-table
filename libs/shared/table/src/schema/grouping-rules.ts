import type { Resource, Signal } from '@angular/core';
import { assertPathIsCurrent } from './column-schema';
import type { ColumnHandle } from './column-schema.types';
import type { AnyGroupingRule, GroupingAsyncRule } from './grouping-schema.types';

/**
 * Declares one grouping level, gated by `when`. `when` returning `undefined` (pending) makes
 * the *whole* rule set abstain — not just this level. Call order = level order: the Nth
 * `applyGrouping`/`applyGroupingAsync` call in a schema fn becomes the Nth entry in the
 * resulting grouping array, when active.
 */
export function applyGrouping<TRow, K extends Extract<keyof TRow, string>>(
  path: ColumnHandle<TRow, K, AnyGroupingRule<TRow>>,
  opts: { when: () => boolean | undefined }
): void {
  assertPathIsCurrent(path).record({ kind: 'grouping', columnId: path.id, when: opts.when });
}

/**
 * Resource-backed counterpart — the rule owns fetching/re-querying. `onError` is required: an
 * errored resource must produce an explicit boolean, never silent abstention.
 */
export interface GroupingAsyncOpts<TParams, TResult> {
  params: () => TParams | undefined;
  factory: (params: Signal<TParams | undefined>) => Resource<TResult | undefined>;
  onSuccess: (result: TResult) => boolean;
  onError: (error: unknown) => boolean;
}

export function applyGroupingAsync<
  TRow,
  K extends Extract<keyof TRow, string>,
  TParams,
  TResult
>(
  path: ColumnHandle<TRow, K, AnyGroupingRule<TRow>>,
  opts: GroupingAsyncOpts<TParams, TResult>
): void {
  const rule: GroupingAsyncRule<TRow, TParams, TResult> = {
    kind: 'grouping-async',
    columnId: path.id,
    params: opts.params,
    factory: opts.factory,
    onSuccess: opts.onSuccess,
    onError: opts.onError,
  };
  // Same generic-erasure boundary documented in `column-schema.ts`'s `record()`
  // (`MetadataAsyncRule`'s contravariant `factory`/`onSuccess` positions defeat plain
  // assignability against the fixed `AnyGroupingRule<TRow>` union member) — `kind:
  // 'grouping-async'` never matches record()'s `MetadataAsyncRule` arm, so TS falls through to
  // the `TRule` arm here instead, which needs the same double-cast bridge.
  assertPathIsCurrent(path).record(rule as unknown as AnyGroupingRule<TRow>);
}
