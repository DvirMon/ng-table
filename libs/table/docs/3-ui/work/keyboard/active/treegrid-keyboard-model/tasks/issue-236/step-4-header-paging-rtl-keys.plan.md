---
step: 4
type: code
commit: feat
depends_on: [1, 2, 3]
files:
  - libs/table/src/directives/ngp-table.directive.ts
  - libs/table/src/directives/ngp-table.directive.spec.ts
---

# Step 4 — Keys and DOM focus for header, paging and RTL

Wires `nextGridTarget`, the page step and the direction to the host keydown, and lets DOM focus reach header cells.

Decisions: K4, K4b, K6b, K7, K24, K39, K40, K41

## Do

`navigateBodyOnKeydown` becomes grid navigation (rename it for what it now does):

1. Skip when `defaultPrevented` (K6b).
2. `current` is the active target when it is a header, or a body cell with a column.
3. Build the `NavOrder` as before (non-group rows, render columns).
4. Call `nextGridTarget` with `{ isRtl: isRtlAt(host), pageSize: pageStepOf(host, <focused cell element>) }`, both read at keypress.
5. Non-null: `moveTo` the result and `preventDefault()`.
6. ArrowUp from the first row when no header cell is registered: stay on that row, still `preventDefault()`.

The sync effect also focuses header elements. The existing rule is unchanged: DOM focus moves only on a new `focusElement` request or while focus is inside the grid (K24).

## Watch out

Read direction and page step inside the handler. Never in a `computed` or at construction.

Add new `describe` blocks and hosts in `ngp-table.directive.spec.ts`; the existing `setupGrid` helper and its tests stay as they are.

#237's editable-target skip has to guard this handler once #237 merges. Step 6 checks it.

## Out of scope

- Group header stops (#240), treegrid (#239), widgets in cells (#237).
- Virtual-scroll visible range.

## Done when

- `nx run shared-table:typecheck` clean.
- `nx run shared-table:typecheck-spec` clean.
- `ngp-table.directive.spec.ts` passes.
