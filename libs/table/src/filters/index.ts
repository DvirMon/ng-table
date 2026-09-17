// Public API of the filters domain. Lists every symbol explicitly — do not `export *` from
// `./create-filters`, `./rules` or `./matchers` here, that would leak internal helpers (e.g.
// `createFilterEvaluatorFrom`, `buildFilterModel`) into the table's public surface.
// `create-filters.ts`, `evaluator.ts`, `state.ts` and `validate.ts` are internal precisely
// because they are not listed here — `withFiltering`'s `schema` config is the only entry point
// to the model.
export type { Filters, FilterNode, FilterOptions, FiltersPath } from './types';
export {
  anyOf,
  contains,
  equals,
  filter,
  hasAny,
  hasNone,
  inDateRange,
  inRange,
} from './rules';
export {
  hasAnyOf,
  hasNoneOf,
  isContaining,
  isEqual,
  isInDateRange,
  isInRange,
} from './matchers';
