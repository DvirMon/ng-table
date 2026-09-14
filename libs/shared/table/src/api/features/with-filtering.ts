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
 *
 * Either input alone is enough; supplying both ANDs the filter model with the predicate terms.
 */
export interface WithFilteringConfig<
  TRow,
  TState extends Record<string, unknown> = Record<string, unknown>
> {
  filters?: Filters<TRow, TState>;
  /** One call = one evaluation. Terms AND'd; a term that throws is dropped for that pass. */
  predicates?: () => readonly ((row: TRow) => boolean)[];
  manual?: boolean;
}

/** One evaluator per pass — its per-filter reporting and degradation are scoped to that instance. */
function applyFilterModel<TRow>(
  rows: TRow[],
  filters: Filters<TRow, Record<string, unknown>>
): TRow[] {
  return createFilterEvaluator<TRow, Record<string, unknown>>(filters).filterRows(rows);
}

/**
 * Narrows by each term in turn, AND'd. One `try` per term rather than per row (ADR-0014): a
 * throwing term aborts its own pass before its result is kept, so it applies to no row at all
 * instead of to the rows it reached first. Sibling terms keep narrowing.
 */
function applyPredicateTerms<TRow>(
  rows: TRow[],
  terms: readonly ((row: TRow) => boolean)[]
): TRow[] {
  let narrowed = rows;
  for (let index = 0; index < terms.length; index++) {
    try {
      narrowed = narrowed.filter(terms[index]);
    } catch (error) {
      reportPredicateError(terms[index], index, error);
    }
  }
  return narrowed;
}

function reportPredicateError<TRow>(
  predicate: (row: TRow) => boolean,
  index: number,
  error: unknown
): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    `[withFiltering] The predicate at index ${index} threw while evaluating a row. ` +
      'This predicate does not narrow for this pass; other predicates are unaffected.',
    { index, predicate, error }
  );
}

/**
 * Adds client-side filtering to a `createTable()` — a standalone `createFilters()` object, a
 * thunk of plain row predicates, or both — applied to the pipeline's `filter` stage. See
 * `docs/1-state/features/filtering.md`. Owns no filter state; the consumer holds both inputs.
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
        const terms = config.predicates?.() ?? [];
        const filtersModel = config.filters;
        const matched = filtersModel
          ? applyFilterModel<RowOf<In>>(rows, filtersModel)
          : rows;
        return applyPredicateTerms<RowOf<In>>(matched, terms);
      },
    },
  });
  const feature: Feature<any, any> = derive
    ? createTableFeature(factory, derive)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withFiltering' });
}
