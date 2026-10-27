---
step: 3
type: code
commit: feat
depends_on: [1, 2]
files:
  - libs/table/src/directives/focus-registry.ts (new)
  - libs/table/src/directives/ngp-table.directive.ts
  - libs/table/src/directives/ngp-table-cell.directive.ts
  - libs/table/src/directives/ngp-table.directive.spec.ts
---

# Step 3 — Keys, click and DOM focus

Wires keys, pointer focus and DOM focus to the store through `ngpTable`.
Editable targets, header, treegrid and group stops are left to later slices.

Decisions: K3b, K6b, K9d, K12c, K13, K15, K24

## Do

`focus-registry.ts`: a per-table map from target key to element.
`ngpTable` provides it, like `NGP_TABLE_PANEL_REGISTRY` in `panel-registry.ts`.
It is internal; do not export it from `index.ts`.

Cells register their element in an effect and unregister on destroy.

`ngpTable` host `(keydown)`, bubble phase:

1. Skip when `defaultPrevented`.
2. Build a `NavOrder` from `renderRows()` (non-group) and `renderColumns()`.
3. `current` is `activeTarget`.
4. Call `nextBodyTarget`.
5. Non-null: `focus.moveTo(next)` and `preventDefault()`.
6. Null: leave the event alone.

`ngpTable` host `(focusin)`: map the event target to its closest registered cell and `moveTo` it. This covers a pointer click.

`ngpTable` remembers focus-within:

- set on `focusin`;
- cleared on `focusout` only when `relatedTarget` is outside the host.

A removed focused cell therefore still counts as inside.

Sync effect. It runs when `focus()` changes while focus-within is set, or when `focusRequests()` went up since last seen.
It calls `.focus()` on the target's registered element after render (`afterNextRender`).
Otherwise only the tabindex moves.

## Watch out

Never treat the first counter read as a request. No focus steal on load.

Skip `.focus()` when `document.activeElement` is already inside the target cell. In-cell button clicks keep focus.

Step 3 adds its own `describe` block and its own `GridHost` in `ngp-table.directive.spec.ts`. It does not reuse step 2's `setup()`.

## Out of scope

- Editable-target skip and widgets (#237).
- Header, Page Up/Down, RTL (#236).
- Treegrid (#239).
- Group headers (#240).
- Div parity (#238).
- Recovery rules (#233).

## Done when

- `nx run shared-table:typecheck` clean.
- `nx run shared-table:typecheck-spec` clean.
- `ngp-table.directive.spec.ts` passes.
