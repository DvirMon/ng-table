# Step 1 test plan — Key map: header row, paging, RTL (pure)

Step: [step-1-key-map-header-paging-rtl.plan.md](step-1-key-map-header-paging-rtl.plan.md)
Spec file: `libs/table/src/directives/keyboard-nav.grid.spec.ts` (new file; `keyboard-nav.spec.ts` must not change)

## Behaviour coverage

| Id   | Behaviour                                                                                                                             | Source                                | Tested by      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------- |
| AC1  | ↑ from the first data row focuses the header cell (same column); ↓ returns to the same column                                         | issue #236 AC1, spec story 4, K7, K39 | A, B           |
| AC2  | ←/→ move across the header cells, with no wrap                                                                                        | issue #236 AC2, spec story 34, K7     | C              |
| AC3  | Page Up/Down move by `pageSize` rows in the same column and stop at the first or last row                                             | issue #236 AC3, spec story 10, K4     | F              |
| AC5  | Under RTL, ← moves toward the end of the row and → toward the start                                                                   | issue #236 AC5, spec story 12, K4b    | G              |
| US11 | At an edge, focus stays where it is (handled, no wrap)                                                                                | spec story 11, K4                     | C, F           |
| DW1  | ↓ from the header with no body rows stays on the header                                                                               | outline                               | D              |
| DW2  | Home/End on the header go to the first/last header cell; Ctrl+Home goes to the first header cell (from a header and from a body cell) | outline, K39                          | E              |
| DW3  | Ctrl+End on the header goes to the last cell of the last body row; with no body rows, the last header cell                            | outline, K39                          | E              |
| DW4  | Page Up/Down on a header cell are handled and do not move                                                                             | outline                               | F              |
| DW5  | `null` for an unhandled key, an unknown current position, or an Alt/Shift modifier                                                    | outline, K22                          | H              |
| DW6  | Body moves are delegated to `nextBodyTarget`, which does not change                                                                   | outline                               | A (row-2 case) |

AC4 (fallback to 10) and AC6 (direction at keypress) belong to the caller (steps 2 and 4).

## Stubs (red phase)

In `keyboard-nav.types.ts`: `HeaderCell`, `GridBodyCell = { readonly area: 'body' } & BodyCell`, `GridCell = HeaderCell | GridBodyCell`, `GridNavOptions = { isRtl: boolean; pageSize: number }` (as in the step file).
In `keyboard-nav.ts`: `export function nextGridTarget(order: NavOrder, current: GridCell, event: NavKey, options: GridNavOptions): GridCell | null` — throws `not implemented: nextGridTarget`.

## Seams — in red-green order

Shared fixture, inline as in the sibling spec: `order = { rowIds: [1, 2, 3, 4, 5], columnIds: ['name', 'age', 'city'] }`; `ltr = { isRtl: false, pageSize: 2 }`; `rtl = { isRtl: true, pageSize: 2 }`; `press()` helper copied from the sibling spec. Every expected value is a literal `GridCell`. The middle column `'age'` is used on purpose, so "same column" fails if the code jumps to the first column.

### A. ↑ on a body cell → header cell in the same column from row 1, the body row above from row 2

- Test: `it.each(...)('moves up on ArrowUp from %s')`
- Asserts: from `{ area: 'body', rowId: 1, columnId: 'age' }` → `{ area: 'header', columnId: 'age' }`; from `{ area: 'body', rowId: 2, columnId: 'age' }` → `{ area: 'body', rowId: 1, columnId: 'age' }`.
- Covers: AC1, DW6
- Risk: damage high, likelihood high
- Why this seam: catches four bugs: ↑ from row 1 still clamped by `nextBodyTarget` so the header cannot be reached (K7); the header target loses the column (first header cell instead of `'age'`); every ↑ jumps to the header, not only ↑ from row 1; a delegated body result returned without its `area: 'body'` tag.
- Order reason: independent. Base case; adds the header arm and the wrapping of `nextBodyTarget`'s result.

### B. ↓ on a header cell → same column of the first body row

- Test: `it('moves from the header to the first body row in the same column on ArrowDown')`
- Asserts: `{ area: 'header', columnId: 'age' }` + ArrowDown → `{ area: 'body', rowId: 1, columnId: 'age' }`.
- Covers: AC1
- Risk: damage high, likelihood high
- Why this seam: catches ↓ landing on the first column, on the wrong row (index 1 instead of 0), or returning `null` (the header becomes a dead end).
- Order reason: builds on A. A creates the header shape; B is the return trip.

### C. ←/→/↑ on the header → next header cell, and edges stay put

- Test: `it.each(...)('moves across the header row on %s and stops at the edge')`
- Asserts: ArrowRight on header `'age'` → header `'city'`; ArrowLeft on header `'age'` → header `'name'`; ArrowRight on header `'city'` → header `'city'`; ArrowLeft on header `'name'` → header `'name'`; ArrowUp on header `'age'` → header `'age'`. All results non-null and `area: 'header'`.
- Covers: AC2, US11
- Risk: damage high, likelihood high
- Why this seam: catches four bugs: index ±1 at an edge goes past the array so `columnId` is `undefined` and focus is lost; the move wraps (K4 forbids it); ↑ on the header returns `null` so the caller skips `preventDefault` and the page scrolls; a header move routed to `nextBodyTarget`.
- Order reason: builds on A (the header arm and the column lookup).

