# Step 5 test plan — Tab on a focused row walks its widgets, then leaves

Step: [step-5-row-tab-walk.plan.md](step-5-row-tab-walk.plan.md)
Spec file: `libs/table/src/directives/ngp-table.directive.spec.ts` (new `describe('NgpTableDirective treegrid row Tab walk')`, new `TreeRowWidgetsHost` built on `withTree()` + `mockTaskTreeRows`)

## Behaviour coverage
| Id | Behaviour | Source | Tested by |
|---|---|---|---|
| S24 / AC6 | Tab on a focused row walks that row's widgets, then leaves the grid | spec user story 24, §K6a; issue AC "Tab on a focused row walks its widgets, then leaves" | A, C |
| K35 | Only operable widgets come back: disabled, `hidden`, `aria-hidden` and original `tabindex="-1"` controls (the tree toggle) stay `-1` | K35; step Do | B |
| L1 | Leaving row mode by moving to a cell or another row puts the widgets back to `-1` | step Do | D, E |
| L2 | Focus leaving the row (and the grid) puts the widgets back to `-1` | step Do | F |
| K37/K38 | A nested grid in a row cell stays out of the row walk | K37, K38 | I |
| L3 | The row unregistering ends row mode | step Do | Not tested |
| K33 | Row mode does not fight the host MutationObserver | K33; step Watch out | G, H |

## Stubs (red phase)
None. Every test drives `ngpTable` through the DOM and `table.focus.moveTo`. No test imports a symbol this step creates. The registry's row-mode methods (for example `enterRow` / `exitRow`) are named in the step file.

## Seams — in red-green order

### A. Row is the active target → the counted widgets in its cells get their original tabindex back; cells stay `-1`
- Test: `it('restores the widgets of the focused row and keeps its cells out of the tab order')`
- Asserts: after `moveTo({ area: 'body', rowId: <root 1>, columnId: null })` and a flush:
  - a button with no authored tabindex has no `tabindex` attribute;
  - a button authored with `tabindex="0"` has `"0"`;
  - every `td` of that row has `"-1"`;
  - the row has `"0"`;
  - widgets in every other row stay `"-1"`.
- Covers: S24
- Risk: damage high, likelihood high
- Why this seam: catches the base bug. Without row mode, Tab from a row skips straight out of the grid, so row actions cannot be reached. It also catches restoring the wrong row's widgets, or giving the cells a tabindex of their own. Those bugs would add Tab stops and break "then leaves".
- Order reason: independent (base case)

### B. Row mode skips widgets that do not count (K35) while a sibling counted widget is restored
- Test: `it.each([...])('keeps a %s control out of the tab order while its row is focused')`, cases:
  - the toggle stand-in `<button tabindex="-1" aria-hidden="true">`;
  - an `aria-hidden="true"` button with no tabindex;
  - a `hidden` button;
  - a `disabled` button.
- Asserts: in row mode, the case's control has `tabindex="-1"`, and the counted checkbox in the same cell has no `tabindex` attribute. Both assertions are in one test, so the test fails in red.
- Covers: K35
- Risk: damage low, likelihood high (every tree row has a toggle)
- Why this seam: catches an implementation that calls plain `restoreTabOrder` on the cell. That call brings back an `aria-hidden` or hidden control as a Tab stop the screen reader cannot announce.
- Order reason: builds on A

### C. Focus moving onto a restored widget keeps the row as the active target
- Test: `it('keeps the row active while Tab walks onto its widgets')`
- Asserts:
  - after row mode, `firstWidget.focus()` plus a flush leaves `host.table.focus()` equal to `{ area: 'body', rowId: <root 1>, columnId: null }`;
  - the second widget still has no `tabindex` attribute;
  - the widget's cell is not entered: after focusing the second widget of a composite cell, the other widgets keep their restored values.
- Covers: S24
- Risk: damage high, likelihood high
- Why this seam: `followFocusIn` today maps the target to its cell. It then calls `moveTo` on that cell, and may call `enterCell` on a composite cell. Either call ends row mode on the first Tab, so the walk stops after one widget.
- Order reason: builds on A

### D. Moving from the row to a cell ends row mode
- Test: `it('returns the row widgets to tabindex="-1" when focus moves to a cell')`
- Asserts:
  - before the move, the widgets are restored (as in A);
  - after `moveTo` to a body cell of the same row, every widget is `"-1"`, except the target cell's lone widget, which follows the normal single-widget rule;
  - the only `[tabindex="0"]` is that cell or its lone widget.
- Covers: L1
- Risk: damage high, likelihood high
- Why this seam: catches a missing exit on the row-to-cell branch. Restored widgets would stay as extra Tab stops next to the roving stop (breaks K3).
- Order reason: builds on A

