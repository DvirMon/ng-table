import { buildFilterModel } from '../../../engine/filters/build';
import type { AnyRule, StateOf } from '../../../engine/filters/types';
import type { Filters, FiltersPath } from './types';
import type { ColumnValuesOf, Feature, RowOf, TableFeatureSpec } from '../../../engine/types';
import { createTableFeature } from '../../create-table-feature';
import type { ColumnValueMap, DerivedDict, TableStore } from '../../types';

// The slice of the accumulating store this feature reads, row-typed via `RowOf<In>`. Recovers
// the value map via `ColumnValuesOf<In>` rather than `Record<ColumnIdOf<In>, unknown>` — the
// latter circularly self-references under `withFiltering`'s F-bounded `In`, because it derives
// from `In.columns` through an extra `keyof Record<...>` indirection. `ColumnValuesOf<In>` reads
// `In`'s own `__columnValues` phantom directly, with no circularity. Mirrors `GroupingInput`
// (`with-grouping/feature.ts`).
type FilteringInput<In> = Pick<TableStore<RowOf<In>, ColumnValuesOf<In>>, 'columns' | 'rows'>;

export interface WithFilteringConfig<
  TRow,
  TValues extends ColumnValueMap,
  S extends Record<string, AnyRule> = {}
> {
  /** Skips the `filter` stage — rows pass through untouched, but the model still builds and
   * `filters` is still exposed. For server-driven filtering via `filters().criteria()`. */
  manual?: boolean;
  /** Declares the owned filter model, exposed as `filters`. Built once at construction; its
   * criteria narrow the pipeline's `filter` stage through `matcher()`. */
  schema?: (path: FiltersPath<TRow, TValues>) => S;
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
export function withFiltering<In extends FilteringInput<In>>(
  config?: WithFilteringConfig<RowOf<In>, ColumnValuesOf<In>, {}> & { schema?: undefined }
): Feature<In, {}>;
export function withFiltering<In extends FilteringInput<In>, S extends Record<string, AnyRule>>(
  config: WithFilteringConfig<RowOf<In>, ColumnValuesOf<In>, S> & {
    schema: (path: FiltersPath<RowOf<In>, ColumnValuesOf<In>>) => S;
  }
): Feature<In, FilteringMembers<RowOf<In>, StateOf<S>>>;
export function withFiltering<In extends FilteringInput<In>, D extends DerivedDict>(
  config: (WithFilteringConfig<RowOf<In>, ColumnValuesOf<In>, {}> & { schema?: undefined }) | undefined,
  derive: Feature<NoInfer<In>, D>
): Feature<In, D>;
export function withFiltering<
  In extends FilteringInput<In>,
  S extends Record<string, AnyRule>,
  D extends DerivedDict
>(
  config: WithFilteringConfig<RowOf<In>, ColumnValuesOf<In>, S> & {
    schema: (path: FiltersPath<RowOf<In>, ColumnValuesOf<In>>) => S;
  },
  derive: Feature<NoInfer<In> & FilteringMembers<RowOf<In>, StateOf<S>>, D>
): Feature<In, FilteringMembers<RowOf<In>, StateOf<S>> & D>;
export function withFiltering(
  config: WithFilteringConfig<any, any, any> = {},
  derive?: Feature<any, any>
): Feature<any, any> {
  const factory = <In extends FilteringInput<In>>(
    input: In
  ): TableFeatureSpec<RowOf<In>, any> => buildFilteringSpec(input, config);

  const feature: Feature<any, any> = derive
    ? createTableFeature(factory, derive)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withFiltering' });
}

// Shared by both `withFiltering()` overloads via the generic `factory` above, like
// `buildGroupingSpec`. `assertDeclarationsAreKnown` runs inside `buildFilterModel` itself
// (`engine/filters/build.ts`) — it already holds the built records and the `columns` getter
// this function passes through, so the check needs nothing this function doesn't already have.
function buildFilteringSpec<TRow, TValues extends ColumnValueMap>(
  input: Pick<TableStore<TRow, TValues>, 'columns' | 'rows'>,
  config: WithFilteringConfig<TRow, TValues, any>
): TableFeatureSpec<TRow, any> {
  const manual = config.manual ?? false;
  const schemaFn = config.schema;
  const filters = schemaFn
    ? buildFilterModel<TRow, TValues, any>(schemaFn, () => input.columns())
    : undefined;

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
}
