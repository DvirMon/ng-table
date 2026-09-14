import { Injector, inject, runInInjectionContext } from '@angular/core';
import { attachFiltersInternal, buildValueOfContext, type FiltersInternal } from './filters/evaluator';
import { buildFiltersPath, createFilterRecorderSession, withActiveFilterRecorder } from './filters/recorder';
import { buildFilterState, buildFiltersObject, gateByCondition } from './filters/state';
import { pathsOf, validateRecords } from './filters/validate';
import type { FilterNode, FilterValueOfContext, Filters, FiltersPath } from './filters.types';

export { createFilterEvaluator } from './filters/evaluator';
export {
  assertFilterPathIsCurrent,
  buildFiltersPath,
  createFilterRecorderSession,
  currentFilterRecorder,
  withActiveFilterRecorder,
} from './filters/recorder';

/**
 * Constructs filter criteria as a standalone, consumer-held object. See
 * `docs/1-state/filters.md`. `TRow` must be explicitly annotated — there is no `data` argument
 * to infer from, since server mode needs filters before any data exists (R10/R11).
 *
 * `TState` is a second, caller-supplied type parameter — see `filters.md`'s Signature section
 * (R32) for why it isn't inferred from `schema`.
 */
export function createFilters<TRow, TState extends Record<string, unknown> = Record<string, unknown>>(
  schema: (path: FiltersPath<TRow>) => void,
  opts?: { injector?: Injector }
): Filters<TRow, TState> {
  const injector = opts?.injector ?? inject(Injector);

  const session = createFilterRecorderSession<TRow>();
  const path = buildFiltersPath(session.recorder);
  withActiveFilterRecorder(session.recorder, () => schema(path));
  session.close();
  const records = session.records;

  return runInInjectionContext(injector, () => {
    validateRecords(records);

    const nodesByKey = new Map<string, FilterNode<unknown>>();
    const pathToKey = new Map<string, string>();
    const pendingGates: { key: string; condition: (ctx: FilterValueOfContext<TRow>) => boolean }[] = [];

    for (const record of records) {
      const { node } = buildFilterState(record);
      nodesByKey.set(record.key, node);
      for (const filterPath of pathsOf(record)) {
        pathToKey.set(filterPath, record.key);
      }
      if (record.condition) {
        pendingGates.push({ key: record.key, condition: record.condition });
      }
    }

    // Holds the same `nodesByKey` reference the gating pass mutates below, so it exposes the
    // gated nodes either way.
    const internal: FiltersInternal<TRow> = { records, nodesByKey, pathToKey };

    // Second pass: applyWhen's condition may read any filter's value, including one declared
    // after it — gate only once every node exists.
    if (pendingGates.length > 0) {
      const ctx = buildValueOfContext<TRow>(internal);
      for (const { key, condition } of pendingGates) {
        const base = nodesByKey.get(key);
        if (base) {
          nodesByKey.set(key, gateByCondition(base, condition, ctx));
        }
      }
    }

    const filters = buildFiltersObject<TRow, TState>(internal);
    attachFiltersInternal(filters, internal);

    return filters;
  });
}
