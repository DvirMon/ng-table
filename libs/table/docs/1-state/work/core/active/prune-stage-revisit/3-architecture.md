# Architecture — tree-shaped render IR (#105)

Consumed by `/to-tasks`. Grounded against the source at commit `4930ddf`.
Spec: [`2-spec.md`](2-spec.md) · decisions: [`1-decisions.md`](1-decisions.md).

Unlike the spec, this file names exact paths, types and snippets. It goes stale on
purpose — it is read once, during implementation.

## Settled — not open for relitigation

| #   | Decision                                                                             | Source |
| --- | ------------------------------------------------------------------------------------ | ------ |
| 1   | The tree IR is the chosen alternative; alt-1 and "keep as shipped" are rejected      | A1     |
| 2   | `RENDER_ORDER = ['group', 'tree']` — `'prune'` and `'paginate'` both leave           | B1     |
| 3   | The engine ships `mapNodes`; no stage hand-writes a walk                             | C1     |
| 4   | `RenderNode.hasChildren` is an explicit optional override, not a predicate parameter | C3     |
| 5   | `isExpanded` stamped uniformly by the walk, on every node with children              | D1     |
| 6   | Stamped only when a feature contributed the slot (`expanded !== undefined`)          | D1a    |
| 7   | A new ADR supersedes ADR-0017 **D2 only**; ADR-0020 is edited in place               | G1, G3 |
| 8   | #105 lands before #101                                                               | F1     |

## Current source — what each file does today

| File                                                 | Today                                                                                                                                                                                               | After                                                                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `libs/table/src/engine/render-stages.ts`             | `RENDER_ORDER` (4 entries), `StagedRow`, `RenderRowTransform`, `RenderStages` (with `Exclude`), `CLAIMABLE_RENDER_STAGES`, `pruneUnexpandedDescendants`, `runRenderStages(rows, stages, expanded?)` | `RenderNode`, `RenderNodeTransform`, `RENDER_ORDER` (2 entries), `RenderStages`, `mapNodes`, `runRenderStages(nodes, stages)` |
| `libs/table/src/engine/flatten.ts`                   | —                                                                                                                                                                                                   | **new**: `FlatRenderRow`, `flattenVisible`                                                                                    |
| `libs/table/src/engine/rows.ts:26`                   | `buildDefaultRenderRows` → flat `StagedRow[]` with `depth: 0`                                                                                                                                       | `buildDefaultRenderNodes` → `RenderNode[]` with `children: []`                                                                |
| `libs/table/src/engine/core.ts:88`                   | `runRenderStages(seedRenderRows(rows()), renderStages, expanded())` then `.map` stamps `index`/`sourceIndex`/`cells`                                                                                | `runRenderStages(seed, renderStages)` → `flattenVisible(tree, expanded())` → same `.map`                                      |
| `libs/table/src/engine/compose-table.ts:104`         | `for (const stage of CLAIMABLE_RENDER_STAGES)`                                                                                                                                                      | `for (const stage of RENDER_ORDER)`                                                                                           |
| `libs/table/src/api/features/compose-features.ts:51` | same                                                                                                                                                                                                | same                                                                                                                          |
| `libs/table/src/engine/grouping/render.ts:79`        | `emitGroupRows` — flat, stamps `depth`/`parentId`/`hasChildren`                                                                                                                                     | `buildGroupNodes` — nested, stamps none of the three                                                                          |
| `libs/table/src/api/features/with-expansion.ts:100`  | `buildTreeStage(trackBy, expandedRows, childrenAccessor, isExpandable)` — flattens children as siblings, reads `expandedRows`                                                                       | `buildTreeStage(trackBy, childrenAccessor, isExpandable)` — nests children, reads no state                                    |
| `libs/table/src/api/types.ts:33`                     | `RenderRow`                                                                                                                                                                                         | unchanged in shape; two field comments rewritten                                                                              |

`engine/cells.ts`, `engine/pipeline.ts`, `engine/columns.ts`, `engine/slots.ts`,
`engine/grouping/clusters.ts` and every `with-*` feature other than `withExpansion()` and
`withGrouping()` are untouched.

## Types

### `engine/render-stages.ts`

```ts
/** Engine-internal render IR. Never exported from `index.ts`. `depth`, `parentId`,
 *  `index`, `sourceIndex`, `cells` and `isExpanded` are all derived or stamped later —
 *  a node states structure, never position. */
export interface RenderNode<TRow> {
  readonly id: RowId;
  readonly kind: RowKind;
  readonly data: TRow | null;
  readonly groupKey?: { columnId: string; value: unknown; label: string };
  readonly aggregates?: Record<string, unknown>;
  /** Overrides the walk's `children.length > 0` derivation. Set it `true` for a lazy row
   *  whose children have not loaded yet, so its toggle renders (C3). */
  readonly hasChildren?: boolean;
  readonly children: readonly RenderNode<TRow>[];
}

export const RENDER_ORDER = ['group', 'tree'] as const;
export type RenderStage = (typeof RENDER_ORDER)[number];

export type RenderNodeTransform<TRow> = (
  nodes: readonly RenderNode<TRow>[],
) => readonly RenderNode<TRow>[];

export type RenderStages<TRow> = Partial<Record<RenderStage, RenderNodeTransform<TRow>>>;
```

