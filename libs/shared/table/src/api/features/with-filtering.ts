import type { Feature, RowOf, Shape, TableFeatureSpec } from '../../engine/types';
import { createFilterEvaluator } from '../create-filters';
import { createTableFeature } from '../create-table-feature';
import type { Filters } from '../filters.types';
import type { DerivedDict } from '../types';

/**
 * `TState` is carried through so a concretely-keyed filter set stays typed at the call site.
 * `Filters<TRow, TState>` is **not** assignable to `Filters<TRow>` — `FilterNode<T>` holds a
 * `WritableSignal<T>`, which is invariant — so pinning this to the default would force every
 * consumer declaring `createFilters<TRow, TState>()` to widen back to `unknown` criteria.
 */
export interface WithFilteringConfig<
  TRow,
  TState extends Record<string, unknown> = Record<string, unknown>
> {
  filters: Filters<TRow, TState>;
  manual?: boolean;
}

/**
 * Adds client-side filtering to a `createTable()` by applying a standalone `createFilters()`
 * object to the pipeline's `filter` stage. See `docs/1-state/features/filtering.md`. Owns no
 * filter state — the consumer already holds `config.filters`.
 */
export function withFiltering<
  In extends Shape,
  TState extends Record<string, unknown> = Record<string, unknown>
>(config: WithFilteringConfig<RowOf<In>, TState>): Feature<In, {}>;
export function withFiltering<
  In extends Shape,
  D extends DerivedDict,
  TState extends Record<string, unknown> = Record<string, unknown>
>(
  config: WithFilteringConfig<RowOf<In>, TState>,
  derive: Feature<NoInfer<In>, D>
): Feature<In, D>;
export function withFiltering(
  config: WithFilteringConfig<any>,
  derive?: Feature<any, any>
): Feature<any, any> {
  const manual = config.manual ?? false;
  const factory = <In extends Shape>(_input: In): TableFeatureSpec<RowOf<In>, {}> => ({
    stages: {
      filter: (rows) => {
        if (manual) {
          return rows;
        }
        const evaluator = createFilterEvaluator<RowOf<In>, Record<string, unknown>>(config.filters);
        return rows.filter((row) => evaluator.matchesRow(row));
      },
    },
  });
  const feature: Feature<any, any> = derive
    ? createTableFeature(factory, derive)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withFiltering' });
}
