import { debounce, schema } from '@angular/forms/signals';
import type { ColumnDefInput, TableConfig } from '../../../api/types';
import type { InvoiceRow, ServerInvoiceFilterState } from './types';

/** Every column the client story renders — `note` is the nullable one, `tags` the array one. */
const clientColumns: ColumnDefInput<InvoiceRow>[] = [
  { id: 'id', label: 'Invoice' },
  { id: 'customer', label: 'Customer' },
  { id: 'status', label: 'Status' },
  { id: 'amount', label: 'Amount' },
  { id: 'issuedAt', label: 'Issued' },
  { id: 'tags', label: 'Tags' },
  { id: 'note', label: 'Note' },
];

/** The server and selection stories filter on a subset, so they render one too. */
const narrowColumns: ColumnDefInput<InvoiceRow>[] = [
  { id: 'id', label: 'Invoice' },
  { id: 'customer', label: 'Customer' },
  { id: 'status', label: 'Status' },
  { id: 'amount', label: 'Amount' },
  { id: 'tags', label: 'Tags' },
];

/** Consumed by `client-filtering/`, which composes `withFiltering({ predicates: () => [filters().matcher()] })`. */
export const clientInvoiceConfig: TableConfig<InvoiceRow> = {
  trackBy: 'id',
  columns: clientColumns,
};

/** Consumed by `server-filtering/`, which composes **no filtering feature** — the rows arrive
 * already narrowed, so a client `filter` stage would have nothing to do. */
export const serverInvoiceConfig: TableConfig<InvoiceRow> = {
  trackBy: 'id',
  columns: narrowColumns,
};

/** Consumed by `selection-filtering/`: `withFiltering()` + `withSelection()` + `withSorting()`.
 * The checkbox column is template-only — selection never becomes a `ColumnDef`. */
export const selectionInvoiceConfig: TableConfig<InvoiceRow> = {
  trackBy: 'id',
  columns: narrowColumns,
};

/**
 * The server story's form schema — applied to the **filter model itself**, not to a separate
 * search model. `debounce(path.search, 300)` is what makes one request per typing pause instead
 * of one per keystroke; it has no visible consequence in the synchronous client story, which is
 * why only this one carries it.
 */
export const serverFilterFormSchema = schema<ServerInvoiceFilterState>((path) => {
  debounce(path.search, 300);
});