### E. Moving from one row to another switches row mode
- Test: `it('switches the restored widgets to the newly focused row')`
- Asserts: after `moveTo` to row 2 (`columnId: null`):
  - row 1's widgets are all `"-1"`;
  - row 2's counted widgets are restored.
- Covers: L1
- Risk: damage high, likelihood high (↑/↓ between rows is the main path)
- Why this seam: catches an implementation that restores the new row without first marking the old one again. Tab stops would pile up row by row. D does not catch this: D exercises the exit-to-cell branch, not the switch branch.
- Order reason: builds on A

### F. Focus leaving the grid from a row widget ends row mode; the row stays the Tab stop
- Test: `it('puts the row widgets back to tabindex="-1" when focus leaves the grid')`
- Asserts:
  - focus a row widget, then `#outside`, and dispatch `focusout` with `relatedTarget` set to the outside button;
  - every widget in the row is `"-1"`;
  - the only `[tabindex="0"]` in the grid is the row;
  - `host.table.focus()` is still the row target.
- Covers: S24 ("then leaves"), L2
- Risk: damage high, likelihood high
- Why this seam: without this exit, a later Tab back into the grid stops on the old row's widgets first. Those widgets become extra Tab stops outside the roving model.
- Order reason: builds on C (focus starts on a restored widget)

### G. Restored widgets survive an observer delivery and a later render
- Test: `it('keeps the row widgets restored after the host observer runs', async)`
- Asserts: in row mode, `await` the observer microtask, then flush another render. The widgets still hold their restored values (none flips to `"-1"`).
- Covers: K33
- Risk: damage high, likelihood high (every render runs `flushAddedWidgets` and `syncTabStop`)
- Why this seam: catches two bugs:
  - restore writes made with plain `setAttribute`, not `writeTabindex`, which `retrackTabindex` treats as a binding write and marks `-1` again;
  - `retrackTabindex` or `syncTabStop` ignoring row mode the way they already check `entered`.

  In both cases the widgets are restored and then removed again, so the walk does nothing in a browser.
- Order reason: builds on A

### H. A control added to a row-mode row after entry joins the walk
- Test: `it('leaves a control added to the focused row in the tab order', async)`
- Asserts: in row mode, flip a host signal that renders a new button into a cell of that row, then `await` the observer and flush. The new button has no `tabindex` attribute. The same button added to a row that is not focused gets `"-1"`.
- Covers: K33
- Risk: damage low, likelihood low
- Why this seam: `refreshWidgets` only skips marking for the `entered` cell. If it is not told about row mode, it marks the new control `-1`, and Tab skips it.
- Order reason: builds on G

### I. A nested grid inside a row cell keeps its inner roving `tabindex="0"` at `-1` while the row is in row mode
- Test: `it('keeps a nested grid\'s roving tabindex at -1 while the row is in row mode')`
- Asserts: a row cell holds a nested `ngpTable` grid whose active cell has original `tabindex="0"`, and another cell holds a plain button. With the row as the active target, the button is back to its original tabindex and the nested grid's active cell stays `-1`.
- Covers: K37, K38
- Risk: damage low, likelihood low
- Why this seam: catches a row walk that restores every original `tabindex="0"` in the row, which would put a second Tab stop inside the nested grid. Cells that classify `composite` by role are skipped.
- Order reason: builds on A and B (the restore rule and the operable-widget filter).

## Types phase (after green)
None — no public type surface in this step.

## Not tested
- The real Tab key moving focus — jsdom has no sequential focus navigation. The tabindex state in A, B, F is the testable contract, and the browser does the walk.
- The row unregistering ends row mode (L3) — over budget, damage low, likelihood low. A removed row's elements are detached, so a stale reference has no observable effect unless the same id re-renders into a new element (a rare `track` miss).
- Shift+Tab from the first widget back onto the row element — the row's own `focusin` mapping belongs to step 1, and C covers keeping the row active.
- The real `ngpTableTreeToggle` in the fixture — its `tabindex="-1"` / `aria-hidden` comes from step 4, and this step depends only on step 1. B uses a button with the same attributes instead.
- Row mode on a `role="grid"` table (no `withTree()`) — row targets exist only in a treegrid (step 1). Nothing new to test.
- Arrow keys pressed while focus is on a row widget — key map is step 2/3, and `activeTarget` already stays on the row (C).

## Decisions applied
- New `FocusRegistry` methods `enterRow` / `exitRow`.
- Cells that classify `composite` by role (a nested grid) are skipped by the row walk (seam I).
