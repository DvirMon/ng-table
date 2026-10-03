---
step: 5
type: docs
commit: docs
depends_on: [3]
files:
  - libs/table/docs/3-ui/directives/tree.md
  - libs/table/docs/0-product/tree.md
---
# Step 5 — Tree docs retrofit

Updates the tree directive and product docs to the new toggle behavior and removes the nameless-toggle warning.
Nothing is left for later steps.

Decisions: [TR47, TR48](../../../../../../../decisions/tree.md) · [D11](../../1-decisions.md)

## Do

In `libs/table/docs/3-ui/directives/tree.md`:

- § ngpTableTreeToggle: add that the button is always `type="button"`, even over a template `type`.
- "Non-expandable row" bullet: a leaf shows `aria-expanded="false"` (was "omits").
- Attribute-ownership table: split the toggle row. "Shared trigger core (internal)" owns `type`, `aria-expanded` and `data-expanded`. The tree toggle owns `disabled`, `aria-hidden` and `data-disabled`.
- § Dev checks: delete the "Nameless button" and "Disabled leaf skipped" bullets.

In `libs/table/docs/0-product/tree.md`:

- Failure behavior: delete the bullet that says a toggle the page forgot to name is caught by a development warning.
- "Covered by": drop "the missing-name development warning is not shown".
- "Code:" line: remove the `:26-40 (name check)` reference. Fix the other line references to the post-retrofit directive, or point at the file without line numbers.
- Delete the "Nameless toggle warning (TR39, TR46)" bullet near line 920.

## Watch out

- Work folders (`*/work/**`) are history. Do not edit them.
- Keep the "Accessible name. Consumer-owned" bullet.

## Out of scope

- `tree.mdx` and `grouping.mdx` prose. They have no warning or type guidance.

## Done when

- [ ] Neither doc mentions a nameless-name warning for the toggle.
- [ ] `npm run llms:check` is clean.

---
← [Step 4: Stories drop the manual button type](step-4-stories-drop-manual-type.plan.md)
