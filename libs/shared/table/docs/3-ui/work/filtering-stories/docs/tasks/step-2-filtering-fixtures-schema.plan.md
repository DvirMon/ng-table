---
title: "Step 2 — filtering/fixtures/schema.ts: three table configs + the debounced form schema"
type: task-step
plan: ../../1-gap-analysis.md
node: A (part)
---

# Step 2 — `filtering/fixtures/schema.ts`: three table configs + the debounced form schema

> **Partly superseded 2026-09-14.** The table configs are unchanged. `filterFormSchema` was
> renamed `serverFilterFormSchema` and retargeted from a standalone search model to
> `ServerInvoiceFilterState` — the filter model itself, so the debounce applies to the
> criterion directly (R18/R25).

**PR scope:** One fixture file.

**Task type:** code

**Skills used:** typescript-conventions, file-organization

**Depends on:** Step 1
**Parallel-safe with:** Step 3

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/stories/filtering/fixtures/schema.ts` (create)

## Why This Step Exists

Node A's config half. All three configs land up front so Steps 4, 5 and 6 stay parallel-safe.

## What To Do

1. `clientInvoiceConfig` — `TableConfig<InvoiceRow>`, columns `id`, `customer`, `status`, `amount`,
   `issuedAt`, `tags`, `note`; `trackBy: 'id'`. Consumed by Step 4 with `withFiltering({ filters })`.
2. `serverInvoiceConfig` — same columns, for Step 5, which composes **no filtering feature at all**
   (settled: `createFilters()` alone feeds the request; `manual: true` is an identity pass-through
   that still claims the `filter` stage, so composing it would demo an empty stage claim — R10/R23).
3. `selectionInvoiceConfig` — for Step 6, sized for `withFiltering()` + `withSelection()` +
   `withSorting()`.
4. `filterFormSchema` — the Signal Forms schema carrying R25's `debounce(path, 300)` on the search
   field, beside the configs the way `row-edit/fixtures/schema.ts` holds `editRowsSchema`.

## Implementation Notes

- **The gap analysis says `createTableSchema()`. No such function exists** — it is a stale name. The
  shipped API is `TableConfig<TRow>` + positional `createTable(data, config, ...features)`. Mirror
  `stories/row-edit/fixtures/schema.ts`.
- Import the filter factories from Step 1 only where a config genuinely needs them; the filters
  themselves stay the host's to construct in an injection context.

## Risks / Watchouts

- Don't widen `InvoiceRow` — it already carries a numeric `id`, a nullable `note`, an array `tags`,
  a `Date` and a same-day/time-of-day pair in `fixtures/mock.ts`.

## Non-Goals

- No MSW/HTTP (Step 3). No host.

## Acceptance Checks

- [ ] Three configs plus `filterFormSchema` exported; no inline mock data.
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` clean.

---
← [Step 1: filtering fixtures — filters.ts](step-1-filtering-fixtures-filters.plan.md) | [Step 3: filtering fixtures — transport](step-3-filtering-fixtures-transport.plan.md) →
