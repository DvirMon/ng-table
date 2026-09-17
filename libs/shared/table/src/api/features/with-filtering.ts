import { buildFilterModel } from '../../filters/create-filters';
import type { AnyRule, Filters, FiltersPath, StateOf } from '../../filters/types';
import type { Feature, RowOf, Shape, TableFeatureSpec } from '../../engine/types';
import { createTableFeature } from '../create-table-feature';
import type { DerivedDict } from '../types';

export interface WithFilteringConfig<TRow, S extends Record<string, AnyRule> = {}> {
  /** Skips the `filter` stage — rows pass through untouched, but the model still builds and
   * `filters` is still exposed. For server-driven filtering via `filters().criteria()`. */
  manual?: boolean;
  /** Declares the owned filter model, exposed as `filters`. Built once at construction; its
   * criteria narrow the pipeline's `filter` stage through `matcher()`. */
  schema?: (path: FiltersPath<TRow>) => S;
}

export interface FilteringMembers<TRow, TState extends Record<string, unknown>> {
  readonly filters: Filters<TRow, TState>;
}

/**
 * Adds filtering to a `createTable()`. With `schema`, builds and owns the filter model,
 * exposing it as `filters`, and its criteria narrow the pipeline's `filter` stage; without
 * `schema`, contributes no member and the stage is a no-op. See
 * `docs/1-state/features/filtering.md`.
 */
export function withFiltering<In extends Shape>(
  config?: WithFilteringConfig<RowOf<In>, {}> & { schema?: undefined }
): Feature<In, {}>;
export function withFiltering<In extends Shape, S extends Record<string, AnyRule>>(
  config: WithFilteringConfig<RowOf<In>, S> & { schema: (path: FiltersPath<RowOf<In>>) => S }
): Feature<In, FilteringMembers<RowOf<In>, StateOf<S>>>;
export function withFiltering<In extends Shape, D extends DerivedDict>(
  config: (WithFilteringConfig<RowOf<In>, {}> & { schema?: undefined }) | undefined,
  derive: Feature<NoInfer<In>, D>
): Feature<In, D>;
export function withFiltering<
  In extends Shape,
  S extends Record<string, AnyRule>,
  D extends DerivedDict
>(
  config: WithFilteringConfig<RowOf<In>, S> & { schema: (path: FiltersPath<RowOf<In>>) => S },
  derive: Feature<NoInfer<In> & FilteringMembers<RowOf<In>, StateOf<S>>, D>
): Feature<In, FilteringMembers<RowOf<In>, StateOf<S>> & D>;
export function withFiltering(
  config?: WithFilteringConfig<any, any>,
  derive?: Feature<any, any>
): Feature<any, any> {
  const manual = config?.manual ?? false;
  const schemaFn = config?.schema;

  const factory = <In extends Shape>(_input: In): TableFeatureSpec<RowOf<In>, any> => {
    const filters = schemaFn ? buildFilterModel<RowOf<In>, any>(schemaFn) : undefined;

    return {
      members: filters ? { filters } : {},
      stages: {
        filter: (rows) => {
          const shouldSkipFiltering = manual || !filters;
          if (shouldSkipFiltering) {
            return rows;
          }
          // One matcher per stage evaluation, not per row — it carries its own
          // error-dedup scope and memoized narrowing set.
          const matcher = filters().matcher();
          return rows.filter(matcher);
        },
      },
    };
  };

  const feature: Feature<any, any> = derive
    ? createTableFeature(factory, derive)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withFiltering' });
}
