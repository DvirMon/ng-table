---
step: 3
type: code
commit: feat
depends_on: [2]
files:
  - libs/table/src/directives/ngp-table-panel-toggle.directive.ts
  - libs/table/src/directives/ngp-table-panel.directive.spec.ts
---
# Step 3 — Toggle registers with the panel registry

This step registers the toggle's host element with the panel registry. The panel's existing focus return then finds it.

Decisions: [D5, D8](../../1-decisions.md) · [E48, E51](../../../../../../../decisions/expansion.md)

## Do
- Call `registry.registerToggle(rowId, host)` once the row id is known.
- Call `registry.unregisterToggle(rowId, host)` when the toggle is destroyed.
- When the row id changes, move the registration to the new id. The row id arrives through `NGP_TABLE_ROW`, so there is no `ngOnChanges`.

```ts
registerToggle(id: RowId, host: HTMLElement): void
unregisterToggle(id: RowId, host: HTMLElement): void
```

## Watch out
- Do not rely on unregistering the old id before registering the new one. A reused view can swap rows, and the old id may already belong to another toggle. `unregisterToggle` checks the host, so use that.
- Seam F may need a second `detectChanges()` after the reorder before the move has run. If it does, note it in the spec. Do not hide it.
- Focus return is already in the panel directive. Do not change it.

## Out of scope
- Destroy-path focus tests (step 4).
- Any change to `ngp-table-panel.directive.ts`.

## Done when
- [ ] The tests in the test plan pass.
- [ ] `close()` and Esc inside a panel put focus on that row's toggle.

---
← [Step 2: Toggle aria-controls](step-2-toggle-aria-controls.plan.md) | [Step 4: Destroy-path focus return](step-4-toggle-destroy-focus.plan.md) →
