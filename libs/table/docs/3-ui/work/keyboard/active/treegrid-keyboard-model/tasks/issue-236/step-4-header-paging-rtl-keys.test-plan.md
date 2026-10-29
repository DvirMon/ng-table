# Step 4 test plan — Header, paging and RTL keys

Step: [step-4-header-paging-rtl-keys.plan.md](step-4-header-paging-rtl-keys.plan.md)
Spec file: `libs/table/src/directives/ngp-table.directive.spec.ts`

## Behaviour coverage

| Id   | Behaviour                                                            | Source                                | Tested by                          |
| ---- | -------------------------------------------------------------------- | ------------------------------------- | ---------------------------------- |
| AC1  | ↑ from the first data row focuses the header cell                    | issue #236 AC1; spec story 4, 36; K7  | A                                  |
| AC1b | ↓ from a header cell returns to the first data row, same column      | issue #236 AC1                        | C                                  |
| AC2  | ←/→ move across header cells, no wrap                                | issue #236 AC2; spec story 34; K4, K7 | B                                  |
| AC3  | Page Up/Down move by the visible row count, same column              | issue #236 AC3; spec story 10; K4     | E, G                               |
| AC3b | Page Up/Down stop at the first/last row                              | issue #236 AC3; spec story 11         | Not tested (step 1 owns the clamp) |
| AC4  | Page step falls back to 10 when nothing can be measured              | issue #236 AC4; K40                   | E                                  |
| AC5  | Under RTL, ← moves toward the row end, → toward the start            | issue #236 AC5; spec story 12; K4b    | F                                  |
| AC6  | Direction is read from the host's computed `direction` at keypress   | issue #236 AC6; K40                   | F                                  |
| K6b  | A key event the consumer already prevented is skipped                | K6b                                   | Not tested (existing test)         |
| K24  | Header DOM focus follows the focus-within / `focusRequests` gate     | K24                                   | D                                  |
| NH   | A table with no header cell registered does not move on ↑ from row 1 | step file Do 6, K41                   | H                                  |

## Stubs (red phase)

None. This step creates no exported symbol. `nextGridTarget`, `pageStepOf` and `isRtlAt` come from steps 1-2; header registration from step 3. Every seam goes red on an assertion against today's `navigateBodyOnKeydown`, which ignores header targets, Page keys and direction.

## Seams — in red-green order

Fixture notes for the red phase:

- Add new hosts and a new `describe` block with its own setup helper. The existing `setupGrid` generic is constrained to `GridHost | ReversedRowsHost`; widening it edits existing test code, which is read-only.
- Header host template: `<thead><tr>` with `@for (column of table.renderColumns(); …; let i = $index)` `<th [ngpTableHeaderCell]="i">`. Add `NgpTableHeaderCellDirective` to the imports. The header `<tr>` gets no `ngpTableRow` (core.md). Body as in `GRID_TEMPLATE`, with columns `id` and `name` from `createGridTable`.
- Find a header cell with `[role="columnheader"][aria-colindex="N"]`.
- Paging host: `createMockRows(25)` (ids 0-24). Body cells sit at `aria-rowindex` = render position + 1, not at id + 1.
- Same `press`/`flush` shape as the existing block: append the root to `document.body`, `TestBed.tick()` + `detectChanges()`, and `replaceChildren()` in `afterEach`.

### A. ↑ on the first data row's first cell → header target in the store, DOM focus and tab stop on that `th`

- Test: `it('moves to the first header cell on ArrowUp from the first data row')`
- Asserts: after `cell(1,'id').focus()` and pressing ArrowUp: `table.focus()` equals `{ area: 'header', columnId: 'id' }`, `document.activeElement` is the `th` with `aria-colindex="1"`, `tabStops()` is exactly `[that th]`, and `event.defaultPrevented` is `true`.
- Covers: AC1
- Risk: damage high, likelihood high
- Why this seam: two wiring bugs. One: the order passed to `nextGridTarget` never reaches the header, so ↑ stops at row 1. Two: the sync effect still returns early on `area !== 'body'`, so the store moves but DOM focus stays on the body cell. Either cuts keyboard users off from sort buttons and header filters.
- Order reason: independent. Base case: the only way onto the header through keys.

### B. → on a header cell → next header cell; → on the last header cell → stays put, still handled

- Test: `it('moves across header cells with ArrowRight and stops at the last one')`
- Asserts: from header `id` (reached as in A), ArrowRight focuses header `name` (store and `activeElement`). A second ArrowRight leaves the store at `{ area: 'header', columnId: 'name' }` and focus on the same `th`, with `defaultPrevented` `true`.
- Covers: AC2
- Risk: damage high, likelihood high
- Why this seam: the current-target resolution must accept a header target. Today's `activeBodyCell()` returns `null` for `area: 'header'`, so every key on the header row does nothing. The edge press proves the edge result is still treated as handled, so the page does not scroll sideways.
- Order reason: builds on A (needs the header as the current target).

### C. ↓ on header `name` → first data row, column `name`

- Test: `it('returns to the first data row in the same column on ArrowDown from a header cell')`
- Asserts: from header `name` (reached through A + B), ArrowDown sets `table.focus()` to `{ area: 'body', rowId: 1, columnId: 'name' }`, and `document.activeElement` is `cell(1,'name')`.
- Covers: AC1b
- Risk: damage high, likelihood high
- Why this seam: catches a header → body handoff that loses the column (falls back to column 1) or never leaves the header, trapping the user on the header row. Starting in column 2 tells "same column" apart from "first column".
- Order reason: builds on B (reaches header `name` through →).

