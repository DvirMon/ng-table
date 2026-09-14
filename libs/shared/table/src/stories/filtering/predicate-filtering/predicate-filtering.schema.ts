import type { ColumnDefInput, TableConfig } from '../../../api/types';
import type { InvoiceRow } from '../fixtures/types';

/** Story-local rather than in `filtering/fixtures/schema.ts`: that file also carries the server
 * story's Signal Forms filter schema, and this story's whole claim is that nothing filter-model
 * shaped reaches it — transitively included. */
const predicateColumns: ColumnDefInput<InvoiceRow>[] = [
  { id: 'id', label: 'Invoice' },
  { id: 'customer', label: 'Customer' },
  { id: 'status', label: 'Status' },
  { id: 'amount', label: 'Amount' },
  { id: 'note', label: 'Note' },
];

export const predicateInvoiceConfig: TableConfig<InvoiceRow> = {
  trackBy: 'id',
  columns: predicateColumns,
};
