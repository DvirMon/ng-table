---
step: 4
type: story
commit: feat
depends_on: [1]
files:
  - libs/table/src/stories/tree/tree-row-click/tree-row-click-story-host.component.ts (new)
  - libs/table/src/stories/tree/tree-row-click/tree-row-click-story-host.component.html (new)
  - libs/table/src/stories/tree/tree-row-click/tree-row-click.css (new)
  - libs/table/src/stories/tree/tree-row-click/tree-row-click.stories.ts (new)
---
# Step 4 — Whole-row click story

Adds the `Whole-row click` story: clicking anywhere on a parent row opens it.
Leaves the toolbar, filtering and bulk controls out.

Decisions: [TR36, TR44](../../../../../../../decisions/tree.md)

## Do

Host shape and handler: see [story-plan.md](story-plan.md) §3 "RowClick".

```html
<tr [ngpTableRow]="row" ngpTableTreeRow (click)="toggleFromRowClick(row, $event)">
```

```css
[ngpTableTreeRow][data-expandable] { cursor: pointer; }
```

- `withTree({ parentId })` only. No toolbar.
- `toggleFromRowClick(row, event)` uses named booleans and does three things:
  - returns when the target is inside `[ngpTableTreeToggle]` (an `instanceof Element` guard, no `as`);
  - returns when the row has no children;
  - otherwise calls `table.tree.toggle(row.id)`.
- The CSS rule above goes in `tree-row-click.css`.
- `styleUrls`: `story-host.css`, `tree-story.css`, `tree-row-click.css`.
- Export `RowClick` with `name: 'Whole-row click'`.

## Watch out
- The toggle name is `'Children of ' + row.data.name`, with no level.
- The toggle sits on every row in the `name` cell, keyed by `column.id === 'name'`.
  No `@if (row.hasChildren)` around it.
- `<tr [ngpTableRow]="row" ngpTableTreeRow ...>`, with no bare `ngpTableRow` attribute beside the binding.
- Do not call `stopPropagation` on the toggle. Skipping the toggle's click is the row handler's job.

## Out of scope
- `withFiltering()`, `withExpansion()`.
- Adding this handler to `Basic`.
- Broken-link or cycle rows.

## Done when
- [ ] Clicking a parent row's text toggles it once.
- [ ] Clicking the toggle button toggles it exactly once.
- [ ] Clicking a leaf row does nothing.
- [ ] The story files contain no `stopPropagation`.

---
← [Step 3: Filtered tree story](step-3-filtered-tree-story.plan.md) | [Step 5: Tree docs page](step-5-tree-docs-page.plan.md) →