`RenderStages` no longer needs `Exclude<…>`: every key of `RENDER_ORDER` is claimable, which
is the whole point of B1.

### `engine/flatten.ts`

```ts
/** What the walk produces. `index`, `sourceIndex` and `cells` are stamped centrally in
 *  `engine/core.ts` after it runs (ADR-0011 D5, ADR-0022). */
export type FlatRenderRow<TRow> = Omit<RenderRow<TRow>, 'index' | 'sourceIndex' | 'cells'>;
```

`StagedRow` is deleted. `FlatRenderRow` additionally drops `sourceIndex`, which `StagedRow`
carried but no stage ever set.

## Functions

### `mapNodes` — `engine/render-stages.ts`

```ts
/**
 * Post-order walk: `fn` sees a node whose `children` are already mapped, and its return
 * value is used as-is — never re-descended. The engine owns this recursion so a stage
 * cannot forget to reach nodes nested under another stage's output (C1/C2).
 */
export function mapNodes<TRow>(
  nodes: readonly RenderNode<TRow>[],
  fn: (node: RenderNode<TRow>) => RenderNode<TRow>,
): readonly RenderNode<TRow>[] {
  return nodes.map((node) =>
    fn(node.children.length === 0 ? node : { ...node, children: mapNodes(node.children, fn) }),
  );
}
```

`fn` returns one node, not an array — a stage that adds rows nests them (simplest signature
that covers every verified case; sibling insertion is exactly the flat shape being removed).

### `runRenderStages` — `engine/render-stages.ts`

```ts
export function runRenderStages<TRow>(
  nodes: readonly RenderNode<TRow>[],
  stages: RenderStages<TRow>,
): readonly RenderNode<TRow>[] {
  return RENDER_ORDER.reduce<readonly RenderNode<TRow>[]>(
    (current, stage) => stages[stage]?.(current) ?? current,
    nodes,
  );
}
```

No `expanded` parameter, no branch. The reduce no longer special-cases its own order array.

### `flattenVisible` — `engine/flatten.ts`

```ts
/**
 * Depth-first walk producing the flat render rows a template consumes. The only reader of
 * expansion state and the only producer of `depth` and `parentId`.
 *
 * `expanded === undefined` means no feature contributed the slot — everything is open and
 * `isExpanded` is left unstamped. A defined-but-empty set means a feature contributed and
 * nothing is open, so every nested row hides (X1/D1a). The two are never conflated into a
 * `size === 0` check.
 */
export function flattenVisible<TRow>(
  nodes: readonly RenderNode<TRow>[],
  expanded: ReadonlySet<RowId> | undefined,
): FlatRenderRow<TRow>[] {
  const out: FlatRenderRow<TRow>[] = [];

  const walk = (node: RenderNode<TRow>, depth: number, parentId: RowId | undefined): void => {
    const hasChildren = node.hasChildren ?? node.children.length > 0;
    const isOpen = expanded === undefined || expanded.has(node.id);
    out.push({
      id: node.id,
      kind: node.kind,
      data: node.data,
      depth,
      parentId,
      groupKey: node.groupKey,
      aggregates: node.aggregates,
      hasChildren,
      isExpanded: expanded !== undefined && hasChildren ? isOpen : undefined,
    });
    if (isOpen) {
      node.children.forEach((child) => walk(child, depth + 1, node.id));
    }
  };

  nodes.forEach((node) => walk(node, 0, undefined));
  return out;
}
```

Three details a reviewer will look for:

- **Descent is `isOpen` alone**, not `isOpen && hasChildren`. An explicit
  `hasChildren: true` on a lazy row with an empty `children` array must not suppress a
  descent that would be a no-op anyway, and must not gate a later-loaded array.
- **`isExpanded` needs both conditions** — a contributed slot _and_ children. Dropping the
  first invents expansion state on a grouping-only table (D1a).
- **`hasChildren` is always stamped now**, on every row, where today it is `undefined` on a
  data row unless `withExpansion()` is composed. `false` on a leaf is additive.

### `buildDefaultRenderNodes` — `engine/rows.ts`

```ts
export function buildDefaultRenderNodes<TRow>(
  trackBy: TrackByFn<TRow>,
): (rows: TRow[]) => RenderNode<TRow>[] {
  return (rows) => rows.map((row) => ({ id: trackBy(row), kind: 'row', data: row, children: [] }));
}
```

