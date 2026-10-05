---
step: 5
type: story
commit: docs
depends_on: [2, 3, 4]
files:
  - libs/table/src/stories/tree/tree.mdx (new)
---

# Step 5 — Tree docs page

Adds the single docs page for the Tree entry, with one section per story.
Leaves the convention and coverage-mark edits for Step 6.

Decisions: [TR43, TR44](../../../../../../../decisions/tree.md)

## Do

Page outline and code tabs: see [story-plan.md](story-plan.md) §3 "`tree.mdx`".

```mdx
<Meta title="Table / Tree" name="Docs" />
## Basic / ## Filtered / ## Whole-row click / ## Shared across the three
```

- Each story section has one paragraph on why it exists, a `<Canvas>`, and tabs `TS`, `HTML`, `CSS`.
  `CSS` is `tree-story.css`, as `grouping.mdx` uses `grouping-story.css`.
- Extras are filename-labelled: the toolbar `.ts` and `.html`, and `tree-filtering.filters.ts`.
- RowClick's `CSS` tab is `tree-row-click.css`, with `tree-story.css` as an extra.
- The last section shows `fixtures/schema.ts`.
- The intro links:
  - the [tree UI spec](../../../../../../directives/tree.md);
  - `grouping-collapsible/` for group headers;
  - #190's `expansion/panel-in-groups/` for a tree chevron beside a panel chevron.
- Link repo docs the way existing mdx pages do.

## Watch out

- Any row snippet uses `<tr [ngpTableRow]="row" ngpTableTreeRow>`, with no bare `ngpTableRow` attribute
  beside the binding.
- The page says the toggle name is `'Children of ' + name`, with no level.
- Reduced motion is described as an OS setting with no control.
- The RowClick section says the toggle's click bubbles and the row handler skips it.

## Out of scope

- Story code changes.
- Touching `grouping-collapsible/` or `grouping.mdx`.
- Any `withExpansion()` example.
- Broken-link or cycle content.

## Done when

- [ ] The page has the four sections in order, each embedding a working `<Canvas>`.
- [ ] The intro carries the three links above.
- [ ] Every code tab points at a file that exists.

---

← [Step 4: Whole-row click story](step-4-whole-row-click-story.plan.md) | [Step 6: Story conventions and coverage marks](step-6-conventions-and-coverage.plan.md) →
