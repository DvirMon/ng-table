---
step: 3
type: code
commit: feat
depends_on: [2]
files:
  - libs/table/src/directives/ngp-table-tree-toggle.directive.ts
  - libs/table/src/directives/ngp-table-tree-toggle.directive.spec.ts
---

# Step 3 — Toggle dev-mode checks

The toggle throws on a table without `withTree()`.
It warns once when its button has no accessible name.
Both checks run only under `ngDevMode`.

Decisions: [D7, D8](../../1-decisions.md)

## Do

- Wiring check: on first render, a table with no `tree` member throws.
- The message names `ngpTableTreeToggle` and `withTree()`.
- Name check: after first render (`afterNextRender`), warn once through `console.warn`.
- Warn when the button has no `aria-label`, no `aria-labelledby` and no trimmed text.
- Skip the name check on a leaf (disabled) toggle.

## Watch out

- Gate each check with `ngDevMode` inside its own body.
- Whitespace-only text counts as no name.
- A missing `ngpTableTreeRow` on the row is not an error.
- The implementer chooses where the throw fires (constructor, first computed read, or `afterNextRender`).
- The spec asserts only that setup throws.

## Out of scope

- Production behaviour of either check.
- Message wording beyond the two names.

## Done when

- [ ] The throw message contains both `ngpTableTreeToggle` and `withTree()`.
- [ ] Each nameless parent toggle warns exactly once.

---

← [Step 2: The tree toggle directive](step-2-tree-toggle.plan.md) | [Step 4: Collapsible-grouping story host uses the tree pair](step-4-grouping-story-host.plan.md) →
