# Step 3 test plan — Composite cell modes

Step: [step-3-composite-cell-modes.plan.md](step-3-composite-cell-modes.plan.md)
Spec file: `libs/table/src/directives/ngp-table.directive.spec.ts`
(new `describe('NgpTableDirective composite cell modes')`,
beside step 2's widget block)

## Behaviour coverage

| Id   | Behaviour                                                                                                                 | Source                                                 | Tested by  |
| ---- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------- |
| AC2a | Arrowing onto a text-input or multi-widget cell focuses the cell                                                          | issue AC2; story 26; K6a                               | Not tested |
| AC2b | Enter/F2 on the focused composite cell moves focus to its first widget and gives its widgets back their original tabindex | issue AC2; story 27; K34                               | A          |
| AC2c | Esc or F2 inside an entered cell sets its widgets back to `-1` and focuses the cell                                       | issue AC2; story 28; APG grid (F2 restores navigation) | B          |
| S1   | Enter on a single-widget cell's button keeps its native click (Enter/F2 entry applies to composite cells only)            | K6a ("Space/Enter stay native"); step 2 plan hand-off  | C          |
| AC5  | Esc the consumer already prevented keeps focus in the input and leaves the cell entered                                   | issue AC5; story 30; K6b                               | D          |
| AC4  | Keys whose target is an input, textarea, select or contenteditable never move the grid                                    | issue AC4; story 29; K21                               | E          |
| W1   | In an entered cell, keys from any widget belong to that widget (Esc/F2 excepted)                                          | K6a ("arrows/Tab then belong to them")                 | F          |
| K34a | A pointer click straight into a composite cell's widget enters the cell                                                   | K34; outline Do                                        | G          |
| K34b | Focus leaving an entered cell returns it to navigation mode (widgets back to `-1`)                                        | K34; outline Do                                        | H          |
| AC3s | A control swapped in while the cell is entered stays tabbable, and is set to `-1` on exit                                 | issue AC3 (swap half); outline Do                      | Not tested |
| DW1  | Tab past the last widget leaves the grid                                                                                  | outline Do                                             | Not tested |
| U1   | An entered cell that unregisters (removed from the DOM) clears the entered state                                          | review answer                                          | Not tested |

## Stubs (red phase)

None. Every test reaches the behaviour only through
`<table [ngpTable]>`. The tests import nothing the step creates.
Red fails on assertions, not on `not implemented`.

## Seams — in red-green order

Fixture: `CompositeCellHost` uses `GRID_TEMPLATE`'s layout.
Row 1, column `name` holds a `@switch` on a host signal
`editor: 'input' | 'textarea' | 'select' | 'contenteditable'`.
The default `'input'` renders
`<input aria-label="Name">` + `<button type="button" tabindex="0">Save</button>`.
Each other value renders that element alone (all classified
`composite` by step 1; contenteditable is in its text-widget
set). Row 2, column `name` holds a lone
`<button type="button">Act</button>`, a single-widget cell
(for C).
Reuse `setupGrid`'s helpers (`cell`, `press`, `tabStops`,
`outside`, `flush`). Its generic constraint has to widen to
accept the new host. The `Save` button's explicit
`tabindex="0"` is the "original" value restored in A. The
input has no `tabindex` attribute.

### A. Enter / F2 on a focused composite cell → first widget focused, original tabindex back

- Test: `it.each(['Enter', 'F2'])('enters a composite cell on %s')`
- Asserts: focus cell(1,'id'), press `ArrowRight` (lands on
  cell(1,'name')), then press the key on the cell.
  `document.activeElement` is the input. The input has no
  `tabindex` attribute. The button has `tabindex="0"` (its
  original). `event.defaultPrevented` is `true`.
  `host.table.focus()` still names row 1 / `name`.
