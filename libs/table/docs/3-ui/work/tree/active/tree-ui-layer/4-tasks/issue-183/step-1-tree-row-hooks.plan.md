---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/directives/ngp-table-tree-row.directive.ts
  - libs/table/src/directives/ngp-table-tree-row.directive.spec.ts
---

# Step 1 — Tree-row hooks

`NgpTableTreeRowDirective` gains presence-only `data-expandable` and `data-expanded` beside `data-context-row`.
Step 4 uses them on group headers.

Decisions: [D3, D5](../../1-decisions.md)

## Do

- Add two host bindings, each driven by its own computed.

```ts
host: {
  '[attr.data-context-row]': 'isContextRow() ? "" : null',
  '[attr.data-expandable]': 'isExpandable() ? "" : null',
  '[attr.data-expanded]': 'isExpanded() ? "" : null',
}
```

- `isExpandable` reads `hasChildren === true`.
- `isExpanded` reads `isExpanded === true`.
- Both read from `this.row.ngpTableRow()`.
- Update the class's one-line JSDoc to cover all three hooks.

## Watch out

- `data-expanded` is not gated on `hasChildren`. The two bindings stay independent.
- Row fixtures in the spec come from `mockDataRenderRow()`.
- `update()` rebuilds the row from defaults, so pass every field each time.

## Out of scope

- Core `ngpTableRow` changes (row `aria-expanded`, `--ngp-table-row-depth`) belong to issue #182.

## Done when

- [ ] Both attributes render as `""` or are absent, never `"true"` or `"false"`.
- [ ] The existing `data-context-row` cases pass unchanged.

---

[Step 2: The tree toggle directive](step-2-tree-toggle.plan.md) →
