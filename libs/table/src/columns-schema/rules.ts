import type { ResourceRef, Signal } from '@angular/core';
import { SORT_NULLS, VISIBLE } from '../engine/columns';
import { metadata, metadataAsync } from './metadata';
import type { ColumnHandle, ColumnRuleContext } from './types';

/**
 * Reactive show/hide rule. Static visibility never goes through the schema
 * — set `visible` directly on the `columns` array literal instead.
 *
 * Convenience wrapper over `metadata()` writing to the internal `VISIBLE` key
 * (`engine/columns.ts`). Multiple `visible()` calls on the same column AND-combine
 * (`VISIBLE` is exempted from `metadata()`'s single-writer rule — see
 * `docs/2-columns/reference/column-metadata.md`).
 */
export function applyVisible<TRow, K extends string>(
  path: ColumnHandle<TRow, K>,
  visible: { when: (ctx: ColumnRuleContext<TRow>) => boolean }
): void {
  metadata(path, VISIBLE, visible.when);
}

// ADR-0025: bare name, same function. Both names stay exported until the migration contracts.
export { applyVisible as visible };

/**
 * Async show/hide rule. On loader error, `onError` decides the resulting `visible` —
 * required, since silently holding the last-resolved value on an unhandled error can leave a
 * permission-governed column visible when it shouldn't be.
 */
export interface VisibleAsyncOpts<TRow, TParams, TResult> {
  params: (ctx: ColumnRuleContext<TRow>) => TParams | undefined;
  factory: (params: Signal<TParams | undefined>) => ResourceRef<TResult | undefined>;
  onSuccess: (result: TResult) => boolean;
  onError: (error: unknown) => boolean;
}

/**
 * Convenience wrapper over `metadataAsync()` writing to `VISIBLE` — the resource-backed
 * counterpart to `visible()` above.
 */
export function applyVisibleAsync<TRow, K extends string, TParams, TResult>(
  path: ColumnHandle<TRow, K>,
  opts: VisibleAsyncOpts<TRow, TParams, TResult>
): void {
  metadataAsync(path, VISIBLE, opts);
}

// ADR-0025: bare name, same function. Both names stay exported until the migration contracts.
export { applyVisibleAsync as visibleAsync };

export interface SortNullsOpts {
  /** Which end empty values land on regardless of sort direction. Default `'last'`. */
  order?: 'first' | 'last';
  /** Opt `''` into the empty branch. By default `''` sorts as a normal string value. */
  emptyString?: 'is-empty';
}

/**
 * Per-column override of `withSorting()`'s null/empty placement. Convenience wrapper over
 * `metadata()` writing to the internal `SORT_NULLS` key (`engine/columns.ts`), mirroring
 * `visible()` above. Single-writer, unlike `VISIBLE` — a second `sortNulls()` call
 * on the same column throws at resolve time.
 */
export function applySortNulls<TRow, K extends string>(
  path: ColumnHandle<TRow, K>,
  opts: SortNullsOpts
): void {
  metadata(path, SORT_NULLS, opts);
}

// ADR-0025: bare name, same function. Both names stay exported until the migration contracts.
export { applySortNulls as sortNulls };
