import { contains, filter, hasAny } from '../../../api/features/with-filtering/rules';
import type { FiltersPath } from '../../../api/features/with-filtering/types';
import type { ColumnValues } from '../../../api/types';
import type { StateOf } from '../../../engine/filters/types';
import { narrowColumns } from '../../filtering/fixtures/schema';
import type { InvoiceRow } from '../../filtering/fixtures/types';
import { matchesStatus } from '../../filtering/fixtures/utils';

/** Hoisted so `SelectionCriteria` below names the inferred state without deriving it off the
 * component class. */
export const selectionInvoiceFilters = (
  path: FiltersPath<InvoiceRow, ColumnValues<InvoiceRow, typeof narrowColumns.columns>>
) => ({
  status: filter(path.status, matchesStatus, { emptyValue: '' }),
  customer: contains(path.customer),
  tags: hasAny(path.tags),
});

/** The criterion map the schema above infers. Derived, never restated. */
export type SelectionCriteria = StateOf<ReturnType<typeof selectionInvoiceFilters>>;
