---
title: "Step 1 — collapse-aware group render stage"
type: task-step
issue: 59
---

# Step 1 — collapse-aware group render stage

**PR scope:** Two pure functions in `engine/grouping.ts`, nothing wired to `withGrouping()` yet.
**Parallel-safe with Step 2.**

**Task type:** code

**Skills used:** angular-developer, file-organization, typescript-conventions

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/engine/grouping.ts` (edit)

## Why This Step Exists

`'group'` runs before `'tree'` in `RENDER_ORDER`, so grouping cannot lean on `withExpansion()`'s
tree-walking — by the time `'tree'` runs, grouping has already emitted its rows. Skipping
descendants of a collapsed group id has to be the `'group'` stage's own subtree walk.

Decision: `../../../2-decisions.md` D11. Spec: `../../../3-spec.md` D11, user story 18.

## What To Do

Thread an optional `expandedRows` set through `buildGroupRenderRows` into `emitGroupRows`:

```ts
function emitGroupRows<TRow>(
  nodes: ClusterNode<Omit<RenderRow<TRow>, 'index'>>[],
  depth: number,
  parentPath: string,
  columns: ColumnDef<TRow>[],
  expandedRows: ReadonlySet<RowId> | undefined
): Omit<RenderRow<TRow>, 'index'>[] {
  return nodes.flatMap((node) => {
    const path = `${parentPath}>${node.columnId}:${toGroupKey(node.value)}`;
    const id: RowId = `group:${path}`;
    const header: Omit<RenderRow<TRow>, 'index'> = {
      id,
      depth,
      kind: 'group',
      data: null,
      hasChildren: node.items.length > 0,
      aggregates: computeAggregates(
        node.items.map((item) => item.data).filter(isRowData),
        columns
      ),
    };
    const isExpanded = expandedRows === undefined || expandedRows.has(id);
    const nested = !isExpanded
      ? []
      : node.children.length > 0
        ? emitGroupRows(node.children, depth + 1, path, columns, expandedRows)
        : node.items.map((item) => ({ ...item, depth: depth + 1 }));
    return [header, ...nested];
  });
}

export function buildGroupRenderRows<TRow>(
  rows: Omit<RenderRow<TRow>, 'index'>[],
  grouping: readonly string[],
  columns: ColumnDef<TRow>[],
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number,
  expandedRows?: ReadonlySet<RowId>
): Omit<RenderRow<TRow>, 'index'>[] {
  // ...unchanged levels/columnById/nodes/ordered setup...
  return emitGroupRows(ordered, 0, '', columns, expandedRows);
}
```

`id` is factored into a local so the header build and the `isExpanded` check read the same value
instead of reconstructing the template string twice.

## Implementation Notes

- **`expandedRows === undefined` ⇒ unconditionally expanded.** This is the whole of the
  "`withExpansion()` not composed" regression (#7, unchanged) — Step 3 passes `undefined` when
  there is nothing to read.
- **Header always emits; only `nested` is gated.** A collapsed header must still render (it's what
  the consumer clicks to expand again) and still carries a real `hasChildren`/`aggregates` computed
  from `node.items` regardless of collapse — aggregates over a collapsed group are still shown
  (AG-Grid-shaped: collapsing hides rows, not the summary).
- **Do not stamp `isExpanded` on the header `RenderRow`.** Out of scope here — not in D11, not in
  the spec's Public Surface additions, and `api/types.ts`'s `isExpanded` comment ("Set only when
  `withExpansion()` is composed") stays accurate either way since nothing here writes it. Wiring a
  toggle UI to read a group header's own collapse state is UI-layer work tracked separately
  (`3-spec.md`, "Auto-wiring a header collapse-all/expand-all UI").
- The **pipeline** `group` stage (`clusterRows`) is untouched — collapse is a render-only concern.
  `rows()` always contains every row; only `renderRows()` omits descendants.

## Risks / Watchouts

- Don't gate on `hasChildren` instead of the `expandedRows` membership check — a childless header
  (`hasChildren: false`) must still pass through the same `isExpanded` branch (it just has nothing
  to omit either way); special-casing it adds a branch with no behavioral difference.
- Keep the recursive call passing `expandedRows` unchanged through every depth — a nested header
  three levels down must resolve its own membership independent of its ancestors' collapse state
  (a collapsed parent already prevents its children from being *emitted at all*, so no double
  gating is needed or correct).

## Non-Goals

- No wiring into `withGrouping()`'s `renderStages.group` (Step 3).
- No change to `rowsBeneathGroup` (Step 2 — separate function, separate concern).
- No tests in this step (Step 4).

## Acceptance Checks

- [ ] `buildGroupRenderRows(rows, grouping, columns, groupOrder, undefined)` behaves identically to
      the current (5-arg-minus-one) signature — full regression safety.
- [ ] Passing a `Set` that omits a header's id drops that header's descendants (headers and leaves)
      at every depth beneath it.
- [ ] Passing a `Set` that includes a header's id keeps its descendants, still gated by its own
      children's membership recursively.
- [ ] `tsc --noEmit` passes with no new errors.

---
[Step 2: Collapse-independent rowsOf →](step-2-rows-of-collapse-independent.plan.md)
