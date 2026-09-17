import { delay, http, HttpResponse } from 'msw';
import { GROUPING_ROWS_MOCK } from './mock';
import type { DealRow } from './types';

/** Shared header-driven latency/failure simulation — every handler below applies it the same way,
 * matching `row-edit/fixtures/handlers.ts`. */
async function simulateNetwork(request: Request): Promise<{ forceFailure: boolean }> {
  const latencyMs = Number(request.headers.get('x-latency-ms') ?? 0);
  if (latencyMs > 0) {
    await delay(latencyMs);
  }
  return { forceFailure: request.headers.get('x-force-failure') === 'true' };
}

/** A deep copy, so every response hands back rows the client has never seen before. Returning the
 * module-level fixture array would make `grouping-collapsible/`'s "collapse state survives a
 * refetch" check vacuous — the rows would be the same objects it already had. */
function toFreshRow(row: DealRow): DealRow {
  const children = row.children?.map(toFreshRow);
  return { ...row, closedAt: new Date(row.closedAt), ...(children ? { children } : {}) };
}

/**
 * Stand-in server for the grouping stories. Read-only — grouping never mutates server-side.
 * Behaviour is driven by the request headers the story hosts set from their Storybook
 * `forceFailure`/`latencyMs` args, so a failure or a slow response is a genuine intercepted
 * round trip rather than a fake `await`.
 */
export const groupingHandlers = [
  /** The refetch `grouping-collapsible/` races collapse state against. */
  http.get('/api/grouped-rows', async ({ request }) => {
    const { forceFailure } = await simulateNetwork(request);
    if (forceFailure) {
      return HttpResponse.json({ message: 'Refresh failed (forced).' }, { status: 500 });
    }

    const rows = GROUPING_ROWS_MOCK.map(toFreshRow);
    return HttpResponse.json({ rows, total: rows.length });
  }),

  /** Backs `grouping-static/`'s `applyGroupingAsync()` rule: whether `rep` is an active grouping
   * level is a server decision the table waits on. A forced failure is what makes the rule's
   * required `onError` produce an explicit boolean instead of abstaining (D13/D15). */
  http.get('/api/grouping-preference', async ({ request }) => {
    const { forceFailure } = await simulateNetwork(request);
    if (forceFailure) {
      return HttpResponse.json(
        { message: 'Grouping preference lookup failed (forced).' },
        { status: 500 }
      );
    }

    return HttpResponse.json({ groupByRep: true });
  }),
];
