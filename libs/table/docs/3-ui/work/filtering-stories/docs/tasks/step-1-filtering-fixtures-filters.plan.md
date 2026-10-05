---
title: 'Step 1 — filtering/fixtures/filters.ts: createFilters() factories, one per story'
type: task-step
plan: ../../1-gap-analysis.md
node: A (part)
---

# Step 1 — `filtering/fixtures/filters.ts`: `createFilters()` factories, one per story

> **Superseded 2026-09-14 — this step's artifact was deleted.** `fixtures/filters.ts` no
> longer exists. Each story host now declares its own `createFilters<InvoiceRow, TState>()`
> inline, directly above its `createTable()`. The "factories, not module constants"
> rationale below rests on a false premise: `createFilters()` does need an injection
> context (R24), but a host field initializer **is** one, so the factory bought nothing and
> only moved the declaration out of sight. See `docs/3-ui/stories.md` for the convention.

**PR scope:** One fixture file. No story renders it yet.

**Task type:** code

**Skills used:** typescript-conventions, file-organization

**Depends on:** —
**Parallel-safe with:** Step 3

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/stories/filtering/fixtures/filters.ts` (create)

## Why This Step Exists

Node A, the declaration half. Every one of the three stories declares filters; landing all of them
up front is what keeps Steps 4, 5 and 6 parallel-safe — a factory added later by one story turns
this file into a write-edge between them.

**Factories, not module constants:** `createFilters()` needs an injection context (R24).

## What To Do

Export one factory per story, each returning a `createFilters<InvoiceRow>(…)` declaration:

1. `createClientInvoiceFilters()` — one criterion per shipped rule kind, so Step 4 has an input for
   each: `status` (`equals`), `customer` (`contains`), `amount` (`inRange`), `issuedAt`
   (`inDateRange`), `tags` include (`hasAny`) and exclude (`hasNone`), plus:
   - a **quick-filter** criterion `anyOf('search', …)` spanning `customer`, `note` (nullable) and
     `id` (numeric) — the typed matchers must visibly return `false` on the non-string cells where a
     stringify-and-substring quick filter throws (`pain T3`);
   - a **compound** criterion on `tags`: one `filter(path.tags, (cell, { include, exclude }) =>
hasAnyOf(cell, include) && hasNoneOf(cell, exclude))` fed by two multi-selects into a single
     criterion — R5/R6's documented workaround made copy-pasteable;
   - a criterion carrying a `source: () => …` default, so Step 5's late-default race (R19) has a
     shape to reuse.
2. `createServerInvoiceFilters()` — the subset Step 5 serializes into the request. Same declaration
   surface; only the consumer changes (R10).
3. `createSelectionInvoiceFilters()` — what Step 6 needs, including whatever `withSorting()` row
   requires (the migrated sort-survival case).

## Implementation Notes

- The gap analysis calls this file `filter-demo.filters.ts` at `src/stories/` root. That layout is
  **superseded** by commit `a1b96fc` (one folder per feature, fixtures inside it) — the current path
  is `stories/filtering/fixtures/filters.ts`, no `filter-demo.` prefix, because the folder supplies
  the domain.
- Rule and matcher names come from the library root: `anyOf`, `applyWhen`, `contains`, `equals`,
  `filter`, `hasAny`, `hasNone`, `inDateRange`, `inRange`; matchers `hasAnyOf`, `hasNoneOf`,
  `isContaining`, `isEqual`, `isInDateRange`, `isInRange`.
- Option lists are hand-supplied and already ship in `fixtures/mock.ts` (`STATUS_OPTIONS`,
  `TAG_OPTIONS`) — never derived from the rows (R11).

## Risks / Watchouts

- Per-kind `isEmpty` is shipped behavior: an empty criterion must narrow nothing without a
  story-local guard (product story 1.3). Do not add one.

## Non-Goals

- No table config (Step 2), no transport (Step 3), no host.

## Acceptance Checks

- [ ] Three factories exported, each callable in an injection context.
- [ ] Every shipped rule kind appears at least once; the quick filter spans a nullable and a numeric
      path.
- [ ] `npx tsc -p libs/table/tsconfig.lib.json --noEmit` clean.

---

[Step 2: filtering fixtures — schema.ts](step-2-filtering-fixtures-schema.plan.md) →