- Covers: AC2b
- Risk: damage high, likelihood high
- Why this seam: catches three bugs. Entering only moves focus
  but leaves the widgets at `-1`, so Tab cannot reach the
  second widget. Or the code writes a hardcoded `0` instead of
  the remembered original, so a consumer `tabindex` is lost.
  Or the code removes the attribute from a widget that had one.
- Order reason: base case. Arrives on the cell by arrowing onto
  it. That arrival (cell focused, not its input) is step 2's
  seam E.

### B. Esc / F2 from the input of an entered cell → widgets back to -1, cell focused

- Test: `it.each(['Escape', 'F2'])('leaves an entered cell on %s and focuses the cell')`
- Asserts: the key is dispatched with the **input** as target.
  After it, `document.activeElement` is cell(1,'name'). Input
  and button both have `tabindex="-1"`. `tabStops()` is
  `[cell(1,'name')]`. `event.defaultPrevented` is `true`.
- Covers: AC2c
- Risk: damage high, likelihood high
- Why this seam: catches Esc/F2 being dropped by the editable-
  target skip or by F's widget-key rule. Exit handling has to
  run before both, and this test fails if the order is wrong.
  The F2 row catches F2 wired as "enter" only, which would
  re-focus the first widget instead of exiting. Also catches the
  exit not setting widgets back to `-1`, which leaves extra Tab
  stops in the grid.
- Order reason: needs A's entered state.

### C. Enter on a single-widget cell's button → native click kept, cell not entered

- Test: `it('leaves Enter on a single-widget cell\'s button to the button')`
- Asserts: focus cell(2,'id'), press `ArrowRight`. Step 2
  makes the `Act` button the focus target. Press `Enter` on
  the button. `event.defaultPrevented` is `false`,
  `document.activeElement` is still the button,
  `host.table.focus()` still names row 2 / `name`, and
  `tabStops()` is still `[Act button]`. Entering would have
  restored its original tabindex (no attribute), so this shows
  the cell was not entered.
- Covers: S1
- Risk: damage high, likelihood high
- Why this seam: catches Enter/F2 entry that runs for every
  cell kind instead of `composite` only. Every single-button
  cell's keyboard click would be cancelled.
- Order reason: needs A (the Enter entry it limits to composite
  cells). Placed after B per review.

### D. Consumer-prevented Esc → focus stays in the input, cell stays entered

- Test: `it('keeps focus in the input when the consumer prevented Escape')`
- Asserts: an Esc event already `preventDefault()`-ed (same
  shape as the existing prevented-ArrowDown test) is dispatched
  on the input of an entered cell. `document.activeElement` is
  still the input. The button still has `tabindex="0"`. A
  following, unprevented Esc then exits (cell focused). That
  proves the cell is still in entered mode.
- Covers: AC5
- Risk: damage high, likelihood low
- Why this seam: catches an Esc exit path that skips the
  `defaultPrevented` check. That is likely if Esc is handled
  before the existing top-of-handler guard, or in a separate
  listener. The consumer's cancel-edit then also throws them
  out of the cell.
- Order reason: needs B (the exit it suppresses).

### E. Navigation key from an editable target, cell not entered → grid does not move

- Test: `it.each(['input', 'textarea', 'select', 'contenteditable'])('never moves the grid on an arrow key typed in a %s')`
- Asserts: set `editor` to the kind and flush. Focus
  cell(1,'name') (navigation mode, never entered). Dispatch
  `ArrowDown` and `Home` with the editable element as target.
  For each: `event.defaultPrevented` is `false`,
  `host.table.focus()` is unchanged, and
  `document.activeElement` is still the cell.
- Covers: AC4
- Risk: damage high, likelihood high
- Why this seam: catches a missing or partial editable check
  (for example `instanceof HTMLInputElement` only, or no
  `contenteditable`). The user's caret keys would jump the grid
  mid-edit. The keys are dispatched _without_ entering the
  cell, so F's entered-cell rule cannot make this pass; the
  test pins the K21 skip on its own. `Home` is included because
  `nextBodyTarget` handles it and a caret user needs it.
  jsdom note: the implementation should check the attribute
  (`closest('[contenteditable]')`), not `isContentEditable`,
  which jsdom may not implement.
