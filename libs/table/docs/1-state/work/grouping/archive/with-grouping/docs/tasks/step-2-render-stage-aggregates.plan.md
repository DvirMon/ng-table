---
title: "Step 2 — Render-stage group headers + per-depth aggregates"
type: task-step
issue: 6
---

# Step 2 — Render-stage group headers + per-depth aggregates

**PR scope:** Depends on Step 1's `ClusterNode`/`buildClusters`/`resolveGroupingLevels`. Same
file as Step 1 (`engine/grouping.ts`) — a sequential edit, not a new module.

**Task type:** code

**Skills used:** angular-developer, file-organization

**Scaffolding agent:** angular-implementer

**Depends on:** Step 1

## Files

- `libs/shared/table/src/engine/grouping.ts` (edit — add the render-stage builder)
- `libs/shared/table/src/engine/grouping.spec.ts` (edit — add render-stage cases)

## Why This Step Exists

The `'group'` render stage (`RENDER_ORDER`, `engine/render-stages.ts`) turns the already-
clustered rows into `RenderRow`s: a `kind: 'group'` header at every cluster boundary, at every
depth, with `aggregates` computed over that cluster's own leaf rows — never a descendant
cluster's already-computed aggregate (D9's two invariants). It reuses Step 1's `buildClusters`
so the tree it walks is built the same way the pipeline stage built it — no second, divergent
notion of "what's a cluster."

Spec: `../../3-spec.md` (D9's two invariants; the Render Layer section of
`../../../features/grouping.md`, "still current" per its superseded banner).

## What To Do

### 1. `computeAggregates` — per-cluster aggregate row

```ts
function computeAggregates<TRow>(
  rows: TRow[],
  columns: ColumnDef<TRow>[]
): Record<string, unknown> {
  const aggregates: Record<string, unknown> = {};
  for (const column of columns) {
    if (column.aggregateFn) {
      aggregates[column.id] = column.aggregateFn(rows);
    }
  }
  return aggregates;
}
```

`rows` here is always `node.items.map(item => item.data)` for a `ClusterNode` at that depth —
i.e. that node's own leaves. Never pass a child node's already-computed `aggregates` back in as
if it were rows; that's exactly the bug class D9 exists to avoid.

### 2. `emitGroupRows` — depth-first header + leaf walk

```ts
function emitGroupRows<TRow>(
  nodes: ClusterNode<Omit<RenderRow<TRow>, 'index'>>[],
  depth: number,
  parentPath: string,
  columns: ColumnDef<TRow>[]
): Omit<RenderRow<TRow>, 'index'>[] {
  return nodes.flatMap((node) => {
    const path = `${parentPath}>${node.columnId}:${toGroupKey(node.value)}`;
    const header: Omit<RenderRow<TRow>, 'index'> = {
      id: `group:${path}`,
      depth,
      kind: 'group',
      data: null,
      hasChildren: node.items.length > 0,
      aggregates: computeAggregates(
        node.items.map((item) => item.data as TRow),
        columns
      ),
    };
    const nested =
      node.children.length > 0
        ? emitGroupRows(node.children, depth + 1, path, columns)
        : node.items.map((item) => ({ ...item, depth: depth + 1 }));
    return [header, ...nested];
  });
}
```

`toGroupKey` is the same function Step 1 added — export it (or keep it module-private and reuse
directly, since both live in this one file) rather than re-deriving id serialization here.

### 3. `buildGroupRenderRows` — the `'group'` render-stage entry point

```ts
export function buildGroupRenderRows<TRow>(
  rows: Omit<RenderRow<TRow>, 'index'>[],
  grouping: readonly string[],
  columns: ColumnDef<TRow>[]
): Omit<RenderRow<TRow>, 'index'>[] {
  const levels = resolveGroupingLevels(grouping, columns);
  if (levels.length === 0) {
    return rows;
  }
  const columnById = new Map(columns.map((c) => [c.id, c]));
  const nodes = buildClusters(rows, levels, (item, columnId) =>
    columnById.get(columnId)!.accessor(item.data as TRow)
  );
  return emitGroupRows(nodes, 0, '', columns);
}
```

`'group'` runs first in `RENDER_ORDER` (`engine/render-stages.ts`), so its input is always the
plain 1:1 seed from `buildDefaultRenderRows` (`engine/rows.ts`) — every `item.data` is a real
`TRow`, never `null`. That's what makes `item.data as TRow` safe here without a guard.

### 4. `engine/grouping.spec.ts` — render-stage cases

- No grouping (`levels: []`): input rows pass through unchanged (still `Omit<RenderRow,'index'>`
  shape, `kind: 'row'`, `depth: 0`) — the "standalone, all clusters flat and always-expanded"
  acceptance check, exercised here at the pure-function level (Step 5 exercises it again through
  the public `createTable()` surface).
- One level: one `kind: 'group'` header per distinct value, immediately followed by that
  cluster's member rows at `depth: 1`.
- Two levels: nested headers at `depth: 0` and `depth: 1`, leaf rows at `depth: 2`; a header's
  `aggregates` reflects only its own subtree.
- **The depth-correctness case (issue #7's own acceptance criterion):** an `aggregateFn` where a
  parent aggregate computed over its own leaves differs from what it would be if computed over
  the mean/sum of its children's aggregates (e.g. an unweighted average with unequal cluster
  sizes per child — see Step 5's fixture data for the concrete numbers). Assert the parent
  header's `aggregates` matches the leaf-level computation, not the wrong one.
- Group header `id`s are unique across sibling parents that share a child-level value (e.g.
  `US > Electronics` and `EU > Electronics` must not collide).

## Implementation Notes

- `hasChildren: node.items.length > 0` is always `true` in practice — a `ClusterNode` is never
  constructed with zero items (the bucket that produced it had at least one row). Keep the field
  anyway; it's part of `RenderRow`'s existing public contract (already set by `withExpansion()`
  for tree rows) and a future `groupOrder`/empty-group scenario (#24) may change that invariant.
- This step does **not** read `expandedRows` — that optional read (`store.expandedRows?.()`) is
  #25's job. Every cluster renders fully expanded here, unconditionally.

## Risks / Watchouts

- Don't reconstruct the cluster tree independently for aggregates vs. for the header walk — one
  `buildClusters` call, one tree, both header insertion and `computeAggregates` read from the
  same `ClusterNode`. Two separate walks is how the "parent reads child aggregate" bug class
  creeps back in.

## Non-Goals

- No `groupOrder` (#24) — clusters emit in first-occurrence order, unconditionally.
- No collapse/expand (#25).
- `aggregateFn` itself stays unguarded (no `try`/`catch` around the consumer callback) — ADR-0014
  names this a cross-cutting retrofit not owned by any one feature; adding it here would be
  scope creep past this issue's acceptance criteria.

## Acceptance Checks

- [ ] `'group'` render stage inserts a `kind: 'group'` header at every cluster boundary, at
      every depth.
- [ ] A header's `aggregates` is computed over that cluster's own leaf rows only, verified by the
      parent-vs-child-aggregate depth case.
- [ ] Without grouping composed (or `grouping: []`), rows render flat, `depth: 0`, unchanged.
- [ ] Group header ids are unique across sibling parents sharing a child value.
- [ ] `tsc --noEmit` passes; `engine/grouping.spec.ts` passes under plain `vitest`.

---
← [Step 1: Pipeline clustering engine + shared types](step-1-pipeline-clustering.plan.md) | [Step 3: mutations/update-grouping.ts](step-3-update-grouping-mutations.plan.md) →
