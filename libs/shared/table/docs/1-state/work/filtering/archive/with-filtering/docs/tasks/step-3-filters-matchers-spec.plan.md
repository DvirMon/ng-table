---
title: "Step 3 — Matchers spec"
type: task-step
issue: 61
---

# Step 3 — Matchers spec

**PR scope:** Depends on Step 2's public shape; otherwise standalone.

**Task type:** test

**Skills used:** unit-test (selection policy — these are pure logic functions, squarely in scope)

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/filters/matchers.spec.ts` (new)

## Why This Step Exists

Matchers are pure, independently testable, and carry the one policy (R27 null handling) that's
easy to get subtly wrong per-function. Colocated `vitest` spec, no `TestBed` — matches this
repo's rule that pure `engine/`-shaped logic is tested without Angular test machinery.

## What To Do

1. One `describe` block per matcher, covering:
   - The straightforward true/false case from `filters.md`'s own examples.
   - The null/undefined cell case (R27 table): every positive matcher → `false`; `hasNoneOf` → `true`.
   - `isInRange`/`isInDateRange`: one-sided bounds (`min` only, `max` only) and both-null (matches
     everything — not the same as *empty*, which is a Step 5 concern, but the matcher itself must
     not throw or misbehave on that shape).
   - `hasAnyOf`/`hasNoneOf`: empty criterion array, empty cell array, disjoint arrays, intersecting
     arrays.
   - `isContaining`: case-insensitivity, substring not equality.
2. No test constructs a `createFilters()` instance — these are direct unit tests of the exported
   functions.

## Implementation Notes

- Follow this package's existing spec style (`columns.spec.ts` is a good pure-function precedent
  to match for structure/assertions).

## Risks / Watchouts

- Don't test emptiness detection here — that's `isEmpty`, declared per-rule in Step 5's spec
  (Step 6), not a matcher concern.

## Non-Goals

- No integration with `create-filters.ts`/`rules.ts` — pure function tests only.

## Acceptance Checks

- [ ] Every matcher has a null/undefined-cell test matching the R27 table
- [ ] `nx test shared-table` passes

---
← [Step 2: Matchers](step-2-filters-matchers.plan.md) | [Step 4: createFilters() core](step-4-create-filters-core.plan.md) →
