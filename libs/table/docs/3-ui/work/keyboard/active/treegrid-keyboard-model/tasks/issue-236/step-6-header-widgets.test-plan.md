# Step 6 test plan — Header widgets (provisional)

Step: [step-6-header-widgets.plan.md](step-6-header-widgets.plan.md)
Spec file: `libs/table/src/directives/ngp-table.directive.spec.ts` (new `describe('NgpTableDirective header widgets', …)` block with its own host and setup helper)

Provisional: written before #237 exists on `main`. Re-check each seam against #237's tests after the rebase (see the step file's Watch out).

## Behaviour coverage

| Id   | Behaviour                                                                                | Source                                | Tested by  |
| ---- | ---------------------------------------------------------------------------------------- | ------------------------------------- | ---------- |
| AC7  | A sortable header cell focuses its sort button (single-widget cell)                      | issue #236 AC; spec story 35; K7, K6a | A          |
| S35b | Enter/Space on the header button stay native: the grid does not handle them              | spec story 35; K6a                    | B          |
| AC8  | A header filter input behaves like any other text cell                                   | issue #236 AC; spec story 32; K6c     | C, D, E    |
| S26h | Arrowing onto a header holding a text input focuses the header cell, not the input       | spec story 26                         | C          |
| S27h | Enter or F2 on that header cell moves focus into the input                               | spec story 27; K6a                    | C          |
| S28h | Esc in the input returns focus to the header cell; the store target stays on that header | spec story 28; K6a                    | D          |
| S29h | Arrow keys typed in the header input move the caret, not the grid                        | spec story 29; K6a                    | E          |
| K6aT | Widgets inside header cells sit at `tabindex="-1"`, so the grid stays one Tab stop       | K6a                                   | F          |
| S30  | A consumer's `(keydown.escape)` with `preventDefault()` keeps focus in the input         | spec story 30; K6b                    | Not tested |
| S35s | Enter/Space actually sorts                                                               | spec story 35                         | Not tested |

## Stubs (red phase)

None. This step creates no exported symbol. The glue goes into existing directives, and its shape depends on how #237 implements widget detection. Every seam goes red on an assertion against the code as it stands after step 4 plus the #237 rebase.

## Seams — in red-green order

Fixture notes for the red phase:

- Add a new host, `HeaderWidgetsHost`, and a new setup helper. `setupGrid` is generic over `GridHost | ReversedRowsHost`; widening it would edit existing test code.
- Template: the same `<thead><tr>` as the step 4 header host, with `@for (column of table.renderColumns(); …; let i = $index)` `<th [ngpTableHeaderCell]="i">`. Column `id` holds `<input aria-label="Filter id">`. Column `name` holds `<button type="button">Sort name</button>` — a plain button, because `ngpTableSort` has no code. Body: `GRID_ROW` with `createGridTable`.
- Find header cells with `[role="columnheader"][aria-colindex="N"]`; find widgets by `aria-label` or visible text.
- Same `press`/`flush` shape as the existing block; append the root to `document.body`, `replaceChildren()` in `afterEach`.

### A. ArrowUp from body cell `(1,'name')` → the `name` header's button gets DOM focus; the store holds `{area:'header', columnId:'name'}`

- Test: `it('focuses the single button of a header cell when arrowing onto it')`
- Asserts: after `cell(1,'name').focus()` and ArrowUp, `document.activeElement` is the "Sort name" button. `table.focus()` equals `{ area: 'header', columnId: 'name' }`. `event.defaultPrevented` is `true`. The set of `tabindex="0"` elements is the one element #237 makes the stop for a single-widget cell (th or button; confirm after the rebase).
- Covers: AC7
- Risk: damage high, likelihood high
- Why this seam: catches a widget redirect that exists only for body cells — detection in `ngpTableCell`, or step 4's header branch of the sync effect calling `.focus()` on the `th` directly and skipping #237's "focus the single widget" step. Focus then lands on the `th` and the sort button needs an extra Tab.
- Order reason: independent. Base case for the button header.

### B. Enter / Space pressed on the focused header button → not handled by the grid

- Test: `it.each(['Enter', ' '])('leaves %j on a header sort button to the button')`
- Asserts: reach the button as in A, then press the key on the button. `event.defaultPrevented` is `false`. `document.activeElement` is still the button. `table.focus()` is still `{ area: 'header', columnId: 'name' }`.
- Covers: S35b
- Risk: damage high, likelihood low
- Why this seam: #237 adds an Enter/F2 "enter the cell" handler. If it sees a header target and treats it as a multi-widget cell (detection does not run for headers), it would `preventDefault()` Enter and break sorting by keyboard.
- Order reason: builds on A.

