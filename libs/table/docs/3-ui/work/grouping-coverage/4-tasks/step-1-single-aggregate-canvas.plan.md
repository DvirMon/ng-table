# Step 1 — A group total appears on exactly one canvas

**Task type:** code
**Stack:** angular
**Parallel-safe with:** Steps 2, 3, 4, 7

## Why

When `fixtures/schema.ts` was split into `groupingConfig` (whose `amount` column carries
`sumAmount`) and `plainGroupingConfig` (no `aggregateFn` anywhere), three hosts kept the wrong
one. The user noticed totals rendering in stories whose lesson is not aggregation: *"we are not
showing a specific code in a specific story."*

Decision D2: a group total appears on exactly one canvas — `grouping-aggregates/`, the story that
owns `aggregateFn`.

## Files

- `libs/table/src/stories/grouping/grouping-async-rule/grouping-async-rule-story-host.component.ts`
- `libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.ts`
- `libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.html`
- `libs/table/src/stories/grouping/grouping-selection/grouping-selection-story-host.component.ts`
- `libs/table/src/stories/grouping/grouping-selection/grouping-selection-story-host.component.html`

**Do not edit** `libs/table/src/stories/grouping/fixtures/schema.ts` — it is modified in the
working tree by a parallel effort. Both configs already exist there; this step only changes which
one is imported.

## What to do

In all three hosts, change the `fixtures/schema.ts` import from `groupingConfig` to
`plainGroupingConfig` and update the `createTable(...)` argument.

Rendering is already safe and needs no guard: `computeAggregates`
(`engine/grouping/render.ts:34-55`) skips a column with no `aggregateFn` (`if (!column.aggregateFn) continue;`),
so the key is absent from `RenderRow.cells` and the read yields `undefined`; `formatAmount`
(`stories/grouping/fixtures/utils.ts:31-40`) returns `''` for a non-number. Cells go cleanly
blank — no `NaN`, no `$0`, no throw.

Two templates then carry markup that lies, and must be cleaned in the same commit:

- `grouping-collapsible-story-host.component.html:94-96` and
  `grouping-selection-story-host.component.html:90-92` — the group-header branch's
  `@else { {{ row.cells[column.id] | dealAmount }} }` is now always empty. Remove the
  interpolation, leaving the `<td>`.
- Same two files — `[class.grouping-story__aggregate]="!isFirst"` (collapsible `:72`, selection
  `:79`) styles a cell that holds no aggregate (`grouping-story.css:47-51` — tabular numerals
  and an accent colour). Remove the binding.

`grouping-async-rule/`'s template renders content only when `isFirst`, so it never showed a
total at all — there the swap is a no-op on canvas. It was carrying the aggregate config for
nothing, which is exactly the leak this step closes.

## Acceptance checks

- [ ] `nx run shared-table:typecheck` clean. Templates change here, so this is the only check
      that reads them; if the run reports `.ts` errors it aborted before the template phase —
      fix and re-run until a source-clean run passes.
- [ ] No grouping host other than `grouping-aggregates/` imports `groupingConfig`. Verify:
      `grep -rn "groupingConfig" libs/table/src/stories/grouping/*/*-story-host.component.ts`
      returns only `grouping-aggregates` plus `plainGroupingConfig` matches.
- [ ] `fixtures/schema.ts` is unmodified by this step (`git diff --stat` names it nowhere).
- [ ] `grouping-story__aggregate` is referenced by no grouping template.

## Known consequence — do not treat as a regression

F-G1's first acceptance criterion in `0-product/grouping.md` is "counts **and summaries** are
computed over the rows that survived the filter", and `grouping-selection/` was the only host
composing `withFiltering()`. After this step the counts half still renders; the summaries half
becomes an argument from `PIPELINE_ORDER` rather than something on screen. This was accepted
explicitly. Step 5 records it; do not "fix" it by reverting the config here.
