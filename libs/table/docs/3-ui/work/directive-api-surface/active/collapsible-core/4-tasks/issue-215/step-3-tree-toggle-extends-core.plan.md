---
step: 3
type: code
commit: feat
depends_on: [1, 2]
files:
  - libs/table/src/directives/ngp-table-tree-toggle.directive.ts
  - libs/table/src/directives/ngp-table-tree-toggle.directive.spec.ts
---

# Step 3 — Tree toggle extends the core

Makes `NgpTableTreeToggleDirective` extend `NgpTableCollapsibleTrigger`, so the core owns `type`, click and the expanded attributes.
Steps 4 and 5 then update stories and docs.

Decisions: [D2, D9, D10](../../1-decisions.md) · [TR37, TR48](../../../../../../../decisions/tree.md)

## Do

- Extend `NgpTableCollapsibleTrigger`. Call `super()` first in the constructor.
- Remove `(click)`, `[attr.aria-expanded]` and `[attr.data-expanded]` from the host.
- Remove the `ariaExpanded` computed.
- Make `isOpen` and `toggle` `protected override`.
- Keep the leaf host bindings, the row and table injection, `isLeaf` and the `withTree()` dev throw.
- Update the JSDoc: the type is always `button`, and a leaf shows `aria-expanded="false"`.

```ts
@Directive({
  selector: 'button[ngpTableTreeToggle]',
  host: {
    '[attr.disabled]': 'isLeaf() ? "" : null',
    '[attr.aria-hidden]': 'isLeaf() ? "true" : null',
    '[attr.data-disabled]': 'isLeaf() ? "" : null',
  },
})
export class NgpTableTreeToggleDirective extends NgpTableCollapsibleTrigger {
  protected override readonly isOpen: Signal<boolean> = computed(/* as today */);
  protected override toggle(): void {
    /* table.tree.toggle(id), as today */
  }
}
```

## Watch out

- The subclass must not re-bind `type`, `(click)`, `aria-expanded` or `data-expanded`. Angular lets the subclass win silently (TR37), and nothing enforces it.
- `noImplicitOverride` is on in `libs/table/tsconfig.json`.
- If typecheck reports `.ts` errors, fix them and run it again. `ngc` stops before it reaches templates.

## Out of scope

- Stories and docs (Steps 4 and 5).
- Any change to `libs/table/src/index.ts`.

## Done when

- [ ] The directive host block has only the three leaf bindings.
- [ ] No `ariaExpanded` member remains.

---

← [Step 2: Drop the nameless-toggle warning](step-2-drop-nameless-warning.plan.md) | [Step 4: Stories drop the manual button type](step-4-stories-drop-manual-type.plan.md) →
