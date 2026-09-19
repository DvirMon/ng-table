import type { ResourceRef, Signal } from '@angular/core';
import { assertPathIsCurrent } from '../schema/path-proxy';
import type {
  ColumnHandle,
  ColumnMetaKey,
  ColumnRuleContext,
} from './types';
import type { ColumnDef } from '../api/types';

/**
 * Consumer-defined, non-participating side channel for column data — modeled on Signal
 * Forms' `createMetadataKey()`/`metadata()`/`field().metadata(key)`. Unlike
 * `applyVisible`/`applyVisibleAsync` (`columns-schema/rules.ts`), nothing here is consumed by the
 * table engine; it exists purely to be read back by the consumer's own code (e.g. a custom
 * `with-*()` feature). See `docs/2-columns/reference/column-metadata.md`.
 */

/**
 * Mints a unique typed key. Object identity is the actual key — call once per logical key and
 * share the returned value.
 */
export function createColumnMetaKey<T>(): ColumnMetaKey<T> {
  return { kind: 'column-meta-key' };
}

/**
 * Registers a metadata value for one column under `key`, called inside a `columnSchema()`
 * body alongside `applyVisible`/`applyVisibleAsync`. `logic` is a plain value or a closure
 * over the same `ColumnRuleContext<TRow>` those rules read — both resolve the same way,
 * discriminated at wiring time (`engine/columns-schema/wiring.ts`).
 *
 * Single-writer: a second `metadata()` call for the same `(column, key)` pair throws at
 * resolve time (`resolve.ts`'s `assertMetadataKeysAreUnique`) — no reducer/combine story.
 *
 * Erases `T` to `unknown` at the recording site, same rationale as `metadataAsync()` below:
 * `key`/`logic` are only ever read back together, still at their original type, inside
 * `wiring.ts`.
 */
export function metadata<TRow, K extends string, T>(
  path: ColumnHandle<TRow, K>,
  key: ColumnMetaKey<T>,
  logic: NoInfer<T> | ((ctx: ColumnRuleContext<TRow>) => NoInfer<T>)
): void {
  const recorder = assertPathIsCurrent(path);
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
 * `applyVisibleAsync()` (`columns-schema/rules.ts`) can write to the internal `VISIBLE` key
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
  }
): void {
  const recorder = assertPathIsCurrent(path);
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
  key: ColumnMetaKey<T>
): T | undefined {
  return column.meta?.get(key) as T | undefined;
}
