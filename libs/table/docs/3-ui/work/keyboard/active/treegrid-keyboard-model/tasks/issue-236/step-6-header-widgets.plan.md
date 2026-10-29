---
step: 6
type: code
commit: feat
depends_on: [4]
files:
  - libs/table/src/directives/ngp-table.directive.ts
  - libs/table/src/directives/ngp-table-header-cell.directive.ts
  - libs/table/src/directives/ngp-table.directive.spec.ts
---

# Step 6 — Header widgets

Proves a sort button and a filter input inside a header cell follow the same widget rules as body cells, and adds only the glue that is missing.
Starts only after #237 (the widget mechanism) has merged to `main` and this branch is rebased onto it.

Decisions: K6a, K6b, K6c, K7, K41, K42

## Do

Rebase onto `origin/main` first. If #237 is not merged, stop and say so.

Header cells already register in the same focus registry as body cells (step 3). #237 detects widgets over registered elements, so it should apply to headers with no header special case. Run the step 6 tests; for each that fails, add the smallest fix in `ngp-table.directive.ts` or `ngp-table-header-cell.directive.ts`:

- A header cell holding exactly one non-text widget (a plain `<button>`): arrowing onto the header focuses the button. Enter and Space stay native.
- A header cell holding a text input: the cell is focused. Enter or F2 enters the input. Esc returns focus to the cell. Arrow keys typed in the input move the caret, not the grid.
- Widgets in header cells sit at `tabindex="-1"`, so the grid stays one Tab stop.

## Watch out

#237's editable-target skip must guard the grid keydown handler as step 4 renamed it, not only the old body handler. Seam E checks it.

A seam that passes right after the rebase with no step 6 change is a plan defect: report it, do not delete it. A seam that only repeats a #237 body test with no header branch moves to "Not tested" in the test plan.

## Out of scope

- `ngpTableSort` itself, and the `sort.md` text (#237).
- Multi-widget, `<select>` and `contenteditable` headers.
- Div-grid parity (#238).

## Done when

- `nx run shared-table:typecheck` clean.
- `nx run shared-table:typecheck-spec` clean.
- The new `describe` in `ngp-table.directive.spec.ts` passes.
