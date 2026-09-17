---
title: "Step 4 — collapse/expand test coverage"
type: task-step
issue: 59
---

# Step 4 — collapse/expand test coverage

**PR scope:** Tests only. **Parallel-safe with Step 5.**

**Task type:** test

**Skills used:** unit-test

**Depends on:** Step 3

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/engine/grouping.spec.ts` (edit)
- `libs/shared/table/src/api/features/with-grouping.spec.ts` (edit)

## Why This Step Exists

Issue #25's acceptance criteria plus the rowsOf-collapse fix (Step 2) split the same way the spec's
Testing Decisions always have: pure engine logic gets plain `vitest`, everything behavioral
(composition, optional-read detection, cross-feature interaction) goes through `createTable()` with
no reach into internals.

Spec: `../../../3-spec.md`, "Testing Decisions" and its Coverage list (the `withExpansion()`
collapse/expand line).

## What To Do

### 1. `engine/grouping.spec.ts` — plain `vitest`, no `TestBed`

**Extend `describe('buildGroupRenderRows', ...)`:**
- An `expandedRows` set omitting a depth-0 header's id: that header still renders, but every
  descendant (nested headers and leaves, at every depth) is omitted.
- An `expandedRows` set including a header's id but omitting one of its children's ids: the
  included header's *own* children render, but that grandchild's descendants are omitted — proves
  gating is per-node, not "the whole subtree if the top is expanded."
- `expandedRows: undefined` (omit the 5th arg entirely): identical output to the current 4-arg
  behavior — the explicit regression case for "no `withExpansion()` composed."
- An empty `Set()`: every header renders, every descendant is omitted (nothing is a member) —
  distinguishes "no expansion feature" (`undefined`) from "expansion feature present, nothing
  expanded yet" (empty set), which produce different results.

**Replace `describe('rowsBeneathGroup', ...)` entirely** — the old `twoClusterFixture()` /
`header()` / `leaf()` helpers build hand-rolled `RenderRow[]`s with ids (`'group:A'`) that don't
match the real `` group:${path} `` format and no longer fit the new signature. Delete those helpers
and the `Leaf` interface (dead code after this step); reuse the file's existing `orders`/`columns`
fixtures instead:

- Two-level grouping (`['region', 'category']`): a depth-0 group id (e.g.
  `'group:>region:string:US'`) returns every leaf under all of its sub-clusters.
- A depth-1 (nested) group id returns only its own sub-cluster's leaves, never a sibling
  sub-cluster's.
- An id matching no cluster returns `[]`, no throw.
- A malformed/non-group id returns `[]`, no throw.
- **The regression case Step 2 exists for:** build the same cluster lookup and confirm it does not
  take `expandedRows` or `renderRows()` as input at all — there is no collapse-related parameter to
  even pass. (This is enforced by the type signature, not a runtime assertion — call it out in the
  test file's describe-level comment instead of asserting something untestable.)

### 2. `api/features/with-grouping.spec.ts` — through `createTable()`

Import `withExpansion` from `./with-expansion`. New `describe('collapse/expand (#25)', ...)` block:

- **No `withExpansion()` composed (regression, unchanged from #7):** `withGrouping()` alone —
  `renderRows()` has every cluster flat and fully expanded, matching the existing "composed alone"
  test already in this file.
- **`withExpansion()` composed, nothing toggled:** every group's descendants are omitted (default
  `expandedRows` is empty — collapsed, same as any tree row that's never been toggled).
- **`withExpansion()` composed, `toggleExpanded(headerId)` called:** that header's descendants
  appear; sibling headers stay collapsed.
- **Two-level grouping, expand outer only:** the outer header's own direct children (inner headers)
  appear, but the inner headers' own leaves stay hidden until they're individually toggled too —
  proves gating is per-node depth-by-depth, not "expanding the top reveals everything beneath it."
- **Feature array order doesn't matter:** compose `[withExpansion(), withGrouping()]` and
  `[withGrouping(), withExpansion()]` — same collapse behavior either way (proves the `composed`
  read is genuinely order-independent, not accidentally working because of array position).
- **No throw / no console warning composing `withGrouping()` without `withExpansion()`** — spy on
  `console.warn`/`console.error`, assert neither is called during construction or a `renderRows()`
  read.
- **`rowsOf()` on a collapsed group (the Step 2 regression):** collapse a group via
  `withExpansion()`, then call `table.rowsOf(header)` — still returns the full leaf set, not `[]`.
  Use a header object captured from `renderRows()` before or after collapsing; both must work since
  resolution is by id, not by presence in the current render pass (D16.1, unaffected by this
  issue).

## Implementation Notes

- Fixtures come from `table.mock.ts` (`mockGroupingRows`, `mockGroupingTrackBy`,
  `GroupingMockRow`) and this file's own `makeColumns()`/`makeStore()` helpers — don't inline new
  row data.
- `withExpansion<GroupingMockRow>()` needs no config for these cases — `mockGroupingRows` has no
  `children` field, so its `childrenAccessor`/`isExpandable` defaults never fire; only its
  `expandedRows` member is exercised here.
- Assert on `renderRows()` shape (`kind`, `depth`, present/absent ids) the same way the existing
  grouping tests do (`toShape` helper already in this file) — no DOM/structural assertions.

## Risks / Watchouts

- **Toggling a header id requires knowing it in advance.** Read it off an uncollapsed
  `renderRows()` pass first (or construct it from the same `` group:>columnId:type:value ``
  format the existing "groupOrder omitted" test already asserts against), rather than guessing a
  literal string independently — a drift between the id format used in the test and the real one
  would pass for the wrong reason.
- **Don't assert on `console.error`/`console.warn` call *count* being zero across the whole suite**
  — scope the spy to the single construction + first `renderRows()` read this test performs, mirror
  the existing `groupOrder` throw test's spy/restore pattern (`with-grouping.spec.ts`'s last case).

## Non-Goals

- No perf/benchmark test for the re-clustering cost in `rowsBeneathGroup` (D12/D16 already accept
  the O(n)-per-call model).
- No directive-layer / UI toggle test — that's a separate, UI-stream issue.
- No test for `ADR-0012`'s proposed `withTree()` split (not implemented).

## Acceptance Checks

- [ ] Every issue #25 acceptance criterion has a corresponding case.
- [ ] The Step 2 `rowsOf`-under-collapse regression has an explicit test, not just incidental
      coverage.
- [ ] Store-level cases go through `createTable()` only — no import from `engine/` in
      `with-grouping.spec.ts`.
- [ ] `nx test shared-table` passes.

---
[← Step 3: Wire withGrouping()](step-3-wire-with-grouping.plan.md) | [Step 5: Docs →](step-5-docs.plan.md)
