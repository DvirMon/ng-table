# Step 2 test plan — A cell with one widget focuses that widget

Step: [step-2-single-widget-cell.plan.md](step-2-single-widget-cell.plan.md)
Spec file: `libs/table/src/directives/ngp-table.directive.spec.ts`

## Behaviour coverage

| Id  | Behaviour                                                                                                                          | Source                                                 | Tested by                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| AC1 | A single-checkbox or single-button cell focuses the widget when arrowed onto                                                       | issue #237 AC1; spec story 25; K6a                     | B                                                   |
| DO1 | In the active single-widget cell, the widget holds `tabindex="0"` and the cell holds `-1`. Exactly one `tabindex="0"` in the table | outline Do 1; K34; spec story 1                        | A, C, D, E                                          |
| DO2 | Arrowing, the focus-sync effect and Tab into the grid all focus the widget                                                         | outline Do 2; architecture § host listener             | A (Tab in), B (arrow / sync effect)                 |
| DO3 | Arrow keys pressed on a focused checkbox or button still move the grid                                                             | outline Do 3; K6a                                      | C                                                   |
| DO4 | Space/Enter on the widget keep their native action; the grid does not handle them                                                  | outline Do 3; K6a                                      | Not tested                                          |
| DO5 | Clicking the widget moves the stored position to its cell                                                                          | outline Do 4; K3b; architecture § focusin              | Existing test, edited (see Edits to existing tests) |
| DO6 | A multi-widget cell is focused as the cell itself, not forwarded to a widget                                                       | K6a; issue #237 AC2 (first half); moved in from step 3 | E                                                   |

## Stubs (red phase)

- None. The tests drive only the existing `NgpTableDirective`, `NgpTableRowDirective` and `NgpTableCellDirective` through the DOM. Step 2 exports no new symbol the tests import. Step 1's `cell-widgets.ts` is real code by the time this step starts.

## Edits to existing tests (red phase, approved behaviour change per K34)

`GridHost` row 2 `name` holds one `<button>`, so it is now a single-widget cell.

- `'writes the focused cell to the store on focusin (a button inside the cell)'`
  - Old: `tabStops()` equals `[cell(2, 'name')]`.
  - New: `tabStops()` equals `[button]`, the button inside `cell(2, 'name')`.
  - Note: `it.each` shares that assertion with the `'the cell itself'` row. That row's expected stop must become the button too, since the cell is single-widget either way. Expected stop: the button for both rows.
- `'never moves DOM focus from outside the grid without a focusElement request'`
  - Old: after `moveTo(2/name, { focusElement: true })`, `document.activeElement` is `cell(2, 'name')`.
  - New: `document.activeElement` is the button inside `cell(2, 'name')`.

Both edits fail against step 1 code (red) and pass in green. They also give a button the single-widget coverage the new describe gives a checkbox.

## Seams — in red-green order

New `describe('NgpTableDirective single-widget cells')` in the spec file. It has its own host, `WidgetGridHost`:

- rows 1–3 from `mockRows`, columns `id` and `name`;
- every `name` cell holds one `<input type="checkbox" [attr.aria-label]="'Select ' + row.id">` behind `@if (showCheckbox())`, with `showCheckbox = signal(true)`;
- row 3 `id` cell holds two buttons, "Edit 3" and "Delete 3" (composite);
- other `id` cells hold text only;
- a `#outside` button before the table.

It reuses the `setupGrid` helper shape: `flush`, `cell`, `press`, `tabStops`. Widgets are queried by accessible name.

### A. Store target on a single-widget cell → the widget is the only Tab stop

- Test: `it('puts the only tabindex="0" on the widget of a single-widget active cell')`
- Asserts: with `#outside` focused, `moveTo({ area: 'body', rowId: 2, columnId: 'name' })` and flush. Then:
  - checkbox "Select 2" has `tabindex="0"`;
  - `cell(2, 'name')` has `tabindex="-1"`;
  - `tabStops()` equals `[checkbox 2]`;
  - `document.activeElement` is still `#outside`.
- Covers: DO1, DO2 (Tab into the grid lands on the widget)
- Risk: damage high, likelihood high
- Why this seam: catches the cell keeping `0` (the Tab stop never reaches the widget) and both cell and widget at `0` (two Tab stops, breaks K3). It also pins Tab-in: jsdom does not simulate Tab, but the browser's next Tab goes to the single `tabindex="0"`.
- Order reason: independent. The base case: the tabindex derivation everything else reads.

