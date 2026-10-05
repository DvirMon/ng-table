# Step 2 test plan — Cluster by root value

Step: [step-2-cluster-by-root-value.plan.md](step-2-cluster-by-root-value.plan.md)
Spec files: `libs/table/src/engine/grouping/pipeline.spec.ts` (seams A, B, G),
`libs/table/src/engine/grouping/render.spec.ts` (seam C)
Fixture: `libs/table/src/engine/grouping/grouping.mock.ts`

## Stubs (red phase)

- `ClusterOpts<TRow>` gains
  `readonly treeLinks?: { readonly parentOf: ParentLink<TRow>; readonly trackBy: TrackByFn<TRow> }`
  (type-only).
- Fixture additions to `grouping.mock.ts`, written in red:
  - `interface TreeOrder extends Order { parentId: number | null }`
  - `treeOrders: TreeOrder[]`, in this input order:
    - `{1, null, US, Electronics}`
    - `{2, null, EU, Books}`
    - `{3, null, US, Books}`
    - `{4, 1, EU, Books}`: a child whose own region and category differ from its root's.
    - `{5, 4, EU, Electronics}`: a grandchild.
  - `brokenLinkOrders: TreeOrder[]`, in this input order:
    - `{6, parent 7, EU}`
    - `{8, parent 99, US}`: 99 is not in the data.
    - `{7, parent 6, US}`: 6 and 7 form a cycle. It breaks at 6, the first in input order, so 6 becomes the root.
  - `treeOrderColumns: ColumnDef<TreeOrder>[]` (id, region, category). It follows the same pattern as `orderColumns`.
  - `treeOrderLinks = { treeLinks: { parentOf: (r) => r.parentId, trackBy: (r) => r.id } }`
    (name it `treeOrderLinks`; every `{ ...treeOrderLinks, … }` spread stays valid.)

## Seams — in red-green order

### A. `clusterRows` with `treeLinks`: every row joins its root's region bucket, in input order

- Test: `it('with treeLinks, descendants join their root\'s cluster whatever their own value, in input order')`
- Asserts: `clusterRows(treeOrders, ['region'], treeOrderColumns, treeOrderLinks).map(r => r.id)` equals `[1, 3, 4, 5, 2]`.
- Why this seam: this is the core rule (D13). Two wrong implementations give different results:
  - reading each row's own value gives `[1, 3, 2, 4, 5]`;
  - putting each subtree right after its root gives `[1, 4, 5, 3, 2]`.
    So the test catches both "not following the root" and "not input order".
- Order reason: independent. It is the base case and brings in root resolution inside `buildClusterNodes` plus `clusterRows` passing the links on.

### B. Two levels: the deeper level also reads the root's value

- Test: `it('with treeLinks, every grouping level reads the root\'s value, not only the first')`
- Asserts: `clusterRows(treeOrders, ['region', 'category'], treeOrderColumns, treeOrderLinks).map(r => r.id)` equals `[1, 4, 5, 3, 2]`. Rows 4 and 5 sit under US > Electronics with their root.
- Why this seam: catches an implementation that swaps in the root only at level 0. That bug splits the subtree at `category` and gives `[1, 5, 3, 4, 2]` (4 lands in US > Books).
- Order reason: builds on A (same resolution, applied per level).

### G. Broken links resolve to root, so the row groups by its own value

- Test: `it('with treeLinks, a broken link (absent parent, cycle) makes that row a root grouped by its own value')`
- Asserts: `clusterRows(brokenLinkOrders, ['region'], treeOrderColumns, treeOrderLinks).map(r => r.id)` equals `[6, 7, 8]`.
  - 6 breaks the cycle, so it is a root, EU.
  - 7 follows 6, so EU, although its own value is US.
  - 8's parent is absent, so it groups by its own value, US.
- Why this seam: catches walking the raw `parentOf` instead of `resolveTreeLinks`' `parentById`:
  - on the cycle, that loops forever;
  - on the absent parent, it looks up a row that does not exist and gets an `undefined` bucket.
    Without the root logic the output is `[6, 8, 7]`.
- Order reason: builds on A (same resolution helper, broken-link input).

### C. `buildGroupRenderRows`: header leaves and `aggregateFn` rows include descendants

- Test: `it('with treeLinks, a header holds its root\'s whole subtree and aggregateFn receives every node in it (D15)')`
- Asserts: call it with `toSeedRenderRows(treeOrders)`, `['region']` and `treeOrderColumns`. Opts are `{ ...treeOrderLinks, aggregateByColumn: new Map([['id', (rows) => rows.map(r => r.id)]]) }`.
  - Top-level header ids are `['group:>region:string:US', 'group:>region:string:EU']`.
  - US `children` ids and `aggregates.id` are both `[1, 3, 4, 5]`.
  - EU `children` ids and `aggregates.id` are both `[2]`.
- Why this seam: the render stage clusters on its own path. It calls `buildClusters` directly over `RenderNode`s, not `buildClusterNodes`. It can therefore miss the links even when the pipeline honours them. It must also resolve roots from `item.data`. `aggregateFn` rows are the header's own items, so one bug breaks both assertions. That makes it one seam.
- Order reason: builds on A (reuses the root-resolution helper over a different item type).

## Types phase (written in red, proven by green's typecheck)

None — no public type surface in this step. `ClusterOpts` and the `rowsBeneathGroup` opts are internal to the engine and not exported from `index.ts`.

## Not tested

- Without `treeLinks`, output is byte-identical to today. Every existing case in the four grouping specs already passes opts without links, so any change to that path fails them.
- `groupOrder` sees descendants. `sortClusters` reads `node.items`, which A already asserts. There is no code path of its own, so the test would fail on the same bug as A.
- Self-parent. `resolveTreeLinks` maps it to `null` through the same branch as an absent parent, which G covers. `tree-links.spec` covers the break kinds themselves.
- Grouping does not report broken links. This is an absence of behaviour; `withTree`'s `'tree'` stage owns reporting.
- `clusterRows` and `buildGroupRenderRows` agreeing under links. A and C each assert an exact expected partition, so a separate agreement test would add nothing.
- `resolveTreeLinks` itself belongs to its own module and spec.
- Duplicate row ids are out of scope (#156).
- Store-level behaviour through `createTable()` (the spec's Testing Decisions seam 1) needs the `ctx.parentOf` wiring in `withGrouping`, which is step 4.
- Queries (`rowsBeneathGroup`, `collectGroupIds`, `collectAppliedLevels`) — step 3.

## Resolved in planning

- The link is one field, `treeLinks` (P3), so a half-set pair cannot be written.
- Rows in a bucket keep input order (P4). Seam A's `[1, 3, 4, 5, 2]` stands.
- How `buildClusterNodes` receives the link is green's choice.