- Order reason: independent.

### F. Enter / ArrowDown on a button inside an entered cell → left to the widget

- Test: `it.each(['Enter', 'ArrowDown'])('leaves %s on a widget inside an entered cell to the widget')`
- Asserts: enter the cell (A), focus the `Save` button, press
  the key on it. `event.defaultPrevented` is `false`,
  `document.activeElement` is still the button, and
  `host.table.focus()` still names row 1 / `name`.
- Covers: W1
- Risk: damage high, likelihood high
- Why this seam: the button is not an editable target, so E's
  skip does not protect it. A handler that treats Enter inside
  a composite cell as "enter the cell" would preventDefault and
  cancel the button's click on every keyboard press. A handler
  without the entered-cell rule would move the grid on
  ArrowDown and take focus out of the cell being edited.
- Order reason: needs A's entered state.

### G. Pointer focus straight into a widget → the cell enters

- Test: `it('enters a composite cell when focus lands on its widget from a pointer click')`
- Asserts: from navigation mode (cell never entered), call
  `input.focus()`. This fires the `focusin` a click produces.
  After flush, the button has `tabindex="0"` (restored), the
  store names row 1 / `name`, and an Esc on the input then
  focuses the cell (B's exit works from this entry).
- Covers: K34a
- Risk: damage low, likelihood high
- Why this seam: catches entry wired only to the Enter/F2 key
  path. A clicked-into cell would then have focus inside while
  its siblings stay `-1` (Tab dead-ends), and Esc would find no
  entered cell to leave.
- Order reason: reuses A's restore assertion and B's exit.

### H. Focus leaving an entered cell → widgets back to -1

- Test: `it('returns an entered cell to navigation mode when focus leaves it')`
- Asserts: enter the cell, then focus `outside()`. Input and
  button have `tabindex="-1"`. `tabStops()` is
  `[cell(1,'name')]`, so the next Tab in lands on the cell
  and not on a leftover widget.
- Covers: K34b
- Risk: damage low, likelihood high
- Why this seam: catches exit wired only to Esc/F2. Clicking
  away or tabbing out would leave the cell's widgets tabbable.
  The grid then has several Tab stops (breaks K3), and the next
  arrow onto that cell finds it still "entered".
- Order reason: needs A's entered state. Independent of B–G.

## Types phase (after green)

None — no public type surface in this step.

## Not tested

- Arrowing onto a composite cell focuses the cell (AC2a) — covered by step 2 seam E.
- Controls swapped in while entered stay tabbable and are set to `-1` on exit (AC3s) — over budget, damage low, likelihood low.
- Tab past the last widget leaves the grid (DW1) — native browser Tab order. jsdom does not move focus on Tab. The library's part (tabindex restored, one grid tab stop) is asserted in A and H.
- An entered cell that unregisters clears the entered state (U1) — removal drops focus to `<body>` with no `focusout`. The cell is gone, so nothing in the DOM shows the stale state. It only matters if a later cell reuses the same registration, which is a rare combination. Damage low, likelihood low.
- Esc on a cell in navigation mode is not prevented (so an enclosing dialog still closes) — over budget, damage low, likelihood low.
- Enter / F2 on a cell with no widgets is not prevented — over budget, damage low, likelihood low.
- Widget classification none / single / composite, the first `-1` marking, and the host `MutationObserver` in navigation mode — step 1's tests.
- A single-widget cell's widget as the roving tab stop — step 2's tests.
- `defaultPrevented` on non-Esc keys — covered by `ngp-table.directive.spec.ts` — 'ignores a key event a consumer already prevented'.
- Tab on a cell left unhandled — covered by `ngp-table.directive.spec.ts` — 'leaves an unhandled %s key alone'.
- Nested grids (step 4), header filter inputs (#236) — out of scope per outline / K32.
