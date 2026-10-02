---
step: 2
type: code
commit: feat
depends_on: [1]
files:
  - libs/table/src/directives/ngp-table-panel.directive.ts (new)
  - libs/table/src/directives/ngp-table-panel.directive.spec.ts (new)
  - libs/table/src/table.mock.ts
  - libs/table/src/index.ts
---
# Step 2 — ngpTablePanel: identity, inert and wiring errors

This step adds the panel directive with its minted `id`, its `inert` state and its wiring errors. It leaves `close()`, Esc and focus return to Step 3.

Decisions: [D2, D3, D4, D7, D9, D13](../../1-decisions.md) · [E45, E46, E47, E50, E52, E56](../../../../../../../decisions/expansion.md)

## Do
- Create `NgpTablePanelDirective` with this shape:

```ts
@Directive({
  selector: '[ngpTablePanel]',
  host: { '[id]': 'panelId', '[inert]': '!isOpen()' },
})
export class NgpTablePanelDirective {
  readonly ngpTablePanel = input.required<RowId>();
}
```

- `isOpen` is a `computed` over `table.expansion().has(this.ngpTablePanel())`.
- Register with the registry in `ngOnInit`, because the input is unset in the constructor. Unregister on destroy.
- In `DestroyRef.onDestroy`, write `inert` with `renderer.setAttribute(host, 'inert', '')`.
- Add a `//` comment there: the `@if` view is destroyed before its bindings refresh (Angular 22.1.2), so the binding never marks a leaving panel.
- Add a `hasExpansion(table: unknown): table is ExpansionMembers` guard.
- Add a dev throw that names `ngpTablePanel` and `withExpansion()`. Mirror `hasTree` and `assertTreeComposed` in `ngp-table-tree-toggle.directive.ts`.
- Export `NgpTablePanelDirective` from `index.ts` beside the other directives.
- Add a mock row with a space in its id to `table.mock.ts`, for the escaping case (seam A).

## Watch out
- Keep `[inert]` as a property binding. The test DOM is happy-dom, and its `inert` setter reflects the attribute.
- Step 3 adds focus return before the `inert` write in `onDestroy`. Leave room for it.

## Out of scope
- `exportAs`, `close()`, Esc and focus return (Step 3).
- The toggle (#212).

## Done when
- [ ] The tests in the test plan pass.
- [ ] `NgpTablePanelDirective` is exported from `index.ts`.

---
← [Step 1: Panel registry and its provider](step-1-panel-registry.plan.md) | [Step 3: ngpTablePanel: close paths and focus return](step-3-panel-close-focus.plan.md) →
