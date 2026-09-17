import type { Filters, FilterNode, StateOf } from '../../../filters/types';
import type { dealFilters } from './schema';
import type { DealRow } from './types';

/**
 * What the grouping pipes are built on, plus the two filter accessors a host needs in TypeScript.
 * Templates format through `grouping-story.pipes.ts`, never through these directly — so a cell's
 * formatting is memoised per value.
 */

/** A group key with nothing to render. `null`, `undefined` and `''` cluster as three separate
 * groups today (S7) and none of them carries a label — the story shows that rather than hiding
 * it, so every caller checks this before reaching for a label. */
export function isBlankGroupValue(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * Value to text, for the one place that needs a string in TypeScript rather than in a template:
 * `grouping-regressions/`'s `groupOrder` comparator and its external-rank lookup.
 */
export function formatValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toLocaleDateString('en-GB');
  }
  return String(value);
}

/** `amount`. Backs the `dealAmount` pipe, which is how every template reaches it. */
export function formatAmount(value: unknown): string {
  if (typeof value !== 'number') {
    return '';
  }
  return value.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

/** Current criterion of the "rep" filter, for rendering an input's value. */
export function readRepCriterion(
  filters: Filters<DealRow, StateOf<ReturnType<typeof dealFilters>>>
): string {
  return filters.rep().value();
}

/** The "rep" filter's node, for writing a new criterion via `.value.set(...)`. */
export function repFilterNode(
  filters: Filters<DealRow, StateOf<ReturnType<typeof dealFilters>>>
): FilterNode<string> {
  return filters.rep();
}
