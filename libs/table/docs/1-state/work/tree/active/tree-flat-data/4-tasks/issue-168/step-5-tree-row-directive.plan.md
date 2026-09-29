---
step: 5
type: code
commit: feat
depends_on: [1]
files:
  - libs/table/src/directives/ngp-table-tree-row.directive.ts (new)
  - libs/table/src/directives/ngp-table-tree-row.directive.spec.ts (new)
  - libs/table/src/index.ts
---
# Step 5 — Tree-row directive

This step adds `ngpTableTreeRow`, which marks context rows with a `data-context-row` attribute.
It leaves tree indentation, `aria-level` and the toggle to a separate tree-UI issue.

Decisions: [D18, D21](../../1-decisions.md)

## Do

- Add `NgpTableTreeRowDirective` with the selector `tr[ngpTableRow][ngpTableTreeRow], div[ngpTableRow][ngpTableTreeRow]`.
- Read the row with `inject(NGP_TABLE_ROW, { self: true })`. Add no second input.
- Bind the host attribute:

  ```ts
  '[attr.data-context-row]': 'isContextRow() ? "" : null'
  ```

- Make `isContextRow` a `protected` computed.
- Export the directive from `index.ts`, next to the other directives.
- Leave the core `ngpTableRow` unchanged.

## Watch out

- The attribute is presence-only. Never write `"true"` or `"false"` (ADR-0026 rule 1).

## Out of scope

- `aria-level`, indentation and the toggle.

## Done when

- [ ] The attribute is present with value `""` on a context row.
- [ ] The attribute is absent on any other row.
- [ ] The attribute is removed when the same row stops being a context row.

---
← [Step 4: Filter keeps ancestors](step-4-filter-keeps-ancestors.plan.md) | [Step 6: hasChildren follows the filtered view](step-6-filtered-has-children.plan.md) →
