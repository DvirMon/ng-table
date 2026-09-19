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

/** `inRange`'s criterion shape. */
export interface RangeCriterion {
  min: number | null;
  max: number | null;
}

/** `inDateRange`'s criterion shape. Bounds are compared as raw instants, never truncated to a
 * calendar day — see the client story's date-bound hint. */
export interface DateRangeCriterion {
  from: Date | null;
  to: Date | null;
}

/** The compound include/exclude criterion the `tags` column carries. One filter may target a
 * path (`build.ts`'s construction check), so include and exclude share a single
 * criterion fed by two multi-selects instead of being two `hasAny`/`hasNone` filters. */
export interface TagCriterion {
  include: readonly string[];
  exclude: readonly string[];
}

/** `GET /api/invoices` over the wire — `issuedAt` arrives as an ISO string and is revived in
 * `http.ts`, so a host never holds a `Date`-typed field that is really a string. */
export type InvoiceRowPayload = Omit<InvoiceRow, 'issuedAt'> & { issuedAt: string };

export interface InvoicePagePayload {
  rows: InvoiceRowPayload[];
  total: number;
}
