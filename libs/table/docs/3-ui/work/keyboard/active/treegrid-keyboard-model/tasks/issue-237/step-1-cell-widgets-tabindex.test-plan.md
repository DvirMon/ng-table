# Step 1 test plan — Find a cell's widgets and keep them out of the Tab order

Step: [step-1-cell-widgets-tabindex.plan.md](step-1-cell-widgets-tabindex.plan.md)
Spec file: `libs/table/src/directives/cell-widgets.spec.ts` (new — helper seams A–C) and `libs/table/src/directives/ngp-table.directive.spec.ts` (new `describe('NgpTableDirective cell widgets tab order')` — host seams D–F)

## Behaviour coverage

| Id   | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Source                                                             | Tested by  |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------- |
| AC3a | Focusables already inside a cell are `tabindex="-1"` once the cell registers                                                                                                                                                                                                                                                                                                                                                                                                                                         | issue AC3; K6a; K33; Done when 1                                   | D          |
| AC3b | A control added or swapped into a registered cell later becomes `-1` after the observer flushes                                                                                                                                                                                                                                                                                                                                                                                                                      | issue AC3; K33; Done when 2                                        | E          |
| DW3  | The table still has exactly one `tabindex="0"`, even when consumer markup puts `tabindex="0"` inside a cell                                                                                                                                                                                                                                                                                                                                                                                                          | Done when 3; K3                                                    | D          |
| W1   | A cell is classified `none` / `single` / `composite`. `single` = exactly one button, checkbox, radio, switch or link. `composite` = any text input, textarea, select or contenteditable, more than one widget, or any descendant with a composite-widget role (`grid`, `treegrid`, `listbox`, `tree`), whatever the focusable count. Disabled controls, `input[type=hidden]`, `aria-hidden` elements and elements whose original tabindex is `-1` are not counted. The count reads the remembered original tabindex. | Do; K6a, K34, K38; coordinator ruling (detection half of AC1, AC2) | B, C       |
| W2   | Each marked element's original tabindex is remembered and can be restored                                                                                                                                                                                                                                                                                                                                                                                                                                            | Do; K34 (step 3 reads it)                                          | A          |
| W3   | The registry's widget kind refreshes when the observer flushes (step 1 owns it)                                                                                                                                                                                                                                                                                                                                                                                                                                      | Do                                                                 | Not tested |
| W4   | Only focusables inside registered cells are marked; the rest of the host is left alone                                                                                                                                                                                                                                                                                                                                                                                                                               | Do ("inside registered cells"); K33                                | F          |

## Stubs (red phase)

- `export type CellWidgetKind = 'none' | 'single' | 'composite'` in `libs/table/src/directives/cell-widgets.types.ts` (a type, so no throwing body)
- `export function classifyCellWidgets(cell: HTMLElement): CellWidgetKind` in `libs/table/src/directives/cell-widgets.ts` — throws `not implemented: classifyCellWidgets`
- `export function removeFromTabOrder(root: Node): void` in `cell-widgets.ts` — marks `root` itself if it is focusable, plus every focusable descendant, and saves each element's original tabindex. Throws `not implemented: removeFromTabOrder`
- `export function restoreTabOrder(cell: HTMLElement): void` in `cell-widgets.ts` — throws `not implemented: restoreTabOrder`

The registry additions (store and refresh the kind) and the `ngpTable` observer are not imported by any test, so they need no stubs. The host tests go red on their assertions.

## Seams — in red-green order

### A. Mark twice, then restore → every element's original tabindex comes back

- Test: `it('restores each descendant\'s original tabindex after it was marked twice')`
- Asserts: the cell holds `<button>` (no attribute), `<span tabindex="0">` and `<input tabindex="2">`. Call `removeFromTabOrder(td)`. All three read `"-1"`. Call `removeFromTabOrder(td)` again, then `restoreTabOrder(td)`. The button has no `tabindex` attribute (`hasAttribute` false, not `"null"`), the span reads `"0"`, the input reads `"2"`, and the cell's own attribute is unchanged.
- Covers: W2
- Risk: damage high, likelihood high
- Why this seam: cells are marked twice in normal use: on register, again when the effect re-registers, and again when the observer fires. If the second pass saves `-1` as the "original", step 3's entered cell never gets its Tab order back. Restoring a missing attribute as the string `"null"` or `"-1"` is the other common bug.
- Order reason: independent; base case. B uses its marking pass, and D–F use it as the marking primitive.

### B. One countable non-text widget → `single`; nothing countable → `none`; the count holds after marking

- Test: `it.each(...)('classifies a cell holding %s as %s')`. Every row is checked twice: once on fresh markup, and once after `removeFromTabOrder(td)`. Rows:
  - plain text → `none`
  - a lone `<button disabled>` → `none`
  - `<button>`, `<input type="checkbox">`, `<input type="radio">`, `<button role="switch">`, `<a href="#">` → `single`
  - tree toggle `<button tabindex="-1" aria-hidden="true">` + `<input type="checkbox">` → `single`
  - `<input type="hidden">` + `<button>` → `single`
  - `<a href="#" aria-hidden="true">` + `<button>` → `single`
- Asserts: `classifyCellWidgets(td)` returns the literal kind in both checks
- Covers: W1
- Risk: damage high, likelihood high
- Why this seam: catches four bugs.
  - Every `input` treated as text: checkbox cells become `composite`, so step 2 focuses the cell and not the checkbox. That is the extra keypress K6a rejected.
  - The link (K34) or `role="switch"` missing from the list: same result.
  - The K5 tree toggle, a disabled control, a hidden input or an `aria-hidden` element counted: a tree-column checkbox cell becomes `composite`, or a disabled-button cell becomes `single` and gets focus on a dead control.
  - The count read from the live attribute instead of the saved original: after marking, every element reads `-1`, so the toggle can no longer be told apart and the second check fails.
