import type { ResourceRef, Signal } from '@angular/core';
import { VISIBLE } from '../engine/columns';
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
export function visible<TRow, K extends string>(
  path: ColumnHandle<TRow, K>,
  visible: { when: (ctx: ColumnRuleContext<TRow>) => boolean }
): void {
  metadata(path, VISIBLE, visible.when);
}

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
export function visibleAsync<TRow, K extends string, TParams, TResult>(
  path: ColumnHandle<TRow, K>,
  opts: VisibleAsyncOpts<TRow, TParams, TResult>
): void {
  metadataAsync(path, VISIBLE, opts);
}
