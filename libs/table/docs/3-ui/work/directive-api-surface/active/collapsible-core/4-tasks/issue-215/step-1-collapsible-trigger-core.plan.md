---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/directives/ngp-table-collapsible-trigger.directive.ts (new)
---
# Step 1 — The collapsible trigger core

Adds the internal selectorless core directive that owns the shared trigger bindings.
Nothing extends it yet; Step 3 moves the tree toggle onto it.

Decisions: [D1, D2, D4, D7, D10, D11](../../1-decisions.md)

## Do

Create a selectorless abstract directive. Do not export it from `libs/table/src/index.ts`.

```ts
@Directive({
  host: {
    '[attr.type]': '"button"',
    '(click)': 'toggle()',
    '[attr.aria-expanded]': 'isOpen() ? "true" : "false"',
    '[attr.data-expanded]': 'isOpen() ? "" : null',
  },
})
export abstract class NgpTableCollapsibleTrigger {
  protected abstract readonly isOpen: Signal<boolean>;
  protected abstract toggle(): void;
}
```

## Watch out

- Bind `type` with the dynamic `[attr.type]` binding. A static `type: 'button'` host attribute loses to a consumer's own `type`.
- The core reads no store, no `table.tree` and no `table.expansion` (E37).
- The core holds only these four bindings. Nothing feature-specific belongs in it.

## Out of scope

- The tree toggle retrofit (Step 3).
- The panel toggle (#212).
- Any export from `index.ts`.

## Done when

- [ ] The file has exactly the four host bindings and the two abstract members above.
- [ ] `libs/table/src/index.ts` has no export for it.

---
[Step 2: Drop the nameless-toggle warning](step-2-drop-nameless-warning.plan.md) →
