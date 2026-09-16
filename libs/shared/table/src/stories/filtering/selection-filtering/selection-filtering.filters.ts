import type { Signal } from '@angular/core';
import { createFilters } from '../../../filters/create-filters';
import { contains, filter, hasAny } from '../../../filters/rules';
import type { InvoiceRow } from '../fixtures/types';
import { matchesStatus } from '../fixtures/utils';

/** Declares the selection-filtering criterion schema — extracted so `SelectionCriteria` below
 * names the inferred state without deriving it off the component class. */
export function createSelectionFilters(data: Signal<InvoiceRow[]>) {
  return createFilters(data, (path) => [
    filter(path.status, matchesStatus, { emptyValue: '' }),
    contains(path.customer),
    hasAny(path.tags),
  ]);
}

type SelectionFiltersRoot = ReturnType<ReturnType<typeof createSelectionFilters>>;

/** The criterion map the schema above infers. Derived, never restated. */
export type SelectionCriteria = ReturnType<SelectionFiltersRoot['value']>;
