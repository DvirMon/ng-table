---
title: "Step 2 — emission honours admission (dissolution)"
type: task-step
issue: 119
---

# Step 2 — emission honours admission (dissolution)

**PR scope:** What a dissolved cluster actually does — in the render walk, in the pipeline flatten,
and in the group-id collection. Still unobservable: nothing supplies a predicate until Step 3.

**Task type:** code

**Skills used:** angular-developer, typescript-conventions, declarative-naming

**Depends on:** Step 1 — reads the `admitted` flag that step introduces.

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/engine/grouping.ts` (edit)

## Why This Step Exists

Admission changes row **structure**, which is why it is engine work and not a directive that
declines to draw a header (`design-group-admission.md` § Why this is engine work). A dissolved
cluster must lose four things at once — its header, its depth, its synthetic group id, and its
aggregates. Lose any one of them separately and the table is inconsistent: rows indented under a
header that is not there, an `expandedRows` entry nothing renders, `computeAggregates` running for
nobody, `rowsOf` resolving a group that does not exist.

Three call sites walk the same tree and all three have to agree, or the pipeline order and the
render order describe two different tables.

**Q1, decided 2026-09-16: a dissolved cluster exits the grouping tree entirely** — its rows do not
re-enter at the next level. Recorded in `../../../2-decisions.md`; rationale in issue #85's
comment thread.

## What To Do

### 1. `emitGroupRows` — drop the header, re-parent the rows, stop descending

Inside the `nodes.flatMap`, before building the header:

```ts
if (!node.admitted) {
  return node.items.map((item) => ({ ...item, depth, parentId }));
}
```

Three things this says, all deliberate:

- `depth` — the **parent's** depth, the one this function was called with, not `depth + 1`.
- `parentId` — the parent's id, passed straight through. The dissolved cluster's own id is never
  minted, so nothing can put it in `expandedRows` and nothing can resolve it.
- `node.items`, not a recursion into `node.children` — this is Q1. Every leaf under the dissolved
  cluster emits flat, at one depth, regardless of how many levels remain.

No `computeAggregates` call on this path, and no `buildGroupPath`/`toGroupId` call.

### 2. `flattenLeaves` — a dissolved node contributes its own items

The pipeline stage's flatten currently recurses whenever `children.length > 0`. It must stop at a
dissolved node for the same reason `emitGroupRows` does — otherwise the `group` pipeline stage
orders rows by a sub-clustering the render stage never draws:

```ts
function flattenLeaves<T>(nodes: ClusterNode<T>[]): T[] {
  return nodes.flatMap((node) =>
    node.admitted && node.children.length > 0 ? flattenLeaves(node.children) : node.items,
  );
}
```

### 3. `collectClusterGroupIds` — no id for a dissolved cluster

```ts
function collectClusterGroupIds<T>(nodes: ClusterNode<T>[], parentPath: string): RowId[] {
  return nodes.flatMap((node) => {
    if (!node.admitted) return [];
    const path = buildGroupPath(parentPath, node.columnId, node.value);
    return [toGroupId(path), ...collectClusterGroupIds(node.children, path)];
  });
}
```

This is what keeps `expandAll(table.groupIds())` (#97) from seeding an id that no header carries.

### 4. `findClusterByPath` needs no change

A dissolved cluster's id is never minted, so no `rowsOf(group)` call can name it and the existing
"id matching no cluster returns `[]`" degrade already covers it (Q3, recommendation: correct as-is
— the *parent's* `rowsOf` still includes those rows, because dissolution changes depth, not
membership). Confirm by reading, do not add a guard.

## Implementation Notes

- **The parent's `hasChildren` is unaffected.** It reads `node.items.length`, which dissolution
  does not change — a parent whose only child cluster dissolved still has rows beneath it, they
  just render flat.
- **Multiple dissolved siblings at one level stay separate nodes.** Do not merge them into one
  residual node: merging is expressible with a comparator that ties them, un-merging is not
  recoverable once the engine has collapsed them (`design-group-admission.md` § Multiple dissolved
  clusters at one level stay separate). Under the default partition they land adjacent anyway.
- **Row sorting is unaffected.** `sort` runs after `group` in `PIPELINE_ORDER` and the `'group'`
  render stage re-clusters after it, so rows inside a flat region sort exactly like grouped rows
  (S-G2, D5). Nothing in this step touches that.
- **The prune stage (ADR-0017) needs nothing.** A dissolved cluster's rows carry the *parent's*
  id as `parentId`, so collapsing the parent hides them, which is correct — they are still that
  parent's rows.

## Risks / Watchouts

- **`depth`, not `depth + 1`, is the whole point.** Getting this wrong produces rows indented as if
  under a header that was never drawn — the exact artifact the "UI-level don't-render" approach was
  rejected for.
- **Do not descend into a dissolved node's children anywhere.** Three call sites, one rule. A
  half-applied Q1 renders a row twice at ambiguous depth — the counter-case that was checked and
  rejected when Q1 was decided.
- **`buildGroupRenderRows`'s null-data throw must stay reachable.** The dissolved-node early return
  comes *after* the tree is built, so the accessor guard still runs on every row.

## Non-Goals

- No `config.groupWhen`, so no behaviour change is observable from this PR alone — Step 3.
- No labelling of the flat region (Q2: ship nothing in v1; the escape hatch is admitting the
  cluster and styling its header).
- No per-column predicate — #86.

## Acceptance Checks

- [ ] A node marked `admitted: false` emits its leaves at the parent's depth, carrying the parent's
      `parentId`, with no header row.
- [ ] No group id is minted for a dissolved cluster — neither in `emitGroupRows` nor in
      `collectGroupIds`.
- [ ] `computeAggregates` is not called for a dissolved cluster.
- [ ] A dissolved cluster's leaves are not sub-clustered by any deeper level (Q1).
- [ ] `flattenLeaves` and `emitGroupRows` agree on which rows a dissolved cluster contributes and
      in what order.
- [ ] With every node admitted, `renderRows()` output is byte-identical to before this step.
- [ ] `nx run shared-table:typecheck` clean, on a source-clean run.
- [ ] `shared-table` suite green in CI on the PR, with no existing assertion changed. Not run
      locally; the byte-identical claim above is unverified until it passes.

---
← [Step 1: ClusterSummary and the admitted flag](step-1-cluster-summary-admission-flag.plan.md) | [Step 3: Wire config.groupWhen](step-3-wire-group-when-config.plan.md) →
