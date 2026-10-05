import type { ResourceRef, Signal } from '@angular/core';
import { recorderOf } from '../schema/path-proxy';
import type { ColumnHandle, ColumnMetaKey, ColumnRuleContext } from './types';
import type { ColumnDef } from '../api/types';

/**
 * Consumer-defined, non-participating side channel for column data — nothing here is consumed
 * by the table engine; it exists purely to be read back by the consumer's own code. See
 * `docs/2-columns/reference/column-metadata.md`.
 */

/**
 * Mints a unique typed key. Object identity is the actual key — call once per logical key and
 * share the returned value.
 */
export function createColumnMetaKey<T>(): ColumnMetaKey<T> {
  return { kind: 'column-meta-key' };
}

/**
 * Registers a metadata value for one column under `key`, called inside a
 * `columnSchema()` body alongside `visible()`/`visibleAsync()`.
 *
 * @remarks
 * `logic` is a plain value or a closure over `ColumnRuleContext<TRow>` —
 * both resolve the same way, at wiring time. A second call for the same
 * `(column, key)` pair throws (single-writer, no reducer/combine story).
 */
export function metadata<TRow, K extends string, T>(
  path: ColumnHandle<TRow, K>,
  key: ColumnMetaKey<T>,
  logic: NoInfer<T> | ((ctx: ColumnRuleContext<TRow>) => NoInfer<T>),
): void {
  const recorder = recorderOf(path);
  // `T` erases to `unknown` here — `key`/`logic` are read back together, still at their
  // original type, inside `wiring.ts`. Same rationale as `metadataAsync()`'s erasure below.
  recorder.record({
    kind: 'metadata',
    columnId: path.id,
    key,
    logic,
  });
}

/**
 * Resource-backed counterpart to `metadata()` — records a `MetadataAsyncRule` instead of a
 * plain `MetadataRule`. Not exported from `index.ts`: consumer metadata has no async story
 * yet (see `docs/2-columns/reference/column-metadata.md`), this exists solely so
 * `visibleAsync()` (`columns-schema/rules.ts`) can write to the internal `VISIBLE` key
 * through the same recorder `metadata()` uses.
 * @internal
 */
export function metadataAsync<TRow, K extends string, TParams, TResult, T>(
  path: ColumnHandle<TRow, K>,
  key: ColumnMetaKey<T>,
  opts: {
    params: (ctx: ColumnRuleContext<TRow>) => TParams | undefined;
    factory: (params: Signal<TParams | undefined>) => ResourceRef<TResult | undefined>;
    onSuccess: (result: TResult) => T;
    onError: (error: unknown) => T;
  },
): void {
  const recorder = recorderOf(path);
  recorder.record({
    kind: 'metadata-async',
    columnId: path.id,
    key,
    params: opts.params,
    factory: opts.factory,
    onSuccess: opts.onSuccess,
    onError: opts.onError,
  });
}

/**
 * Reads a registered metadata value back off a resolved `ColumnDef`. A free function, not a
 * `.metadata(key)` method — `ColumnDef` is a plain, flat interface everywhere else in the
 * engine (never a class/handle), unlike the per-slice `table.columns`/`table.value` write
 * members.
 */
export function readColumnMeta<TRow, T>(
  column: ColumnDef<TRow>,
  key: ColumnMetaKey<T>,
): T | undefined {
  return column.meta?.get(key) as T | undefined;
}
