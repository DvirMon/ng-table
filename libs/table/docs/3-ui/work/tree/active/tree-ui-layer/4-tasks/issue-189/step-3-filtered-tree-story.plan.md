---
step: 3
type: story
commit: feat
depends_on: [1]
files:
  - libs/table/src/stories/tree/tree-filtering/tree-filtering-story-host.component.ts (new)
  - libs/table/src/stories/tree/tree-filtering/tree-filtering-story-host.component.html (new)
  - libs/table/src/stories/tree/tree-filtering/tree-filtering-toolbar.component.ts (new)
  - libs/table/src/stories/tree/tree-filtering/tree-filtering-toolbar.component.html (new)
  - libs/table/src/stories/tree/tree-filtering/tree-filtering.filters.ts (new)
  - libs/table/src/stories/tree/tree-filtering/tree-filtering.stories.ts (new)
---
# Step 3 — Filtered tree story

Adds the `Filtered` story: a name filter over the tree, with context rows and a row count.
Leaves bulk controls and whole-row click out.

Decisions: [TR22, TR36, TR38, TR39, TR42](../../../../../../../decisions/tree.md)

## Do

Host shape, hints and coverage table: see [story-plan.md](story-plan.md) §3 "Filtered".
Layout reference: `filtering/client-filtering/`.

```ts
createTable(TREE_ROWS_MOCK, treeConfig,
  withFiltering({ schema: treeFilters }), withTree({ parentId: (row) => row.parentId }));
```

- `tree-filtering.filters.ts`: `name: contains(path.name)`, annotated
  `FiltersPath<TaskRow, ColumnValues<TaskRow, typeof treeColumns.columns>>`.
- The toolbar takes the Signal Forms field `filterForm.name` and emits `clearFilter`.
  The host calls `table.filters().reset(null)`.
- The host shows `{{ table.totalRowCount() }} rows`.
- Row and toggle markup as in Step 2.
- Hints:
  - type "review" and every match shows under its opened ancestors;
  - close one revealed parent and it stays closed while typing;
  - open a non-matching branch, filter, then Clear, and that branch is open again;
  - the matching parent with no matching children shows an inert toggle.
- Export `Filtered`.

## Watch out
- Default reveal only. Pass no `revealContextRow` and no `includeDescendants`.
- The toggle name is `'Children of ' + row.data.name`, with no level.
- The toggle sits on every row in the `name` cell, keyed by `column.id === 'name'`.
  No `@if (row.hasChildren)` around it.
- `<tr [ngpTableRow]="row" ngpTableTreeRow>`, with no bare `ngpTableRow` attribute beside the binding.
- Context rows are dimmed by the recipe's `[data-context-row]` rule, not by host code.
- The row count must not change when a revealed parent is closed.

## Out of scope
- `withExpansion()`.
- Expand all and Collapse all in this toolbar.
- Sorting and selection.
- Broken-link or cycle rows.

## Done when
- [ ] Typing "review" keeps each match's ancestors and shows them open.
- [ ] Context rows are dimmed; matches are not.
- [ ] Clearing the filter restores the open set from before filtering.
- [ ] The matching parent with no matching children renders a hidden, disabled toggle.
- [ ] The story files contain no `revealContextRow`, `includeDescendants` or `withExpansion`.

---
← [Step 2: Basic tree story](step-2-basic-tree-story.plan.md) | [Step 4: Whole-row click story](step-4-whole-row-click-story.plan.md) →
