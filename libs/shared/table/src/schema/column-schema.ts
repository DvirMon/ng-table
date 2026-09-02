import {
  COLUMN_RECORDER,
  type ColumnHandle,
  type ColumnRule,
  type ColumnSchema,
  type ColumnSchemaRecorder,
  type ColumnsPath,
  type ColumnsSchemaFn,
  type MetadataAsyncRule,
  type MetadataRule,
} from './column-schema.types';

/**
 * Recorder session for one schema-fn execution. Tracks whether the fn's
 * synchronous run has finished, so `assertPathIsCurrent` can reject a
 * `ColumnHandle` stashed and reused after the fact (e.g. inside a later
 * async callback) — mirrors Signal Forms' guard against stale field paths.
 */
function createRecorderSession<TRow>(): {
  recorder: ColumnSchemaRecorder<TRow>;
  rules: ColumnRule<TRow>[];
  close(): void;
  assertOpen(): void;
} {
  const rules: ColumnRule<TRow>[] = [];
  let isOpen = true;

  return {
    recorder: {
      record<TParams, TResult, T>(
        rule: MetadataRule<TRow, T> | MetadataAsyncRule<TRow, TParams, TResult, T>
      ): void {
        assertOpen();
        // Sole generic-erasure boundary (mirrors create-table.ts's documented composition
        // boundary): `TParams`/`TResult`/`T` only ever round-trip through the rule's own `key`
        // object identity downstream (`wiring.ts`), never re-derived from this array's static
        // `ColumnRule<TRow>` type, so collapsing them to `unknown` here is sound in practice
        // even though TS can't prove it structurally at this one storage step.
        rules.push(rule as ColumnRule<TRow>);
      },
    },
    rules,
    close(): void {
      isOpen = false;
    },
    assertOpen,
  };

  function assertOpen(): void {
    if (!isOpen) {
      throw new Error(
        '[columnsSchema] A ColumnHandle was used outside its schema function\'s ' +
          'synchronous execution. Handles are only valid for apply* calls made ' +
          'directly inside the schemaFn passed to columnSchema()/columnsSchema.'
      );
    }
  }
}

/**
 * Rejects a `ColumnHandle` used after the recorder session that produced it
 * has closed. Every `apply*` function must call this before recording.
 */
export function assertPathIsCurrent<TRow>(
  handle: ColumnHandle<TRow>
): ColumnSchemaRecorder<TRow> {
  const recorder = handle[COLUMN_RECORDER];
  // Recorder.record() itself throws if the session already closed — routing
  // through it here keeps the "current" check in one place.
  return recorder;
}

/**
 * Builds the structural `path` proxy handed to a schema fn. The `get` trap
 * fabricates a `ColumnHandle<TRow, K>` for any string property accessed —
 * it never reads real column data (same design as Signal Forms'
 * `FieldPathNode`).
 */
export function buildColumnsPath<TRow>(
  recorder: ColumnSchemaRecorder<TRow>
): ColumnsPath<TRow> {
  const handleCache = new Map<string, ColumnHandle<TRow>>();

  return new Proxy({} as ColumnsPath<TRow>, {
    get(_target, property): ColumnHandle<TRow> | undefined {
      if (typeof property !== 'string') {
        return undefined;
      }
      const cached = handleCache.get(property);
      if (cached) {
        return cached;
      }
      const handle: ColumnHandle<TRow> = {
        id: property as Extract<keyof TRow, string>,
        [COLUMN_RECORDER]: recorder,
      };
      handleCache.set(property, handle);
      return handle;
    },
  });
}

/**
 * Runs a schema fn once, synchronously, through a fresh recorder session and
 * returns the rules it recorded. Shared by `columnSchema()` and
 * `resolveColumnsConfig()`'s inline-fn normalization, so both paths compile
 * to the same internal `ColumnRule[]` shape.
 */
export function runColumnsSchemaFn<TRow>(
  fn: ColumnsSchemaFn<TRow>
): readonly ColumnRule<TRow>[] {
  const session = createRecorderSession<TRow>();
  const path = buildColumnsPath(session.recorder);
  fn(path);
  session.close();
  return session.rules;
}

/**
 * Standalone reuse form of a column schema, mirroring Signal Forms'
 * `schema<T>(fn)`. Runs `fn` once, eagerly, at call time — no injection
 * context available here, so `apply*` calls only record rules; the store
 * wires the actual reactivity at construction (`withColumnsSchemaAsync`).
 *
 * Does NOT validate `columnId`s against a `columns` array — `columns` isn't
 * known at this call site. That check happens in `resolveColumnsConfig()`.
 */
export function columnSchema<TRow>(fn: ColumnsSchemaFn<TRow>): ColumnSchema<TRow> {
  return {
    kind: 'column-schema',
    rules: runColumnsSchemaFn(fn),
  };
}
