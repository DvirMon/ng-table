---
title: "Step 3 — grouping/fixtures/handlers.ts + http.ts: GET /api/grouped-rows"
type: task-step
plan: ../../1-gap-analysis.md
node: A (part)
---

# Step 3 — `grouping/fixtures/handlers.ts` + `http.ts`: `GET /api/grouped-rows`

**PR scope:** Two fixture files, the story cluster's transport half.

**Task type:** code

**Skills used:** typescript-conventions, file-organization

**Depends on:** —
**Parallel-safe with:** Step 1, Step 2

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/stories/grouping/fixtures/handlers.ts` (create)
- `libs/table/src/stories/grouping/fixtures/http.ts` (create)

## Why This Step Exists

Node A's async half. Step 5's Refetch button (product story 2.5 — collapse state survives a
background refresh, the corpus's most durable complaint) and Step 7's async grouping rule both
need a real intercepted round trip. `3-ui/stories.md` is explicit: never a fake `await`.

## What To Do

1. `handlers.ts` — MSW `http.get('/api/grouped-rows', …)` returning `DealPage` (`{ rows, total }`),
   **fresh object identities each call** so Step 5 can prove expansion state survives a refetch of
   re-created rows. Copy `row-edit/fixtures/handlers.ts`'s `simulateNetwork(request)` helper shape:
   `x-latency-ms` delays, `x-force-failure: true` returns a 500.
2. `http.ts` — `injectGroupedRowsApi()`: `inject(HttpClient)` wrapper, Observable-based
   (`.subscribe()`, not `firstValueFrom`), headers `X-Force-Failure` / `X-Latency-Ms` set from the
   story's args. Normalize non-2xx and network errors to one `Error(message)` shape, as
   `row-edit/fixtures/http.ts` does.

## Implementation Notes

- Transport decision is already settled for this repo: `HttpClient`, not TanStack Query
  (`3-ui/stories.md`, "Transport decision (2026-09-05)").
- Reuse `DealPage` from `fixtures/types.ts` — it already declares the response shape.
- Handlers are registered per story via `parameters.msw.handlers` in each `.stories.ts`; the
  `mswLoader` is already wired in `.storybook/preview.ts`.

## Risks / Watchouts

- Returning the same array reference on every call would make Step 5's refetch check vacuous.

## Non-Goals

- No write endpoints — grouping stories never mutate server-side.

## Acceptance Checks

- [ ] `GET /api/grouped-rows` honours both headers; forced failure returns a 500 with a message.
- [ ] Each response's rows are newly constructed objects, not a shared module-level array.
- [ ] `npx tsc -p libs/table/tsconfig.lib.json --noEmit` clean.

---
← [Step 2: grouping fixtures — schema.ts](step-2-grouping-fixtures-schema.plan.md) | [Step 4: grouping-static/](step-4-grouping-static-story.plan.md) →
