---
step: 3
type: code
commit: feat
depends_on: [2]
files:
  - libs/table/src/engine/grouping/queries.ts
  - libs/table/src/engine/grouping/queries.spec.ts
---

# Step 3 — Group queries follow the root

This step makes the three group query functions resolve buckets by root value.
It leaves the feature wiring for step 4.

Decisions: [TR16](../../../../../../../decisions/tree.md), [TR17](../../../../../../../decisions/tree.md), [D13, D14](../../1-decisions.md).

## Do

- `rowsBeneathGroup` widens its opts:
  ```ts
  opts?: Pick<ClusterOpts<TRow>, 'extractValueByColumn' | 'treeLinks'>
  ```
- `rowsBeneathGroup`, `collectGroupIds` and `collectAppliedLevels` pass `treeLinks` on to `buildClusterNodes`.
- `when` admission sees the full bucket, descendants included.

## Watch out

- Reuse step 2's `treeOrders` fixture from `grouping.mock.ts`. Add no new fixture.

## Out of scope

- Feature wiring (step 4).

## Done when

- [ ] `rowsBeneathGroup`, `collectGroupIds` and `collectAppliedLevels` all forward `treeLinks`.

---

← [Step 2: Cluster by root value in the group stages](step-2-cluster-by-root-value.plan.md) | [Step 4: Wire the parent link into withGrouping()](step-4-wire-grouping-parent-link.plan.md) →
