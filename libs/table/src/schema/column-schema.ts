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
 * async callback).
 *
 * Generic on `TRule`, defaulting to `ColumnRule<TRow>` — see `ColumnSchemaRecorder`'s doc for
 * why the default keeps every existing call site source-compatible. Exported so
 * `schema/grouping-rules.ts` can build its own (differently-keyed) path proxy off the same
 * session mechanism without duplicating it — the session itself is key-space agnostic.
 */
export function createRecorderSession<TRow, TRule = ColumnRule<TRow>>(): {
  recorder: ColumnSchemaRecorder<TRow, TRule>;
  rules: TRule[];
  close(): void;
  assertOpen(): void;
} {
  const rules: TRule[] = [];
  let isOpen = true;

  return {
    recorder: {
      record<TParams, TResult, T>(
        rule: MetadataRule<TRow, T> | MetadataAsyncRule<TRow, TParams, TResult, T> | TRule
      ): void {
        assertOpen();
        // Sole generic-erasure boundary (mirrors create-table.ts's documented composition
        // boundary): `TParams`/`TResult`/`T` only ever round-trip through the rule's own `key`
        // object identity downstream (`wiring.ts`), never re-derived from this array's static
        // `TRule` type, so collapsing them here is sound in practice even though TS can't prove
        // it structurally at this one storage step (`MetadataAsyncRule`'s contravariant
        // `factory`/`onSuccess` positions defeat plain assignability — only a cast bridges it).
        rules.push(rule as unknown as TRule);
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
export function assertPathIsCurrent<TRow, TRule = ColumnRule<TRow>>(
  handle: ColumnHandle<TRow, string, TRule>
): ColumnSchemaRecorder<TRow, TRule> {
  const recorder = handle[COLUMN_RECORDER];
  // Recorder.record() itself throws if the session already closed — routing
  // through it here keeps the "current" check in one place.
  return recorder;
}

/**
 * Builds the structural `path` proxy handed to a schema fn. The `get` trap
 * fabricates a `ColumnHandle<TRow, K, TRule>` for any string property accessed —
 * it never reads real column data.
 */
export function buildColumnsPath<TRow, TId extends string, TRule = ColumnRule<TRow>>(
  recorder: ColumnSchemaRecorder<TRow, TRule>
): ColumnsPath<TRow, TId, TRule> {
  const handleCache = new Map<string, ColumnHandle<TRow, string, TRule>>();

  return new Proxy({} as ColumnsPath<TRow, TId, TRule>, {
    get(_target, property): ColumnHandle<TRow, string, TRule> | undefined {
      if (typeof property !== 'string') {
        return undefined;
      }
      const cached = handleCache.get(property);
      if (cached) {
        return cached;
      }
      const handle: ColumnHandle<TRow, string, TRule> = {
        id: property,
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
