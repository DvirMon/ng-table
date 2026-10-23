# Step 1 test plan — `ngpTablePanelToggle` directive

Trimmed: A's after-click attribute checks (restate D).

Step: [step-1-panel-toggle-directive.plan.md](step-1-panel-toggle-directive.plan.md)
Spec file: `libs/table/src/directives/ngp-table-panel-toggle.directive.spec.ts`

## Stubs (red phase)
- `@Directive({ selector: 'button[ngpTablePanelToggle]' }) export class NgpTablePanelToggleDirective extends NgpTableCollapsibleTrigger`, in `libs/table/src/directives/ngp-table-panel-toggle.directive.ts`.
  - `protected override readonly isOpen: Signal<boolean>`: a `computed` that throws `not implemented`.
  - `protected override toggle(): void`: throws `not implemented`.
- Also exported from `libs/table/src/index.ts`, so the spec's import resolves in red.

Host fixtures (spec-local, modeled on `ngp-table-tree-toggle.directive.spec.ts`):
- `ExpansionHost`: `createTable(signal(mockTaskTreeRows), { trackBy: 'id', columns }, withExpansion())`.
  - Template: `@for (row of table.renderRows(); track row.id)` → `<tr [ngpTableRow]="row"><td><button ngpTablePanelToggle [attr.aria-label]="'Toggle ' + row.id">`.
  - `table` is public, so tests can read `table.expansion()` and call `table.expansion.expand([...])`.
- `NoExpansionHost`: same template, `createTable` without `withExpansion()`.
- Imports: `NgpTableDirective`, `NgpTableRowDirective` (the source of `NGP_TABLE_ROW`) and the new directive.
- `setup()` helper with `toggle(id)` and `clickToggle(id)` (click + `detectChanges`), as in the tree spec.
- Rows `t1` and `t2` come from `mockTaskTreeRows`. No inline fixtures.

## Seams — in red-green order
### A. Click on a closed row's toggle → row is open in the store
- Test: `it('opens its row on click: the store holds the row id')`
- Asserts:
  - Before the click: `aria-expanded="false"` and no `data-expanded`.
  - After `clickToggle('t1')`: `table.expansion().has('t1')` is `true`.
- Why this seam: base wiring of both overrides at once.
  - Catches `toggle()` never reaching `table.expansion` (wrong member, swallowed by the guard).
  - Catches `isOpen` not reflecting the store after a write.
- Order reason: independent. This is the base case; every later seam reuses its host and helpers.

### B. Second click on an open row → row is closed in the store, `aria-expanded="false"`, no `data-expanded`
- Test: `it('closes its row on a second click: the store drops the row id, aria-expanded is "false" and data-expanded is gone')`
- Asserts: after two clicks on `t1`:
  - `table.expansion().has('t1')` is `false`
  - `aria-expanded` is `"false"`
  - `hasAttribute('data-expanded')` is `false`
- Why this seam: catches `toggle()` wired to `expand([id])` instead of `toggle(id)`. That bug passes A and makes the button one-way.
- Order reason: builds on A, which must open the row first.

### C. Clicking row t1's toggle → only t1 opens; t2's toggle stays `aria-expanded="false"`
- Test: `it('opens only its own row: another row's toggle stays closed')`
- Asserts: after `clickToggle('t1')`:
  - `table.expansion().has('t2')` is `false`
  - the t2 toggle's `aria-expanded` is `"false"` and it has no `data-expanded`
- Why this seam: catches a wrong row id, which A cannot see.
  - Example: `isOpen` checks `expansion().size > 0`.
  - Example: the id is read from a shared or first row instead of `NGP_TABLE_ROW`.
- Order reason: builds on A (same click; adds the cross-row assertion).

### D. Store written outside the toggle (`table.expansion.expand(['t1'])`) → toggle shows `aria-expanded="true"`
- Test: `it('reflects the store when the row is opened by something other than the toggle')`
- Asserts: after `table.expansion.expand(['t1'])` and `detectChanges()`, the t1 toggle has:
  - `aria-expanded="true"`
  - `data-expanded=""`
- Why this seam: catches `isOpen` kept as local state that is flipped on click instead of being derived from `expansion()`.
  - That bug passes A, B and C.
  - It breaks with programmatic opens and with `ngpTablePanel`'s `close()` / Esc.
- Order reason: builds on A's attribute assertions. It uses a different write path, so it is not a duplicate of A.

### E. Table without `withExpansion()` → first render throws, naming `ngpTablePanelToggle` and `withExpansion()`
- Test: `it('throws on first render when the table has no withExpansion()')`
- Asserts: `expect(() => setup(NoExpansionHost)).toThrow(/ngpTablePanelToggle[\s\S]*withExpansion\(\)/)`
- Why this seam: catches a missing or misnamed construction check.
  - Without it, the guard in `toggle()` makes the button silently do nothing.
  - It also catches a message copied from `ngpTablePanel` that names the wrong directive. The regex requires `ngpTablePanelToggle`; a copied `ngpTablePanel` message fails it.
- Order reason: independent. It touches only the constructor check. It goes in its own `describe('... dev checks')`, as in the tree spec.

## Types phase (written in red, proven by green's typecheck)
None — no public type surface in this step.

## Not tested
- `type="button"` forced, and the click bubbling to the row without `preventDefault`.
  - That is the shared core's behavior (`NgpTableCollapsibleTrigger`).
  - The tree toggle spec already pins it.
  - Re-testing would only check the base class again, not this directive's logic.
- `expansion.toggle(id)` semantics (flip, `changed` emission, multi-expand). These belong to the state layer and are already in `with-expansion.spec.ts`. This spec asserts only that the toggle calls it with its own row id. Per the own-domain rule.
- No throw in production (`ngDevMode` off). The gate is framework/environment behavior. The tree and panel specs don't test it either, and TestBed always runs in dev mode.
- `aria-controls`: step 2. Toggle registry registration and focus return: steps 3/4.
- Single-open (`withExpansion({ multi })`): #210.
- The `index.ts` re-export is wiring with no logic; the spec import and `typecheck` cover it.
