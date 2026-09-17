---
title: "Step 4 — tests for table-wide admission"
type: task-step
issue: 119
---

# Step 4 — tests for table-wide admission

**PR scope:** Pure engine cases for the marking and emission halves, plus behaviour through the
public store for everything a consumer can observe.

**Task type:** test

**Skills used:** unit-test, typescript-conventions

**Depends on:** Step 3 — the config member has to exist.

**Parallel-safe with:** Step 5, Step 6.

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/engine/grouping.spec.ts` (edit)
- `libs/shared/table/src/api/features/with-grouping.spec.ts` (edit)

## Why This Step Exists

Admission has two failure shapes that a single layer of testing will not catch. Engine-level: the
marking pass, the ordering default, the dissolution walk — pure functions, plain `vitest`, no
`TestBed`, per the Testing Decisions' rule that pure engine code needing a harness landed in the
wrong file. Store-level: whether the pipeline stage and the render stage actually agree, which is
only observable once both run off one config.

Testing Decisions: `../../../3-spec.md` § Testing Decisions.

## What To Do

### Engine cases — `engine/grouping.spec.ts`

Beside the existing `sortClusters` block:

1. **`admitClusters` with no predicate returns its input by reference**, at every level — the
   no-op guarantee.
2. **A rejected node is marked, not removed.** It keeps its `columnId`, `value` and `items` and
   stays in the sibling array — this is what lets the comparator place it.
3. **Descendants of a rejected node are never judged.** Use a predicate that records the
   `columnId`s it was called with, and assert the deeper level's id never appears.
4. **A throwing predicate admits the cluster** and calls `console.error` once per column, not once
   per cluster — mirror the existing aggregate-dedupe test's shape, including for a level with
   several rejected clusters.
5. **Stable partition without a comparator:** admitted siblings first in first-occurrence order,
   then dissolved ones in first-occurrence order. Plus the reference-identity case — no dissolved
   sibling means the array comes back unchanged.
6. **Dissolution is post-ordering:** a comparator that sorts dissolved first puts those nodes
   first, and their leaves emit first.
7. **`flattenLeaves` stops at a dissolved node** — its leaves come out in their own order, not
   re-clustered by the deeper level (Q1).

### Store cases — `api/features/with-grouping.spec.ts`

Through `createTable()`, asserting on `renderRows()` / `groupIds()`:

8. **The headline scenario.** Group by `region` with `groupWhen: (c) => c.key != null`; rows with
   no region render at depth 0 with no header above them, while the regions that have a value keep
   theirs. Assert the `[kind, depth, id]` triples the file's existing helper produces.
9. **A size threshold.** `(c) => c.rows.length >= 2` dissolves the single-row clusters and keeps
   the rest — the OQ-6 half.
10. **No group id for a dissolved cluster.** `table.groupIds()` omits it, and `renderRows()`
    contains no `group:` id for that key.
11. **No aggregates for a dissolved cluster** — a column with an `aggregateFn` that throws on the
    dissolved cluster's rows proves it is never called.
12. **Pipeline and render agree.** With `withSorting()` composed so both stages are exercised, the
    row order coming out of the pipeline matches the order the render rows appear in.
13. **Q1 through the public surface.** Two levels (`region` → `rep`), a null region, and a
    predicate rejecting on `key == null`: the escaped rows appear once, flat, at depth 0 — never
    under a `rep` header.
14. **Q3 — the parent's `rowsOf` still includes dissolved rows.** Group by `region` → `category`,
    dissolve a category, and assert `rowsOf(regionHeader)` still returns those rows; `rowsOf` on
    anything resolving to the dissolved cluster returns `[]` with no throw.
15. **Comparator placement.** A comparator putting dissolved clusters first puts their flat rows
    first — the assertion that `ungroupedPlacement` is not needed.
16. **Omitting `groupWhen` changes nothing** — the regression gate for the whole slice.

## Implementation Notes

- **The grouping fixture already carries the blank keys.** `GROUPING_ROWS_MOCK`'s `region` is
  `string | null | undefined` with `null`, `undefined` and `''` all present, so cases 8 and 13 need
  no new fixture. The spec file's own `mockGroupingRows` may not — check before adding rows, and
  extend rather than replace if it does not.
- **Case 4 needs a `console.error` spy**, not a thrown-error assertion. Follow the existing
  aggregate-error test's setup exactly rather than inventing a second spy style.
- **Do not assert on `admitted` through the store.** It is not a public member; the observable is
  what `renderRows()` contains. Only the engine cases touch the flag directly.
- **Case 12 is about agreement, not about sorting.** Keep the sort trivial; a complex comparator
  makes a failure ambiguous between the two stages.

## Risks / Watchouts

- **Do not weaken case 3 to "the predicate was called fewer times".** Assert on which `columnId`s
  it saw — a count is satisfied by the wrong clusters being skipped.
- **Case 16 must compare against a stored expectation of the full triple list**, not a spot check.
  The whole slice's claim is that omitting the key changes nothing.
- Per `feedback_spec-files-assert-own-domain-only`, keep `engine/grouping.spec.ts` asserting on the
  engine's own types — do not reach for `WithGroupingConfig` there.

## Non-Goals

- No per-column predicate cases — #86.
- No DOM/structural assertions; those belong to the directive layer.
- No test for the flat region being labellable — Q2 ships nothing in v1.

## Acceptance Checks

- [ ] Every case above exists and passes.
- [ ] Engine cases run with no `TestBed`.
- [ ] Store cases assert only on public members (`renderRows`, `groupIds`, `rowsOf`, `grouping`).
- [ ] The omitted-`groupWhen` regression case compares a full render-row triple list.
- [ ] The new cases pass locally (`nx test shared-table --testFile=…`, these specs only); the
      full `shared-table` suite is green in CI on the PR.
- [ ] `nx run shared-table:typecheck` clean, on a source-clean run.

---
← [Step 3: Wire config.groupWhen](step-3-wire-group-when-config.plan.md) | [Step 5: The story](step-5-grouping-static-story.plan.md) →
