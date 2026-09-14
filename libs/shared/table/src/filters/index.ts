// Public API of the filters domain. Lists every symbol explicitly — do not `export *` from
// `./create-filters`, `./rules` or `./matchers` here, that would leak internal helpers (e.g.
// `createFilterEvaluatorFrom`) into the table's public surface. `evaluator.ts`, `recorder.ts`,
// `state.ts` and `validate.ts` are internal precisely because they are not listed here.
export { createFilters } from './create-filters';
export type { Filters, FilterNode, FilterOptions } from './types';
export {
  anyOf,
  applyWhen,
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