`depth: 0` is gone from the seed — the walk assigns it.

### `core.ts`'s `renderRows`

```ts
const renderRows = computed(() => {
  const byId = indexById();
  const resolvedColumns = columns();
  const reportedColumns = new Set<string>();
  const tree = runRenderStages(seedRenderNodes(rows()), renderStages);
  return flattenVisible(tree, expanded()).map((row, index) => {
    const isSynthesizedRow = row.data === null;
    return {
      ...row,
      index,
      sourceIndex: isSynthesizedRow ? undefined : byId.get(row.id),
      cells: isSynthesizedRow
        ? buildGroupCells(row.aggregates)
        : buildDataCells(row.data, resolvedColumns, reportedColumns),
    };
  });
});
```

The `.map` body is byte-identical to today's. `expanded` (the union computed,
`core.ts:57`) moves from a `runRenderStages` argument to a `flattenVisible` argument;
`expandedSources` and the union logic are unchanged.

## Stage rewrites

### `'group'` — `engine/grouping/render.ts`

`emitGroupRows` becomes `buildGroupNodes`: same depth-first cluster walk, but it returns
nested nodes instead of a flat sequence, and loses `depth`, `parentId` and the
`hasChildren: node.items.length > 0` stamp (D2 — the walk now derives it from
`children.length`).

```ts
function buildGroupNodes<TRow>(
  nodes: ClusterNode<RenderNode<TRow>>[],
  parentPath: string,
  columns: ColumnDef<TRow>[],
  reportedColumns: Set<string>,
  labelByColumn: ReadonlyMap<string, string> | undefined,
): RenderNode<TRow>[] {
  return nodes.flatMap((node) => {
    if (!node.admitted) {
      return node.items; // inlined at the parent's level — was a
    } // `depth`/`parentId` re-stamp
    const path = buildGroupPath(parentPath, node.columnId, node.value);
    const header: RenderNode<TRow> = {
      id: toGroupId(path),
      kind: 'group',
      data: null,
      groupKey: {
        /* unchanged */
      },
      aggregates: computeAggregates(/* unchanged */),
      children:
        node.children.length > 0
          ? buildGroupNodes(node.children, path, columns, reportedColumns, labelByColumn)
          : node.items, // was `.map(item => ({...item, depth, parentId}))`
    };
    return [header];
  });
}
```

`buildGroupRenderRows`'s exported signature keeps its name and parameter list; only its
element type changes (`StagedRow<TRow>[]` → `RenderNode<TRow>[]`). Its `isRowData` guard and
the "group stage must run first" throw are unchanged (X6) — grouping still runs first and
still receives the flat seed, whose every node has `data !== null` and `children: []`.

`admitClusters` / `sortClusters` / `buildClusters` are generic over the item type and need no
change.

### `'tree'` — `api/features/with-expansion.ts`

```ts
function toChildNode<TRow>(
  row: TRow,
  trackBy: TrackByFn<TRow>,
  childrenAccessor: (row: TRow) => TRow[] | undefined,
  isExpandable: (row: TRow) => boolean,
): RenderNode<TRow> {
  const children = childrenAccessor(row);
  return {
    id: trackBy(row),
    kind: 'row',
    data: row,
    hasChildren: isExpandable(row),
    children: hasNonEmptyChildren(children)
      ? children.map((child) => toChildNode(child, trackBy, childrenAccessor, isExpandable))
      : [],
  };
}

function buildTreeStage<TRow>(
  trackBy: TrackByFn<TRow>,
  childrenAccessor: (row: TRow) => TRow[] | undefined,
  isExpandable: (row: TRow) => boolean,
): RenderNodeTransform<TRow> {
  return (nodes) =>
    mapNodes(nodes, (node) => {
      if (node.data === null) {
        return node; // a group header — pass through
      }
      const children = childrenAccessor(node.data);
      return {
        ...node,
        hasChildren: isExpandable(node.data),
        children: hasNonEmptyChildren(children)
          ? children.map((c) => toChildNode(c, trackBy, childrenAccessor, isExpandable))
          : node.children,
      };
    });
}
```

Two things disappear with this rewrite:

- The `expandedRows: Signal<Set<RowId>>` parameter, and with it the whole "read the signal
  _inside_ the returned transform, not at declaration time" hazard its JSDoc documents. The
  stage reads no state at all now.
- `expandRow`'s hand-written recursion, replaced by `mapNodes` — which is what lets the stage
  reach data leaves nested under group nodes, something today's version cannot do (C1).

The spec's `renderStages.tree` registration in `buildExpansionSpec` drops the
`expandedRows` argument; `spec.expandedRows` (the read-only contribution) is unchanged —
ADR-0017 D3 stands.

