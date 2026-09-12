import { createFilterEvaluator } from '../create-filters';
import type { TableCore, TableFeatureSpec } from '../../engine/types';
import type { Filters } from '../filters.types';

export interface WithFilteringConfig<TRow> {
  filters: Filters<TRow>;
  manual?: boolean;
}

/**
 * Adds client-side filtering to a `createTable()` by applying a standalone `createFilters()`
 * object to the pipeline's `filter` stage. See `docs/1-state/features/filtering.md`. Owns no
 * filter state — the consumer already holds `config.filters`.
 */
export function withFiltering<TRow = unknown>(
  config: WithFilteringConfig<TRow>
): (core: TableCore<TRow>) => TableFeatureSpec<TRow> {
  const manual = config.manual ?? false;

  // `core` is unused — this feature has zero compile-time dependency on the columns config
  // (`filtering.md`'s "Compile-Time Dependencies: None") — but every feature factory takes it,
  // per CLAUDE.md's feature plugin pattern, so composition stays uniform across features.
  return (_core: TableCore<TRow>): TableFeatureSpec<TRow> => ({
    stages: {
      filter: (rows) => {
        if (manual) {
          return rows;
        }
        const evaluator = createFilterEvaluator<TRow, Record<string, unknown>>(config.filters);
        return rows.filter((row) => evaluator.matchesRow(row));
      },
    },
  });
}
