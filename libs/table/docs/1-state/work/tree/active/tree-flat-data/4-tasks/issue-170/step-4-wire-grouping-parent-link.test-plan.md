# Step 4 test plan — Wire the parent link into withGrouping()

Step: [step-4-wire-grouping-parent-link.plan.md](step-4-wire-grouping-parent-link.plan.md)
Spec file: `libs/table/src/api/features/with-grouping/feature.spec.ts`
(new `describe('parent link (#170)')` at the end of the file)

Shared fixture for every seam. It is a four-row task tree, grouped by `status`:

| id | status | parentId |
|---|---|---|
| `t1` | open | null |
| `t2` | done | — |
| `t1a` | done | `t1` |
| `t1a1` | blocked | `t1a` |

- The fixture lives in `libs/table/src/table.mock.ts` as `TaskTreeMockRow` / `mockTaskTreeRows`.
- Input order is `[t1, t2, t1a, t1a1]`. Clustering each row by its own value keeps that order and yields three clusters: open, done and blocked.
- Clustering by root value yields `[t1, t1a, t1a1, t2]` and two clusters: open and done.
- Columns are `status` (and `id`). Tables are built with `trackBy: 'id'`.
- Header ids are `group:>status:string:open` and `group:>status:string:done`.
- Tables are built with the existing `inContext` helper, and headers are found with `findHeader`.

## Stubs (red phase)
- None. The step creates no symbol that the tests import. Every test goes through the existing `createTable`, `withGrouping` and `withTree({ parentId })`. Before step 4, every seam fails on an assertion because `clusterOpts` ignores `ctx.parentOf`.

## Seams — in red-green order

### A. Pipeline `'group'` stage: a subtree clusters with its root, and descendants come right after the root
- Test: `it('pipeline group stage clusters by the root value: rows() clusters each subtree with its root')`
- Setup: `createTable(data, cfg, withGrouping({ initial: ['status'] }), withTree({ parentId: (r) => r.parentId }))`
- Asserts: `store.rows().map(r => r.id)` equals `['t1', 't1a', 't1a1', 't2']`
- Why this seam: it catches the pipeline stage's `clusterRows` call receiving no `treeLinks`. Without them, the output stays `['t1', 't2', 't1a', 't1a1']`.
- Order reason: independent. It is the base case, and it is the first test that forces `treeLinks` (built from `ctx.parentOf`, read lazily, and `input.trackBy`) into `clusterOpts`.

### B. Render `'group'` stage: a child nests under its root's group
- Test: `it('render group stage: a child whose own status differs renders under its root\'s header, nested under its parent')`
- Setup:
  - The composition from A.
  - `withTree({ parentId, initial: [openHeaderId, doneHeaderId, 't1', 't1a'] })`.
  - `initial` is used instead of `groupIds()` so that this test does not depend on seam D.
- Asserts:
  - `[kind, depth, id]` per render row equals `[group,0,openHeader] [row,1,t1] [row,2,t1a] [row,3,t1a1] [group,0,doneHeader] [row,1,t2]`.
  - There is no `blocked` header.
  - `t1a.parentId === 't1'`.
- Why this seam: it catches the `buildGroupRenderRows` call being wired without the parent link. Headers would then follow each row's own value: three headers, with `t1a` under `done` and `t1a1` under `blocked`. This covers issue #170 criterion (1).
- Order reason: builds on A. The render stage consumes A's pipeline output and uses the same `clusterOpts`.

### C. `rowsOf(group)` includes descendants, so the group count includes them
- Test: `it('rowsOf(group) returns the root and every descendant; its length is the group count')`
- Asserts:
  - `rowsOf(openHeader)` ids equal `['t1', 't1a', 't1a1']`, which gives a length of 3.
  - `rowsOf(doneHeader)` ids equal `['t2']`.
- Why this seam: `rowsOf` calls a different engine function, `rowsBeneathGroup`. Its opts can drop the parent link on this path alone while A and B pass. This covers criterion (2).
- Order reason: builds on A (same `clusterOpts`). Independent of B.

