---
step: 4
type: story
commit: ref
depends_on: [1, 2, 3]
files:
  - libs/table/src/stories/grouping/grouping-story.css
---
# Step 4 — One depth rule in grouping-story.css

The stylesheet indents label cells from `--ngp-table-row-depth` with a single rule and drops the chevron styles.
It leaves every host template untouched.

Decisions: [G79](../../../../../../../decisions/grouping.md) | [D9](../../1-decisions.md)

## Do

```css
.grouping-story__cell--label {
  padding-inline-start: calc(0.6rem + var(--ngp-table-row-depth, 0) * var(--grouping-indent));
}
```

- Delete the six `[data-depth='N']` selectors, `--grouping-depth`, and their comments.
- Update the top comment. Depth comes from core `ngpTableRow`'s `--ngp-table-row-depth`.
- Delete every `.grouping-story__chevron` rule, including its reduced-motion block.

## Watch out
- `row-edit/grouping-editing` also loads this file and already binds `[ngpTableRow]`. It needs no edit.
- Keep the `[data-row-kind='group']` rules. `ngpTableRow` emits that attribute.

## Out of scope
- Any host template.

## Done when
- [ ] No `[data-depth=` selector and no `--grouping-depth` remain in the file.
- [ ] No `grouping-story__chevron` remains anywhere under `libs/table/src/stories/`.

---
← [Step 3: Collapsible data rows use the tree pair](step-3-collapsible-data-row-tree-pair.plan.md) | [Step 5: Product doc coverage for U6 and 1.6](step-5-product-doc-coverage.plan.md) →
