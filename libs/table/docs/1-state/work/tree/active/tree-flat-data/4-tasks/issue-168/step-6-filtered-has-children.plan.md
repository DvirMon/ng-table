---
step: 6
type: test
commit: test
depends_on: [4]
files:
  - libs/table/src/api/features/with-tree.spec.ts
---

# Step 6 — hasChildren follows the filtered view

This step adds one test for what a filtered tree does to `hasChildren`.
It changes no production code.

Decisions: [D9](../../1-decisions.md)

## Do

Write the test after the code, through `createTable()` with `withTree({ parentId })` and `withFiltering({ schema })`.

- In `with-tree.spec.ts`, a parent whose children are all filtered out renders `hasChildren: false`.

## Watch out

- The `isExpandable` override is already covered by the #167 seam E test in `with-tree.spec.ts`. Add no second one.
- If the test fails, report it. Do not fix the source.

## Out of scope

- Reveal.
- `totalRowCount` and `selectAllIds()`. Both project `rows()`, which step 4 seam A already pins.

## Done when

- [ ] The test exists and passes.

---

← [Step 5: Tree-row directive](step-5-tree-row-directive.plan.md) | [Step 7: Feature docs](step-7-feature-docs.plan.md) →
