---
title: "Step 6 — grouping-selection/: what ticking a group's checkbox does"
type: task-step
plan: ../../1-gap-analysis.md
node: E
---

# Step 6 — `grouping-selection/`: what ticking a group's checkbox does

**PR scope:** One story folder, complete — host, template, `.stories.ts`, `.mdx`.

**Task type:** code

**Skills used:** angular-developer, css-styling, typescript-conventions

**Depends on:** Step 2
**Parallel-safe with:** Step 4, Step 5

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/stories/grouping/grouping-selection/grouping-selection-story-host.component.ts` (create)
- `libs/shared/table/src/stories/grouping/grouping-selection/grouping-selection-story-host.component.html` (create)
- `libs/shared/table/src/stories/grouping/grouping-selection/grouping-selection.stories.ts` (create)
- `libs/shared/table/src/stories/grouping/grouping-selection/grouping-selection.mdx` (create)

## Why This Step Exists

Node E. `withGrouping()` + `withSelection()` + `withFiltering()`. D16 made the group-selection
cascade **consumer-owned** and then said the directive layer should ship the correct wiring as its
default "so most people never hold it wrong" — until that layer exists, **this story is the
reference wiring**. Folding a tri-state checkbox column into Step 4 would also clutter the baseline
whose job is to be readable.

Covers X-G1 in five parts.

## What To Do

1. `createTable(data, groupedSelectionConfig, withGrouping(…), withSelection(…), withFiltering(…))`.
2. **Group checkbox** → `select(table.rowsOf(group).map(r => r.id))`, the D16 pattern written once
   where it can be copied — behind a **`cascade` arg**: `self` / `descendants` /
   `descendants+parents`. P10 is the inventory's sharpest split (AG Grid defaults `'self'`,
   TanStack cascades to descendants, MUI X propagates both ways); D16's position is that the library
   ships none of them, and the strongest demonstration of that position is one story rendering all
   three as ordinary consumer code off one `rowsOf()`. A single hardcoded cascade would read as the
   library's position — the opposite of D16.
3. **Tri-state** group checkbox derived from `rowsOf(group)` ∩ `selectedRows()` (P10b: conventional
   wherever a cascade exists).
4. **Collapsed + filtered agreement** — tick a *collapsed* group while a filter is active. `rowsOf()`
   is collapse-independent and post-filter, so the header count and the selection agree by
   construction. This is ag-grid #11209 *not* happening; say so in the doc-comment.
5. **Selection counts rows, never headers** — a "N of M selected" readout. §6's "a group is a view,
   not a record" made visible (TanStack #5700 is the failure).
6. **Ungroup button** — no group id was ever in `selectedRows`, so there is nothing to prune and no
   phantom entries (TanStack #5822: pin an aggregation row, ungroup, hard error on a vanished id).
7. Per-row checkboxes alongside the group ones — native `<input type="checkbox">`, hand-wired, same
   binding recipe the selection stories use (`[checked]` off `selectedRows()`, `(change)` →
   `toggle(row.id)`; never a `RenderRow` field — D5).

**`.stories.ts` + `.mdx`.**

- Title `Table / Grouping / Group selection`. Single `Default` export — every verb here is
  synchronous and local, so there is no rollback state that never renders on the happy path, and
  per `stories.md` no `ForcedFailure` is earned.
- Code tabs: `HTML`, `TS`, `CSS`, `grouping/fixtures/schema.ts`.

## Implementation Notes

- Read `docs/3-ui/stories.md` first.
- The doc-comment must name D16 and P10's three-way split explicitly — the `cascade` arg is the
  story's whole argument, not a convenience control.
- One cascade function reading the arg signal; not three code paths.

## Risks / Watchouts

- Never put a group id into `selectedRows` — that is the failure the story exists to show absent.
- Keep the filter surface minimal (one input); this is not a filtering showcase.

## Non-Goals

- No bulk delete/edit behind the selection (D12 keeps bulk mutations out of scope). No MSW. No unit
  tests on the host.

## Acceptance Checks

- [ ] All three `cascade` values behave as their named peer default does, off one `rowsOf()` call.
- [ ] The group checkbox renders indeterminate for a partial selection.
- [ ] Ticking a collapsed group under an active filter selects exactly the rows the header counts.
- [ ] The readout counts rows only; ungrouping leaves the selection intact and error-free.
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` clean.

---
← [Step 5: grouping-collapsible/](step-5-grouping-collapsible-story.plan.md) | [Step 7: async grouping rule](step-7-async-grouping-rule.plan.md) →
