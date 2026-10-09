---
step: 3
type: story
commit: feat
depends_on: []
files:
  - libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.html
  - libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.ts
  - libs/table/src/stories/grouping/grouping.mdx
---

# Step 3 — Collapsible data rows use the tree pair

Data rows open through `ngpTableTreeRow` and `ngpTableTreeToggle`, like group headers, and the host styles both from the tree recipe.
Step 4 removes the shared chevron and per-depth CSS.

Decisions: [TR38, TR43](../../../../../../../decisions/tree.md) | [G80](../../../../../../../decisions/grouping.md) | [D11](../../1-decisions.md)

## Do

```html
<tr [ngpTableRow]="row" ngpTableTreeRow>
  <td class="story-host__cell" [class.grouping-story__cell--numeric]="column.id === 'amount'">
    @if (isFirst) {
    <button ngpTableTreeToggle [attr.aria-label]="'Line items on ' + <deal name>">▸</button>
    }
  </td>
</tr>
```

- Data rows get `ngpTableTreeRow`.
- Every data row renders `ngpTableTreeToggle` in its first cell. Drop the `@if (row.hasChildren)` condition. The directive disables and hides the toggle on a leaf.
- Remove the data row's hand-written `type`, `[attr.aria-expanded]` and `(click)`.
- The aria-label carries no state words ("Show", "Hide", "Expand").
- Group-header and data-row toggles drop `class="grouping-story__chevron"` and render `▸` as content, like `stories/tree/tree-basic`.
- Label cells in this host drop `[class.grouping-story__cell--label]`. The recipe's toggle margin indents them.
- Add `'../../tree/tree-story.css'` to the host's `styleUrls`, after `grouping-story.css`.
- In `grouping.mdx`, drop the chevron class from the group-header snippet (~line 446).
- In `grouping.mdx`, add a data-row snippet.
- In `grouping.mdx`, add the recipe (`../tree/tree-story.css?raw`) to the collapsible CSS code tab.
- Update any host hint text or notice that describes the line-item chevron as separate or hand-written.

## Watch out

- Use the recipe from `tree-story.css` as-is. Do not restyle it.
- The recipe rotates the toggle itself. Nothing in this host may also rotate a `::before`.
- Keep `[class.grouping-story__cell--numeric]` on amount cells.
- A depth-4 row (d4-a, d4-b) must indent one step past d4.

## Out of scope

- `grouping-story.css` edits (Step 4).
- The other grouping hosts.
- The product doc (Step 5).

## Done when

- [ ] No `aria-expanded` or `(click)` on any toggle in the host template.
- [ ] Every body `<tr>` carries `ngpTableTreeRow`.
- [ ] No `grouping-story__chevron` or `grouping-story__cell--label` in this host or in the collapsible `.mdx` snippets.
- [ ] The host's `styleUrls` includes `tree-story.css`.

---

← [Step 2: Four more grouping hosts bind the core directives](step-2-core-directives-columns-aggregates-selection-async.plan.md) | [Step 4: One depth rule in grouping-story.css](step-4-single-depth-rule.plan.md) →
