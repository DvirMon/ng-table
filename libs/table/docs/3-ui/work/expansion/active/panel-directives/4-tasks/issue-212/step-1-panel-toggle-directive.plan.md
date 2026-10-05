---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/directives/ngp-table-panel-toggle.directive.ts
  - libs/table/src/directives/expansion.guard.ts
  - libs/table/src/directives/ngp-table-panel.directive.ts
  - libs/table/src/index.ts
  - libs/table/src/directives/ngp-table-panel-toggle.directive.spec.ts
---
# Step 1 — The ngpTablePanelToggle directive

This step adds the toggle button for an expandable row. It opens and closes the row through `table.expansion`.

Decisions: [D2, D9, D10, D11, D14](../../1-decisions.md) · [E52, E53, E54, E55](../../../../../../../decisions/expansion.md)

## Do
- Add the toggle. It extends `NgpTableCollapsibleTrigger`:

```ts
@Directive({ selector: 'button[ngpTablePanelToggle]' })
export class NgpTablePanelToggleDirective extends NgpTableCollapsibleTrigger {
  protected override readonly isOpen: Signal<boolean>
  protected override toggle(): void  // table.expansion.toggle(id)
}
```

- `isOpen` is `computed(() => expansion().has(row.ngpTableRow().id))`.
- The constructor throws in dev mode when the table has no `withExpansion()`. The message names `ngpTablePanelToggle` and `withExpansion()`. Follow the tree toggle's constructor check.
- Move `hasExpansion()` out of `ngp-table-panel.directive.ts` into the new, unexported `directives/expansion.guard.ts`. Both directives import it from there.
- Export the toggle from `index.ts` with `export * from` its file. The shared core stays unexported.

## Watch out
- Read the row id through `row.ngpTableRow().id` inside the computed, so `isOpen` follows a row id that changes.
- Do not keep open state in the directive. The store is the only source.

## Out of scope
- `aria-controls` (step 2).
- Registry registration (step 3).
- Docs (#213).
- Single-open mode (#210).

## Done when
- [ ] The tests in the test plan pass.
- [ ] `ngp-table-panel.directive.ts` no longer defines `hasExpansion()`.
- [ ] `expansion.guard.ts` is not exported from `index.ts`.

---
[Step 2: Toggle aria-controls](step-2-toggle-aria-controls.plan.md) →
