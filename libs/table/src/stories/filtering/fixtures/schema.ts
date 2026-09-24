import { createColumns } from '../../../api/create-columns';
import type { TableConfig } from '../../../api/types';
import type { InvoiceRow } from './types';

// `createColumns()`'s data witness is never read (`void data`, create-columns.ts) — only its
// type binds `TRow` for the builder below.
const invoiceData = (): readonly InvoiceRow[] | undefined => undefined;

// Every column the client story renders — `note` is the nullable one, `tags` the array one.
const clientColumns = createColumns(invoiceData, (col) => [
  col('id', { label: 'Invoice' }),
  col('customer', { label: 'Customer' }),
  col('status', { label: 'Status' }),
  col('amount', { label: 'Amount' }),
  col('issuedAt', { label: 'Issued' }),
  col('tags', { label: 'Tags' }),
  col('note', { label: 'Note' }),
]);

// The server and selection stories filter on a subset, so they render one too.
const narrowColumns = createColumns(invoiceData, (col) => [
  col('id', { label: 'Invoice' }),
  col('customer', { label: 'Customer' }),
  col('status', { label: 'Status' }),
  col('amount', { label: 'Amount' }),
  col('tags', { label: 'Tags' }),
]);

/** Consumed by `client-filtering/`, which composes `withFiltering({ schema: clientInvoiceFilters })` —
 * the table owns the model directly. */
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

/** Consumed by `selection/filtering-selection/`: `withFiltering()` + `withSelection()` + `withSorting()`.
 * The checkbox column is template-only — selection never becomes a `ColumnDef`. */
export const selectionInvoiceConfig: TableConfig<InvoiceRow> = {
  trackBy: 'id',
  columns: narrowColumns,
};