### D. `groupIds()` lists only the headers that root clustering produces
- Test: `it('groupIds() lists only root-value headers — no header for a descendant-only value')`
- Asserts: `store.groupIds().sort()` equals `[doneHeaderId, openHeaderId].sort()`, with no `group:>status:string:blocked`.
- Why this seam: `collectGroupIds` is a separate call with its own opts. If it is wired without the link, `tree.expand(table.groupIds())` receives a phantom id for a header that never renders.
- Order reason: builds on A. Independent of B and C.

### E. `table.grouping` (applied levels) judges `when` against clusters that include descendants
- Test: `it('grouping() applies a level whose root-value cluster passes when only because it includes descendants')`
- Setup: `withGrouping({ initial: ['status'], when: (c) => c.rows.length >= 3 })`, plus `withTree({ parentId })`.
- Asserts: `store.grouping()` equals `['status']`.
- Why this seam: `appliedGrouping` calls `collectAppliedLevels` with its own opts. Clustering by own value gives no cluster above 2 rows, so the level would read as `[]` even though the render stage shows the `open` header. `groupingLevels` and `isGroupedBy` are derived from this value.
- Order reason: builds on A. Independent of B, C and D.

### F. The argument order `withTree` before `withGrouping` gives the same clustering
- Test: `it('withTree({ parentId }) composed before withGrouping() clusters the same way — the parent link is read lazily')`
- Setup: `createTable(data, cfg, withTree({ parentId }), withGrouping({ initial: ['status'] }))`
- Asserts:
  - `rows()` ids equal `['t1', 't1a', 't1a1', 't2']`.
  - `groupIds()` equals the two root-value headers.
- Why this seam: it catches code that reads `ctx.parentOf` once, when the factory runs, for example `const { parentOf } = ctx` or `parentOf: ctx.parentOf` in the object literal. In A to E, `withGrouping` comes first in the arguments, so this bug would not show there.
- Order reason: builds on A to E. Green reaches it only after the wiring exists, and then checks that the wiring holds under the other argument order.

## Types phase (written in red, proven by green's typecheck)
- `expectTypeOf(table.rowsOf).returns.toEqualTypeOf<readonly TaskRow[]>()` for `createTable(data, cfg, withTree({ parentId }), withGrouping({ initial: ['status'] }))`. Goes in `feature.types.spec.ts`.
  - It checks that `GroupingInput<In>`, once widened to also require `'trackBy'` (needed so the factory can read `input.trackBy`), still resolves `RowOf<In>` under the F-bounded constraint when tree members come first.
  - The existing checks on `table.grouping` there cover the `withGrouping`-first order.
  - If green reads `trackBy` without widening `GroupingInput`, this check stays valid but proves nothing new.

## Not tested
- Grouping without a parent link (issue #170 criterion 4, story 35). Existing suites already cover it:
  - every test in `with-grouping/feature.spec.ts`;
  - the collapse-only-plus-grouping cases in `with-tree.spec.ts` at about lines 1117 and 1166.

  A new test would already pass in red, so it cannot drive green.
- Wiring `trackBy` into `clusterOpts` on its own. Leaving it out breaks resolving a parent id to its row, which fails A to F on the same bug. It is not a separate seam.
- `groupingLevels()` and `isGroupedBy()` under a parent link. Both are derived from `appliedGrouping`, so they fail on the same bug as E.
- The internal `(input, ctx)` factory signature. It is engine plumbing (step 1), not a consumer contract, and it is observable only through A to F.
- Broken links (throwing, self, cycle, missing parent) under grouping. Degrading them and reporting them belongs to `withTree` and `engine/tree-links`, not to grouping's wiring (spec-files-assert-own-domain-only).
- Filtering combined with grouping and a tree (context rows). That belongs to the filtering step, not to this one.
- The grouping story's `d4` subtree aggregate — step 5. It is a story fixture outside this step's files.
- `aggregateFn` receiving every node — engine behaviour owned by step 2 seam C; step 5 shows the d4 total in the story.
- The existing `with-tree.spec.ts` seam D (grouping first, then a child nested under its parent in the same region). It already exists and passes both before and after this step.

## Resolved in planning
- The fixture lives in `table.mock.ts`.
- Step 3 widens `rowsBeneathGroup`'s opts.
- `when` sees the full bucket, descendants included (step 3 seam E).
