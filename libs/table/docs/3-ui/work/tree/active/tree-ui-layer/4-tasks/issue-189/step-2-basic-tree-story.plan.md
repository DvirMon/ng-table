---
step: 2
type: story
commit: feat
depends_on: [1]
files:
  - libs/table/src/stories/tree/tree-basic/tree-basic-story-host.component.ts (new)
  - libs/table/src/stories/tree/tree-basic/tree-basic-story-host.component.html (new)
  - libs/table/src/stories/tree/tree-basic/tree-basic-toolbar.component.ts (new)
  - libs/table/src/stories/tree/tree-basic/tree-basic-toolbar.component.html (new)
  - libs/table/src/stories/tree/tree-basic/tree-basic.stories.ts (new)
---

# Step 2 — Basic tree story

Adds the `Basic` story: flat data nested by `parentId`, with the toggle and a bulk toolbar.
Leaves filtering and whole-row click to their own stories.

Decisions: [TR34, TR36, TR38, TR39, TR41](../../../../../../../decisions/tree.md)

## Do

Host shape, hints and coverage table: see [story-plan.md](story-plan.md) §3 "Basic".

```ts
createTable(
  TREE_ROWS_MOCK,
  treeConfig,
  withTree({
    parentId: (row) => row.parentId,
    initial: [
      /* one branch open to depth 3 */
    ],
  }),
);
```

```html
<tr [ngpTableRow]="row" ngpTableTreeRow>
  <td>
    @if (column.id === 'name') {
    <button type="button" ngpTableTreeToggle [attr.aria-label]="'Children of ' + row.data.name">
      ▸
    </button>
    } {{ cell }}
  </td>
</tr>
```

- `styleUrls: ['../../styles/story-host.css', '../tree-story.css']`.
- The toolbar emits `expandAll` and `collapseAll`.
  The host calls `table.tree.expand(ids)` and `table.tree.collapse()`.
- Expand all passes the ids of the parents on the page.
- The host readout is `@switch (table.tree.state())`: "All open", "Some open", "None open".
- Hints: reopen a child after closing its parent and it is still open; Tab reaches parents only;
  depth is not announced.
- Export `Basic`.

## Watch out

- The toggle name is `'Children of ' + row.data.name`, with no level.
- The toggle sits on every row, in the `name` cell, keyed by `column.id === 'name'`.
  No `@if (row.hasChildren)` around it.
- No hand-written `aria-expanded`, no per-depth CSS.
- `<tr [ngpTableRow]="row" ngpTableTreeRow>`, with no bare `ngpTableRow` attribute beside the binding.
- Do not add `stopPropagation` to the toggle.

## Out of scope

- `withFiltering()`, `withSorting()`, `withSelection()`, `withExpansion()`.
- A row click handler.
- A library expand-all member.
- Broken-link or cycle rows.

## Done when

- [ ] Parents toggle open and closed; reopening a parent restores its open descendants.
- [ ] Leaf toggles render disabled, hidden by the recipe, with the label width kept.
- [ ] The readout shows all three states.
- [ ] Tab skips leaf toggles; Enter and Space toggle a parent.
- [ ] The story files contain no `aria-expanded`, `stopPropagation` or `withExpansion`.

---

← [Step 1: Tree fixtures and recipe CSS](step-1-tree-fixtures-and-css.plan.md) | [Step 3: Filtered tree story](step-3-filtered-tree-story.plan.md) →
