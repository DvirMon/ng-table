# Alt (axis 2) — stages exchange a tree; flattening replaces the prune

**Status:** exploration prototype, 2026-09-17. Revisits [ADR-0017](../../../../../adr/0017-engine-owned-descendant-prune.md)
at the data-model level, not the scheduling level. Peer: `alt-1-terminal-finalize.md`.

## Today — the state this replaces

Reference snapshot of the shipped design (`#98`), so the prototype below reads as a diff.

### Flow

```
data()
  └─ runPipeline            filter / sort            → TRow[]
  └─ buildDefaultRenderRows { id, depth: 0, kind }    → flat RenderRow[]
  └─ RENDER_ORDER.reduce
       'group'   claimable  emitGroupRows()           stamps depth + parentId
       'tree'    claimable  buildTreeStage()          stamps depth + parentId
       'prune'   ENGINE     pruneUnexpandedDescendants()  filters the flat list
       'paginate'           unclaimed — reserved name only
  └─ core.ts terminal map   stamps index + sourceIndex
```

Everything between stages is a **flat** `Omit<RenderRow<TRow>, 'index'>[]`.

### Each synthesizer flattens and stamps by hand

`engine/grouping.ts` — depth-first walk, emits header then descendants, each carrying the
parent's id:

```ts
function emitGroupRows<TRow>(nodes, depth, path, columns, reportedColumns, parentId?) {
  return nodes.flatMap((node) => {
    if (!node.admitted) {
      return node.items.map((item) => ({ ...item, depth, parentId }));
    }
    const id = groupId(path, node);
    return [
      { id, depth, kind: 'group', data: null, hasChildren: node.items.length > 0, parentId, … },
      ...(node.children.length
        ? emitGroupRows(node.children, depth + 1, path, columns, reportedColumns, id)
        : node.items.map((item) => ({ ...item, depth: depth + 1, parentId: id }))),
    ];
  });
}
```

`api/features/with-expansion.ts` — same shape for nested children:

```ts
function toChildRenderRow(row, depth, trackBy, parentId) {
  return { id: trackBy(row), depth, kind: 'row', data: row, parentId };
}
// buildTreeStage() recurses at row.depth + 1, each child carrying row.id
```

Neither reads expansion state any more. Both must remember to stamp `depth` **and** `parentId`
correctly, and to emit a parent immediately before its descendants.

### The prune undoes what was just emitted

```ts
function pruneUnexpandedDescendants<TRow>(rows, expanded) {
  if (expanded === undefined) return rows;          // no contributor ⇒ pass-through
  const hidden = new Set<RowId>();
  return rows.filter((row) => {
    const hasHiddenParent =
      row.parentId !== undefined &&
      (hidden.has(row.parentId) || !expanded.has(row.parentId));
    if (hasHiddenParent) { hidden.add(row.id); return false; }
    return true;
  });
}
```

Correct **only** because parents are emitted immediately before their descendants — a single
forward pass with one `hidden` accumulator, no upward climb. That invariant is unchecked.

### What keeps `'prune'` out of feature hands

```ts
export const RENDER_ORDER = ['group', 'tree', 'prune', 'paginate'] as const;

export type RenderStages<TRow> = Partial<
  Record<Exclude<RenderStage, 'prune'>, RenderRowTransform<TRow>>
>;

export const CLAIMABLE_RENDER_STAGES = RENDER_ORDER.filter(
  (stage): stage is Exclude<RenderStage, 'prune'> => stage !== 'prune'
);

// runRenderStages' reduce special-cases its own order array:
if (stage === 'prune') return pruneUnexpandedDescendants(current, expanded);
```

Four constructs whose only job is to say "this entry is not a feature."

### What is already fine and is not revisited

- `RenderRow.parentId` exists — the decoupling itself. Grouping no longer reads expansion.
- Collapse state stays in the feature; the engine gets a read-only contributed signal (D3).
- The `expandedRows` slot accumulates rather than single-claims (D4), for ADR-0012.
- Detail panels were never render rows — consumer-gated via `everExpanded`.

---

## Premise

Today's awkward parts — a `parentId` field nothing validates, an unchecked "parent must be emitted
immediately before its children" rule, and a whole pass whose only job is to undo emission — are
all the price of one choice: **the intermediate representation between render stages is flat.**

Make it a tree and hiding stops being an operation. A collapsed node is simply not descended into.

## Public contract: unchanged, both ends

- **In:** consumer passes flat `data` (plus `childrenAccessor` as today). No nested input.
- **Out:** `renderRows` is still a flat `RenderRow<TRow>[]` with `index`, `depth`, `parentId`.
- `RenderNode` is engine-internal, never exported from `index.ts`.

This is a change of intermediate representation only.

## Prototype

### The internal node

```ts
// engine/render-node.ts — internal, not exported from the barrel
export interface RenderNode<TRow> {
  readonly id: RowId;
  readonly kind: RowKind;
  readonly data: TRow | null;
  readonly groupKey?: { columnId: string; value: unknown };
  readonly aggregates?: Record<string, unknown>;
  readonly children: readonly RenderNode<TRow>[];   // [] for a leaf
}
```

