# Step 8 — Migrate the grouping story hosts onto `cells`

**PR scope:** Six story-host templates stop calling `ColumnDef.accessor` and stop indexing
`aggregates` directly. Closes #80's C5. Consumer-side only — no library change.
**Depends on:** Step 3 (`cells` must exist).
**Parallel-safe with:** Step 5, Step 6, Step 7.
**Task type:** `code`
**Skills used:** `angular-developer`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Action |
|---|---|
| `…/stories/grouping/grouping-static/grouping-static-story-host.component.html` | edit — lines 134, 148, 151, 154 |
| `…/stories/grouping/grouping-crud/grouping-crud-story-host.component.html` | edit — lines 78, 124, 153, 156, 159 |
| `…/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.html` | edit — lines 118, 145, 148, 151 |
| `…/stories/grouping/grouping-selection/grouping-selection-story-host.component.html` | edit — lines 92, 119, 122, 125 |
| `…/stories/grouping/grouping-regressions/grouping-regressions-story-host.component.html` | edit — lines 70, 84, 87, 90 |
| `…/stories/grouping/grouping-async-rule/grouping-async-rule-story-host.component.html` | edit — lines 70, 73, 76 |

All paths are under `libs/table/src/`. Line numbers are from the tree as of 2026-09-19 — find the
expressions, do not trust the numbers after any other step lands.

## Why This Step Exists

#80's problem statement is a *consumer* problem: six story hosts call `column.accessor(rowData)`
once per cell per change-detection pass. Shipping `cells` without moving them leaves the library's
own worked examples teaching the pattern the library just replaced — and `docs/3-ui/stories.md`
makes these hosts the reference for how a consumer writes a table.

`decisions.md` leaves "which of the six move in #80" open and hands the call to `/to-tasks`. **All
six.** The edit is mechanical and identical in each; leaving some behind puts two idioms in one
story folder, which is exactly the drift D7 warns about.

## What To Do

Two substitutions, applied everywhere they appear.

**Data-row cells** — inside the `@for (column of visibleColumns(); …)` loop over a
`kind: 'row'` row:

```html
<!-- before -->
@switch (column.id) {
  @case ('amount')   { {{ column.accessor(rowData) | dealAmount }} }
  @case ('closedAt') { {{ column.accessor(rowData) | dealDate }} }
  @default           { {{ column.accessor(rowData) }} }
}

<!-- after -->
@switch (column.id) {
  @case ('amount')   { {{ row.cells[column.id] | dealAmount }} }
  @case ('closedAt') { {{ row.cells[column.id] | dealDate }} }
  @default           { {{ row.cells[column.id] }} }
}
```

The `@switch` on `column.id` stays — it picks the *pipe*, which is presentation and stays the
consumer's (D6). Only the value expression changes.

**Group-row aggregates** — inside the `kind: 'group'` branch:

```html
{{ row.aggregates?.[column.id] | dealAmount }}   <!-- before -->
{{ row.cells[column.id] | dealAmount }}          <!-- after -->
```

`grouping-crud` line 78 uses a literal key, `row.aggregates?.['amount']`; it becomes
`row.cells['amount']`. Same substitution, literal instead of `column.id`.

These are equivalent by construction: a group row's `cells` **is** `{ ...aggregates }` (D5), and a
column with no `aggregateFn` reads `undefined` from both.

**The `@if (row.data; as rowData)` wrapper.** Each data-row branch opens with it. Once the cell
expressions no longer reference `rowData`, check whether the rest of that branch still uses it —
several hosts bind `rowData` elsewhere (row-level classes, click handlers, selection). Where it is
genuinely unused afterwards, drop the wrapper; where it is still read, leave it. Do not force
either outcome.

**`grouping-async-rule` has no group-row branch** — it is the only one of the six with no
`aggregates` expression. Three accessor call sites, nothing else.

## Implementation Notes

`row.cells[column.id]` is typed `unknown`, which is what the existing pipes already take —
`grouping-story.pipes.ts:7-9` says so in its own comment: *"Each takes `unknown` because a cell
reads through `ColumnDef.accessor`, whose return type is erased."* So `strictTemplates` is
satisfied without a cast, and no pipe signature changes.

The group **header label** is untouched. It renders `row.groupKey.value` through a `@switch` on
`row.groupKey?.columnId`, and that stays: `groupKey.columnId` names a *row field*, `cells` is keyed
by *declared column id*, and the two vocabularies are deliberately separate (ADR-0021, D5's
amendment). Do not "simplify" a `groupKey` expression into a `cells` lookup.

There is no `.ts` change in any of the six hosts. If one seems to need it, the template edit went
wrong.

## Risks / Watchouts

- **This is the one step that can only be verified by rendering.** `tsc` never opens a `.html`;
  `nx run shared-table:typecheck` runs `ngc` and does, but only if the run reaches the template
  phase — `ngc` aborts at the first `.ts` error. Fix any source error, re-run, and treat only the
  second, source-clean run as evidence.
- **Do not touch `row.groupKey`.** See above.
- **Do not collapse the `@switch` on `column.id`.** It selects the pipe, not the value. Removing it
  would move formatting into the engine, which D6 explicitly rejected.
- **Six files, one edit shape — verify each, do not pattern-replace blindly.** `grouping-crud` has
  five sites and one of them uses a literal key; `grouping-async-rule` has three and no group
  branch.
- **Behavior must be pixel-identical.** Every rendered value is the same value by a shorter path.
  If a story looks different, `cells` is wrong, not the template.
- No new stories, no `.mdx` changes.

## Non-Goals

- No migration of story hosts outside `stories/grouping/`. No other folder calls
  `column.accessor()` in a template — grep confirms the six here are the whole set.
- No removal of `aggregates` from `RenderRow`. Templates stop indexing it; the field stays.
- No fix to `api/features/with-sorting.ts:117-118`, the one remaining unwrapped `accessor` site.
  Deliberate follow-up (D9), recorded in ADR-0022.
- No story demonstrating a throwing `accessor` or the duplicate-id throw. Both are developer
  diagnostics; the engine tests own them.

## Acceptance Checks

- [ ] `grep -r "accessor(" libs/table/src/stories/` returns nothing.
- [ ] `grep -r "aggregates" libs/table/src/stories/` returns nothing.
- [ ] All six hosts read `row.cells[column.id]`; `grouping-crud` also reads `row.cells['amount']`.
- [ ] Every `@switch (column.id)` pipe selection is preserved; no pipe signature changed.
- [ ] Every `row.groupKey` expression is unchanged.
- [ ] No `.ts` file under `stories/grouping/` was modified.
- [ ] An `@if (row.data; as rowData)` wrapper was removed only where `rowData` became unused.
- [ ] `nx run shared-table:typecheck` clean **on a source-clean run** — confirm the run reached the
      template phase.

---
← [Step 7: Document `accessor` as the value contract](step-7-docs-accessor-contract.plan.md)
