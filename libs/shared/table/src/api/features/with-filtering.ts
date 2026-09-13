import type { Feature, RowOf, Shape, TableFeatureSpec } from '../../engine/types';
import { createFilterEvaluator } from '../create-filters';
import { createTableFeature } from '../create-table-feature';
import type { Filters } from '../filters.types';
import type { DerivedDict } from '../types';

export interface WithFilteringConfig<TRow> {
  filters: Filters<TRow>;
  manual?: boolean;
}

/**
 * Adds client-side filtering to a `createTable()` by applying a standalone `createFilters()`
 * object to the pipeline's `filter` stage. See `docs/1-state/features/filtering.md`. Owns no
 * filter state — the consumer already holds `config.filters`.
 */
export function withFiltering<In extends Shape>(
  config: WithFilteringConfig<RowOf<In>>
): Feature<In, {}>;
export function withFiltering<In extends Shape, D extends DerivedDict>(
  config: WithFilteringConfig<RowOf<In>>,
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
