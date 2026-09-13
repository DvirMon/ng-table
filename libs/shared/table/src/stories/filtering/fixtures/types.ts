/** Fixture row for the filtering stories. Field kinds are chosen so every shipped rule has a
 * column to bind to: `customer` (contains), `status` (equals), `amount` (inRange), `issuedAt`
 * (inDateRange), `tags` (hasAny/hasNone). `note` is nullable — the blank-cell case. */
export interface InvoiceRow {
  id: number;
  customer: string;
  status: InvoiceStatus;
  amount: number;
  issuedAt: Date;
  tags: string[];
  note: string | null;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';

/** `GET /api/invoices` response shape — `total` is server-supplied, not derived from `rows`. */
export interface InvoicePage {
  rows: InvoiceRow[];
  total: number;
}
