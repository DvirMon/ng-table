# Step 2 test plan — Treegrid key map

Step: [step-2-treegrid-key-map.plan.md](step-2-treegrid-key-map.plan.md)
Spec file: `libs/table/src/directives/keyboard-nav.tree.spec.ts` (new, for seams A–G, laid out like `keyboard-nav.grid.spec.ts`), plus `libs/table/src/directives/ngp-table.directive.spec.ts` (seam H, in a new `describe` block)

## Behaviour coverage
| Id | Behaviour | Source | Tested by |
|---|---|---|---|
| R1 | With a row focused, ↑/↓ move between rows. The order comes from `renderRows()`, data rows only, with no wrap. | outline Do; spec story 13; K4, K13 | A, H |
| R2 | With a row focused, Home/End/Ctrl+Home/Ctrl+End/PageUp/PageDown move between rows, clamped. | outline Do; K4 | I |
| AC2a | → on a row goes to its first cell. | issue AC2; spec story 15 | D |
| AC2b | ← on the first cell goes to its row. | issue AC2; spec story 18 | D |
| AC2c | ← on a row goes to its parent: the nearest earlier row with a smaller depth, in render order. | issue AC2; spec story 17; K14b | E, H |
| AC3 | ↑ from the first row lands on the first header cell (the header row has no row focus). | issue AC3; spec story 36; K7 | B |
| HD | ↓ from a header cell goes to the first row. | outline Do | C |
| CELL | Keys on a cell behave as in grid. | outline Do; K39 | F |
| UNH | Unhandled keys return `null`. Edges return the current target. | outline Do; K4, K22 | G (null); A, E (edges) |
| RTL | RTL swaps ←/→ for the row/cell moves. | outline Do; issue AC8 (core half); K4b | J |
| EXC | Group rows and panels are left out of the row order. | outline Do | Not tested (see list) |

## Stubs (red phase)
- `export type TreegridTarget = GridCell | RowTarget`, in `keyboard-nav.types.ts`
- `export type TreegridNavOrder = NavOrder & { readonly rowDepths: readonly number[] }` (same index as `rowIds`), in `keyboard-nav.types.ts`
- `export function nextTreegridTarget(order: TreegridNavOrder, current: TreegridTarget, event: NavKey, options: GridNavOptions): TreegridTarget | null` — throws `not implemented: nextTreegridTarget`

## Seams — in red-green order

Fixture for A–G: rows `a`(0), `a1`(1), `a1x`(2), `a2`(1), `b`(0). Columns `name`, `age`, `city`. `ltr = { isRtl: false, pageSize: 2 }`. A `row(id)` helper builds `{ area: 'body', rowId: id, columnId: null }`. `press`, `header` and `body` helpers are the same shape as in `keyboard-nav.grid.spec.ts`.

### A. ↓/↑ on a focused row → the adjacent row, still row focus; ↓ on the last row → the same row
- Test: `it.each(...)('moves between rows on %s from a focused row and stops at the last row')`
- Asserts:
  - ArrowDown from `row('a')` → `row('a1')`.
  - ArrowUp from `row('a1')` → `row('a')`.
  - ArrowDown from `row('b')` → `row('b')` (not `null`).
- Covers: R1, UNH (edge)
- Risk: damage high, likelihood high
- Why this seam: this is the base path for row focus. It catches three bugs:
  - the map sends `columnId: null` through `nextBodyTarget`, where `indexOf(null)` is -1, so it returns `null` and the row is a dead end;
  - the result drops `columnId: null` and lands on a cell;
  - the last row wraps or returns `null`.
- Order reason: independent. Base case.

### B. ↑ on the first row (row focus) → the first header cell
- Test: `it('moves from the first focused row to the first header cell on ArrowUp')`
- Asserts: `nextTreegridTarget(order, row('a'), press('ArrowUp'), ltr)` equals `header('name')`.
- Covers: AC3
- Risk: damage high, likelihood high
- Why this seam: the grid branch maps ↑ on row 1 to the same-column header (K39). A row has no column, so the result is `header(undefined)` or `null`. Either way the header and its sort buttons cannot be reached from row focus.
- Order reason: builds on A (same ↑ branch, first-row edge).

