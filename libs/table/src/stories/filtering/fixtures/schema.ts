import { createColumns } from '../../../api/create-columns';
import type { TableConfig } from '../../../api/types';
import type { InvoiceRow } from './types';

// `createColumns()`'s data witness is never read (`void data`, create-columns.ts) — only its
// type binds `TRow` for the builder below.
const invoiceData = (): readonly InvoiceRow[] | undefined => undefined;

// Every column the client story renders — `note` is the nullable one, `tags` the array one.
// Exported so `client-filtering.filters.ts` can spell `FiltersPath<InvoiceRow,
// ColumnValues<InvoiceRow, typeof clientColumns.columns>>` against the same declared set.
export const clientColumns = createColumns(invoiceData, (col) => [
  col('id', { label: 'Invoice' }),
  col('customer', { label: 'Customer' }),
  col('status', { label: 'Status' }),
  col('amount', { label: 'Amount' }),
  col('issuedAt', { label: 'Issued' }),
  col('tags', { label: 'Tags' }),
  col('note', { label: 'Note' }),
]);

// The server and selection stories filter on a subset, so they render one too. Exported for the
// same reason as `clientColumns` — `server-filtering.filters.ts` and
// `filtering-selection.filters.ts` both name it.
export const narrowColumns = createColumns(invoiceData, (col) => [
  col('id', { label: 'Invoice' }),
  col('customer', { label: 'Customer' }),
  col('status', { label: 'Status' }),
  col('amount', { label: 'Amount' }),
  col('tags', { label: 'Tags' }),
]);

/** Consumed by `client-filtering/`, which composes `withFiltering({ schema: clientInvoiceFilters })` —
 * the table owns the model directly. */
// No `TableConfig<InvoiceRow>` annotation — that would default `columns` to the wide union and
// lose `clientColumns`'s literal ids; `satisfies` checks the shape without widening it.
export const clientInvoiceConfig = {
  trackBy: 'id',
  columns: clientColumns,
} satisfies TableConfig<InvoiceRow>;

/** Consumed by `server-filtering/`, which composes **no filtering feature** — the rows arrive
 * already narrowed, so a client `filter` stage would have nothing to do. */
export const serverInvoiceConfig = {
  trackBy: 'id',
  columns: narrowColumns,
} satisfies TableConfig<InvoiceRow>;

/** Consumed by `selection/filtering-selection/`: `withFiltering()` + `withSelection()` + `withSorting()`.
 * The checkbox column is template-only — selection never becomes a `ColumnDef`. */
export const selectionInvoiceConfig = {
  trackBy: 'id',
  columns: narrowColumns,
} satisfies TableConfig<InvoiceRow>;
