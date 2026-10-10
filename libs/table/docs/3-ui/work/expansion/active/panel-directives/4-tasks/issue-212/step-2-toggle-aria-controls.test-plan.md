# Step 2 test plan — toggle `aria-controls`

Trimmed: none.

Step: [step-2-toggle-aria-controls.plan.md](step-2-toggle-aria-controls.plan.md)
Spec file: `libs/table/src/directives/ngp-table-panel-toggle.directive.spec.ts`

## Stubs (red phase)
- None. The tests import no new symbol from this step.
  `NgpTablePanelToggleDirective` comes from Step 1.
  `NGP_TABLE_PANEL_REGISTRY` and `NgpTablePanelDirective` already ship.
  `aria-controls` is a host binding, so red fails on assertions.
  Each seam asserts that the attribute is *present* at least once.
  Without that, a test could pass against the unimplemented
  directive.

Host shape for every seam: follow the hosts in
`ngp-table-panel.directive.spec.ts`. Inside
`<table [ngpTable]>`, each `@for` row renders a
`<tr [ngpTableRow]="row">` holding
`<button ngpTablePanelToggle [attr.aria-label]="'Toggle ' + row.id">`.
After it comes a sibling `<tr>` holding
`<div [ngpTablePanel]="row.id" [attr.aria-label]="'Details ' + row.id">`.
That sibling `<tr>` sits behind an `@if`, and the `@if` gate
changes per host.
Imports: `NgpTableDirective`, `NgpTableRowDirective`,
`NgpTablePanelToggleDirective`, `NgpTablePanelDirective`.
Rows come from `table.renderRows()`, as in the tree toggle spec.
If Step 1's hosts don't render a panel yet, extend them.
Don't add a second set of hosts.
Find elements by accessible label (`Toggle <id>` /
`Details <id>`). Change expansion through `table.expansion`
or a toggle click. Never read the registry.

## Seams — in red-green order

### A. Panel for the toggle's row is mounted → `aria-controls` equals that panel's id
- Test: `it('points aria-controls at its row panel id once the panel mounts')`
- Asserts: DefaultHost (`@if (table.expansion().has(row.id))`).
  Expand `t1` and run change detection. Then
  `toggle('t1').getAttribute('aria-controls')` equals
  `panel('t1').id`, and that value is not empty.
- Why this seam: base wiring. It fails if the toggle never binds
  `aria-controls`, or binds a hand-built id that drifts from the
  id the registry mints. The test starts collapsed, so it also
  fails if the toggle reads `panelId` once before the panel
  registers. That catches a binding that is not reactive.
- Order reason: independent. This is the base case.

### B. Panel unmounts → `aria-controls` is removed, not left stale or empty
- Test: `it('removes aria-controls when its row panel unmounts')`
- Asserts: DefaultHost. Expand `t1`. As a precondition,
  `aria-controls` is present. Collapse `t1` and run change
  detection. Then `toggle('t1').hasAttribute('aria-controls')`
  is `false`.
- Why this seam: D1 says `aria-controls` must never point at a
  missing id. Two bugs fail here:
  - `null` mapped to `''` (or `?? ''`), which leaves an empty
    attribute.
  - The binding keeps its last value after the panel's
    `unregisterPanel`.
- Order reason: builds on A, which makes the attribute appear.
  B removes it.

### C. Only the toggle's own row matters → another row's mounted panel does not set it
- Test: `it('leaves aria-controls off a toggle whose own row has no panel while another row does')`
- Asserts: DefaultHost. Expand `t1` only.
  `toggle('t1')` has `aria-controls === panel('t1').id`.
  `toggle('t2').hasAttribute('aria-controls')` is `false`.
- Why this seam: catches a lookup keyed on the wrong row. Examples:
  - any mounted panel answers;
  - the toggle reads a table-level "current panel";
  - the toggle uses the first registered id.

  A has a single open row, so it cannot see any of these.
- Order reason: builds on A, which fixes the positive half.

### D. Kept-mounted panel while its row is closed → `aria-controls` stays
- Test: `it('keeps aria-controls while a closed panel stays mounted')`
- Asserts: KeptMountedHost
  (`@if (table.expansion.everExpanded().has(row.id))`).
  Expand `t1`, then collapse it. `panel('t1').isConnected` is
  `true`. `toggle('t1').getAttribute('aria-controls')` still
  equals `panel('t1').id`.
- Why this seam: D1 / spec say the attribute tracks "mounted",
  not "open". This catches an implementation that gates on
  `isOpen()` (`isOpen() ? id : null`) instead of on the
  registry. That shortcut passes A–C.
- Order reason: builds on B. Same collapse action, but the
  expected result is the opposite because the panel stays mounted.

### E. Reused toggle view gets a new row id → `aria-controls` follows the new row
- Test: `it('follows its row id when a reused view is moved to another row')`
- Asserts: a host with `@for (row of table.renderRows(); track $index)`
  over a writable data signal, with `withExpansion({ initial: ['t1'] })`.
  Swap the order of `t1` and `t2` in the data signal and run
  change detection. Then:
  - `toggle('t1').getAttribute('aria-controls')` equals
    `panel('t1').id`;
  - `toggle('t2').hasAttribute('aria-controls')` is `false`.

  The labels are bound to `row.id`, so the element now labelled
  `t2` is the old `t1` button.
- Why this seam: `registry.panelId(id)` returns a new computed on
  each call. A toggle that calls it once with the id it had at
  init keeps pointing at `t1` after its view is reused for `t2`.
  The outline names this as the step's trap. A–D never change
  a toggle's row id, so they can't catch it.
- Order reason: builds on C, which proves per-row keying.
  E proves that keying follows a row id that changes.

## Types phase (written in red, proven by green's typecheck)
None — no public type surface in this step.

## Not tested
- Click, `aria-expanded`, `data-expanded`, missing-feature throw.
  Step 1 owns these. Re-asserting them here would fail on the
  same bugs as Step 1's tests.
- The registry directly (`panelId`, `registerPanel`).
  The spec's Testing Decisions ban assertions through the
  registry or private members. The registry is tested only
  through the directives.
- Panel id format, stability across close/reopen, URI encoding,
  per-table prefix. Already pinned in
  `ngp-table-panel.directive.spec.ts`. Re-asserting them here
  would test another domain.
- Two tables sharing row ids, where each toggle resolves its own
  table's registry. DI resolves the nearest `ngpTable` provider.
  That is the framework's job (unit-test skip: "the framework
  itself"). Id uniqueness across tables is minted, and tested,
  on the panel side.
- `registerToggle` / focus return.
  Steps 3 and 4 own these (outline: Out of scope).
- That `aria-controls` is an attribute and not a property.
  This is a template binding with no logic, which the unit-test
  skip list excludes as simple passthrough. B's
  `hasAttribute` check already covers the observable result.
