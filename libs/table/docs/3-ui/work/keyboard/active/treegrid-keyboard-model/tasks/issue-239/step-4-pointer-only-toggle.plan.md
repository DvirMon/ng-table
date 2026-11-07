---
step: 4
type: code
commit: feat
depends_on: [1]
files:
  - libs/table/src/directives/ngp-table-collapsible-trigger.directive.ts
  - libs/table/src/directives/ngp-table-tree-toggle.directive.ts
  - libs/table/src/directives/ngp-table-panel-toggle.directive.ts
  - libs/table/src/directives/ngp-table-tree-toggle.directive.spec.ts
---

# Step 4 — Pointer-only tree toggle

Takes the tree toggle out of the Tab order and the accessibility tree, and moves `aria-expanded` off the shared trigger.
Row keys are left to step 3.

Decisions: K5, K35

## Do

All source paths are under `libs/table/src/directives/`.

First, in its own commit before the red tests (K5 reversed the contract; the user approved this on 11-07):

- In `ngp-table-tree-toggle.directive.spec.ts`, amend the four existing specs that assert the old contract. Remove only their `aria-expanded` and parent `aria-hidden` assertions. Rename any `it()` that mentions `aria-expanded`. Keep the row-render and `data-expanded` assertions.
- Commit this as a `test` commit on its own, with the stage tag the commit skill gives for this plan. Never together with code.

Then:

- Take the `aria-expanded` binding out of `NgpTableCollapsibleTrigger`. Keep type, click and `data-expanded`.
- Bind `aria-expanded` in the host map of `ngpTablePanelToggle`.
- `ngpTableTreeToggle` always binds `tabindex="-1"` and `aria-hidden="true"`. A leaf toggle also stays `disabled` / `data-disabled`. No `aria-expanded`.
- A click still calls `table.tree.toggle(id)`, then `focus.moveTo({ area: 'body', rowId, columnId: null }, { focusElement: true })`.

## Watch out

- The panel toggle spec must stay green, unchanged.
- The shape of #209's shared collapsible core is not settled, so keep the split local.

## Out of scope

- Key handling ([step 3](./step-3-tree-row-aria-keys.plan.md)).
- Row ARIA.

## Done when

- The approved test plan [step-4-pointer-only-toggle.test-plan.md](./step-4-pointer-only-toggle.test-plan.md) passes.
- The panel toggle spec still passes.
- `nx run shared-table:typecheck` clean.
- `nx run shared-table:typecheck-spec` clean.