### D. ↓ on a header cell with no body rows → the same header cell

- Test: `it('stays on the header on ArrowDown when there are no body rows')`
- Asserts: `order = { rowIds: [], columnIds: [...] }`, header `'age'` + ArrowDown → `{ area: 'header', columnId: 'age' }`.
- Covers: DW1, US11
- Risk: damage high, likelihood low
- Why this seam: catches `rowIds[0]` being `undefined` on an empty table, which returns `{ area: 'body', rowId: undefined }`. Focus is then lost on an empty table, the state K9a recovers to.
- Order reason: builds on B. Adds a guard to B's branch.

### E. Home/End/Ctrl+Home/Ctrl+End on a header cell, and Ctrl+Home on a body cell

- Test: `it.each(...)('jumps along the header row on %s')`
- Asserts: Home on header `'age'` → header `'name'`; End on header `'age'` → header `'city'`; Ctrl+Home on header `'age'` → header `'name'`; Ctrl+End on header `'age'` → `{ area: 'body', rowId: 5, columnId: 'city' }`; Ctrl+End on header `'age'` with `rowIds: []` → header `'city'`; Ctrl+Home on body `(3, 'age')` → header `'name'`.
- Covers: DW2, DW3
- Risk: damage low, likelihood high
- Why this seam: catches Home/End on the header routed to the body (landing on row 1); Ctrl+Home going to the first body cell instead of the header row (K39 override of `nextBodyTarget`); Ctrl+End from the header staying in the header; Ctrl+End with no rows giving an `undefined` row id.
- Order reason: builds on C (header column clamp).

### F. Page Up/Down on a body cell → `pageSize` rows in the same column, clamped to the body; on a header cell → no move

- Test: `it.each(...)('pages %s in the same column, clamped to the body')`
- Asserts: PageDown from body `(2,'age')` → body `(4,'age')`; PageUp from body `(4,'age')` → body `(2,'age')`; PageDown from body `(4,'age')` → body `(5,'age')`; PageUp from body `(2,'age')` → body `(1,'age')`, not a header cell; PageDown from body `(5,'age')` → body `(5,'age')`; PageDown and PageUp on header `'age'` → header `'age'`.
- Covers: AC3, US11, DW4
- Risk: damage high, likelihood high
- Why this seam: catches `pageSize` ignored (a step of 1 or a hard-coded 10); the column lost; a step past the end giving an `undefined` row id; PageUp near the top escaping into the header; a header Page key returning `null` or entering the body. `pageSize: 2` against 5 rows separates "step by `pageSize`" from "jump to the edge".
- Order reason: builds on A (body tagging); independent of the header-move seams except the header-cell rows.

### G. Under `isRtl`, ←/→ swap meaning on body and header cells

- Test: `it.each(...)('swaps %s under RTL on a %s cell')`
- Asserts, with `rtl`: ArrowLeft on body `(2,'age')` → body `(2,'city')`; ArrowRight → body `(2,'name')`; ArrowLeft on header `'age'` → header `'city'`; ArrowRight → header `'name'`.
- Covers: AC5
- Risk: damage low, likelihood high
- Why this seam: catches the swap applied only to body moves (delegated) or only to header moves; the flag read but not applied; a swap applied twice, which cancels out.
- Order reason: builds on A (body delegation) and C (header ←/→).

### H. Unhandled input → `null`

- Test: `it.each(...)('returns null for %s')`
- Asserts: each returns `null`: on header `'age'`: Tab, Enter, Escape, Space, Ctrl+ArrowRight, Alt+ArrowLeft, Shift+ArrowDown, Shift+End; header `'missing'` + ArrowRight; body `(99,'age')` + PageDown; body `(2,'age')` + Shift+PageDown.
- Covers: DW5
- Risk: damage high, likelihood high
- Why this seam: these are new code paths that do not go through `nextBodyTarget`'s guards. The header path and the paging path each do their own `indexOf` lookup; `-1` + 2 = row index 1, a valid-looking cell, so focus jumps silently. A header default arm that returns `current` makes the caller `preventDefault()` Tab and traps the user in the grid. Shift+PageDown belongs to the browser and assistive tech (K22).
- Order reason: builds on C (header lookup) and F (paging lookup). Their guards go in front of those lookups.

## Types phase (after green)

None — no public type surface in this step. `nextGridTarget` and its types are internal (not in `index.ts`) and not generic.

## Not tested

- Body ←/→/↓, Home/End, Ctrl+End and body edges — covered by `keyboard-nav.spec.ts`. A's row-2 case proves `nextGridTarget` delegates and tags the result.
- Body Ctrl+Arrow, Alt/Shift on body arrows, unknown body row on an arrow key — covered by `keyboard-nav.spec.ts` ('returns null for unhandled key %s', 'returns null when the current %s is not in the order').
- Home/End under RTL — no swap: Home/End are logical row start/end; the code has no RTL branch there.
- `pageSize` of 0 or negative — the caller always passes ≥ 1 (measured, or the fallback of 10); no branch.
- A single column or a single row — same clamps as C and F.
- AC4 (fallback to 10) and AC6 (direction at keypress) — caller behaviour (steps 2 and 4); here `pageSize` and `isRtl` are inputs.
- Group header rows — not in the order (K21, #240). Treegrid row focus (`columnId: null`) — #239.
- A table with no header row — step 4 decides not to move when no header cell is registered.
