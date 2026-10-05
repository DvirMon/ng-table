---
step: 2
type: code
commit: ref
depends_on: []
files:
  - libs/table/src/directives/ngp-table-tree-toggle.directive.ts
  - libs/table/src/directives/ngp-table-tree-toggle.directive.spec.ts
---

# Step 2 — Drop the nameless-toggle warning

Removes the development warning for a toggle with no accessible name, and its tests.
Step 3 then moves the toggle onto the core.

Decisions: [TR47](../../../../../../../decisions/tree.md)

## Do

In the directive:

- Delete `hasAccessibleName` and `warnWhenNameless`, and the constructor call to it.
- Delete the `ElementRef` injection and the `afterNextRender` and `ElementRef` imports.
- Drop the "warns when the button has no accessible name" clause from the JSDoc.

In the spec, delete:

- `it('warns once per toggle whose button has no accessible name')`.
- `it('does not warn again when an existing toggle re-renders')`.
- The `it.each` cases named `does not warn when %s`.
- The `warn` spy with its `beforeEach` and `afterEach`.
- The hosts `NamelessHost`, `AriaLabelHost`, `AriaLabelledbyHost`, `TextHost` and `LeafNamelessHost`.
- `LEAF_ROWS`.
- The `vi` and `MockInstance` vitest import.

## Watch out

- Keep `CHECK_ROWS`, `checksTemplate`, `createCheckTable`, `CHECK_IMPORTS`, `NoTreeHost` and `renderChecks`. The `withTree()` throw case and Step 3 use them.
- Keep the `throws on first render when the table has no withTree()` case unchanged.

## Out of scope

- Host bindings, `ariaExpanded` and the core (Step 3).
- Adding a "does not warn" test.

## Done when

- [ ] No `console.warn` and no name check remain in the directive.
- [ ] The spec has no warning cases and no `warn` spy.
- [ ] The `withTree()` throw case is unchanged.

---

← [Step 1: The collapsible trigger core](step-1-collapsible-trigger-core.plan.md) | [Step 3: Tree toggle extends the core](step-3-tree-toggle-extends-core.plan.md) →
