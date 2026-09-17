---
title: "Step 8 — 3-ui/architecture.md U5: stale filtering method names"
type: task-step
plan: ../../1-gap-analysis.md
node: G
---

# Step 8 — `3-ui/architecture.md` U5: stale filtering method names

**PR scope:** Docs only. One row.

**Task type:** docs

**Skills used:** audit-docs

**Depends on:** —
**Parallel-safe with:** every other step in this plan

**Scaffolding agent:** — (main thread)

## Files

- `libs/shared/table/docs/3-ui/architecture.md` (edit)

## Why This Step Exists

Node G. U5's filtering row names `setColumnFilter()` / `setGlobalFilter()`, which no longer exist.
The underlying verdict — ordinary form inputs, Angular owns the a11y — still holds (`cov §2b`
reaches it independently); only the method names are wrong.

## What To Do

1. Replace the two dead method names with the shipped surface: `createFilters()` and the declared
   criteria it returns (`filters.<key>().set(…)` / `.reset(…)`, `filters().active()`), verified
   against `src/api/create-filters.ts` and `src/api/filters.types.ts`.
2. Leave the verdict text alone.

## Risks / Watchouts

- Do not re-derive the U5 verdict; this is a naming correction, not a decision revisit.

## Non-Goals

- No other U-row edits.

## Acceptance Checks

- [ ] No occurrence of `setColumnFilter` / `setGlobalFilter` remains in `3-ui/architecture.md`.
- [ ] Every replacement name exists in `src/`.

---
← [Step 7: filters.md code status](step-7-filters-doc-code-status.plan.md) | [Step 9: product coverage marks](step-9-filtering-coverage-marks.plan.md) →
