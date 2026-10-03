---
step: 4
type: story
commit: ref
depends_on: [3]
files:
  - libs/table/src/stories/tree/tree-basic/tree-basic-story-host.component.html
  - libs/table/src/stories/tree/tree-filtering/tree-filtering-story-host.component.html
  - libs/table/src/stories/tree/tree-row-click/tree-row-click-story-host.component.html
  - libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.html
---
# Step 4 — Stories drop the manual button type

Removes the hand-written `type="button"` from the tree toggle buttons in four story hosts.
The toggle now sets its own type.

Decisions: [D11](../../1-decisions.md)

## Do

- Remove the `type="button"` attribute from each `<button ngpTableTreeToggle>`.
- Keep each `[attr.aria-label]`.

## Watch out

- Touch only buttons that carry `ngpTableTreeToggle`. Other buttons in those templates keep their `type`.

## Out of scope

- `.mdx` prose.
- Story CSS.

## Done when

- [ ] `grep` finds no `type="button"` on any `ngpTableTreeToggle` button under `libs/table/src/stories`.

---
← [Step 3: Tree toggle extends the core](step-3-tree-toggle-extends-core.plan.md) | [Step 5: Tree docs retrofit](step-5-tree-docs-retrofit.plan.md) →