### C. ↓ on any header cell → the first row, row focus
- Test: `it('moves from a header cell to the first row on ArrowDown')`
- Asserts: from `header('age')`, ArrowDown → `row('a')`, not `body('a', 'age')`.
- Covers: HD
- Risk: damage high, likelihood high
- Why this seam: catches the header branch falling through to `nextGridTarget`. That puts the user on a cell, so the row-level →/←/Enter (expand, collapse, toggle) silently stop working. The test starts in column 2 so a cell result cannot pass by chance.
- Order reason: builds on B (the reverse move across the header boundary).

### D. Crossing between the row and its cells
- Test: `it.each(...)('moves between a row and its cells on %s')`
- Asserts:
  - ArrowRight on `row('a1')` → `body('a1', 'name')`.
  - ArrowLeft on `body('a1', 'name')` → `row('a1')`.
  - ArrowLeft on `body('a1', 'age')` → `body('a1', 'name')`.
- Covers: AC2a, AC2b
- Risk: damage high, likelihood high
- Why this seam: catches two bugs.
  - The first-cell ← rule is missing (grid keeps you on the cell at the edge), so a user who entered the cells cannot get back to row-level navigation.
  - The rule fires on every column, so ← from `age` skips `name`.
  - The third case pins that precedence.
- Order reason: builds on A (needs the row target to exist as an input and as a result).

### E. ← on a row → its parent row; ← on a top-level row → the same row
- Test: `it.each(...)('moves to the parent row on ArrowLeft from %s')`
- Asserts:
  - `row('a1x')` → `row('a1')`.
  - `row('a2')` → `row('a')`: it skips `a1x`, which is earlier and deeper but not an ancestor, and lands on the nearest earlier row with a smaller depth.
  - `row('b')` → `row('b')`: edge, still handled.
- Covers: AC2c, UNH (edge)
- Risk: damage high, likelihood high
- Why this seam: this is the one real algorithm in the step. It catches three bugs:
  - "previous row" instead of "nearest earlier row with smaller depth" (`a2` → `a1x`);
  - `<=` instead of `<` (`a2` → `a1`, a sibling);
  - `null` at the root, which lets the browser scroll the page sideways.
- Order reason: builds on D (same ← key on a row; D proves ← on a cell is a different branch).

### F. Cell keys in treegrid match grid
- Test: `it.each(...)('keeps grid behaviour for %s on a cell')`
- Asserts:
  - ArrowDown on `body('a', 'age')` → `body('a1', 'age')`.
  - ArrowUp on `body('a', 'age')` → `header('age')` (same column, K39).
  - ArrowRight on `body('a', 'name')` → `body('a', 'age')`.
- Covers: CELL
- Risk: damage high, likelihood low
- Why this seam: catches a tree map that turns vertical moves from a cell into row focus, or sends ↑ from a cell to the first header. Either one loses the user's column on every row step.
- Order reason: builds on A and B (it proves the row-only branches do not catch cell targets).

### G. Unhandled keys on a row → `null`
- Test: `it.each(...)('returns null for %s on a focused row')`
- Asserts: these all return `null` on `row('a1')`:
  - Enter
  - Tab
  - `' '`
  - Shift+ArrowDown
  - Alt+ArrowLeft
  - Ctrl+ArrowDown
  - ArrowDown on an unknown row `row('zz')`
- Covers: UNH
- Risk: damage high, likelihood low
- Why this seam: a non-null Tab blocks step 5's Tab walk through the row's widgets. A non-null Enter on a leaf row cancels it with `preventDefault()`, against K5b ("Enter on a leaf does nothing"). The modifier guard is the selection hook that K14 reserves.
- Order reason: independent.

