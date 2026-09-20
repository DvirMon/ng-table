import {
  type ColumnHandle,
  type ColumnRule,
  type ColumnSchema,
  type ColumnsPath,
  type ColumnsSchemaFn,
} from './types';
import { createPathProxy, PATH_RECORDER, type PathRecorder } from '../schema/path-proxy';
import { runRecordedSchema } from '../schema/run';

export { createRecorderSession, recorderOf } from '../schema/path-proxy';

/**
 * Builds the structural `path` proxy handed to a schema fn. The `get` trap
 * fabricates a `ColumnHandle<TRow, K, TRule>` for any string property accessed —
 * it never reads real column data.
 */
export function buildColumnsPath<TRow, TId extends string, TRule = ColumnRule<TRow>>(
  recorder: PathRecorder<TRow, TRule>
): ColumnsPath<TRow, TId, TRule> {
  return createPathProxy(
    (id): ColumnHandle<TRow, string, TRule> => ({ id, [PATH_RECORDER]: recorder })
  ) as ColumnsPath<TRow, TId, TRule>;
}

/**
 * Thin wrapper over `runRecordedSchema()`, fixing the columns key space via
 * `buildColumnsPath`. Shared by `columnSchema()` and
 * `resolveColumnsConfig()`'s inline-fn normalization, so both paths compile
 * to the same internal `ColumnRule[]` shape.
 */
export function runColumnsSchemaFn<TRow, TId extends string, TRule = ColumnRule<TRow>>(
  fn: (path: ColumnsPath<TRow, TId, TRule>) => void
): readonly TRule[] {
  return runRecordedSchema<TRow, TRule, ColumnsPath<TRow, TId, TRule>>(
    (recorder) => buildColumnsPath<TRow, TId, TRule>(recorder),
    fn
  );
}

/**
 * Standalone reuse form of a column schema — runs `fn` once, eagerly, at call time.
 *
 * @remarks
 * No injection context here, so `apply*` calls only record rules; the store wires the actual
 * reactivity at construction (`wireColumnsSchemaAsync`). Does not validate `columnId`s against
 * a `columns` array — that check happens in `resolveColumnsConfig()` once this schema is
 * attached.
 */
export function columnSchema<TRow, TId extends string = string>(
  fn: ColumnsSchemaFn<TRow, TId>
): ColumnSchema<TRow> {
  return {
    kind: 'column-schema',
    rules: runColumnsSchemaFn(fn),
  };
}
