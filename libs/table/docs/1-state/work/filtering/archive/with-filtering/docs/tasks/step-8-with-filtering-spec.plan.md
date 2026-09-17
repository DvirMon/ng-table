---
title: "Step 8 — withFiltering() spec"
type: task-step
issue: 62
---

# Step 8 — `withFiltering()` spec

**PR scope:** Depends on Step 7. Parallel-safe with Step 9 — different file, no shared state.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/features/with-filtering.spec.ts` (full rewrite)

## Why This Step Exists

The old spec exercises the deleted imperative API (`setColumnFilter`/`setGlobalFilter`/
`clearFilters`, `filterFn`/`enableFiltering` on columns) end to end. None of it is reusable —
every case must be re-expressed against a real `createFilters()` object composed through
`withFiltering({ filters })`.

## What To Do

Build filters and tables the same way `create-filters.spec.ts` and `with-sorting.spec.ts`
already do: `createFilters<Row>(...)` and `createTable(...)` both run inside
`TestBed.runInInjectionContext(...)`. Use `mockRows`/`MockRow` from `table.mock.ts` (or a small
local row fixture, matching this file's existing `Row` shape) as the data.

Cover, per `filtering.md` and the issue's acceptance criteria:

1. **Composition** — `withFiltering({ filters })` composes into `createTable()`'s `features`,
   `TRow` inferred from the enclosing config (no explicit generic on `withFiltering` itself).
2. **Filter stage runs, narrows rows** — set a criterion on one filter, assert `renderRows()`
   (or `rows()`, whichever this package's other feature specs read) only contains matching rows.
3. **Combination** — AND across two separate filters (both must match); OR within one `anyOf`
   group (either sub-path matching is enough) — build the `anyOf` filter via `createFilters()`'s
   own `anyOf()` rule, don't hand-rig it.
4. **Empty criteria never narrow** — with every filter left at its empty value, all rows pass
   through unfiltered.
5. **`manual: true`** — set a criterion, assert `renderRows()` is unfiltered (client-side stage
   skipped) while `filters().active()` / `filters().dirty()` still reflect the write normally.
6. **Throwing predicate degrades, doesn't crash** — a `filter()` rule whose predicate throws:
   assert the table still renders (no thrown error out of `renderRows()`), other active filters
   still narrow correctly, and the error is reported (spy on `console.error` or whatever
   `evaluator.ts` uses) rather than silently swallowed.
7. **No members** — `store` has no `filters`/`setColumnFilter`/etc. members contributed by this
   feature (a `TableStore` composed with only `withFiltering()` exposes nothing beyond the core
   surface).

## Implementation Notes

- Tests go through the public `createTable()` surface only, via `TestBed` — no reaching into
  `api/filters/evaluator.ts` internals directly (that's Step 4/6's territory from issue #27).
- Follow this package's existing spec shape for feature files (see `with-sorting.spec.ts`): a
  local `Row` interface, a `makeColumns()` helper, a `makeStore()` helper wrapping
  `TestBed.runInInjectionContext(() => createTable(...))`.

## Risks / Watchouts

- Don't test `createFilters()`'s own state semantics (`value()`/`reset()`/`dirty()` mechanics,
  key derivation, duplicate-path throws) here — that's fully owned by
  `create-filters.spec.ts` (issue #27, Step 6). This file tests the pipeline integration only:
  given a built `Filters<TRow>`, does the table's `filter` stage honor it correctly.

## Non-Goals

- No `manual` interaction with server-mode — per `filtering.md`, server mode never composes
  this feature at all, so there's nothing to test here beyond the client-side skip itself.

## Acceptance Checks

- [ ] All seven areas above have at least one passing test
- [ ] `nx test shared-table` passes

---
← [Step 7: withFiltering() adapter](step-7-with-filtering-adapter.plan.md) | [Step 9: with-grouping filter interaction fix](step-9-with-grouping-filter-fix.plan.md) →
