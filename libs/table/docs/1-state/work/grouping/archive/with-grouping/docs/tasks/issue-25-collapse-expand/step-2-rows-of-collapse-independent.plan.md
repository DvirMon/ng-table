---
title: 'Step 2 — collapse-independent rowsBeneathGroup()'
type: task-step
issue: 59
---

# Step 2 — collapse-independent `rowsBeneathGroup()`

**PR scope:** One pure function rewritten in `engine/grouping.ts`, nothing wired.
**Parallel-safe with Step 1.**

**Task type:** code

**Skills used:** angular-developer, file-organization, typescript-conventions

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/engine/grouping.ts` (edit)

## Why This Step Exists

`rowsBeneathGroup()` (issue #31, shipped) currently resolves a group's leaves by scanning
`renderRows()` between a header and the next row at `depth <= header.depth`. Once Step 1 makes
`renderRows()` omit a collapsed group's descendants, that scan finds nothing between a collapsed
header and its next sibling and wrongly returns `[]` — `rowsOf()` would silently stop working the
moment a group is collapsed.

The product doc already specs the correct behavior:
`0-product/grouping.md` X-G1 — "When a filter is active and I tick a collapsed group, what I
select matches what the group's count says — I never select rows I cannot see and was never told
about." `rowsOf()` is exactly the primitive that recipe is built on (`2-decisions.md` D16), so it
must stay correct under collapse. This is a fix bundled into #25 (not a separate issue) because #25
is what introduces the collapse state that breaks it.

## What To Do

Replace the `renderRows()`-scanning walk with a cluster-tree lookup over the **pipeline** output
(`core.rows()` — unaffected by collapse, since collapse is render-only per Step 1):

```ts
function findClusterByPath<T>(
  nodes: ClusterNode<T>[],
  parentPath: string,
  targetId: RowId,
): ClusterNode<T> | undefined {
  for (const node of nodes) {
    const path = `${parentPath}>${node.columnId}:${toGroupKey(node.value)}`;
    if (`group:${path}` === targetId) {
      return node;
    }
    const found = findClusterByPath(node.children, path, targetId);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/**
 * Every leaf row beneath a group id, at any depth — D16's "leaf rows, not immediate children".
 * Re-derives the cluster tree from the pipeline's `TRow[]` (post-filter, post-group-clustering,
 * never affected by collapse) rather than scanning `renderRows()`, so a collapsed group still
 * resolves its full leaf set (`0-product/grouping.md` X-G1). An id matching no cluster returns
 * `[]` (D14 runtime degrade).
 */
export function rowsBeneathGroup<TRow>(
  rows: TRow[],
  grouping: readonly string[],
  columns: ColumnDef<TRow>[],
  groupId: RowId,
): TRow[] {
  const levels = resolveGroupingLevels(grouping, columns);
  if (levels.length === 0) {
    return [];
  }
  const columnById = new Map(columns.map((c) => [c.id, c]));
  const nodes = buildClusters(rows, levels, (row, columnId) =>
    columnById.get(columnId)!.accessor(row),
  );
  const node = findClusterByPath(nodes, '', groupId);
  return node ? flattenLeaves([node]) : [];
}
```

This is a **signature change**: `(rows: RenderRow<TRow>[], groupId)` →
`(rows: TRow[], grouping, columns, groupId)`. Both call sites (the feature member, Step 3; the
existing engine tests, Step 4) update to match.

## Implementation Notes

- **Re-clustering here is not a second source of truth.** `buildClusters` is a pure, deterministic
  partition by `(columnId, value)` — clustering `core.rows()` (already grouped by the pipeline
  stage) a second time produces the identical tree; it's redundant work, not redundant logic. D16
  already accepts "derived on call, never materialized" as the cost model — this keeps that,
  trading a `renderRows()` scan for a `buildClusters()` walk of comparable cost.
- **No `groupOrder` needed here.** `findClusterByPath` matches by `(columnId, value)` identity, not
  by sibling position — sort order is irrelevant to locating a node. Don't thread `groupOrder`
  through; it has nothing to do.
- **`flattenLeaves([node])` already handles both shapes** — a leaf node (`children.length === 0`)
  returns `node.items` directly; an interior node recurses into `children`. No branch needed at the
  call site.
- `id` construction here (`` `group:${path}` ``) must stay byte-identical to Step 1's — both build
  the same synthetic id from the same `(columnId, toGroupKey(value))` walk. If one changes, the
  other silently stops matching; there is no shared constant to enforce this today (pre-existing —
  `emitGroupRows` had the same duplication before this step).

## Risks / Watchouts

- **Don't feed `core.renderRows()` into this from Step 3.** The entire point is to read the
  pre-collapse pipeline shape (`core.rows()`). Wiring it to `renderRows()` "for consistency" would
  silently reintroduce the bug this step exists to fix.
- **This breaks every existing `rowsBeneathGroup` test** (`engine/grouping.spec.ts`'s hand-rolled
  `RenderRow[]` fixtures, e.g. `twoClusterFixture()`) — they construct ids like `'group:A'` that
  don't match the real `group:${path}` format and no longer compile against the new signature.
  Step 4 replaces that whole `describe` block; don't patch it in this step.

## Non-Goals

- No change to `emitGroupRows`/`buildGroupRenderRows` (Step 1 — separate function).
- No caching/memoization of the re-derived tree (D16 explicitly rejects a library-side cache).
- No tests in this step (Step 4).

## Acceptance Checks

- [ ] `rowsBeneathGroup(rows, grouping, columns, groupId)` returns every leaf beneath that group id
      at any depth, independent of any collapse/expansion state (it never reads `renderRows()` or
      `expandedRows`).
- [ ] An id matching no cluster returns `[]`, no throw.
- [ ] A `kind: 'row'`-shaped / non-group id (any string not built by `emitGroupRows`) returns `[]`.
- [ ] `tsc --noEmit` passes with no new errors.

---

[← Step 1: Render-stage collapse](step-1-render-stage-collapse.plan.md) | [Step 3: Wire withGrouping() →](step-3-wire-with-grouping.plan.md)
