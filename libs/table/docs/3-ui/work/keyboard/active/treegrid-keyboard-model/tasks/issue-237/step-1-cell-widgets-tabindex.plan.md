---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/directives/cell-widgets.ts (new)
  - libs/table/src/directives/cell-widgets.types.ts (new)
  - libs/table/src/directives/cell-widgets.spec.ts (new)
  - libs/table/src/directives/focus-registry.ts
  - libs/table/src/directives/ngp-table.directive.ts
  - libs/table/src/directives/ngp-table-cell.directive.ts
  - libs/table/src/directives/ngp-table.directive.spec.ts
---

# Step 1 — Find a cell's widgets and keep them out of the Tab order

Classifies each body cell's widgets and keeps every focusable inside a cell at `tabindex="-1"`, including controls added later.
Leaves which element holds the Tab stop, and entering a cell, to steps 2–3.

Decisions: K6a, K32, K33, K35, K38

## Do

- Add `cell-widgets.types.ts` with `CellWidgetKind = 'none' | 'single' | 'composite'`.
- Add `cell-widgets.ts` with three functions:
  - `classifyCellWidgets(cell: HTMLElement): CellWidgetKind`
  - `removeFromTabOrder(root: Node): void` — marks `root` if focusable, plus every focusable descendant, saving each element's original tabindex.
  - `restoreTabOrder(cell: HTMLElement): void` — puts each saved original back; a missing attribute stays missing.
- `single`: exactly one button, checkbox, radio, switch or link.
- `composite`: any text input, textarea, select or contenteditable; more than one widget; or any descendant with role `grid`, `treegrid`, `listbox` or `tree`, whatever the count (K38).
- Not counted (still marked `-1`): disabled controls, `input[type=hidden]`, `aria-hidden` elements, elements whose original tabindex is `-1` (K35).
- The count reads the saved original tabindex, never the live attribute.
- `ngpTableCell` marks its existing descendants when it registers.
- `ngpTable` owns one `MutationObserver` on its host (`childList` + `subtree`). It marks newly added focusables inside registered cells only; disconnect on destroy.
- The focus registry stores each cell's widget kind and refreshes it when the observer fires.

## Watch out

- Marking twice must not save `-1` as the original.
- Never mark the cell element itself — it carries the roving tabindex.
- Focusables outside registered cells (e.g. a `<th>` button, #236) stay untouched.
- Contenteditable: check the attribute (`closest('[contenteditable]')`), not `isContentEditable` — jsdom may not implement it.

## Out of scope

- Which element holds `tabindex="0"` in a single-widget cell (step 2).
- Enter/F2/Esc and restoring on entry (step 3).
- Watching `tabindex` attribute changes (step 4).
- Header cells (#236).

## Done when

- Every focusable inside a cell is `-1`.
- A control added or swapped in later is `-1` after the observer flushes.
- The table still has exactly one `tabindex="0"`.
- `npx nx run-many -t typecheck typecheck-spec -p shared-table` clean.
