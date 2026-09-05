import { delay, http, HttpResponse } from 'msw';

/** Shared header-driven latency/failure simulation — every handler below applies it the same way. */
async function simulateNetwork(request: Request): Promise<{ forceFailure: boolean }> {
  const latencyMs = Number(request.headers.get('x-latency-ms') ?? 0);
  if (latencyMs > 0) {
    await delay(latencyMs);
  }
  return { forceFailure: request.headers.get('x-force-failure') === 'true' };
}

/**
 * Stand-in server for the row-editing stories. Behavior is driven by request headers the story
 * host sets from its Storybook `forceFailure`/`latencyMs` args — closer to a real endpoint
 * than a plain-Promise stub, since it's a genuine intercepted `fetch` round trip.
 */
export const rowEditHandlers = [
  http.put('/api/rows/:id', async ({ request }) => {
    const { forceFailure } = await simulateNetwork(request);
    if (forceFailure) {
      return HttpResponse.json({ message: 'Save failed (forced).' }, { status: 500 });
    }

    const body = await request.json();
    return HttpResponse.json(body);
  }),

  /** Create: the server assigns its own id, distinct from whatever temp id the client sent —
   * this is what a consumer's `swapRowId(tempId, saved.id)` re-keys against. */
  http.post('/api/rows', async ({ request }) => {
    const { forceFailure } = await simulateNetwork(request);
    if (forceFailure) {
      return HttpResponse.json({ message: 'Create failed (forced).' }, { status: 500 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...body, id: `server-${crypto.randomUUID()}` });
  }),

  http.delete('/api/rows/:id', async ({ request }) => {
    const { forceFailure } = await simulateNetwork(request);
    if (forceFailure) {
      return HttpResponse.json({ message: 'Delete failed (forced).' }, { status: 500 });
    }

    return new HttpResponse(null, { status: 204 });
  }),

  /** Bulk create: one request, one outcome for the whole array — a batch failure fails every row,
   * not just some of them, so the client never has to reconcile a partial success. Ids are
   * assigned in request order, same shape as the single-row create handler above. */
  http.post('/api/rows/bulk', async ({ request }) => {
    const { forceFailure } = await simulateNetwork(request);
    if (forceFailure) {
      return HttpResponse.json({ message: 'Batch create failed (forced).' }, { status: 500 });
    }

    const { rows } = (await request.json()) as { rows: Record<string, unknown>[] };
    return HttpResponse.json({
      rows: rows.map((row) => ({ ...row, id: `server-${crypto.randomUUID()}` })),
    });
  }),
];
