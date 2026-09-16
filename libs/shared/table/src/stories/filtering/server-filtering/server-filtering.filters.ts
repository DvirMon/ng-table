import type { Signal } from '@angular/core';
import { createFilters } from '../../../filters/create-filters';
import { contains, filter, hasNone, inRange } from '../../../filters/rules';
import { rowOf } from '../../../filters/row-of';
import type { InvoiceRow, RangeCriterion } from '../fixtures/types';
import { matchesStatus } from '../fixtures/utils';

/**
 * Declares the server-filtering criterion schema — extracted so `ServerCriteria` below names
 * the inferred state without deriving it off the component class.
 *
 * `data` is never fetched — `rowOf<InvoiceRow>()` supplies the row type in the slot real row
 * data would otherwise occupy, since the filters exist before any page has loaded.
 */
export function createServerFilters(serverDefaultAmount: Signal<RangeCriterion>) {
  return createFilters(rowOf<InvoiceRow>(), (path) => [
    filter(path.status, matchesStatus, { emptyValue: '' }),
    contains(path.customer, { as: 'search' }),
    inRange(path.amount, { source: () => serverDefaultAmount() }),
    hasNone(path.tags, { as: 'excludedTags' }),
  ]);
}

type ServerFiltersRoot = ReturnType<ReturnType<typeof createServerFilters>>;

/** The criterion map the schema above infers. Derived, never restated. */
export type ServerCriteria = ReturnType<ServerFiltersRoot['value']>;
