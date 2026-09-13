import type { InvoiceRow, InvoiceStatus } from './types';

/** Hand-supplied, not derived from the rows — `createFilters()` takes no data argument, so a
 * select's options are the consumer's to provide. */
export const STATUS_OPTIONS: readonly InvoiceStatus[] = [
  'draft',
  'sent',
  'paid',
  'overdue',
  'void',
];

export const TAG_OPTIONS = ['retainer', 'hardware', 'consulting', 'rush', 'eu'] as const;

export const INVOICE_ROWS_MOCK: InvoiceRow[] = [
  {
    id: 1001,
    customer: 'Northwind Traders',
    status: 'paid',
    amount: 4820.5,
    issuedAt: new Date('2026-06-02'),
    tags: ['retainer', 'eu'],
    note: 'Annual renewal',
  },
  {
    id: 1002,
    customer: 'Contoso Ltd',
    status: 'sent',
    amount: 1290,
    issuedAt: new Date('2026-06-17'),
    tags: ['consulting'],
    note: null, // blank cell
  },
  {
    id: 1003,
    customer: 'Fabrikam Inc',
    status: 'overdue',
    amount: 15400,
    issuedAt: new Date('2026-07-01'),
    tags: [], // no tags — hasNone matches, hasAny does not
    note: 'Chased twice',
  },
  {
    id: 1004,
    customer: 'Adventure Works',
    status: 'draft',
    amount: 340.25,
    issuedAt: new Date('2026-07-19'),
    tags: ['hardware', 'rush'],
    note: null,
  },
  // Same-day pair — one at midnight, one with a time of day, so a date range whose bound is
  // the day itself has to decide what "on 2026-08-14" means.
  {
    id: 1005,
    customer: 'Tailspin Toys',
    status: 'sent',
    amount: 7600,
    issuedAt: new Date('2026-08-14'),
    tags: ['hardware'],
    note: 'Split shipment',
  },
  {
    id: 1006,
    customer: 'Tailspin Toys',
    status: 'paid',
    amount: 2210.75,
    issuedAt: new Date('2026-08-14T16:45:00'),
    tags: ['hardware', 'rush'],
    note: null,
  },
  {
    id: 1007,
    customer: 'Woodgrove Bank',
    status: 'paid',
    amount: 98000,
    issuedAt: new Date('2026-08-28'),
    tags: ['retainer', 'consulting', 'eu'],
    note: 'Framework agreement',
  },
  {
    id: 1008,
    customer: 'Proseware Inc',
    status: 'void',
    amount: 0,
    issuedAt: new Date('2026-09-01'),
    tags: ['consulting'],
    note: 'Raised in error',
  },
  {
    id: 1009,
    customer: 'Litware Inc',
    status: 'overdue',
    amount: 5125,
    issuedAt: new Date('2026-09-04'),
    tags: ['eu'],
    note: null,
  },
  {
    id: 1010,
    customer: 'Wide World Importers',
    status: 'sent',
    amount: 12750.4,
    issuedAt: new Date('2026-09-09'),
    tags: ['rush', 'eu'],
    note: 'Awaiting PO number',
  },
  {
    id: 1011,
    customer: 'Contoso Ltd',
    status: 'draft',
    amount: 860,
    issuedAt: new Date('2026-09-11'),
    tags: [],
    note: null,
  },
  {
    id: 1012,
    customer: 'Northwind Traders',
    status: 'sent',
    amount: 33400,
    issuedAt: new Date('2026-09-12T09:15:00'),
    tags: ['retainer'],
    note: 'Phase 2 kickoff',
  },
];
