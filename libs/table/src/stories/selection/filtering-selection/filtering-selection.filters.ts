import { contains, filter, hasAny } from '../../../filters/rules';
import type { FiltersPath, StateOf } from '../../../filters/types';
import type { InvoiceRow } from '../../filtering/fixtures/types';
import { matchesStatus } from '../../filtering/fixtures/utils';

/** Hoisted so `SelectionCriteria` below names the inferred state without deriving it off the
 * component class. */
export const selectionInvoiceFilters = (path: FiltersPath<InvoiceRow>) => ({
  status: filter(path.status, matchesStatus, { emptyValue: '' }),
  customer: contains(path.customer),
  tags: hasAny(path.tags),
});

/** The criterion map the schema above infers. Derived, never restated. */
export type SelectionCriteria = StateOf<ReturnType<typeof selectionInvoiceFilters>>;
