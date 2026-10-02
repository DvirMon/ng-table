# Step 2 test plan — ngpTablePanel: identity, inert, wiring errors

Step: [step-2-panel-identity-inert.plan.md](step-2-panel-identity-inert.plan.md)
Spec file: `libs/table/src/directives/ngp-table-panel.directive.spec.ts`

## Stubs (red phase)
- In `libs/table/src/directives/ngp-table-panel.directive.ts`:
  `@Directive({ selector: '[ngpTablePanel]' })`
  `export class NgpTablePanelDirective { readonly ngpTablePanel = input.required<RowId>(); ngOnInit(): void }`.
  `ngOnInit` throws `not implemented: NgpTablePanelDirective`.
  The stub has no host bindings yet. Every test then fails
  on first render, so red is real.
- Re-export `NgpTablePanelDirective` from `libs/table/src/index.ts`.

## Host fixtures (shared by the seams)
These follow `ngp-table-tree-toggle.directive.spec.ts`: host
components over a real `createTable(...)`.
- Rows: `mockTaskTreeRows`, with `trackBy: 'id'` and
  `columns: createColumns(noData<TaskTreeMockRow>(), (col) => [col('status')])`,
  plus the new mock row whose id contains a space.
- Each panel element carries
  `role="region" [attr.aria-label]="'Details ' + row.id"`.
  Tests query it with `[aria-label="Details t1"]`.
- `table` is a public `readonly` field. Tests drive state with
  `table.expansion.expand(['t1'])` / `collapse(['t1'])`, then
  call `fixture.detectChanges()`.
- `DefaultHost`:
  `@if (table.expansion().has(row.id)) { <tr><td><div ngpTablePanel … animate.leave="panel--leave">`.
- `KeptMountedHost`: the same markup, gated on
  `table.expansion.everExpanded().has(row.id)`, with no
  `animate.leave`.
- `NoExpansionHost`: no `withExpansion()`. The panel is
  rendered unconditionally for each row.
- `DuplicatePanelHost`: `withExpansion()`, plus two
  `[ngpTablePanel]="row.id"` elements in the same row. Both
  render unconditionally.
- `setup(hostType)` returns `{ fixture, table, panel(id), expand(id), collapse(id) }`.
  `panel(id)` throws when the panel is not found.

## Seams — in red-green order

### A. Panel mounts → host `id` is the minted id; close then reopen → the same id
- Test: `it('gives the panel a table-scoped id that stays the same across close and reopen')`
- Host: `DefaultHost`.
- Asserts:
  - after `expand('t1')`, `panel('t1').id` matches `/^ngp-t\d+-panel-t1$/`;
  - after `collapse('t1')` → `expand('t1')`, the new element's `id` is strictly equal to the first value;
  - the reopen does not throw;
  - a panel for the mock row whose id contains a space has an `id` with no whitespace, ending in the `encodeURIComponent` form of that id.
- Why this seam:
  - The `[id]` binding is missing, or does not use the id the registry returns.
  - The id is minted per mount and not per table + row. That breaks `aria-controls` across remounts.
  - Registration happens in the constructor, where the `RowId` input is unset. The id would then end `-panel-undefined`.
  - The panel never unregisters on destroy. The reopen then throws a duplicate error.
  - A forgotten `encodeURIComponent`, which yields an id with whitespace that `aria-controls` cannot reference.
- Order reason: base case. Every later seam needs a panel that registers and renders.
- Note: `tableSeq` is a module-level counter, so its value depends on test order. Match it with `\d+`; never hard-code it.

### B. Kept-mounted panel: open → not `inert`; closed → `inert`
- Test: `it('marks a kept-mounted panel inert while its row is closed, and not while it is open')`
- Host: `KeptMountedHost`.
- Asserts:
  - after `expand('t1')`: `panel('t1').hasAttribute('inert') === false`;
  - after `collapse('t1')`, the same element is still connected, and `hasAttribute('inert') === true`.
- Why this seam: catches a missing or inverted `!isOpen()` binding, or `isOpen` reading `everExpanded` instead of `expansion()`. Without this, a closed panel leaks into the Tab order and the accessibility tree.
- Order reason: builds on A.

### C. Default host: collapse → the leaving panel has `inert` right after that `detectChanges()`
- Test: `it('marks a leaving panel inert immediately after the closing change detection')`
- Host: `DefaultHost`.
- Steps: `expand('t1')`; capture `const leaving = panel('t1')`; check `leaving.hasAttribute('inert') === false`; then `collapse('t1')`.
- Asserts: `leaving.hasAttribute('inert') === true` on the captured reference. Never re-query.
- Why this seam: pins the source-verified ordering in Angular 22.1.2. The `@if` view is destroyed before its bindings refresh, so B's binding alone never marks a leaving panel inert. Fails unless `DestroyRef.onDestroy` writes the attribute through the renderer.
- Order reason: builds on B, isolating the destroy-hook path from the binding path.

### D. Table without `withExpansion()` → first render throws, naming the missing feature
- Test: `it('throws on first render when the table has no withExpansion()')`
- Host: `NoExpansionHost`.
- Asserts: `expect(() => setup(NoExpansionHost)).toThrow(/ngpTablePanel[\s\S]*withExpansion\(\)/)`.
- Why this seam: catches a missing or wrong `hasExpansion` guard; the regex rejects a bare `TypeError`.
- Order reason: independent of A–C.

### E. Two panels for one row → throws, naming the row id
- Test: `it('throws when a second panel registers for a row that already has one, naming the row id')`
- Host: `DuplicatePanelHost`.
- Asserts: `expect(() => setup(DuplicatePanelHost)).toThrow(/t1/)`.
- Why this seam: catches a panel that does not route through `registerPanel`, or swallows its throw — two elements would share one DOM id silently.
- Order reason: depends on A.

## Types phase (written in red, proven by green's typecheck)
None — no public type surface in this step.

## Not tested
- The registry directly. The spec's Testing Decisions forbid it; A and E reach it through the panel.
- The `animate.leave` animation itself (framework).
- Browser focus fix-up after `inert` is set (browser behavior).
- `ngDevMode`-off behavior.
- That `NgpTablePanelDirective` is exported from `index.ts` (typecheck catches a broken barrel line).
- `close()`, Esc, and focus return. Step 3.
- `aria-controls` on the toggle. #212.

## Open questions
None — `inert` reflects as an attribute in happy-dom (the repo's test DOM); escaping is covered in A.
