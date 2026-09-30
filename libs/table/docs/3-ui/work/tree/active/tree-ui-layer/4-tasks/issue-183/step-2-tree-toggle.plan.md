---
step: 2
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/directives/ngp-table-tree-toggle.directive.ts (new)
  - libs/table/src/directives/ngp-table-tree-toggle.directive.spec.ts (new)
  - libs/table/src/index.ts
---
# Step 2 — The tree toggle directive

A new public `NgpTableTreeToggleDirective` on a `<button>` toggles its row through `table.tree.toggle()`.
It owns the button's state attributes. Step 3 adds its dev-mode checks.

Decisions: [D4, D5, D6, D11, D12](../../1-decisions.md)

## Do
Usage:

```html
<tr [ngpTableRow]="row" ngpTableTreeRow>
  <td>
    <button ngpTableTreeToggle
      [attr.aria-label]="'Children of ' + row.data.name">▸</button>
  </td>
</tr>
```

Shape:

```ts
@Directive({
  selector: 'button[ngpTableTreeToggle]',
  host: {
    '(click)': 'toggle()',
    '[attr.aria-expanded]': ...,   // "true"/"false"; null on a leaf
    '[attr.data-expanded]': ...,   // "" when open, else null
    '[attr.disabled]': ...,        // "" on a leaf, else null
    '[attr.aria-hidden]': ...,     // "true" on a leaf, else null
    '[attr.data-disabled]': ...,   // "" on a leaf, else null
  },
})
export class NgpTableTreeToggleDirective {}
```

- The directive has no inputs.
- Row: `inject(NGP_TABLE_ROW)`, from an ancestor, not `self`.
- Table: `inject(NGP_TABLE_STORE).ngpTable()`.
- A leaf is a row where `hasChildren !== true`.
- Export the directive from `libs/table/src/index.ts`, right after the tree-row export line.

## Watch out
- `NGP_TABLE_STORE` is typed `unknown` for the row. Reach `tree` through a type guard, not a bare `as`.
- `aria-expanded` is a string value. A closed parent gets `"false"`.
- The click handler never calls `preventDefault()` or `stopPropagation()`.
- Spec clicks use native `button.click()` in jsdom.

## Out of scope
- The dev-mode throw and the nameless-button warning (Step 3).
- Keyboard handlers.
- A `type` attribute on the button.

## Done when
- [ ] The directive is exported from `index.ts`.
- [ ] The host has no `(click)` listener other than the toggle's own.

---
← [Step 1: Tree-row hooks](step-1-tree-row-hooks.plan.md) | [Step 3: Toggle dev-mode checks](step-3-tree-toggle-dev-checks.plan.md) →
