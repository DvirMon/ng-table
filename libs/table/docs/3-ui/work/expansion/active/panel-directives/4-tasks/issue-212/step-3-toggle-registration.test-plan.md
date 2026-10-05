# Step 3 test plan — toggle registers with the panel registry

Trimmed: A and B extend existing tests at :277 and :286 instead of new ones.

Step: [step-3-toggle-registration.plan.md](step-3-toggle-registration.plan.md)
Spec file: `libs/table/src/directives/ngp-table-panel.directive.spec.ts`

## Stubs (red phase)
None. This step adds no symbols the tests import.
The tests import `NgpTablePanelToggleDirective` (from step 1)
and `NgpTableRowDirective` (already exists).
Red is real without stubs: `registerToggle` is never called
today, so `toggleOf(id)` is `null` and focus never moves.

Fixture changes, all in the spec:
- `ClosePanelHost`: iterate `table.renderRows()`. Per row,
  render `<tr [ngpTableRow]="row"><td><button
  ngpTablePanelToggle>Toggle {{ row.id }}</button></td></tr>`,
  then the existing panel `<tr>` under
  `@if (table.expansion().has(row.id))`. The panel `<tr>` gets
  no `ngpTableRow`. The toggle reads its row through
  `NGP_TABLE_ROW`, so it must sit inside a `[ngpTableRow]`.
- Add `NgpTableRowDirective` and `NgpTablePanelToggleDirective`
  to `IMPORTS`. This is safe for the other hosts.
- New `ReusedToggleHost`: `@for (row of orderedRows(); track
  $index)`, where `orderedRows = computed(() => reversed() ?
  [...renderRows()].reverse() : renderRows())`. The toggle row
  and panel row follow the `ClosePanelHost` shape. Use
  `withExpansion({ initial: ['t1', 't2'] })`. Following
  `ReorderedPanelHost`, the panel binds `[ngpTablePanel]=
  "row.id"`, so `movePanel` keeps the panels correct and only
  the toggle side is under test.
- Add a `toggle(name)` lookup to `setupClose()` beside
  `button(name)`. The existing `button()` already matches by
  text, so `button('Toggle t1')` works as it is.

## Seams — in red-green order
### A. Focus inside the panel, then `close()` → the row's toggle gets focus
- Test: extend the existing test at `ngp-table-panel.directive.spec.ts:277` ("close() collapses only its own row") with a focus assertion. No new test.
- Asserts: `button('Close t1').focus(); button('Close t1').click(); fixture.detectChanges();` → `document.activeElement` is `button('Toggle t1')`. It is not `Toggle t2`.
- Why this seam: the base proof that the toggle registers
  once its row id is known. It catches a missing
  registration, a registration made before the `NGP_TABLE_ROW`
  input resolves (keyed `undefined`), and a registration
  keyed by the wrong row. Click alone does not move focus in
  the test DOM, so the explicit `focus()` is what puts focus
  inside the panel.
- Order reason: independent. This is the base case.

### B. Esc inside the panel → the row's toggle gets focus
- Test: extend the existing test at `ngp-table-panel.directive.spec.ts:286` the same way. No new test.
- Asserts: `button('Close t1').focus(); pressEscape(button('Close t1')); fixture.detectChanges();` → `document.activeElement` is `button('Toggle t1')`.
- Why this seam: the issue's acceptance criterion. It catches
  an Esc path that collapses the row without going through
  `close()`'s focus return. The existing Esc test checks only
  the open set, so that bug would pass today.
- Order reason: builds on A, which provides the registration.

### C. Focus on `<body>`, then `close()` → the toggle gets focus
- Test: `it('close() returns focus to the toggle when focus is on <body>')`
- Asserts: `(document.activeElement as HTMLElement | null)?.blur()` (or any blur that leaves `document.activeElement === document.body`; check this first), then `p.close()` through the `Close t1` button's click handler with no prior focus, then `detectChanges()` → `document.activeElement` is `button('Toggle t1')`.
- Why this seam: the `allowBody` branch. It catches a
  `returnFocus` that only handles focus inside the panel.
  That is the destroy path's rule, and `close()` must not use
  it.
- Order reason: builds on A. It is the same path with a
  different starting focus.

### D. No active element, then `close()` → the toggle gets focus
- Test: `it('close() returns focus to the toggle when no element has focus')`
- Asserts: stub `document.activeElement` to return `null` for this test only (`Object.defineProperty(document, 'activeElement', { configurable: true, get: () => null })`, then delete it in `finally`/`afterEach`). Call `close()` on t1 and assert `toggle.focus` was called: `vi.spyOn(button('Toggle t1'), 'focus')` was called once. A spy is needed because `activeElement` is stubbed.
- Why this seam: the `active === null` half of the
  focus-lost check. Removing that half fails only this test.
  The `<body>` case in C passes either way.
- Order reason: builds on C. It is the second half of the same
  condition.

### E. Focus outside the panel, then `close()` → focus stays put
- Test: `it('close() leaves focus alone when it was outside the panel')`
- Asserts: `button('Toggle t2').focus()`, click `Close t1`, `detectChanges()` → `document.activeElement` is still `button('Toggle t2')`.
- Why this seam: the guard against stealing focus. It catches
  a `returnFocus` that always focuses the toggle, or a focus
  check that is too broad. Before this step `toggleOf` was
  always `null`, so the bug could not show. This step makes
  it reachable. E's detectChanges also destroys panel t1, so
  it covers the destroy path with focus outside too; step 4
  cites it.
- Order reason: builds on A. It needs a registered toggle to
  show that the toggle was *not* focused.

### F. A reused view changes row id → registration moves with it
- Test: `it('returns focus to the toggle now rendering the row after reused views swap rows')`
- Asserts: on `ReusedToggleHost`, `reversed.set(true); detectChanges()`. Then focus `Close t1`, click it, `detectChanges()` → `document.activeElement?.textContent?.trim()` is `'Toggle t1'`. Repeat for t2 on a fresh fixture, or in the same test before closing t1: focus `Close t2`, click it → `'Toggle t2'`.
- Why this seam: with `track $index`, the toggle element at
  index 0 changes from t1 to t2. If the registration does not
  move, t1 still maps to the element that now shows `Toggle t2`,
  and the text assertion fails. Checking both rows also
  catches a move that unregisters the old id after the other
  toggle has registered it. That would delete one key. The
  host check in `unregisterToggle` decides the order, and the
  effect-based move must not get around it.
- Order reason: builds on A, which provides first
  registration. This tests the update path the outline calls
  out, because without `ngOnChanges` the toggle reacts to
  `row.ngpTableRow().id` itself.

## Types phase (written in red, proven by green's typecheck)
None — no public type surface in this step.

## Not tested
- Asserting on `registerToggle` / `unregisterToggle` /
  `toggleOf` directly. The spec's Testing Decisions say
  "never on the registry or private members". Every assertion
  above goes through focus.
- `unregisterToggle` on destroy — not observable: the panel's
  `isConnected` guard hides a stale entry. Step 4 owns the
  connected-toggle behaviour.
- Destroy paths (unmount with focus inside; collapse-all or
  destroy with focus outside; focus returning before the
  destroy-time `inert` write). These are step 4.
- `aria-controls`, `isOpen`, and the toggle click. These are
  step 2.
- The browser moving focus after `inert`. That is browser
  behaviour, as the spec says.
