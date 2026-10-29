# Step 4 test plan — A nested grid is ordinary content of a multi-widget cell

Step: [step-4-nested-grid-keys.plan.md](step-4-nested-grid-keys.plan.md)
Spec file: `libs/table/src/directives/ngp-table.directive.spec.ts` (new `describe('NgpTableDirective nested grid in a cell')`)

Fixture: `NestedInCellHost`, laid out like `GridHost`.

- Outer grid: `createGridTable`, columns `id` and `name`, rows 1–3.
- Outer cell row 2 / `name` (`td[ngpTableCell]`) holds `@if (showInner()) { <table [ngpTable]="inner"> … }`. `inner` is a second `createGridTable` store with plain cells only.
- Helpers are scoped per grid. The existing `cell()` descendant selector would also match inner cells. Use `outerCell(row, col)` (rows directly under the outer `<table>`), `innerCell(row, col)` (inside the inner host), and `tabStops()` (every `[tabindex="0"]` under the fixture root).
- Every seam that relies on the host `MutationObserver` must wait for it: `await fixture.whenStable()` (or `await Promise.resolve()`), then `flush()`. Those tests are `async`.

## Behaviour coverage

| Id  | Behaviour                                                                                                            | Source             | Tested by                 |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------- |
| AC6 | A nested grid owns its own keys                                                                                      | issue #237 AC6     | Base, D                   |
| S33 | Arrowing inside a nested grid never moves the outer grid                                                             | spec story 33; K6c | Base, D                   |
| DW  | One Tab stop per outermost grid until the user enters                                                                | outline Done when  | Base, A, B                |
| N1  | An outer cell holding an inner grid classifies `composite`                                                           | outline Do 1; K38  | Base                      |
| N2  | While not entered, the outer marks inner focusables `-1`, roving `0` included                                        | outline Do 2       | A; static case Not tested |
| N3  | Entering restores the originals (the inner Tab stop comes back); exit marks them again                               | outline Do 2       | B, D                      |
| N4  | Keys inside an entered outer cell are left alone; an unhandled Esc/F2 exits the outer cell, one level per press      | outline Do 3       | D; rest Not tested        |
| N5  | Focus landing inside the inner grid enters the outer cell and moves the outer position there; the K9d flag stays set | outline Do 4       | C; flag Not tested        |
| N6  | The observer watches `tabindex` inside non-entered cells, writes only when the value differs, never loops            | outline Do 5       | A, B, D                   |

## Stubs (red phase)

- None. The tests import only existing symbols (`NgpTableDirective`, `NgpTableRowDirective`, `NgpTableCellDirective`). The step adds no exported symbol. Red comes from assertions failing against the code as of step 3.

## Seams — in red-green order

### Base. Arrow onto the outer cell holding an inner grid → the outer cell is focused; Enter moves inside

- Test: `it('treats a nested grid as the widgets of a multi-widget cell')`
- Steps: `showInner` true at setup. Focus `outerCell(2,'id')`, press `ArrowRight`, then press `Enter` on `outerCell(2,'name')`.
- Asserts: after `ArrowRight`, `document.activeElement` is `outerCell(2,'name')` and `tabStops()` is `[outerCell(2,'name')]`. After `Enter`, the inner host contains `document.activeElement`, and `[tabindex="0"]` inside the inner host is exactly `[innerCell(1,'id')]`.
- Covers: AC6, S33, DW, N1
- Risk: damage high, likelihood high
- Why this seam: K38 says a descendant with a composite-widget role (`grid`, `treegrid`, `listbox`, `tree`) makes the cell `composite`, whatever the focusable count. The inner `ngpTable` host carries `role="grid"`. Without that rule, a count-based classification gets a nested grid wrong. Counting only the inner active cell gives `single`: arrowing focuses an inner cell and the inner grid's arrows trap the user. Counting no `[tabindex]` cells gives `plain`: Enter does nothing. Step 1 seam C unit-tests the rule. This is the nested-grid test of it from outside, through the outer host. It fails in red only if step 1 left the role rule out.
- Order reason: independent. It sets up the composite, not-entered state the other seams use.

### A. Inner position moves while the outer cell is not entered → still one Tab stop on the page

- Test: `it('keeps one tab stop when the nested grid moves its own tab stop while the outer cell is not entered')`
- Steps: `showInner` true, outer cell not entered. Call `host.inner.focus.moveTo({ area: 'body', rowId: 2, columnId: 'id' })`, flush, wait for the observer.
- Asserts: `tabStops()` is `[outerCell(1,'id')]`; `innerCell(2,'id')` has `tabindex="-1"`.
- Covers: DW, N2, N6
- Risk: damage low, likelihood low
- Why this seam: catches the observer not watching `tabindex` attribute changes. The inner binding writes `0` onto a new cell after the marking, which exposes a second Tab stop. Fails red: the step-1 observer watches `childList` only. An observer that writes even when the value is unchanged loops on its own records, and this test hangs.
- Order reason: builds on Base (the not-entered composite state).

