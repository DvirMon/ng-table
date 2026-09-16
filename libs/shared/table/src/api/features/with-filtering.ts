import type { Feature, RowOf, Shape, TableFeatureSpec } from '../../engine/types';
import { createTableFeature } from '../create-table-feature';
import type { DerivedDict } from '../types';

export interface WithFilteringConfig<TRow> {
  /** One call = one evaluation. Terms AND'd; a term that throws is dropped for that pass. */
  predicates: () => readonly ((row: TRow) => boolean)[];
  manual?: boolean;
}

/**
 * Narrows by each term in turn, AND'd. One `try` per term rather than per row: a throwing
 * term aborts its own pass before its result is kept, so it applies to no row at all instead
 * of to the rows it reached first. Sibling terms keep narrowing.
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
 * Adds client-side filtering to a `createTable()` — a thunk of plain row predicates, applied to
 * the pipeline's `filter` stage. See `docs/1-state/features/filtering.md`. Owns no filter state;
 * the consumer holds the predicates.
 */
export function withFiltering<In extends Shape>(config: WithFilteringConfig<RowOf<In>>): Feature<In, {}>;
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
        const terms = config.predicates();
        return applyPredicateTerms<RowOf<In>>(rows, terms);
      },
    },
  });
  const feature: Feature<any, any> = derive
    ? createTableFeature(factory, derive)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withFiltering' });
}
