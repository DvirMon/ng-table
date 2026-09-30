---
step: 4
type: story
commit: feat
depends_on: [1, 2]
files:
  - libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.html
  - libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.ts
  - libs/table/src/stories/grouping/grouping.mdx
  - libs/table/src/stories/grouping/grouping-story.css
---
# Step 4 — Collapsible-grouping story host uses the tree pair

The host renders through `ngpTable` and `ngpTableRow`.
Group headers use `ngpTableTreeRow` and `ngpTableTreeToggle` instead of a hand-written toggle.
The story's `.mdx` shows the pair.

Decisions: [D11, D12](../../1-decisions.md)

## Do

```html
<table [ngpTable]="table" ...>
  ...
  <tr [ngpTableRow]="row" ngpTableTreeRow>
    <td>
      <button ngpTableTreeToggle class="grouping-story__chevron"
        [attr.aria-label]="<group name, no state words>"></button>
```

- Import `NgpTableDirective`, `NgpTableRowDirective`, `NgpTableTreeRowDirective` and `NgpTableTreeToggleDirective` in the host.
- Data rows also bind `[ngpTableRow]="row"`.
- Remove the header row's `(click)`. Toggling is button-only.
- Drop "or anywhere on the header row" from the hint text.
- `grouping.mdx` shows the pair in a snippet.

## Watch out
- The group label must not carry state ("Expand", "Collapse"). `aria-expanded` already announces it.
- Remove the hand-written `[attr.aria-expanded]` on group-header buttons. The toggle owns it.
- Chevron CSS that reads `[aria-expanded]` should key on `[data-expanded]`.
- If the chevron CSS lives in a host stylesheet, add that file to `files` in this step's frontmatter.
- Keep the header's `data-row-kind` and `data-depth` hand bindings off the row. `ngpTableRow` binds them.

## Out of scope
- The data row's line-item chevron stays hand-written.
- Tree stories for flat data (#189 family).
- Any toolbar change.

## Done when
- [ ] No group-header `<tr>` has a `(click)`.
- [ ] Group headers have no hand-written `aria-expanded`.
- [ ] The `.mdx` snippet uses `<tr [ngpTableRow]="row" ngpTableTreeRow>`, with no bare `ngpTableRow` beside the binding.

---
← [Step 3: Toggle dev-mode checks](step-3-tree-toggle-dev-checks.plan.md) | [Step 5: Tree UI spec and pointer updates](step-5-tree-ui-docs.plan.md) →