### B. Inner position moves while not entered, then the outer cell is entered → the inner Tab stop is on the inner's new cell

- Test: `it('restores the nested grid\'s latest tab stop when the outer cell is entered')`
- Steps: as A, then focus `outerCell(2,'name')` and press `Enter`.
- Asserts: `[tabindex="0"]` inside the inner host is exactly `[innerCell(2,'id')]`; `innerCell(1,'id')` is `-1`.
- Covers: DW, N3, N6
- Risk: damage high, likelihood low
- Why this seam: catches a stale remembered original. A restore that uses the first sweep's values puts `0` back on inner row 1 and leaves row 2 at `-1`. Angular never rewrites an unchanged binding, so the inner Tab stop and the inner store disagree. It also catches the observer recording its own `-1` write as the original: no inner Tab stop is left at all. Fails red.
- Order reason: builds on A (the observer is what records the inner's new original).

### C. Focus lands on an inner cell → the outer cell is entered, the outer position is that cell, the focused inner cell keeps `0`

- Test: `it('enters the outer cell when focus lands inside the nested grid')`
- Steps: `showInner` true, outer cell not entered. Call `innerCell(2,'name').focus()`, flush, wait for the observer.
- Asserts: `host.table.focus()` is `{ area: 'body', rowId: 2, columnId: 'name' }`; `document.activeElement` is `innerCell(2,'name')`; `[tabindex="0"]` inside the inner host is exactly `[innerCell(2,'name')]`.
- Covers: N5
- Risk: damage high, likelihood high
- Why this seam: catches focus-entry not recognising an inner cell as a widget of the outer cell. Then A's observer treats the cell as not entered and strips `0` from the focused inner cell. Tab leaves the grid and Esc has nothing to exit.
- Order reason: builds on A. Expected to pass in red — regression guard for A's observer.

### D. Enter, move inside the inner grid, Esc, Enter again → the inner Tab stop follows the inner's last position

- Test: `it('re-marks the nested grid on exit and restores its last tab stop on re-entry')`
- Steps: `showInner` true. Enter `outerCell(2,'name')`. Press `ArrowDown` on `innerCell(1,'id')`, flush, wait for the observer. Press `Escape` on `innerCell(2,'id')` (a plain cell, so the inner grid leaves Esc unhandled). Press `Enter` on `outerCell(2,'name')`.
- Asserts:
  - After `ArrowDown`: `host.table.focus()` is unchanged (`{ area: 'body', rowId: 2, columnId: 'name' }`); `[tabindex="0"]` inside the inner host is `[innerCell(2,'id')]`.
  - After `Escape`: `document.activeElement` is `outerCell(2,'name')`; `tabStops()` is `[outerCell(2,'name')]`.
  - After the second `Enter`: `[tabindex="0"]` inside the inner host is exactly `[innerCell(2,'id')]`.
- Covers: AC6, S33, N3, N4, N6
- Risk: damage high, likelihood high
- Why this seam: catches exit keeping the first-entry originals instead of taking a fresh snapshot. Re-entry would then restore `0` on inner row 1. Fails red if step 3 keeps one snapshot per cell. After green, the `ArrowDown` assertion also catches A's observer missing its "not entered" scope: it would strip the inner's `0` while the user is inside.
- Order reason: builds on B (the same originals map, written at exit instead of by the observer).

## Types phase (after green)

None — no public type surface in this step.

## Not tested

- An inner grid rendered with the outer one is marked `-1` while not entered: covered by step 1 — 'marks every focusable already inside a cell as tabindex="-1" when the cell registers'. Inner cells are ordinary focusables.
- An inner grid added after the outer one rendered is marked `-1`: covered by step 1 — 'marks a control added or swapped into a registered cell after the observer flushes'. The dynamic `tabindex` path is A.
- Keys inside an entered outer cell never move the outer grid: covered by step 3 — 'leaves %s on a widget inside an entered cell to the widget'. The inner grid also calls `preventDefault()` on every key it handles: covered by `ngp-table.directive.spec.ts` — 'ignores a key event a consumer already prevented'.
- Esc in an entered inner multi-widget cell exits only the inner cell (one level): covered by `ngp-table.directive.spec.ts` — 'ignores a key event a consumer already prevented'.
- An unhandled F2 bubbling up and exiting the outer cell: same exit path as Esc in D; covered by step 3 — 'leaves an entered cell on %s and focuses the cell'.
- The K9d focus-within flag stays set on inner focus: unchanged code (`followFocusIn` sets it on every `focusin`), so a test cannot fail.
- The observer writing only when the value differs: no separate test. A loop hangs A, and a recorded self-write fails B.
- Detail panels: out of scope (#241). A panel sits in a plain `<td>` today, so the outer grid ignores it.
- `div` host parity: the model does not depend on the host tag.
- Three-level nesting: the same model applied recursively. Damage low, likelihood low.
- The remembered-original map and the registries: internal, ruled out by the spec's Testing Decisions.
