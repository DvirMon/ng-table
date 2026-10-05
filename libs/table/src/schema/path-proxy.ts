/** @internal */
export const PATH_RECORDER: unique symbol = Symbol('PATH_RECORDER');

/**
 * Internal recorder every declare-phase call writes into. One instance per schema-fn execution.
 * @internal
 */
export interface PathRecorder<TRow, TRule> {
  /** Records one rule into this session for later resolution by the owning feature/schema. */
  record(rule: TRule): void;
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
 * finished, so `record()` can reject a handle stashed and reused after the fact (e.g. inside a
 * later async callback).
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
      record(rule: TRule): void {
        assertOpen();
        rules.push(rule);
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
          'the schema function they were fabricated for.',
      );
    }
  }
}

/**
 * The recorder a handle was fabricated against. `record()` itself rejects a handle used after
 * its session closed, so the open-check stays in one place and this is a plain accessor.
 */
export function recorderOf<TRow, TRule>(
  handle: RecordedHandle<TRow, TRule>,
): PathRecorder<TRow, TRule> {
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
  makeHandle: (id: string) => THandle,
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
    },
  ) as Record<string, THandle>;
}