### D. A header `moveTo` while focus is outside → only the tabindex moves; with `focusElement` → the `th` gets DOM focus

- Test: `it('focuses a header cell from outside the grid only on a focusElement request')`
- Asserts: with `#outside` focused, `moveTo({ area: 'header', columnId: 'name' })` leaves `activeElement` on `#outside` while `tabStops()` is `[header name th]`. Then the same call with `{ focusElement: true }` moves `activeElement` to that `th`.
- Covers: K24
- Risk: damage high, likelihood low
- Why this seam: the header branch of the sync effect could skip the `hasNewRequest || hasFocusWithin` gate; then any store write to a header target (a recovery rule, a consumer `moveTo`) takes focus away from the page. The second half fails today because the effect ignores header targets.
- Order reason: builds on A (the header branch of the sync effect).

### E. PageDown on row position 1 of 25 rows, no measurable scroll container → row position 11, same column

- Test: `it('moves PageDown by the fallback step of 10 rows when nothing can be measured')`
- Asserts: on the paging host, focus the cell at `aria-rowindex="1"`, column `name`, press PageDown. `table.focus()` is `{ area: 'body', rowId: 10, columnId: 'name' }`, `activeElement` is the cell at `aria-rowindex="11"`, column `name`, and `defaultPrevented` is `true`. jsdom reports 0 for every layout size, so `pageStepOf` takes its fallback.
- Covers: AC3, AC4
- Risk: damage low, likelihood high
- Why this seam: catches `pageSize` not reaching `nextGridTarget`: the Page keys then do nothing or move by `undefined`/`NaN` rows. It does not catch a hard-coded 10 (G does).
- Order reason: independent.

### F. ArrowRight under LTR moves toward the end; after the host's `style.direction` becomes `rtl`, the same key moves toward the start

- Test: `it('reads the host direction at keypress, so ArrowRight follows RTL once the host switches')`
- Asserts: on the header host, focus `cell(1,'id')` and press ArrowRight. Focus is on `name`. Set `tableHost.style.direction = 'rtl'` with no change detection in between. ArrowRight from `name` moves focus to `id`, and ArrowLeft from `id` moves to `name`.
- Covers: AC5, AC6
- Risk: damage low, likelihood low
- Why this seam: catches both `isRtl` hard-coded `false` (the RTL half fails) and direction read once at construction or in a `computed` (the switch has no effect). Use inline `direction` on the host itself, not `dir="rtl"` on an ancestor: jsdom's computed style does not derive `direction` from `dir` or inheritance.
- Order reason: independent.

### G. Measured page step reaches the handler

- Test: `it('moves PageDown by the measured number of visible rows')`
- Asserts: on the paging host, give the table host `style.overflowY = 'auto'` and pin its `clientHeight` to 200 and the focused cell's `offsetHeight` to 40 with `Object.defineProperty` (`configurable: true`). Focus the cell at `aria-rowindex="1"`, column `name`, press PageDown: `table.focus()` is `{ area: 'body', rowId: 5, columnId: 'name' }` and `activeElement` is the cell at `aria-rowindex="6"`.
- Covers: AC3, AC4
- Risk: damage low, likelihood high
- Why this seam: E passes with a hard-coded 10. This one fails unless the measured value from `pageStepOf(host, <focused cell element>)` reaches `nextGridTarget`, and unless the focused cell (not the host) supplies the row height.
- Order reason: builds on E (same host and key; adds the layout stub).

### H. ↑ on the first data row with no header cell registered → stays, still handled

- Test: `it('stays on the first row on ArrowUp when the table has no header cell')`
- Asserts: on a grid host with no `thead`, focus `cell(1,'id')`, press ArrowUp: `table.focus()` is still `{ area: 'body', rowId: 1, columnId: 'id' }`, `activeElement` is that cell, and `defaultPrevented` is `true`.
- Covers: NH
- Risk: damage high, likelihood low
- Why this seam: without the guard the store points at a header target that has no element. The roving tabindex then leaves no Tab stop and DOM focus drops to `<body>`.
- Order reason: builds on A (same key, no-header host).

## Types phase (after green)

None — no public type surface in this step.

## Not tested

- AC3b clamp at the first/last row for Page Up/Down — pure logic in `nextGridTarget`; step 1 owns it.
- Header ←/→ RTL swap and treegrid RTL — the swap logic is in `nextGridTarget` (step 1); F proves `isRtl` reaches it.
- `isRtlAt` / `pageStepOf` DOM measurement details — step 2's unit tests (G covers only that the value reaches the handler).
- K6b `defaultPrevented` on a header target — the guard runs before the current target is resolved; covered by the existing 'ignores a key event a consumer already prevented'.
- Unhandled keys (Tab, letters) on a header cell — covered by the existing 'leaves an unhandled %s key alone'; same null path.
- Order taken from `renderRows()`, not DOM order — covered by the existing 'takes the next row from renderRows() order, not DOM order'.
- Body arrows, Home/End and Ctrl+End through the new `nextGridTarget` — covered by the existing 'moves to the next cell on %s'.
- Swapped store, removed focused cell and the outside-focus gate for body cells — existing K24 tests; D adds only the header branch.
- Clicking or tabbing onto a `th` — step 3 seam E.
