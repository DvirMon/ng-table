---
title: "Step 3 — filtering/fixtures/handlers.ts + http.ts: GET /api/invoices"
type: task-step
plan: ../../1-gap-analysis.md
node: A (part)
---

# Step 3 — `filtering/fixtures/handlers.ts` + `http.ts`: `GET /api/invoices`

**PR scope:** Two fixture files, the cluster's transport half.

**Task type:** code

**Skills used:** typescript-conventions, file-organization

**Depends on:** —
**Parallel-safe with:** Step 1, Step 2

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/stories/filtering/fixtures/handlers.ts` (create)
- `libs/table/src/stories/filtering/fixtures/http.ts` (create)

## Why This Step Exists

Node A's async half — Step 5 (`server-filtering/`) is the only consumer, but the file lands in the
cluster so the story folders never write into each other.

## What To Do

1. `handlers.ts` — MSW `http.get('/api/invoices', …)` returning `InvoicePage` (`{ rows, total }`),
   where **`total` is server-supplied**, narrowed by the filter query params the host serializes
   from `filters().active()`. Same `simulateNetwork(request)` shape as
   `row-edit/fixtures/handlers.ts`: `x-latency-ms` delays, `x-force-failure: true` returns a 500.
   Must be able to return a `total: 0` page so Step 5 can render the server-side no-matches state.
2. `http.ts` — `injectInvoiceApi()`: `inject(HttpClient)`, Observable-based, `X-Force-Failure` /
   `X-Latency-Ms` headers, errors normalized to one `Error(message)` shape.

## Implementation Notes

- Query-param mapping is **hand-written in the host** (R16) — that is the shipped DX, and Step 5
  shows it rather than hiding it. Keep the handler's parsing symmetrical with what the host sends,
  and keep it dumb: this is a stand-in server, not a filter engine.
- Transport decision: `HttpClient`, not TanStack Query (`3-ui/stories.md`, 2026-09-05).

## Risks / Watchouts

- The handler must count `total` over the **filtered** set, not the fixture length — Step 5's
  "server's number, not an approximation from one page" row depends on it.

## Non-Goals

- No write endpoints. No client-side filtering inside the handler beyond what the params ask for.

## Acceptance Checks

- [ ] `GET /api/invoices` narrows by params and returns a matching `total`, including `0`.
- [ ] Both headers honoured; forced failure returns a 500 with a message.
- [ ] `npx tsc -p libs/table/tsconfig.lib.json --noEmit` clean.

---
← [Step 2: filtering fixtures — schema.ts](step-2-filtering-fixtures-schema.plan.md) | [Step 4: client-filtering/](step-4-client-filtering-story.plan.md) →
