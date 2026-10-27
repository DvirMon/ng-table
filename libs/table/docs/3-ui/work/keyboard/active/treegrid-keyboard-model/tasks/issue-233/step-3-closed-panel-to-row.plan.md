---
step: 3
type: code
commit: feat
depends_on: [2]
files:
  - libs/table/src/engine/focus.ts
  - libs/table/src/engine/compose-table.ts
  - libs/table/src/api/features/with-expansion.ts
  - libs/table/src/api/create-table.spec.ts
  - libs/table/src/api/features/with-expansion.spec.ts
---

# Step 3 — Closed panel recovers to its row

A panel target whose panel closed becomes a body target on its row.
Single-open follow-focus stops reacting to that recovery write.

Decisions: K8b, K1, K11, K23, K25

## Do

- After the row rules: a `panel` target whose row is not in `expansion()` becomes `{ area: 'body', rowId, columnId }`.
- `columnId` is the first render column in a grid, and `null` in a treegrid.
- Treegrid means the store has a `tree` member.
- The effect reads `expansion()` only when the `expansion` member exists. Pass the open set (or `undefined`) and an `isTreegrid` flag into `recoverFocus`.
- `with-expansion.ts` `followFocus`: ignore a body target on the same row as the previous panel target. That is the recovery move. Track the previous target in the effect's closure.
- `with-expansion.spec.ts`: in `does not follow focus to a %s target`, change the `panel` row's fixture to the open row `r1`. Add a one-line comment: a closed panel is never mounted.

## Watch out

- Row rules run first. A hidden row's open panel goes to the ancestor. A deleted row's panel follows the row rule.
- Use `renderColumns()[0]`, not `columns()[0]`.

## Out of scope

- Esc returns focus (directive, S2). DOM.

## Done when

- The test plan is green.
- `nx run shared-table:typecheck` and `nx run shared-table:typecheck-spec` clean.
