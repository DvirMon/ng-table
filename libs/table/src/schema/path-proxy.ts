import type { MetadataAsyncRule, MetadataRule } from '../columns-schema/types';

/** @internal */
export const PATH_RECORDER: unique symbol = Symbol('PATH_RECORDER');

// Generic on `TRule` — a session is homogeneous, one rule family per session, instantiated
// differently at different call sites (`ColumnRule<TRow>` for columns, `AnyGroupingRule<TRow>`
// for grouping). `MetadataRule`/`MetadataAsyncRule` stay in the union so columns' own
// contextually-typed `metadata()`/`applyVisibleAsync()` calls check directly against their own
// instantiated types, with no erasing cast at that call site — the `| TRule` arm is what a
// non-column session (e.g. grouping) actually records through.
/**
 * Internal recorder every declare-phase call writes into. One instance per schema-fn execution.
 * @internal
 */
export interface PathRecorder<TRow, TRule> {
  /** Records one rule into this session for later resolution by the owning feature/schema. */
  record<TParams = unknown, TResult = unknown, T = unknown>(
    rule: MetadataRule<TRow, T> | MetadataAsyncRule<TRow, TParams, TResult, T> | TRule
  ): void;
}

/** A path-proxy handle carrying its owning recorder — every recorder-backed handle satisfies
 * this (`ColumnHandle`, `GroupingHandle`). A handle with no recorder (`FilterHandle`) does not
 * implement it and never needs to. */
export interface RecordedHandle<TRow, TRule> {
  readonly id: string;
  /** @internal */
  readonly [PATH_RECORDER]: PathRecorder<TRow, TRule>;
}

/**
 * Recorder session for one schema-fn execution. Tracks whether the fn's synchronous run has
 * finished, so `assertPathIsCurrent` can reject a handle stashed and reused after the fact
 * (e.g. inside a later async callback).
 */
export function createRecorderSession<TRow, TRule>(): {
  recorder: PathRecorder<TRow, TRule>;
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
        // object identity downstream, never re-derived from this array's static `TRule` type,
        // so collapsing them here is sound in practice even though TS can't prove it
        // structurally at this one storage step.
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
        "[schema] A path handle was used outside its schema function's synchronous " +
          'execution. Handles are only valid for declare-phase calls made directly inside ' +
          'the schema function they were fabricated for.'
      );
    }
  }
}

/**
 * Rejects a handle used after the recorder session that produced it has closed. Every
 * declare-phase apply/record function must call this before recording.
 */
export function assertPathIsCurrent<TRow, TRule>(
  handle: RecordedHandle<TRow, TRule>
): PathRecorder<TRow, TRule> {
  // Recorder.record() itself throws if the session already closed — routing through it here
  // keeps the "current" check in one place.
  return handle[PATH_RECORDER];
}

/**
 * Builds the structural `path` proxy handed to a schema fn — the `get` trap fabricates one
 * handle per string property accessed and caches it, so a schema passing the same path to two
 * declarations gets identity-stable handles. `makeHandle` decides the fabricated shape, so
 * callers with no session (filtering) and callers with one (columns, grouping) share this one
 * Proxy+cache mechanism instead of each reimplementing it.
 */
export function createPathProxy<THandle>(
  makeHandle: (id: string) => THandle
): Record<string, THandle> {
  const handleCache = new Map<string, THandle>();

  return new Proxy(
    {},
    {
      get(_target, property): THandle | undefined {
        if (typeof property !== 'string') {
          return undefined;
        }
        const cached = handleCache.get(property);
        if (cached) {
          return cached;
        }
        const handle = makeHandle(property);
        handleCache.set(property, handle);
        return handle;
      },
    }
  ) as Record<string, THandle>;
}