`collectExpandableRowIds` (used by `expandAll()`) is untouched — it walks raw `TRow`s, not
render rows.

## File layout

```
libs/table/src/engine/
  render-stages.ts       RenderNode, RenderNodeTransform, RENDER_ORDER,
                         RenderStages, runRenderStages, mapNodes
  render-stages.spec.ts  fold order, pass-through, mapNodes reach     (rewritten)
  flatten.ts             FlatRenderRow, flattenVisible                (new)
  flatten.spec.ts        the whole visibility rule                    (new)
```

Chosen over a single file (`render-stages.ts` would hold four concerns) and over an
`engine/render/` folder (ADR-0004: promote on evidence, never anticipation — ~200 lines is
thin for a folder). `flatten.ts` earns its own file because visibility is its own domain
and its spec is the one place "why is this row hidden" is answered.

## Call-site checklist

Every site that must change, from the `prune` / `RENDER_ORDER` / `StagedRow` sweep:

| Path                                                             | What                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `engine/render-stages.ts:8,14,16,26,32,44,77`                    | The whole file                                                         |
| `engine/flatten.ts`                                              | New                                                                    |
| `engine/rows.ts:2,26,28`                                         | `StagedRow` import; seed rename and shape                              |
| `engine/core.ts:25,53,88`                                        | Comment on `expandedSources`; comment on `expanded`; `renderRows` body |
| `engine/compose-table.ts:5,104`                                  | Import and fold                                                        |
| `api/features/compose-features.ts:4,51`                          | Import and fold                                                        |
| `engine/grouping/render.ts:2,15,76,80,87,94,121,127,131,139,144` | Node rewrite + JSDoc                                                   |
| `api/features/with-expansion.ts:4,82,91,104-131,247`             | Node rewrite + JSDoc                                                   |
| `api/types.ts:57,60,71`                                          | `isExpanded` / `hasChildren` / `parentId` field comments               |
| `engine/types.ts:65,72`                                          | `renderStages` and `expandedRows` slot docs                            |

Specs: `engine/render-stages.spec.ts` (rewrite), `engine/grouping/render.spec.ts`
(`depth`/`parentId` assertions move out; lines 86, 101, 146 are the affected cases),
`api/features/with-expansion.spec.ts` (add C3 lazy case, adjust C4), `engine/core.spec.ts:4,49`
(`RenderRowTransform` import in the fake stage), `engine/compose-table.spec.ts:187,219`
(comment wording), `api/features/compose-features.spec.ts:466-472` (comment wording),
`api/features/with-grouping/feature.spec.ts:1317` (comment wording).

Docs and stories:

| Path                                                                         | What                                                                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `libs/table/docs/adr/00XX-…md`                                               | New ADR — next free number is **0023**                                                                                          |
| `libs/table/docs/adr/0017-…md`                                               | `supersedes` marker on D2; D1's "stamped by each stage" → "derived by the walk"                                                 |
| `libs/table/docs/adr/0011-…md`                                               | Amend D2's `RENDER_ORDER` literal and the `RenderRowTransform` snippet                                                          |
| `libs/table/docs/adr/0020-…md`                                               | Drop D3, the emission-order half of D5, and `'paginate'`/`'prune'` from D2's anchor set                                         |
| `libs/table/CLAUDE.md:63,65,210,245`                                         | `render-stages.ts` row in the file table; `rows.ts` row; the "add a render stage" rule; the `withGrouping()`/ADR-0017 paragraph |
| `libs/table/docs/1-state/architecture.md:158`                                | "entirely the engine-owned `'prune'` render stage's job"                                                                        |
| `libs/table/src/stories/grouping/grouping-collapsible/…component.html:77,79` | `table.expandedRows().has(row.id)` → `row.isExpanded` (D1/D3)                                                                   |
| `libs/table/src/stories/grouping/grouping-collapsible/…component.ts:25`      | The JSDoc sentence describing the split                                                                                         |
| `libs/table/src/stories/grouping/grouping.mdx:427`                           | Same paragraph                                                                                                                  |
| `llms.txt`                                                                   | Regenerate (`npm run llms`); `npm run llms:check` must stay clean                                                               |

## Open questions

1. **ADR-0020 D2's post-flatten anchor.** B2 leaves the anchor set with no name meaning
   "after the tree is flattened". Adding one deliberately vs. stating there is none is #102's
   call, not this slice's — but the edit to D2 has to say which. Flagged for whoever grills
   #102.
2. **ADR number.** 0023 is next free at `4930ddf`; confirm nothing else claims it before the
   branch lands.
3. **`buildGroupRenderRows` name.** It now returns nodes, not render rows. Renaming it
   (`buildGroupRenderNodes`) is a one-call-site change with a spec-file rename attached;
   left to the implementer's judgment, not a decision this doc makes.
