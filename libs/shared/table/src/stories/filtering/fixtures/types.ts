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
 * path (`create-filters`'s construction check), so include and exclude share a single
 * criterion fed by two multi-selects instead of being two `hasAny`/`hasNone` filters. */
export interface TagCriterion {
  include: readonly string[];
  exclude: readonly string[];
}

/**
 * The `TState` each story hands `createFilters<InvoiceRow, …>()` — one entry per declared filter,
 * keyed exactly as the schema declares it. Supplying it is what makes every node read back
 * typed (`filters.amount().value()` is a `RangeCriterion`, not `unknown`), so no story needs a
 * narrowing layer over the library's own state.
 *
 * `type`, never `interface`: an interface has no implicit index signature, so it fails
 * `createFilters`' `TState extends Record<string, unknown>` constraint outright.
 */
export type ClientInvoiceFilterState = {
  status: InvoiceStatus | '';
  customer: string;
  amount: RangeCriterion;
  issuedAt: DateRangeCriterion;
  tags: TagCriterion;
  search: string;
};

/** `customer` is declared `{ as: 'search' }`, so the key is `search`, not `customer`. */
export type ServerInvoiceFilterState = {
  status: InvoiceStatus | '';
  search: string;
  amount: RangeCriterion;
  excludedTags: readonly string[];
};

export type SelectionInvoiceFilterState = {
  status: InvoiceStatus | '';
  customer: string;
  tags: readonly string[];
};

/** `GET /api/invoices` over the wire — `issuedAt` arrives as an ISO string and is revived in
 * `http.ts`, so a host never holds a `Date`-typed field that is really a string. */
export type InvoiceRowPayload = Omit<InvoiceRow, 'issuedAt'> & { issuedAt: string };

export interface InvoicePagePayload {
  rows: InvoiceRowPayload[];
  total: number;
}
