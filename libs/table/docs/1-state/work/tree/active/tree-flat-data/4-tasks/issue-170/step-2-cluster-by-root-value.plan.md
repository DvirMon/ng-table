---
step: 2
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/engine/grouping/clusters.ts
  - libs/table/src/engine/grouping/pipeline.ts
  - libs/table/src/engine/grouping/render.ts
  - libs/table/src/engine/grouping/grouping.mock.ts
  - libs/table/src/engine/grouping/pipeline.spec.ts
  - libs/table/src/engine/grouping/render.spec.ts
---

# Step 2 — Cluster by root value in the group stages

This step makes both group stages read every level's group value from a row's root when a parent link is present.
It leaves the query functions for step 3 and the `withGrouping()` wiring for step 4.

Decisions: [TR16](../../../../../../../decisions/tree.md), [TR17](../../../../../../../decisions/tree.md), [TR18](../../../../../../../decisions/tree.md), [D13, D14, D15](../../1-decisions.md).

## Do

- `ClusterOpts<TRow>` gains one optional field:
  ```ts
  readonly treeLinks?: {
    readonly parentOf: ParentLink<TRow>;
    readonly trackBy: TrackByFn<TRow>;
  }
  ```
- When `treeLinks` is present, `buildClusterNodes` (`clusters.ts`) and `buildGroupRenderRows` (`render.ts`) resolve each row's root with `resolveTreeLinks` (`engine/tree-links.ts`).
  They resolve over the rows they receive, then read every grouping level's value from the root row.
- `clusterRows` passes `treeLinks` through.
- Rows inside a bucket keep input order.
- Without `treeLinks`, the output is unchanged.
- Whether `buildClusterNodes` receives the link as an extra argument or through the whole opts is the implementer's choice.

## Watch out

- Look roots up through `parentById` from `resolveTreeLinks`. Never walk the raw `parentOf`, which loops on cycles.
- Grouping never reports broken links. `withTree`'s `'tree'` stage owns reporting.
- The render path clusters `RenderNode`s through `buildClusters` directly, so its root lookup is keyed from `item.data`.

## Out of scope

- `queries.ts` (step 3).
- `withGrouping()` wiring (step 4).

## Done when

- [ ] Without `treeLinks`, every existing grouping spec is unchanged (🧪 awaiting CI).

---

← [Step 1: Feature factories receive the stage context](step-1-feature-factory-stage-context.plan.md) | [Step 3: Group queries follow the root](step-3-group-queries-follow-root.plan.md) →
