import { delay, http, HttpResponse } from 'msw';

/**
 * Stand-in server for the optimistic stories (S4 gated, S6 live). Behavior is driven by
 * request headers the story
 * host sets from its Storybook `forceFailure`/`latencyMs` args — closer to a real endpoint
 * than a plain-Promise stub, since it's a genuine intercepted `fetch` round trip.
 */
export const rowEditHandlers = [
  http.put('/api/rows/:id', async ({ request }) => {
    const latencyMs = Number(request.headers.get('x-latency-ms') ?? 0);
    if (latencyMs > 0) {
      await delay(latencyMs);
    }

    const forceFailure = request.headers.get('x-force-failure') === 'true';
    if (forceFailure) {
      return HttpResponse.json({ message: 'Save failed (forced).' }, { status: 500 });
    }

    const body = await request.json();
    return HttpResponse.json(body);
  }),
];
