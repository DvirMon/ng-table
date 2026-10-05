---
step: 4
type: test
commit: test
depends_on: [3]
files:
  - libs/table/src/directives/ngp-table-panel.directive.spec.ts
---
# Step 4 — Destroy-path focus return

This step pins how focus returns to the toggle when a panel is destroyed. It adds specs only.

Decisions: [D4, D5, D8](../../1-decisions.md) · [E47, E48, E51](../../../../../../../decisions/expansion.md)

## Do
Add these cases to `ngp-table-panel.directive.spec.ts`:

- Unmount with focus inside the panel. Collapse through `table.expansion.collapse()`, not `close()`. Focus returns to the toggle.
- Collapse all through `table.expansion.collapse()` with focus on `<body>`. Focus does not move. The destroy path uses `allowBody: false`. Put "on body" in the test name.
- Only a connected toggle is focused. Remove the toggle from the DOM while the panel stays, with focus inside, then close the panel. The disconnected toggle gets no `focus` call.
- Ordering pin. A `focusin` listener on the toggle records `panel.hasAttribute('inert')` when focus arrives during unmount. It records `false`, so focus return runs before the destroy-time `inert` write.

## Watch out
- Use `table.expansion.collapse()` so the destroy path runs. `close()` returns focus on its own and would hide a broken destroy path.

## Out of scope
- Destroy with focus outside the panel. Step 3 seam E covers it.
- Any source change.

## Done when
- [ ] The four cases pass.

---
← [Step 3: Toggle registers with the panel registry](step-3-toggle-registration.plan.md)
