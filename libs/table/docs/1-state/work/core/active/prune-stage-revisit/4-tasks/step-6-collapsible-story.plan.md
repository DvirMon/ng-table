# Step 6 — The collapsible grouping story reads `row.isExpanded`

**PR scope:** One PR. `Depends on: Step 1`
`Parallel-safe with: Step 2, Step 3, Step 4, Step 5, Step 7`

**Task type:** `code`
**Stack:** `angular`
**Skills used:** `angular-developer`
**Scaffolding agent:** `angular-implementer`

## Files

| Path                                                                                     | Action                 |
| ---------------------------------------------------------------------------------------- | ---------------------- |
| `…/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.html` | edit (lines 77, 79)    |
| `…/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.ts`   | edit (JSDoc, ~line 25) |
| `libs/table/src/stories/grouping/grouping.mdx`                                           | edit (~line 427)       |

## Why This Step Exists

This is the consumer-visible half of D3 — the reason the migration is
_additively_ non-neutral rather than fully behaviour-neutral. Before
Step 1, a group header had no `isExpanded`, so this template reached
past the row into `table.expandedRows().has(row.id)` while the detail
row beside it (line 109) already read `row.isExpanded`. Two spellings
for one question, decided by `row.kind`.

After Step 1 the header carries a real `isExpanded`, because this
story composes `withExpansion()` alongside `withGrouping()` — a
contributed slot, so D1a stamps it. Leaving the old spelling in the
one story that demonstrates the feature would ship the fix and keep
teaching the workaround.

## What To Do

1. **`…-story-host.component.html:77`** —
   `[attr.aria-expanded]="table.expandedRows().has(row.id)"`
   becomes `[attr.aria-expanded]="row.isExpanded"`.
2. **Line 79** — the same expression inside the `aria-label` ternary
   (`'Collapse ' : 'Expand '`) becomes `row.isExpanded`.
3. **Line 109 and 111** already read `row.isExpanded`. Leave them —
   they are now the same expression, which is the point.
4. **`…-story-host.component.ts:25`** — the JSDoc sentence says group
   headers read `table.expandedRows().has(row.id)` while
   `renderRows()` stamps `isExpanded` on detail rows. Rewrite it to
   say one expression answers both, and drop the split it described.
5. **`grouping.mdx:427`** — the same paragraph in prose. Same
   rewrite. Check whether the surrounding code sample also shows the
   old spelling and update it if so.

## Implementation Notes

- Nothing else in the story changes: the toggle handler still calls
  `table.toggleExpanded(row.id)`, and `table.expandedRows()` remains
  a legitimate member for anything that needs the whole set.
- Grep the other story hosts for
  `expandedRows().has(` before finishing — if another story reaches
  past the row for the same reason, fix it here and say so. If it
  reaches for a _different_ reason (an `expandAll` affordance, a
  count), leave it.

## Risks / Watchouts

- **`ngc` aborts at the first `.ts` error and never reaches the
  template phase.** A typecheck run that reported source errors
  checked no templates at all. Fix, re-run, and only trust the
  second, source-clean run — this is exactly the class of bug
  `.claude/rules/typecheck-angular-templates.md` was written for
  (#60).
- `row.isExpanded` is `boolean | undefined`. Confirm the binding and
  the ternary read correctly when it is `undefined` — on a header
  with no children, it will be.

## Non-Goals

- Any other story host, unless the grep above turns up the same
  workaround for the same reason.
- Storybook conventions, story structure, or new stories.
- Running Storybook. Static typecheck only.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean on a **second,
      source-clean run** — the template phase must actually execute.
- [ ] `grep -rn "expandedRows().has(" libs/table/src/stories`
      returns nothing in the collapsible grouping story.
- [ ] The component JSDoc and the MDX paragraph no longer describe a
      split between header and detail-row spellings.

---

← [Step 5: core.spec and the wording sweep](step-5-core-spec-and-sweep.plan.md) | [Step 7: ADRs and maintainer docs](step-7-adrs-and-docs.plan.md) →
