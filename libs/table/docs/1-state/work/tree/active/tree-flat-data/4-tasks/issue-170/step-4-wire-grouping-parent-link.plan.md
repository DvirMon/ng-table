---
step: 4
type: code
commit: feat
depends_on: [1, 3]
files:
  - libs/table/src/api/features/with-grouping/feature.ts
  - libs/table/src/api/features/with-grouping/feature.spec.ts
  - libs/table/src/api/features/with-grouping/feature.types.spec.ts
  - libs/table/src/table.mock.ts
---

# Step 4 — Wire the parent link into withGrouping()

This step makes `withGrouping()` read the parent link from the stage context and pass it to every grouping call.
It leaves the story fixture for step 5.

Decisions: [TR16](../../../../../../../decisions/tree.md), [TR17](../../../../../../../decisions/tree.md), [TR18](../../../../../../../decisions/tree.md), [D13, D14, D15](../../1-decisions.md).

## Do

- The `withGrouping()` factory takes `(input, ctx)`.
- `clusterOpts` gets `treeLinks`, built from `ctx.parentOf` and `input.trackBy`.
  `treeLinks` is `undefined` when `ctx.parentOf` is `undefined`.
- Both `'group'` stages and the members `rowsOf`, `groupIds` and `appliedGrouping` use the same `clusterOpts`.
- `GroupingInput<In>` may need `'trackBy'` added.
- Add the fixture `TaskTreeMockRow` and `mockTaskTreeRows` to `src/table.mock.ts`.

## Watch out

- Read `ctx.parentOf` at call time. Do not destructure or copy it when the factory runs.
  The composition-order test (seam F) catches this.

## Out of scope

- The story fixture (step 5).
- Broken-link reporting.
- Filtering combined with a tree.

## Done when

- [ ] A child whose own group value differs renders under its root's header, nested under its parent.
- [ ] `rowsOf` and the group count include descendants.
- [ ] Without `parentId`, grouping is unchanged (🧪 awaiting CI).

---

← [Step 3: Group queries follow the root](step-3-group-queries-follow-root.plan.md) | [Step 5: Show roots-only grouping in the collapsible story](step-5-story-roots-only-grouping.plan.md) →
