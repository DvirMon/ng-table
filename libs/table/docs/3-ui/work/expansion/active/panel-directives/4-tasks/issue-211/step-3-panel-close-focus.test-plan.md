# Step 3 test plan — ngpTablePanel: close paths and focus return

Step: [step-3-panel-close-focus.plan.md](step-3-panel-close-focus.plan.md)
Spec file: `libs/table/src/directives/ngp-table-panel.directive.spec.ts`

## Stubs (red phase)
- `@Directive({ ..., exportAs: 'ngpTablePanel' })` on the existing `NgpTablePanelDirective`. Real metadata, not a stub. Without it, a host template using `#p="ngpTablePanel"` fails at TestBed compile and hides the real red.
- `close(): void` on `NgpTablePanelDirective` throws `not implemented: close`.
- No stub for the Esc listener. Seam B and C tests fail on their assertions until green adds `'(keydown.escape)'`.

Host: extend step 2's default host (`@if` + `animate.leave`). Seed two open rows with `withExpansion({ initial: [rowA, rowB] })`, using two row ids from step 2's fixture. Inside each panel add:
- a close button, `<button (click)="p.close()">Close {{id}}</button>`, with `#p="ngpTablePanel"` on the panel;
- an inner button with `(keydown.escape)="$event.preventDefault()"`, labelled e.g. `Handles Esc {{id}}`.
Query by role/name. Assert through `table.expansion()`, never the registry. Esc events are `new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })`. `cancelable: true` is required, or `preventDefault()` does nothing.

## Seams — in red-green order
### A. close() from an in-panel button collapses that row only
- Test: `it('close() collapses only its own row')`
- Asserts: after clicking rowA's close button and calling `detectChanges()`, `[...table.expansion()]` equals `[rowB]`.
- Why this seam: catches `close()` not collapsing, calling `collapse()` with no ids (collapses everything), or collapsing the wrong id. Also fails if `exportAs` is missing.
- Order reason: base case; Esc delegates to `close()`.

### B. Esc inside an open panel collapses that row only
- Test: `it('Esc inside a panel collapses only that row')`
- Asserts: after dispatching Esc on rowA's close button, `[...table.expansion()]` equals `[rowB]`; `event.defaultPrevented === true` after the panel handles Esc (the panel marks Esc handled).
- Why this seam: catches a missing or misbound host listener, or one placed on `document` or the table rather than the panel host, which would collapse the wrong row or all rows. Also catches the panel not marking Esc handled, which would let an enclosing dialog close on the same key.
- Order reason: builds on A.

### C. Esc whose default was already prevented is ignored
- Test: `it('ignores Esc when an inner element already prevented it')`
- Asserts: both rows are open before Esc is dispatched on rowA's inner "Handles Esc" button; both rows are still open after it.
- Why this seam: catches a missing `defaultPrevented` early return. Without it, an inner widget (combobox, date picker) that handles Esc also closes the panel.
- Order reason: builds on B.

## Types phase (written in red, proven by green's typecheck)
None — no public type surface in this step.

## Not tested
- Trimmed by the overlap pass: the redundant `defaultPrevented` assert in C.
- Destroy with focus outside the panel does not move focus. Deferred to #212: in #211 `toggleOf(id)` always returns `null`, so the test cannot fail. The spec's Testing Decisions lists it, so #212's plan must pick it up.
- Focus returns to the toggle after `close()` or Esc, including from `<body>`. Deferred to #212 for the same reason.
- `returnFocus` running before the destroy-time `inert` write. Only observable with a toggle; deferred to #212. Step 2's C pins the `inert` half.
- Faking a toggle by injecting `NGP_TABLE_PANEL_REGISTRY` in the host. Rejected: the spec bans assertions through the registry.
- Non-Escape keys do not close. Angular's key filter does that.
- Esc on a closed kept-mounted panel. `collapse([id])` on a closed id is `withExpansion`'s own spec.
- `toggleOf(id)?.isConnected` check. No toggle in #211; #201 owns the row-gone case.

## Open questions
None — marking Esc handled was decided 2026-10-02.
