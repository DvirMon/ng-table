# Step 3 test plan — Group queries follow the root

Step: [step-3-group-queries-follow-root.plan.md](step-3-group-queries-follow-root.plan.md)
Spec file: `libs/table/src/engine/grouping/queries.spec.ts`
Fixture: reuses step 2's `treeOrders`, `treeOrderColumns` and `treeOrderLinks` from `grouping.mock.ts`.

## Stubs (red phase)

- `rowsBeneathGroup(..., opts?: Pick<ClusterOpts<TRow>, 'extractValueByColumn' | 'treeLinks'>)` (type-only widening).

## Seams — in red-green order

### D. `rowsBeneathGroup` with links returns the whole subtree (D14 count)

- Test: `it('with treeLinks, a group id resolves every node beneath it, descendants included')`
- Asserts: `rowsBeneathGroup(treeOrders, ['region'], treeOrderColumns, 'group:>region:string:US', treeOrderLinks).map(r => r.id)` equals `[1, 3, 4, 5]`.
- Why this seam: `rowsOf` and the group count depend on it. It catches the widened `Pick` accepting the links but not passing them to `buildClusterNodes`. That bug returns `[1, 3]`, so the count disagrees with select-all.
- Order reason: builds on step 2 (root resolution in buildClusterNodes).

### F. `collectGroupIds` with links: no header id comes from a descendant's own value

- Test: `it('with treeLinks, collects only group ids that roots produce at every level')`
- Asserts: `collectGroupIds(treeOrders, ['region', 'category'], treeOrderColumns, treeOrderLinks)` equals:
  `['group:>region:string:US', 'group:>region:string:US>category:string:Electronics', 'group:>region:string:US>category:string:Books', 'group:>region:string:EU', 'group:>region:string:EU>category:string:Books']`.
- Why this seam: if links are not passed on here, you get an extra `EU>Electronics` id and different membership. "Expand all" would then seed an id that never renders.
- Order reason: builds on step 2 (root resolution in buildClusterNodes), including its multi-level ids.

### E. `collectAppliedLevels`: `when` admission counts descendants

- Test: `it('with treeLinks, when judges a cluster by every node in it, descendants included')`
- Asserts: `collectAppliedLevels(treeOrders, ['region'], treeOrderColumns, { ...treeOrderLinks, when: (s) => s.rows.length >= 4 })` equals `['region']`. With per-row values, US has 2 rows and EU has 3, so the result would be `[]`.
- Why this seam: catches `collectAppliedLevels` not passing the links on. `grouping()` / `isGroupedBy()` would then report a level as not applied even though the render shows it grouped.
- Order reason: builds on step 2 (root resolution in buildClusterNodes).

## Types phase (written in red, proven by green's typecheck)

None — no public type surface in this step. `ClusterOpts` and the `rowsBeneathGroup` opts are internal to the engine and not exported from `index.ts`.

## Not tested

- Without `treeLinks`, output is byte-identical to today. Every existing case in the grouping specs already passes opts without links.
- `resolveTreeLinks` itself belongs to its own module and spec.
- Duplicate row ids are out of scope (#156).
- Store-level `rowsOf` / `groupIds` / `grouping()` wiring — step 4.

## Resolved in planning

- `when` sees the full bucket, descendants included (matches D15).