### B. Arrow onto a single-widget cell → DOM focus on the widget

- Test: `it('focuses the widget when arrowing onto a single-widget cell')`
- Asserts: focus `cell(1, 'id')`, press `ArrowRight`, flush. Then:
  - `document.activeElement` is checkbox "Select 1";
  - `table.focus()` equals `{ area: 'body', rowId: 1, columnId: 'name' }`;
  - `tabStops()` equals `[checkbox 1]`;
  - `event.defaultPrevented` is `true`.
- Covers: AC1, DO2 (arrow and sync effect share `focusCellElement`)
- Risk: damage high, likelihood high
- Why this seam: catches `focusCellElement` focusing the registered cell instead of its widget. This is the AC1 failure, and it leaves DOM focus on a `-1` element while the Tab stop is elsewhere.
- Order reason: builds on A. The element that gets DOM focus must be the one A made the Tab stop.

### E. Arrow onto a multi-widget cell → DOM focus on the cell itself

- Test: `it('focuses a multi-widget cell itself when arrowed onto')`
- Asserts: focus `cell(2, 'id')`, press `ArrowDown`, flush. Then:
  - `document.activeElement` is `cell(3, 'id')`;
  - buttons "Edit 3" and "Delete 3" both have `tabindex="-1"`;
  - `tabStops()` equals `[cell(3, 'id')]`.
- Covers: DO6, DO1
- Risk: damage high, likelihood high
- Why this seam: catches B's widget forwarding also firing for a composite cell, for example "focus the first focusable descendant". The caret would land in an input, and arrow keys would then belong to the widget instead of the grid.
- Order reason: builds on B. It is B's negative case, the guard on the same forwarding branch.

### C. Arrow off a focused widget → grid moves, widget drops back to -1

- Test: `it('navigates from a focused widget and returns it to tabindex="-1"')`
- Asserts: reach checkbox "Select 1" as in B, press `ArrowLeft` on the checkbox, flush. Then:
  - `document.activeElement` is `cell(1, 'id')`;
  - checkbox "Select 1" has `tabindex="-1"`;
  - `tabStops()` equals `[cell(1, 'id')]`.
- Covers: DO3, DO1
- Risk: damage high, likelihood high
- Why this seam: catches a widget left at `0` after its cell is no longer active (one extra Tab stop per visited row). It also catches a key from a widget target not reaching navigation. Step 3's editable-target skip must not swallow `input[type=checkbox]`, and this test guards that.
- Order reason: builds on B (starts from a widget focused by arrow).

### D. Widget removed from the active cell → the cell takes the Tab stop back

- Test: `it('moves the Tab stop back to the cell when its only widget is removed')`
- Asserts: `moveTo` 2/name with focus outside, flush, then `showCheckbox.set(false)`, flush. Then:
  - `tabStops()` equals `[cell(2, 'name')]`.
- Covers: DO1
- Risk: damage high, likelihood low
- Why this seam: step 1 owns refreshing the widget kind when children change. This is that behaviour's outside test, at the Tab-stop level step 2 owns. It catches the Tab stop staying on a detached widget, which leaves the grid with zero Tab stops and unreachable by keyboard.
- Order reason: builds on A.

## Types phase (after green)

- None — no public type surface in this step.

## Not tested

- `moveTo` while focus is inside, and `{ focusElement: true }` from outside, focusing the widget: same `focusCellElement` path as B, so they fail on the same bug. The edited `focusElement` existing test covers the request path with a button anyway.
- Button vs checkbox vs link as a single widget: classification is step 1's spec. The focusing path here does not depend on the widget kind. The two edited existing tests exercise a button, the new describe a checkbox.
- A lone disabled button cell (classified `none`, gets cell focus): classification is step 1's (K35). Step 2's focusing path only reads the kind.
- DO4 Space/Enter stay native: nothing in step 2 handles them, so the test passes before and after this step. A test that cannot fail in red is a plan defect. It belongs to step 3, where Enter gains a meaning: carry it as a step 3 seam ("Enter on a single-widget cell is not prevented").
- DO5 click on the widget writes the store: covered by `ngp-table.directive.spec.ts` — `'writes the focused cell to the store on focusin (a button inside the cell)'`, edited above for its Tab-stop half.
- A widget added to the active plain cell (the reverse of D): same step 1 reclassification mechanism as D. Low damage: the cell keeps the single stop, and only focus lands on the cell instead of the widget.
- Focus on the padding of a single-widget cell (cell focused, widget is the Tab stop): no store change, no code path in this step.
