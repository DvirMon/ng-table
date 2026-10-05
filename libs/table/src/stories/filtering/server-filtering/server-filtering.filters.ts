import { signal } from '@angular/core';
import { contains, filter, hasNone, inRange } from '../../../api/features/with-filtering/rules';
import type { FiltersPath } from '../../../api/features/with-filtering/types';
import type { ColumnValues } from '../../../api/types';
import type { StateOf } from '../../../engine/filters/types';
import { narrowColumns } from '../fixtures/schema';
import type { InvoiceRow, RangeCriterion } from '../fixtures/types';
import { EMPTY_RANGE, matchesStatus } from '../fixtures/utils';

/** Empty until "Deliver server default now" is pressed — the race needs a late arrival. */
export const serverDefaultAmount = signal<RangeCriterion>(EMPTY_RANGE);

/** No table composes this schema — it types the form only, against the same declared set the
 * table's own config uses. */
export const serverInvoiceFilters = (
  path: FiltersPath<InvoiceRow, ColumnValues<InvoiceRow, typeof narrowColumns.columns>>,
) => ({
  status: filter(path.status, matchesStatus, { emptyValue: '' }),
  search: contains(path.customer),
  amount: inRange(path.amount, { source: () => serverDefaultAmount() }),
  excludedTags: hasNone(path.tags),
});

/** The criterion map the schema above infers. Derived, never restated. */
export type ServerCriteria = StateOf<ReturnType<typeof serverInvoiceFilters>>;
