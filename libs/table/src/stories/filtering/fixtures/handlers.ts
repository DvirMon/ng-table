import { delay, http, HttpResponse } from 'msw';
import { INVOICE_ROWS_MOCK } from './mock';
import type { InvoiceRow } from './types';

/** Shared header-driven latency/failure simulation — same shape as `row-edit/fixtures/handlers.ts`. */
async function simulateNetwork(request: Request): Promise<{ forceFailure: boolean }> {
  const latencyMs = Number(request.headers.get('x-latency-ms') ?? 0);
  if (latencyMs > 0) {
    await delay(latencyMs);
  }
  return { forceFailure: request.headers.get('x-force-failure') === 'true' };
}

function matchesStatus(row: InvoiceRow, status: string | null): boolean {
  return status === null || row.status === status;
}

/** Symmetrical with the host's own `search` param: invoice number or customer name. */
function matchesSearch(row: InvoiceRow, search: string | null): boolean {
  if (search === null || search === '') {
    return true;
  }
  const needle = search.toLowerCase();
  return row.customer.toLowerCase().includes(needle) || String(row.id).includes(needle);
}

function matchesAmount(row: InvoiceRow, min: string | null, max: string | null): boolean {
  const isAboveMin = min === null || row.amount >= Number(min);
  const isBelowMax = max === null || row.amount <= Number(max);
  return isAboveMin && isBelowMax;
}

function matchesExcludedTags(row: InvoiceRow, excluded: string | null): boolean {
  if (excluded === null || excluded === '') {
    return true;
  }
  const excludedTags = excluded.split(',');
  return !excludedTags.some((tag) => row.tags.includes(tag));
}

/**
 * Stand-in server for the filtering stories — deliberately dumb. It narrows by exactly the
 * params the host serializes from `filters().criteria()` and counts `total` over the **filtered**
 * set, so the server story can render the server's own number rather than an approximation
 * from one page. A query that matches nothing returns `total: 0`.
 */
export const filteringHandlers = [
  http.get('/api/invoices', async ({ request }) => {
    const { forceFailure } = await simulateNetwork(request);
    if (forceFailure) {
      return HttpResponse.json({ message: 'Loading invoices failed (forced).' }, { status: 500 });
    }

    const params = new URL(request.url).searchParams;
    const rows = INVOICE_ROWS_MOCK.filter(
      (row) =>
        matchesStatus(row, params.get('status')) &&
        matchesSearch(row, params.get('search')) &&
        matchesAmount(row, params.get('amountMin'), params.get('amountMax')) &&
        matchesExcludedTags(row, params.get('excludedTags')),
    );

    return HttpResponse.json({ rows, total: rows.length });
  }),
];
