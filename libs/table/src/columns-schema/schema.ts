import {
  type ColumnHandle,
  type ColumnRule,
  type ColumnSchema,
  type ColumnsPath,
  type ColumnsSchemaFn,
} from './types';
import {
  createPathProxy,
  createRecorderSession,
  PATH_RECORDER,
  type PathRecorder,
} from '../schema/path-proxy';

export { createRecorderSession, assertPathIsCurrent } from '../schema/path-proxy';

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
 * Runs a schema fn once, synchronously, through a fresh recorder session and
 * returns the rules it recorded. Shared by `columnSchema()` and
 * `resolveColumnsConfig()`'s inline-fn normalization, so both paths compile
 * to the same internal `ColumnRule[]` shape.
 */
export function runColumnsSchemaFn<TRow, TId extends string, TRule = ColumnRule<TRow>>(
  fn: (path: ColumnsPath<TRow, TId, TRule>) => void
): readonly TRule[] {
  const session = createRecorderSession<TRow, TRule>();
  const path = buildColumnsPath<TRow, TId, TRule>(session.recorder);
  fn(path);
  session.close();
  return session.rules;
}

/**
 * Standalone reuse form of a column schema. Runs `fn` once, eagerly, at call
 * time — no injection context available here, so `apply*` calls only record
 * rules; the store wires the actual reactivity at construction
 * (`wireColumnsSchemaAsync`).
 *
 * Does NOT validate `columnId`s against a `columns` array — `columns` isn't
 * known at this call site. That check happens in `resolveColumnsConfig()`.
 * `TId` defaults to `string` since a standalone schema isn't tied to one table's declared
 * columns — the same validation runs regardless once it's attached via `columnsSchema`/`schema`.
 */
export function columnSchema<TRow, TId extends string = string>(
  fn: ColumnsSchemaFn<TRow, TId>
): ColumnSchema<TRow> {
  return {
    kind: 'column-schema',
    rules: runColumnsSchemaFn(fn),
  };
}
