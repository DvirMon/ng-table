import {
  FILTER_RECORDER,
  type FilterHandle,
  type FilterRuleRecord,
  type FilterSchemaRecorder,
  type FiltersPath,
} from './types';

/** One schema-fn execution. Mirrors `schema/column-schema.ts`'s `createRecorderSession` —
 *  the fn runs once, synchronously; a `FilterHandle` used after it returns must throw. */
export function createFilterRecorderSession<TRow>(): {
  recorder: FilterSchemaRecorder<TRow>;
  records: FilterRuleRecord<TRow>[];
  close(): void;
} {
  const records: FilterRuleRecord<TRow>[] = [];
  let isOpen = true;

  return {
    recorder: {
      record(rule: FilterRuleRecord<TRow>): void {
        assertOpen();
        records.push(rule);
      },
    },
    records,
    close(): void {
      isOpen = false;
    },
  };

  function assertOpen(): void {
    if (!isOpen) {
      throw new Error(
        "[createFilters] A FilterHandle was used outside its schema function's " +
          'synchronous execution. Handles are only valid for rule calls made ' +
          'directly inside the schema fn passed to createFilters().'
      );
    }
  }
}

/** Ambient "currently running schema" recorder — see design-options-hybrid-api.md's R33 for
 *  why `anyOf`/`applyWhen` need this instead of a parameter, and its synchronous-only caveat. */
const activeFilterRecorderStack: FilterSchemaRecorder<unknown>[] = [];

export function withActiveFilterRecorder<TRow, TResult>(
  recorder: FilterSchemaRecorder<TRow>,
  fn: () => TResult
): TResult {
  activeFilterRecorderStack.push(recorder as FilterSchemaRecorder<unknown>);
  try {
    return fn();
  } finally {
    activeFilterRecorderStack.pop();
  }
}

export function currentFilterRecorder<TRow>(): FilterSchemaRecorder<TRow> {
  const top = activeFilterRecorderStack.at(-1);
  if (!top) {
    throw new Error(
      '[createFilters] anyOf()/applyWhen() must be called directly inside a schema function.'
    );
  }
  return top as FilterSchemaRecorder<TRow>;
}

/** Rejects a stale `FilterHandle`, hands back its recorder. Every rule in `filters/rules.ts`
 *  calls this before recording. */
export function assertFilterPathIsCurrent<TRow>(
  handle: FilterHandle<TRow, Extract<keyof TRow, string>>
): FilterSchemaRecorder<TRow> {
  return handle[FILTER_RECORDER];
}

/** Structural `path` proxy handed to a schema fn — fabricates a `FilterHandle` per string
 *  property, never reads row data. Same design as `buildColumnsPath`. */
export function buildFiltersPath<TRow>(recorder: FilterSchemaRecorder<TRow>): FiltersPath<TRow> {
  const handleCache = new Map<string, FilterHandle<TRow, Extract<keyof TRow, string>>>();

  return new Proxy({} as FiltersPath<TRow>, {
    get(_target, property): FilterHandle<TRow, Extract<keyof TRow, string>> | undefined {
      if (typeof property !== 'string') {
        return undefined;
      }
      const cached = handleCache.get(property);
      if (cached) {
        return cached;
      }
      const handle: FilterHandle<TRow, Extract<keyof TRow, string>> = {
        id: property as Extract<keyof TRow, string>,
        [FILTER_RECORDER]: recorder,
      };
      handleCache.set(property, handle);
      return handle;
    },
  });
}
