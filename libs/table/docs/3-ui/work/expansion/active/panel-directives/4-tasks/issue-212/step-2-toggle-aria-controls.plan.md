---
step: 2
type: code
commit: feat
depends_on: [1]
files:
  - libs/table/src/directives/ngp-table-panel-toggle.directive.ts
  - libs/table/src/directives/ngp-table-panel-toggle.directive.spec.ts
---
# Step 2 — Toggle aria-controls

This step points the toggle's `aria-controls` at its row's panel while that panel is mounted. The attribute is absent otherwise.

Decisions: [D1](../../1-decisions.md) · [E44](../../../../../../../decisions/expansion.md)

## Do
- Inject `NGP_TABLE_PANEL_REGISTRY` in the toggle.
- Bind the host attribute to a computed that reads the registry:

```ts
host: { '[attr.aria-controls]': 'controlsId()' }
protected readonly controlsId: Signal<string | null>
// computed(() => registry.panelId(row.ngpTableRow().id)())
```

- A `null` id removes the attribute.

## Watch out
- `panelId(id)` returns a new computed on every call. Call it inside the toggle's computed, so it re-reads when the row id changes.

## Out of scope
- Registering the toggle with the registry (step 3).
- Focus return.

## Done when
- [ ] The tests in the test plan pass.
- [ ] A toggle whose row has no mounted panel has no `aria-controls` attribute.

---
← [Step 1: The ngpTablePanelToggle directive](step-1-panel-toggle-directive.plan.md) | [Step 3: Toggle registers with the panel registry](step-3-toggle-registration.plan.md) →
