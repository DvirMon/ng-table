---
title: "Step 4 — rowsOf test coverage"
type: task-step
issue: 65
---

# Step 4 — `rowsOf` test coverage

**PR scope:** Tests only. **Parallel-safe with Step 5.**

**Task type:** test

**Skills used:** unit-test

**Depends on:** Step 3

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/engine/grouping.spec.ts` (edit)
- `libs/shared/table/src/api/features/with-grouping.spec.ts` (edit)

## Why This Step Exists

The issue's acceptance criteria are behavioral and mostly only observable through a composed
table — post-filter membership, reactivity inside a `computed()`, and "a group id never enters
`selectedRows`". The split follows the spec's Testing Decisions: pure engine logic gets plain
`vitest`; everything else goes through the public `createTable()` surface with no reach into
internals.

Spec: `../../../3-spec.md`, "Testing Decisions".

## What To Do

### 1. `engine/grouping.spec.ts` — plain `vitest`, no `TestBed`

Hand-built `RenderRow[]` fixtures (a header, nested header, leaves) — the shape
`buildGroupRenderRows` emits:

- Returns every leaf beneath a header at depth 2+, not just immediate children.
- Nested `kind: 'group'` rows are skipped as values but walked through.
- The walk stops at the next sibling at or above the header's depth — a later cluster's leaves
  never leak in.
- An id matching no row returns `[]`.
- A `kind: 'row'` id returns `[]` (matches no header), no throw.

### 2. `api/features/with-grouping.spec.ts` — through `createTable()`

Compose a real table with `withGrouping()` and assert on public members only:

- **Depth:** two-level grouping — the outer header's `rowsOf` returns every leaf under both inner
  clusters; an inner header returns only its own.
- **Stale header:** capture a header from `renderRows()`, force a new render pass (change sort, or
  patch an unrelated field), then call `rowsOf` with the *captured* object — same leaves.
- **Reactivity:** a `computed()` that finds a header by `groupKey`/id and calls `rowsOf`
  recomputes after a `data` write, a filter change, and a grouping change (`TestBed`, read the
  computed between changes).
- **Post-filter:** with `withFiltering()` composed and a predicate excluding a row, that row never
  appears in `rowsOf()` for its group.
- **Missing group:** hold a header, then remove every row in that cluster — `rowsOf` returns `[]`,
  no throw.
- **Cascade recipe:** with `withSelection()` composed, run the documented recipe
  (`table.rowsOf(g).map(table.trackBy)` → `selectionStateOf` → `select`/`deselect`) and assert
  `selectedRows` contains exactly the leaf ids and **no** `group:` id; a second run deselects.
  Also assert `selectionStateOf(ids)` walks `'none' → 'all'`, and `'some'` after deselecting one.

## Implementation Notes

- Fixtures come from `table.mock.ts` — don't inline row data (`CLAUDE.md`).
- Assert on values, not recomputation counts. "It recomputes" is asserted by reading the
  `computed()` and seeing the new value, never by counting evaluations.
- No DOM/structural assertions — that is the directive layer's job.

## Risks / Watchouts

- The "stale header" test is void if the trigger doesn't actually rebuild the `RenderRow` objects.
  Confirm the captured header is `!==` the freshly-found one before asserting the result.
- Keep the selection-cascade test reading `table.trackBy` rather than a hand-written id builder —
  it is the recipe consumers copy.

## Non-Goals

- No perf/benchmark test for the O(n) cost (D16 accepts it).
- No directive-layer wiring test.

## Acceptance Checks

- [ ] Every issue #31 acceptance criterion has a corresponding case.
- [ ] Store-level cases go through `createTable()` only — no import from `engine/` in
      `with-grouping.spec.ts`.
- [ ] `nx test shared-table` passes.

---
← [Step 3: rowsOf member](step-3-rows-of-member.plan.md) | [Step 5: Docs](step-5-docs.plan.md) →
