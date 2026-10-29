---
step: 3
type: code
commit: feat
depends_on: [2]
files:
  - libs/table/src/directives/ngp-table.directive.ts
  - libs/table/src/directives/cell-widgets.ts
  - libs/table/src/directives/focus-registry.ts
  - libs/table/src/directives/ngp-table.directive.spec.ts
---

# Step 3 — Enter and leave a cell with text inputs or several widgets

Adds the entered mode for `composite` cells: Enter/F2 in, Esc/F2 out, click in, focus out.
Also adds the editable-target key skip deferred from #235.

Decisions: K6a, K6b, K21, K34, K36

## Do

- Enter or F2 on a focused `composite` cell enters it: focus its first widget and `restoreTabOrder` its widgets, so Tab walks them natively.
- Enter/F2 entry applies to `composite` cells only. Enter on a single-widget cell's button keeps its native click.
- Esc or F2 inside an entered cell exits: re-mark its widgets `-1` and focus the cell.
- An Esc whose `defaultPrevented` is set does not exit (K6b).
- In an entered cell, keys from any widget are left to it (not only editable targets), Esc/F2 excepted.
- Keys whose target is an input, textarea, select or contenteditable are never handled as navigation (K21).
- Esc/F2 exit handling runs before both skips.
- Focus landing on a composite cell's widget (pointer click) enters the cell.
- Focus leaving an entered cell returns it to navigation mode (widgets re-marked `-1`).
- An entered cell that unregisters clears the entered state.
- The step 1 observer must not mark controls swapped into the entered cell; exit re-marks them.

## Watch out

- On exit, save fresh originals — the cell's content may have changed while entered.
- Contenteditable: check the attribute, not `isContentEditable`.

## Out of scope

- Nested grids (step 4).
- Header filter inputs (#236).

## Done when

- AC2: a text-input or multi-widget cell focuses the cell; Enter/F2 enters, Esc leaves.
- AC4: arrow keys typed in an input, textarea, select or contenteditable never move the grid.
- AC5: `(keydown.escape)` with `preventDefault()` keeps focus in the input.
- `npx nx run-many -t typecheck typecheck-spec -p shared-table` clean.
