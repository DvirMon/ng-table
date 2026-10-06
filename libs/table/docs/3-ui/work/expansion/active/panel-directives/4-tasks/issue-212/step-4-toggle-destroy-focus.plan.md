---
step: 4
type: code
commit: fix
depends_on: [3]
files:
  - libs/table/src/directives/ngp-table-panel.directive.ts
  - libs/table/src/directives/ngp-table-panel.directive.spec.ts
---
# Step 4 — Destroy-path focus return

This step makes focus return to the toggle when a panel is destroyed with focus inside, and pins it with specs.

Decisions: [D4, D5, D8](../../1-decisions.md) · [E47, E48, E51](../../../../../../../decisions/expansion.md)

## Amended
The first run of the specs found a defect in the panel directive. When `table.expansion.collapse()` removes the `@if` panel, Angular detaches its DOM before `ngOnDestroy` runs. Focus has already dropped to `<body>`, so `host.contains(document.activeElement)` is false and `returnFocus(id, { allowBody: false })` returns early. The original plan said "no source change"; that assumed focus was still inside at destroy time.

## Do
Specs (already written in `ngp-table-panel.directive.spec.ts`, using the `UnmountPanelHost` fixture; keep them as they are):

- Unmount with focus inside the panel. Collapse through `table.expansion.collapse()`, not `close()`. Focus returns to the toggle.
- Collapse all through `table.expansion.collapse()` with focus on `<body>`. Focus does not move. Put "on body" in the test name.
- Only a connected toggle is focused. Disconnected toggle gets no `focus` call.
- Ordering pin. A `focusin` listener on the toggle records `panel.hasAttribute('inert')` when focus arrives during unmount. It records `false`, so focus return runs before the destroy-time `inert` write.

Source fix in `ngp-table-panel.directive.ts`:

- Track whether focus is inside the panel while it is mounted: host `(focusin)` sets a private flag true; host `(focusout)` sets it false, but ignores the event when `!host.isConnected` (a focusout caused by the DOM removal itself).
- In `ngOnDestroy`, treat focus as inside when the flag is set **or** `host.contains(document.activeElement)`. Keep `allowBody: false`; keep focus return before the `inert` write.
- `close()` keeps its current behavior (`allowBody: true`).

## Watch out
- Use `table.expansion.collapse()` in the specs so the destroy path runs. `close()` returns focus on its own and would hide a broken destroy path.
- A body-focused collapse must still not move focus: the flag is false when focus was never inside.
- If the flag approach can't pass the ordering pin, report it; don't weaken the spec.
- Keep the JSDoc/`//` contract on the directive (note why the flag exists).

## Out of scope
- Registry changes. Toggle directive changes.
- Single-open mode (#210).

## Done when
- [ ] The four cases pass, and the rest of `ngp-table-panel.directive.spec.ts` still passes.
- [ ] `nx run shared-table:typecheck` and `typecheck-spec` clean.

---
← [Step 3: Toggle registers with the panel registry](step-3-toggle-registration.plan.md)
