---
step: 4
type: code
commit: feat
depends_on: [1, 3]
files:
  - libs/table/src/api/features/with-filtering/feature.ts
  - libs/table/src/api/features/with-filtering/feature.spec.ts
---
# Step 4 — Filter keeps ancestors

This step makes the filter stage keep the ancestors of every match when a tree is composed.
It also makes `withFiltering` contribute the resulting `contextRows`.
It leaves reveal to #169 and the tree consequence tests to step 6.

Decisions: [D5](../../1-decisions.md), [A2](../../3-architecture.md)

## Do

- Add `includeDescendants?: boolean` to `WithFilteringConfig`.
- Add `'trackBy'` to the `FilteringInput` `Pick`.
- In the `filter` stage, when filtering is active and `ctx.parentOf` is set, call `retainTreeMatches` with the one matcher.
- Without `ctx.parentOf`, keep the plain `rows.filter(matcher)`.
- Write the last `contextIds` into a closure box from the stage.
- Contribute the box through the slot:

  ```ts
  contextRows: computed(() => { input.rows(); return box.ids; })
  ```

- With `manual: true` or no schema, the early-return path resets the box to empty and runs no retention.

## Watch out

- Keep the `manual || !filters` guard ahead of the tree branch.
- Reset the box on every early return. Otherwise context flags stay after the filter clears.
- Call `matcher()` once per evaluation.

## Out of scope

- Reveal and `revealContextRow` (#169).
- The `hasChildren`, `totalRowCount` and `selectAllIds` tests (step 6).

## Done when

- [ ] A child match keeps its ancestors in input order, flagged as context rows.
- [ ] `includeDescendants` keeps the whole branch of a match.
- [ ] `manual: true` flags nothing.

---
← [Step 3: Tree retention](step-3-tree-retention.plan.md) | [Step 5: Tree-row directive](step-5-tree-row-directive.plan.md) →
