import { signal } from '@angular/core';
import { contains, filter, hasNone, inRange } from '../../../filters/rules';
import type { FiltersPath, StateOf } from '../../../filters/types';
import type { InvoiceRow, RangeCriterion } from '../fixtures/types';
import { EMPTY_RANGE, matchesStatus } from '../fixtures/utils';

/** Empty until "Deliver server default now" is pressed — the race needs a late arrival. */
export const serverDefaultAmount = signal<RangeCriterion>(EMPTY_RANGE);

/** The table supplies `TRow` (as `RowOf<In>`); this schema only ever needs `path`. */
export const serverInvoiceFilters = (path: FiltersPath<InvoiceRow>) => ({
  status: filter(path.status, matchesStatus, { emptyValue: '' }),
  search: contains(path.customer),
  amount: inRange(path.amount, { source: () => serverDefaultAmount() }),
  excludedTags: hasNone(path.tags),
});

/** The criterion map the schema above infers. Derived, never restated. */
export type ServerCriteria = StateOf<ReturnType<typeof serverInvoiceFilters>>;