- Order reason: builds on A (the second check in each row needs the saved originals)

### C. Text widget, select, contenteditable, more than one widget, or a composite-widget role → `composite`

- Test: `it.each(...)('classifies a cell holding %s as composite')`. Rows:
  - `<input type="text">`, `<input>` (no type), `<textarea>`, `<select>`, `<div contenteditable="true">`
  - `<button>` + `<input type="checkbox">`
  - `<table role="grid">` whose cells have one `tabindex="0"` and the rest `tabindex="-1"` (the shape of a nested `ngpTable`)
  - `<div role="listbox" tabindex="0">`
- Asserts: `classifyCellWidgets(td)` returns `'composite'` for each row
- Covers: W1
- Risk: damage high, likelihood high
- Why this seam: catches three bugs.
  - A lone text input or select wrongly counted as `single`: step 2 puts focus inside the input, which traps the arrow keys.
  - The count rule ignored for two buttons: step 2 picks one of them and leaves the other unreachable.
  - The role rule (K38) missing: a nested grid's inactive cells have original tabindex `-1` and so drop out of the count (B's rule). Its one `tabindex="0"` cell then makes the outer cell `single`, so the outer grid's arrows dive straight into the inner grid and step 4's nested-grid model breaks. A focusable listbox counts as one widget the same way.
- Order reason: builds on B (same function; adds the text-kind check, the count rule and the role rule. The grid row relies on B's exclusion of original `-1`)

### D. Cell registers with existing focusables → all `-1`, one Tab stop in the table

- Test: `it('marks every focusable already inside a cell as tabindex="-1" when the cell registers')`
- Asserts: a host component like `FlatHost` renders, in one column, `<button>`, `<a href="#">`, `<input>` and `<span tabindex="0">` inside each `td[ngpTableCell]`. After `detectChanges`, each of those descendants reads `tabindex="-1"`, `tabStops()` has length 1, and that one stop is the first-entry cell itself (`aria-colindex="1"`, row 1).
- Covers: AC3a, DW3
- Risk: damage high, likelihood high
- Why this seam: catches three bugs. Register never marking leaves one Tab stop per widget per row, which breaks K3. A selector that misses `[tabindex]` or `a[href]` leaves the consumer's own `tabindex="0"` as a second stop. Marking the cell element itself overwrites its roving tabindex.
- Order reason: builds on A (register calls the marker)

### E. Control added or swapped into a registered cell later → `-1` after flush

- Test: `it('marks a control added or swapped into a registered cell after the observer flushes')`
- Asserts: the host toggles a signal behind an `@if`/`@else` in one column. One branch shows text, the other shows a bare `<button>` and a `<div><input></div>`. Flip it, `detectChanges`, then `await fixture.whenStable()` (or one microtask) so the `MutationObserver` callback runs. The new button and the nested input both read `"-1"`, and `tabStops()` still has length 1.
- Covers: AC3b, DW3
- Risk: damage high, likelihood high
- Why this seam: the edit-mode swap is why the architecture doc rejected a one-time sweep (K33). The test catches three bugs: no `subtree` option, handling only `addedNodes` themselves (misses the input inside the div), and querying only descendants of each added node (misses the bare button).
- Order reason: builds on D (the cells must already be registered for the observer to treat them as inside a cell)

### F. Focusable added outside any registered cell → left as it was

- Test: `it('leaves focusables outside registered cells untouched while marking the ones inside')`
- Asserts: one signal flip adds a `<button>` inside a `<thead><tr><th>` (no `ngpTableCell`; header cells are not registered until #236, K32) and a `<button>` inside a body cell. After the flush, the header button has no `tabindex` attribute and the cell button reads `"-1"`.
- Covers: W4
- Risk: damage high, likelihood low
- Why this seam: catches an observer that marks every focusable under the host. That would remove the sort button and header filter inputs from the keyboard altogether until #236 makes headers arrow stops: a control nobody can reach. The cell half of the test makes it fail in red; a check of the header half alone would pass against the stub.
- Order reason: builds on E (same observer; adds the "inside a registered cell" guard)

## Types phase (after green)

None — no public type surface in this step. (`CellWidgetKind` and the helpers are internal to `directives/`, not exported from `index.ts`.)

## Not tested

- W3: the kind refreshes on observer flush. Step 1 owns it, but the registry is internal (spec Testing Decisions: never assert internal registries) and nothing reads the kind until step 2. Covered by step 2 seam D, `'moves the Tab stop back to the cell when its only widget is removed'`.
- A row added after first render has its widgets at `-1`. It fails on the same bug as D (cell registration marks its existing content), so it is one seam with D.
- Div host (`div[ngpTable]`) parity for marking. Same code path with no tag branch, so a separate test cannot fail on its own.
- `MutationObserver` disconnects on destroy. This is cleanup with no observable result in jsdom; it would only check that Angular's `DestroyRef` runs.
- Removed nodes (`removedNodes`). There is nothing to mark, and the outline specifies no behaviour for them.
- `role="tree"` and `role="treegrid"` rows in seam C. Same role check as `grid`/`listbox`; a missing entry in a role list is a typo, not a logic branch, so one grid row and one listbox row cover the rule.
- A widget's own key or click behaviour (Space/Enter on a checkbox). That is native browser behaviour, outside this step (and outside the library).
- Which element holds `tabindex="0"` in a single-widget cell: step 2. Enter/F2/Esc, and restoring tabindex when a cell is entered: step 3. Nested grids owning their own keys: step 4. Owned by later steps (outline, Out of scope).