### C. ArrowUp from body cell `(1,'id')` → the `id` header cell itself is focused; Enter or F2 then moves focus into its input

- Test: `it.each(['Enter', 'F2'])('enters the filter input of a header cell on %s')`
- Asserts: after ArrowUp, `document.activeElement` is the `th` with `aria-colindex="1"` (not the input), and `table.focus()` is `{ area: 'header', columnId: 'id' }`. After pressing the key on the `th`, `document.activeElement` is the "Filter id" input, `table.focus()` is unchanged, and `event.defaultPrevented` is `true`.
- Covers: AC8, S26h, S27h
- Risk: damage high, likelihood high
- Why this seam: catches (1) the Enter/F2 handler resolving "the cell to enter" from `activeBodyCell()` or a body-only registry lookup, so it does nothing on a header target; (2) an input classified as a single widget on header cells, so the arrow lands in the input and traps the arrow keys.
- Order reason: independent of A and B. Base case for the filter header.

### D. Esc in the header filter input → focus returns to the `id` header cell; the store still holds that header

- Test: `it('returns focus from a header filter input to its header cell on Escape')`
- Asserts: reach the input as in C (Enter). Press Escape on the input. `document.activeElement` is the `th` with `aria-colindex="1"`. `table.focus()` equals `{ area: 'header', columnId: 'id' }`.
- Covers: AC8, S28h
- Risk: damage high, likelihood high
- Why this seam: Esc must find "the cell containing the input". A lookup that only builds body targets, or a write that falls back to the K3 first-entry default, sends the user to body row 1 or leaves focus in the input. The store assertion also catches a `focusin` on the `th` that writes a wrong target.
- Order reason: builds on C.

### E. ArrowDown / ArrowLeft typed in the header filter input → the grid does not move

- Test: `it.each(['ArrowDown', 'ArrowLeft'])('leaves %s typed in a header filter input to the caret')`
- Asserts: reach the input as in C. Press the key on the input. `event.defaultPrevented` is `false`. `document.activeElement` is still the input. `table.focus()` is still `{ area: 'header', columnId: 'id' }`.
- Covers: AC8, S29h
- Risk: damage high, likelihood high
- Why this seam: before step 4 a key from inside a header returned early because `activeBodyCell()` was `null` for a header target, hiding a missing editable-target skip. After step 4 a header is a valid current target, so the skip is the only guard left. If the rebase merges #237's skip into the old handler and not step 4's renamed one, ArrowDown takes the user out of the filter mid-typing.
- Order reason: builds on C.

### F. A body cell is active → the header's input and button are `tabindex="-1"`

- Test: `it('keeps widgets inside header cells out of the tab order')`
- Asserts: after `cell(1,'id').focus()`, the "Filter id" input and the "Sort name" button both have `tabindex="-1"`, and `tabStops()` equals `[cell(1,'id')]`.
- Covers: K6aT
- Risk: damage high, likelihood high
- Why this seam: if #237 sets `tabindex="-1"` on descendants from `ngpTableCell` only, the native input and button in a header stay in the Tab order — one extra Tab stop per header widget, breaking K3.
- Order reason: independent. Last because it does not feed A–E.

## Types phase (after green)

None — no public type surface in this step.

## Not tested

- S30: a consumer's Esc handler with `preventDefault()` keeps focus in the input. K6b skips prevented events before any target is resolved, so there is no header branch. Covered by the existing 'ignores a key event a consumer already prevented' and by #237's Esc test (name to confirm after the rebase).
- S35s: Enter/Space actually sorts. `ngpTableSort` has no code; the grid's only job here is not to take the key (B).
- Arrowing away from a focused header button: the current target comes from `activeTarget()`, not the event target. Expected to be covered by #237's single-widget body test plus step 4 seams B and C. Bring it back if #237 has no such test.
- Tab from the header input leaving the grid: native behaviour once F holds.
- `focusin` on the input or button writing the header target: covered by step 3 seam E (button variant, same `cellContaining` path).
- A cell with several widgets, a `<select>` or a `contenteditable` in a header: same classification path as C; body coverage belongs to #237.
- Widgets in div-grid header cells: same binding on both host tags (#238).

## Open questions (resolve after the #237 rebase)

- Which element holds `tabindex="0"` for a single-widget cell, the cell or the widget? A's tab-stop assertion follows #237's answer.
- Does the grid call `preventDefault()` on the Esc it handles? D does not assert it; neither the spec nor K6a says so.
