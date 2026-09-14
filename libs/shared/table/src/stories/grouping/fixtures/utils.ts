import type { FilterNode } from '../../../filters/types';
import type { createDealFilters } from './schema';

/**
 * Display helpers shared by all three grouping story hosts — a group header, a level pill and a
 * data cell all render the same values, so they format them the same way.
 */

/** A group key with nothing to render. `null`, `undefined` and `''` cluster as three separate
 * groups today (S7) and none of them carries a label — the story shows that rather than hiding
 * it, so every caller checks this before reaching for a label. */
export function isBlankGroupValue(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * The one formatter behind every rendered value, group label included. A `Date` formats
 * correctly; an **object has no label path at all** and falls through to `[object Object]` (S8),
 * which is the point of grouping by `owner` in these stories, not an oversight to paper over.
 */
export function formatValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toLocaleDateString('en-GB');
  }
  return String(value);
}

/** `amount`, in the one place a group header's total and a row's own figure agree. */
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
export function readRepCriterion(filters: ReturnType<typeof createDealFilters>): string {
  return filters.rep().value();
}

/** The "rep" filter's node, for writing a new criterion via `.value.set(...)`. */
export function repFilterNode(
  filters: ReturnType<typeof createDealFilters>
): FilterNode<string> {
  return filters.rep();
}
