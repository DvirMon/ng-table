import { signal } from '@angular/core';
import { anyOf, contains, filter, inDateRange, inRange } from '../../../api/features/with-filtering/rules';
import type { FiltersPath } from '../../../api/features/with-filtering/types';
import type { ColumnValues } from '../../../api/types';
import type { StateOf } from '../../../engine/filters/types';
import { clientColumns } from '../fixtures/schema';
import type { InvoiceRow, RangeCriterion, TagCriterion } from '../fixtures/types';
import {
  EMPTY_TAG_CRITERION,
  isEmptyTagCriterion,
  matchesInvoiceNumber,
  matchesStatus,
  matchesTagCriterion,
} from '../fixtures/utils';

/** The `amount` default the story's `Reset to defaults` restores and `Clear all` does not.
 * Without a declared `source` the two buttons would be indistinguishable. */
const DEFAULT_AMOUNT_RANGE: RangeCriterion = { min: 1000, max: null };

/** Story control, not filter state — the "Break the tags filter" toggle. Module-scope because
 * a hoisted schema takes only `path`, and this is the one input that is not a criterion. */
export const tagsPredicateIsBroken = signal(false);

function matchesTagCriterionUnlessBroken(cell: string[], criterion: TagCriterion): boolean {
  if (tagsPredicateIsBroken()) {
    throw new Error('The tags predicate is broken (story control).');
  }
  return matchesTagCriterion(cell, criterion);
}

/** Declares the client-filtering criterion schema the table owns directly. The `path`
 * annotation is the point — it fixes `S` so `ClientCriteria` below derives from this function
 * rather than restating its shape. */
export const clientInvoiceFilters = (
  path: FiltersPath<InvoiceRow, ColumnValues<InvoiceRow, typeof clientColumns.columns>>
) => ({
  status: filter(path.status, matchesStatus, { emptyValue: '' }),
  customer: contains(path.customer),
  amount: inRange(path.amount, { source: () => DEFAULT_AMOUNT_RANGE }),
  issuedAt: inDateRange(path.issuedAt),
  tags: filter(path.tags, matchesTagCriterionUnlessBroken, {
    isEmpty: isEmptyTagCriterion,
    emptyValue: EMPTY_TAG_CRITERION,
  }),
  // Declared paths (PrimeNG's shape), never scanned (AG Grid's). `note` is nullable and `id`
  // is numeric, so the typed matchers return `false` where a stringify-and-substring quick
  // filter throws. `customer` cannot join the group — it already owns a `contains` filter,
  // and one path carries one filter.
  search: anyOf([contains(path.note), filter(path.id, matchesInvoiceNumber)]),
});

/** The criterion map the schema above infers. Derived, never restated — a renamed filter key
 * breaks this type rather than silently passing an unknown key to `reset()`. */
export type ClientCriteria = StateOf<ReturnType<typeof clientInvoiceFilters>>;
