---
step: 5
type: code
commit: feat
depends_on: [1]
files:
  - libs/table/src/directives/focus-registry.ts
  - libs/table/src/directives/cell-widgets.ts
  - libs/table/src/directives/ngp-table.directive.ts
  - libs/table/src/directives/ngp-table.directive.spec.ts
---

# Step 5 — Tab walk on a focused row

Lets Tab on a focused row walk the operable widgets in its cells, then leave the grid.
Keys and ARIA are left to other steps.

Decisions: K6a, K33, K35, K37, K38

## Do

All source paths are under `libs/table/src/directives/`.

- Add `enterRow(rowTarget)` and `exitRow()` to `FocusRegistry`, like `enterCell` / `exitCell`.
- While the active target is a row, restore the original `tabindex` of the operable widgets (the K35 rule) in that row's cells. The cells stay `-1`, so native Tab walks the widgets and then leaves the grid.
- Skip any cell that classifies `composite` by role (a nested grid and similar, K37, K38).
- Leaving row mode puts the widgets back to `-1`. This covers an arrow move to a cell or another row, focus leaving the grid, and the row unregistering.
- `followFocusIn` must not end row mode when focus lands on a restored widget. It must not call `moveTo` on that widget's cell, and must not call `enterCell`.
- Restore writes go through `writeTabindex`, so `retrackTabindex` ignores them.
- `refreshWidgets` and `syncTabStop` respect row mode the way they respect `entered`.

## Watch out

- Do not fight the host `MutationObserver` (K33).

## Out of scope

- Key map ([step 2](./step-2-treegrid-key-map.plan.md)).
- ARIA.

## Done when

- The approved test plan [step-5-row-tab-walk.test-plan.md](./step-5-row-tab-walk.test-plan.md) passes.
- `nx run shared-table:typecheck` clean.
- `nx run shared-table:typecheck-spec` clean.
