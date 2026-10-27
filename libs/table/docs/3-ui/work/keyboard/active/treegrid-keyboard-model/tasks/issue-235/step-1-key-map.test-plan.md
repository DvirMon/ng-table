# Step 1 test plan — Key map, pure

Step: [step-1-key-map.plan.md](step-1-key-map.plan.md)
Spec file: `libs/table/src/directives/keyboard-nav.spec.ts`

## Behaviour coverage

| Id   | Behaviour                                                          | Source                                                                                              | Tested by                                   |
| ---- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| US7  | ←/→ move cell to cell, ↑/↓ row to row in the same column           | spec § Moving in a grid, story 7                                                                    | A, B                                        |
| US8  | Home/End jump to the first/last cell of the row                    | spec story 8                                                                                        | D                                           |
| US9  | Ctrl+Home/Ctrl+End jump to the first/last cell of the table        | spec story 9                                                                                        | E                                           |
| US11 | At an edge, focus stays put, no wrap                               | spec story 11                                                                                       | C                                           |
| AC3  | Arrows, Home/End and Ctrl+Home/End follow APG, no wrap at any edge | issue #235 AC3                                                                                      | A, B, C, D, E                               |
| AC4  | The next target comes from the order; the position is data         | issue #235 AC4 (pure half only; building the order from `renderRows()`/`renderColumns()` is step 3) | A–E (input is ids only, output is ids only) |
| DW1  | A key it does not handle returns `null`                            | Done when (outline)                                                                                 | F                                           |
| DW2  | A current position not in the order returns `null`                 | Done when (outline)                                                                                 | G                                           |

## Stubs (red phase)

In `libs/table/src/directives/keyboard-nav.ts`:

- `export function nextBodyTarget(order: NavOrder, current: BodyCell, event: NavKey): BodyCell | null` — throws `not implemented: nextBodyTarget`
  - `NavOrder`, `BodyCell`, `NavKey` come from `./keyboard-nav.types`; `RowId` from `../api/types`, imported with `import type`.

## Seams — in red-green order

Fixture, shared by every seam: `order = { rowIds: [1, 2, 3], columnIds: ['name', 'age', 'city'] }`. It is a two-line literal of ids, not row data, so it stays in the spec instead of `table.mock.ts`. Middle cell = `{ rowId: 2, columnId: 'age' }`. Every expected value is a literal.

Every seam is one branch in the code. Its two directions are one `it.each` with two rows, because they share one branch, a ±1 step on one axis. Each row pins one sign.

### A. ←/→ from the middle cell → neighbour cell in the same row

- Test: `it.each(...)('moves one cell along the row on %s')`
- Asserts: ArrowRight from `(2,'age')` → `{ rowId: 2, columnId: 'city' }`. ArrowLeft → `{ rowId: 2, columnId: 'name' }`.
- Covers: US7, AC3, AC4
- Risk: damage high, likelihood high
- Why this seam: catches a swapped sign, a step on the wrong axis (row instead of column), or a column change that loses the row.
- Order reason: independent. It is the base case and sets up the shared index lookup.

### B. ↑/↓ from the middle cell → same column, neighbour row

- Test: `it.each(...)('moves one row in the same column on %s')`
- Asserts: ArrowDown from `(2,'age')` → `{ rowId: 3, columnId: 'age' }`. ArrowUp → `{ rowId: 1, columnId: 'age' }`.
- Covers: US7, AC3, AC4
- Risk: damage high, likelihood high
- Why this seam: catches a vertical move that resets the column (for example to the first column) or moves the wrong way.
- Order reason: builds on A's index lookup. Adds the row axis.

### C. An arrow at an edge → the same position, not `null`, no wrap

- Test: `it.each(...)('stays put at the edge on %s')`
- Asserts: ArrowRight at `(2,'city')`, ArrowLeft at `(2,'name')`, ArrowUp at `(1,'age')` and ArrowDown at `(3,'age')` each return the input position with `toEqual`. None returns `null`, and none returns a cell in the next or previous row.
- Covers: US11, AC3
- Risk: damage high, likelihood high
- Why this seam: catches three bugs.
  - Index ±1 past the array returns `undefined` ids, and focus is lost.
  - Wrapping to the next row or the opposite end breaks the APG "focus does not move" rule.
  - Returning `null` at an edge makes the caller skip `preventDefault`, so the page scrolls.
