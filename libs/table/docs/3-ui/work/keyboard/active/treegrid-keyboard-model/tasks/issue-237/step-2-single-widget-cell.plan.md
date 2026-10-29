---
step: 2
type: code
commit: feat
depends_on: [1]
files:
  - libs/table/src/directives/ngp-table.directive.ts
  - libs/table/src/directives/ngp-table-cell.directive.ts
  - libs/table/src/directives/ngp-table.directive.spec.ts
---

# Step 2 — A cell with one widget focuses that widget

Makes a single-widget cell's widget the roving Tab stop and the target of arrow focus.
Leaves composite cells' Enter/F2/Esc to step 3.

Decisions: K6a, K24, K34, K35

## Do

- When the active cell is `single`, its widget holds `tabindex="0"` and the cell holds `-1`.
- Exactly one `tabindex="0"` stays in the table.
- Arrowing onto a single-widget cell, the focus-sync effect, and Tab into the grid focus the widget (`focusCellElement`).
- A multi-widget (`composite`) cell is focused as the cell itself.
- Arrow keys from a focused checkbox or button still move the grid.
- Space/Enter on the widget are not handled by the grid.
- Removing the only widget moves the Tab stop back to the cell (reads step 1's refreshed kind).
- Update two existing `GridHost` tests: row 2 `name` holds one `<button>`, so their expected Tab stop / DOM focus moves from the cell to the button (K34).

## Watch out

- A widget must drop back to `-1` once its cell is no longer active.
- A lone disabled button cell is `none` (K35) and gets cell focus.

## Out of scope

- Enter/F2/Esc, editable-target skip (step 3).
- Nested grids (step 4).
- Header cells (#236).

## Done when

- AC1: a single-checkbox or single-button cell focuses the widget when arrowed onto.
- `npx nx run-many -t typecheck typecheck-spec -p shared-table` clean.
