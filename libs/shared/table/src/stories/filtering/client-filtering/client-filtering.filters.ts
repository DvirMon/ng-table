import type { Signal } from '@angular/core';
import { createFilters } from '../../../filters/create-filters';
import { anyOf, contains, filter, inDateRange, inRange } from '../../../filters/rules';
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

/** Declares the client-filtering criterion schema — extracted so `ClientCriteria` below names
 * the inferred state without deriving it off the component class. */
export function createClientFilters(
  data: Signal<InvoiceRow[]>,
  tagsPredicateIsBroken: Signal<boolean>,
) {
  return createFilters(data, (path) => [
    filter(path.status, matchesStatus, { emptyValue: '' }),
    contains(path.customer),
    inRange(path.amount, { source: () => DEFAULT_AMOUNT_RANGE }),
    inDateRange(path.issuedAt),
    filter(
      path.tags,
      (cell: string[], criterion: TagCriterion): boolean => {
        if (tagsPredicateIsBroken()) {
          throw new Error('The tags predicate is broken (story control).');
        }
        return matchesTagCriterion(cell, criterion);
      },
      { isEmpty: isEmptyTagCriterion, emptyValue: EMPTY_TAG_CRITERION },
    ),
    // Declared paths (PrimeNG's shape), never scanned (AG Grid's). `note` is nullable and `id`
    // is numeric, so the typed matchers return `false` where a stringify-and-substring quick
    // filter throws. `customer` cannot join the group — it already owns a `contains` filter,
    // and one path carries one filter.
    anyOf('search', [contains(path.note), filter(path.id, matchesInvoiceNumber)]),
  ]);
}

type ClientFiltersRoot = ReturnType<ReturnType<typeof createClientFilters>>;

/** The criterion map the schema above infers. Derived, never restated — a renamed filter key
 * breaks this function rather than silently passing an unknown key to `reset()`. */
export type ClientCriteria = ReturnType<ClientFiltersRoot['value']>;