### H. In a `withTree()` host, ← on a focused grandchild row → DOM focus on its parent row element
- Test: `it('moves DOM focus to the parent row on ArrowLeft from a focused tree row')`
- Fixture: a new `TreeHost` built on `mockTaskTreeRows` with `withTree()` (link `parentId`). Expand `t1` and `t1a` through the tree API, so the render order is `t1`, `t1a`, `t1a1`, `t2`. Rows carry `ngpTableRow` + `ngpTableTreeRow`. Use the existing `press`/`flush` shape. Do not reuse `setupGrid`: widening it would edit existing test code.
- Asserts: after focusing the `t1a1` row element and pressing ArrowLeft:
  - `table.focus()` equals `{ area: 'body', rowId: 't1a', columnId: null }`;
  - `document.activeElement` is the `t1a` row element;
  - `event.defaultPrevented` is `true`.
- Covers: AC2c, R1
- Risk: damage high, likelihood high
- Why this seam: catches three wiring bugs.
  - `navigateGridOnKeydown` still sends row targets through `toGridCell` (it returns `null` for `columnId: null`), so every key on a row does nothing.
  - `rowDepths` is not built from `renderRows()[i].depth` next to `rowIds`, so ← goes to the wrong row.
  - The handler calls `nextGridTarget` on a tree table.
- Order reason: builds on E (the pure parent rule), and on step 1 (row registration and the row-target sync to DOM focus).

### I. Home, End, Ctrl+Home, Ctrl+End, PageUp and PageDown on a focused row move by rows, clamped
- Test: `it.each([...])('%s on a row moves to the %s row')`
- Asserts: with five rows and `pageSize: 2`: Home and Ctrl+Home give the first row; End and Ctrl+End give the last row; PageDown from row 2 gives row 4; PageUp from row 1 stays on the first row; PageDown from row 4 stays on the last. Every result is a row target (`columnId: null`).
- Covers: R2
- Risk: damage low, likelihood high
- Why this seam: catches row-focus keys that fall through to the cell map (first cell of the row, or a cell target) or that wrap. It also catches a page move that is not clamped.
- Order reason: builds on A (adjacent row moves share the row order).

### J. RTL swaps left and right for row and cell moves
- Test: `it('swaps ←/→ under RTL: → on a row goes to its parent, ← on a row goes to its first cell, → on the first cell goes to the row')`
- Asserts: with `isRtl: true`: → on a child row gives its parent row; ← on a row gives its first cell; → on the first cell gives its row.
- Covers: RTL
- Risk: damage low, likelihood low
- Why this seam: catches an RTL swap applied to cell keys only, or not applied to the row moves added in this step.
- Order reason: builds on D and E (the LTR versions of these moves).

## Types phase (after green)
None — no public type surface in this step. `keyboard-nav.types.ts` is not exported from `index.ts` (K22, K39).

## Not tested
- → on a row is left to `ngpTableTreeRow` when the row is collapsed and expandable — that is the tree row's `preventDefault()` (K14b), owned by step 3. Core skipping prevented events is covered by `ngp-table.directive.spec.ts` — 'ignores a key event a consumer already prevented'.
- Host role `treegrid` and row registration/tabindex — step 1.
- Group rows left out of the order — covered by the existing 'skips group header rows when choosing the first-entry cell'. The filter is the same `kind !== 'group'` filter already used in `navigateGridOnKeydown`. A grouped tree table is not in this step's fixtures.
- Panels left out — no panel target exists in the key map yet (K8b slice). There is nothing to exclude, so no test can fail.
- Order taken from `renderRows()`, not the DOM — covered by the existing 'takes the next row from renderRows() order, not DOM order'.
- Grid tables still use `nextGridTarget` (header ↓ keeps the column) — covered by the existing 'returns to the first data row in the same column on ArrowDown from a header cell'.
- → on a row when the table has no rendered column — no reachable state. `activeTarget` is `null` with no column (K23), so the handler returns before the map runs.
- Enter toggling a row and the `aria-level` / `aria-expanded` / toggle ARIA criteria — steps 3 and 4. Tab-walk — step 5. `tree.md` — step 6.

## Decisions applied
- A separate `nextTreegridTarget` with `TreegridNavOrder` (adds `rowDepths`); the grid specs stay untouched.
- `RowTarget` comes from step 1, so it is not stubbed here.
- ↓ from a header cell goes to the first row (seam C).
- Seam H relies on step 1 seam H (DOM focus sync for row targets).
- Row paging, Home/End and RTL are tested in seams I and J.