- Order reason: builds on A and B. It clamps their step.

### D. Home/End from the middle cell → first/last cell of the same row

- Test: `it.each(...)('jumps to the row edge on %s')`
- Asserts: Home from `(2,'age')` → `{ rowId: 2, columnId: 'name' }`. End → `{ rowId: 2, columnId: 'city' }`.
- Covers: US8, AC3
- Risk: damage low, likelihood high
- Why this seam: catches Home/End jumping to the table corner, or keeping the column. Starting at a middle row is what lets D and E fail on different bugs.
- Order reason: builds on A, same row axis. Independent of C.

### E. Ctrl+Home/Ctrl+End (and Cmd) from the middle cell → first cell of the first row / last cell of the last row

- Test: `it.each(...)('jumps to the table corner on %s')`
- Asserts: `{ key: 'Home', ctrlKey: true }` from `(2,'age')` → `{ rowId: 1, columnId: 'name' }`. `{ key: 'End', ctrlKey: true }` → `{ rowId: 3, columnId: 'city' }`. `{ key: 'End', ctrlKey: false, metaKey: true }` → `{ rowId: 3, columnId: 'city' }`.
- Covers: US9, AC3
- Risk: damage low, likelihood low
- Why this seam: a precedence rule. It catches the `ctrlKey` check ignored or placed after the plain Home/End branch, so Ctrl+Home acts like Home. It also catches a move of only the row or only the column, and Cmd (macOS) not counting as Ctrl.
- Order reason: builds on D. Same keys, plus the modifier that takes precedence.

### F. A key the map does not handle → `null`

- Test: `it.each([...])('returns null for unhandled key %s')`
- Asserts: `nextBodyTarget(order, middle, event)` is `null` for `Tab`, `Enter`, `a`, ` `, `PageDown`, `Escape` (each `ctrlKey: false`) and for `{ key: 'ArrowRight', ctrlKey: true }`.
- Covers: DW1
- Risk: damage high, likelihood high
- Why this seam: catches a default branch that returns `current` instead of `null`. The caller would then `preventDefault()` Tab and trap keyboard users in the grid, or swallow typing and Esc. PageDown is listed because it is out of scope in this slice and must pass through until it is built. Ctrl+Arrow has no APG meaning in a grid and is left to the browser.
- Order reason: independent. It is the switch's default arm.

### G. A current position not in the order → `null`

- Test: `it.each(...)('returns null when the current %s is not in the order')`
- Asserts: `{ rowId: 99, columnId: 'age' }` and `{ rowId: 2, columnId: 'missing' }` with ArrowRight both return `null`.
- Covers: DW2
- Risk: damage high, likelihood low
- Why this seam: catches `indexOf` → `-1` flowing into the step. ArrowRight from `-1` gives index 0, a valid-looking cell, so focus jumps silently to a wrong cell instead of handing recovery to #233.
- Order reason: builds on A. The guard sits in front of the index lookup A introduced.

## Types phase (after green)

None — no public type surface in this step. `nextBodyTarget` and its types are internal (not in `index.ts`) and not generic.

## Not tested

- Ctrl+Home/End at the matching corner, Home at the first column, End at the last column — the clamp in C and the jumps in D and E already make these values; a separate test would fail on the same bugs.
- Single-row or single-column order — the same clamp as C; no separate branch.
- Empty order (`rowIds: []`) — G's guard covers it, since any current is not in the order.
- String vs numeric `RowId` mix — the lookup is identity by value, and nothing branches on the id type.
- Page Up/Down, RTL, header row, treegrid row focus, group headers — out of this step's scope (#236, #239, #240 and later steps). F pins only that PageDown passes through for now.
- Building the order from `renderRows()`/`renderColumns()`, `preventDefault`, `defaultPrevented` skip — caller behaviour, step 3 (S2 host specs).

## Resolved

- `metaKey` acts as Ctrl for Ctrl+Home/End (E row added).
- Ctrl+Arrow returns `null` (F row added).
- Parameter types are named `NavOrder`, `BodyCell`, `NavKey` in `keyboard-nav.types.ts`.