Gone from the node: `depth`, `parentId`, `index`, `hasChildren`, `isExpanded` — every one is
derivable from position in the tree, and is stamped during flatten.

### The stage signature

```ts
export type RenderNodeTransform<TRow> =
  (nodes: readonly RenderNode<TRow>[]) => readonly RenderNode<TRow>[];

export const RENDER_ORDER = ['group', 'tree'] as const;   // claimable stages only
```

No `'prune'`, no `Exclude<…>`, no `CLAIMABLE_RENDER_STAGES`, no `expanded` parameter.

### A synthesizer — grouping

Before: emit header, then decide whether to emit members, by reading expansion state.
After: nest them. No decision, no state read.

```ts
function groupStage(nodes: readonly RenderNode<TRow>[]): readonly RenderNode<TRow>[] {
  return clusters().map((cluster) => ({
    id: groupId(cluster),
    kind: 'group',
    data: null,
    groupKey: cluster.key,
    children: cluster.members,      // ← always. Visibility is not grouping's business.
  }));
}
```

### The flatten — the only place expansion is read

```ts
// engine/flatten.ts
export function flattenVisible<TRow>(
  nodes: readonly RenderNode<TRow>[],
  expanded: ReadonlySet<RowId> | undefined      // undefined = no contributor ⇒ all open
): Omit<RenderRow<TRow>, 'index' | 'sourceIndex'>[] {
  const out: Omit<RenderRow<TRow>, 'index' | 'sourceIndex'>[] = [];

  const walk = (
    node: RenderNode<TRow>,
    depth: number,
    parentId: RowId | undefined
  ): void => {
    const isOpen = expanded === undefined || expanded.has(node.id);
    out.push({
      id: node.id,
      kind: node.kind,
      data: node.data,
      depth,
      parentId,
      groupKey: node.groupKey,
      aggregates: node.aggregates,
      hasChildren: node.children.length > 0,
      isExpanded: node.children.length > 0 ? isOpen : undefined,
    });
    if (isOpen) {
      node.children.forEach((child) => walk(child, depth + 1, node.id));
    }
  };

  nodes.forEach((node) => walk(node, 0, undefined));
  return out;
}
```

That `if (isOpen)` is the entire feature. There is no hide, no filter, no second pass.

### `core.ts`

```ts
const renderRows = computed(() => {
  const byId = indexById();
  const tree = runRenderStages(seedRenderNodes(rows()), renderStages);
  return flattenVisible(tree, expanded()).map((row, index) => ({
    ...row,
    index,
    sourceIndex: row.data === null ? undefined : byId.get(row.id),
  }));
});
```

## Why the awkward parts disappear

| Today | Here |
|---|---|
| `parentId` stamped by each synthesizer; forget it ⇒ silently unprunable row | derived by the walk; cannot be forgotten |
| `depth` stamped by each synthesizer; can disagree with `parentId` | derived; cannot disagree |
| "parent emitted immediately before its children" — unchecked, load-bearing | structural; a child is *inside* its parent, so it cannot be mis-ordered |
| `'prune'` stage + `Exclude` + `CLAIMABLE_RENDER_STAGES` + reduce special-case | none |
| `hasChildren` a feature must remember to set | `children.length > 0` |
| Union of contributed sets, read by a filter pass | same union, read by the walk |

Unchanged: collapse state stays in the feature (D3), the contributed `expandedRows` slot still
accumulates (D4), grouping still never reads expansion.

## The two collapse models

- **Tree / group collapse** — hides *rows*. Exactly what the walk handles.
- **Detail panel** — never was a render row. `with-expansion.ts` exposes `everExpanded`; the
  consumer gates mounting a panel in their own template. It never entered the prune and never
  enters the flatten. Nothing to support.

Under [ADR-0012](../../../../../adr/0012-split-expansion-into-panel-and-tree.md)'s split, panel and
tree keep separate open-id sets; both contribute, the walk reads the union. Identical to today.

## Cost

- `RenderRowTransform` → `RenderNodeTransform`: both synthesizers (`engine/grouping.ts`, the tree
  stage in `with-expansion.ts`) rewritten to nest rather than flatten-and-stamp.
- `render-stages.spec.ts` rewritten; `core.spec.ts`, `grouping.spec.ts`, `with-expansion.spec.ts`
  assertions on `parentId`/`depth` still pass — those fields survive on `RenderRow`.
- Recursive walk instead of a single forward pass. Same O(n); stack depth = nesting depth.
- Behavior-neutral, so spec-132 story 21 still applies as the gate.
- Largest diff of the three options, and the only one that removes the problem rather than
  relocating it.

## Open question

Does any future stage need to run *between* synthesis and flatten on already-flat rows? If yes,
that stage sees a tree instead and must recurse. No such stage exists today, and `'paginate'`
(unclaimed) belongs after flatten either way.
