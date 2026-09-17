---
title: "Step 6 — selection-filtering/: selection under an active filter"
type: task-step
plan: ../../1-gap-analysis.md
node: D
---

# Step 6 — `selection-filtering/`: selection under an active filter

> **Reworked 2026-09-14.** Filter declaration moved inline into the host with a typed
> `TState`; the customer input binds through Signal Forms. Selection behaviour is
> unchanged.

**PR scope:** One story folder, complete — host, template, `.stories.ts`, `.mdx`.

**Task type:** code

**Skills used:** angular-developer, css-styling, typescript-conventions

**Depends on:** Step 1, Step 2
**Parallel-safe with:** Step 4, Step 5

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/stories/filtering/selection-filtering/selection-filtering-story-host.component.ts` (create)
- `libs/table/src/stories/filtering/selection-filtering/selection-filtering-story-host.component.html` (create)
- `libs/table/src/stories/filtering/selection-filtering/selection-filtering.stories.ts` (create)
- `libs/table/src/stories/filtering/selection-filtering/selection-filtering.mdx` (create)

## Why This Step Exists

Node D, and a **cross-plan blocker**: the selection plan's doc step
(`../../../selection-stories/docs/tasks/step-4-selection-docs.plan.md`) cannot flip its §1.4 /
§2.3 / §2.4 / §2.5 marks until this story renders.

**Ownership settled 2026-09-13:** the selection plan independently proposed a folder of this name
and gave it up. This plan owns it, because the story only means anything over a fixture that can
exercise real filters (six rule kinds, a nullable field, an array field) — `InvoiceRow` — while the
selection half adds only a checkbox column on top. Cheap dependency follows expensive one.

`pain T1` is the largest single cluster in the whole corpus: 9 issues across four libraries,
2019→2026, every one of them having shipped the wrong select-all default at least once.

## What To Do

1. `createTable(data, selectionInvoiceConfig, withFiltering({ filters }), withSelection(…),
   withSorting())`.
2. **Two select-all buttons, side by side, co-equal and separately named** — `selectAllIds(table)`
   (defaults to `rows()`: post-filter, post-sort — D59) and
   `selectAllIds(table, { includeHidden: true })`. Deliberately TanStack's shape: the only library
   exposing visible- and dataset-scope as two equally first-class named functions rather than one
   flag with a chosen default, and the matrix says there is no convergent default to inherit. This
   is the literal bug in MUI X #976 / #1141 / #1863 and AG Grid #2139.
3. **Header select-all checkbox**, tri-state, indeterminate scoped to the **visible** rows
   (TanStack #4781 is exactly this confusion). Its `checked` state reads `all` while
   selected-but-hidden rows exist, because `selectionStateOf(selectAllIds(table))`'s denominator is
   the visible set — render that deliberately and let the doc-comment name the denominator question
   as **open** (`ux §5`: unanswered by every library researched; MRT PR #1499 open and unmerged).
4. **Retention of a hidden selection — expected to fail today.** Select rows, then filter them out.
   `withSelection()` retains them, but no signal reports "M not currently visible". Render a
   `hiddenSelectionNotice` stating that gap live, routed to
   `1-state/work/computed-state-mechanism/1-intake.md` and `0-product/selection.md` §2.5. It starts
   passing on its own when the signal ships — no story rework. The doc-comment names **MUI X's
   opposite, documented behavior** ("selected rows that do not pass the filtering criteria are
   automatically deselected") so the reader sees retention is a *rejected* convention, not an
   unconsidered default.
5. **Clearing the filter restores the selection exactly** — nothing added, nothing lost (TanStack
   #2210, MUI X #14074 are the failures this proves absent).
6. **Failure behavior** — when the hidden count is unavailable, only the *count display* degrades;
   the selection itself is never reset as a side effect.
7. **Sort toggle** — the selection is unchanged when rows reorder. Separates "the row moved" from
   "the row left the visible set", two things one count would otherwise conflate. *(Migrated from
   the selection plan.)*
8. **Delete a selected, currently-filtered-out row** — the count drops (D11), where filtering it out
   never did. Retention and pruning are the same mechanism from two sides. *(Migrated.)*
9. Reuse Step 4's filter inputs (a subset is fine) so there is a real filter to act under.

**`.stories.ts` + `.mdx`.** Title `Table / Filtering / Selection × Filtering`. Single `Default` —
every verb is synchronous and local; no rollback state exists that never renders on the happy path.
Code tabs: `HTML`, `TS`, `CSS`, `filtering/fixtures/filters.ts`, `filtering/fixtures/schema.ts`.

## Implementation Notes

- Read `docs/3-ui/stories.md` first.
- Row-selected styling uses the binding recipe, never a `RenderRow` field (D5):
  `[class.is-selected]` + `[attr.aria-selected]` read off `selectedRows()`.
- Native `<input type="checkbox">`, hand-wired — no checkbox directive exists, and that is what a
  consumer copies today.

## Risks / Watchouts

- The hidden-selection notice is an honest gap, not a workaround: do not compute a substitute
  "hidden count" in the host and present it as shipped behavior. State it is missing.
- Do not import from `stories/selection/fixtures/*` — this story runs on `InvoiceRow`, and a shared
  file between the two clusters is the edge both plans removed on purpose.

## Non-Goals

- No shift-click range select (blocked on the undrilled selection directive), no bulk actions, no
  MSW, no unit tests on the host.

## Acceptance Checks

- [ ] Both select-all buttons exist, named for their scope, with visibly different results.
- [ ] The header checkbox's indeterminate state is scoped to visible rows.
- [ ] Filtering out a selected row retains it; clearing the filter restores the selection exactly.
- [ ] The hidden-selection notice states the missing signal and does not fake it.
- [ ] Sorting leaves the selection untouched; deleting a filtered-out selected row drops the count.
- [ ] `npx tsc -p libs/table/tsconfig.lib.json --noEmit` clean.

---
← [Step 5: server-filtering/](step-5-server-filtering-story.plan.md) | [Step 7: filters.md code status](step-7-filters-doc-code-status.plan.md) →
