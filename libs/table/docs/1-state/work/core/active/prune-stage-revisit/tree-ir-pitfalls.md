# Documented, real-world pitfalls of a nested/tree intermediate representation for table rows

**Date:** 2026-09-17 · **Depth:** standard

## Answer

The question's framing — *flat array vs. nested tree* — is not the choice the surveyed libraries
actually made. **Every one of them keeps both, in one pass.** TanStack Table's core row model
builds `row.subRows` (nested) *and* `rows` / `flatRows` / `rowsById` simultaneously [S1]; MUI X
stores a tree as a **flat id-keyed node map** (`{id, depth, parent, children: GridRowId[]}`), never
as object nesting [S2]; Angular CDK Tree maintains `_flattenedNodes` as a synchronous cache
alongside the nested data [S3]. So the proposal is mainstream — *provided the flat views are
materialized by the same walk, not derived on demand.*

The measured dangers are **not** recursion depth. Every performance post-mortem found was about
**breadth** and about **per-node array operations**, not stack depth: TanStack's 30s → <100ms
grouping fix was a spread-in-a-loop [S4]; AG Grid's tree-data fix removed `splice` calls [S5]; MUI
X's 10× v6 tree regression was fixed by optimizing one node-removal function [S6][S7]. The one real
stack overflow found — CDK `#29733` — fires at **~500 siblings, one level deep**, and **only in the
nested node renderer; the flat one is unaffected** [S8]. That is a *rendering* recursion, not an IR
walk.

The strongest argument against the proposal is **maintenance**, and it comes from Handsontable's
`NestedRows`: five separate shipped bugs in one recent cycle, every one rooted in the nested source
tree and the flat grid index space disagreeing [S9][S10][S11][S12]. That is the specific cost of
owning two representations — and it is a cost the current flat+prune design also pays, in a
different currency (the unchecked emission-order invariant).

**For this engine's scale, the difference is immaterial.** No source found reports a tree-vs-flat IR
cost below roughly **10k rows**; the numbers start at 18k [S6], 50k [S4] and 200k [S4].

## Method

- Versions pinned: `@tanstack/table-core@9.2.4` (npm registry, read 2026-09-17),
  `@mui/x-data-grid-pro@9.13.0` (npm registry, read 2026-09-17). CDK / Handsontable / AG Grid read
  from `main` at the linked commit paths, dated below.
- Source reads via `gh api repos/<o>/<r>/contents/<path>` with the raw accept header (2026-09-17);
  issues and PR bodies via `gh api` (2026-09-17). Page fetches for issue threads.
- **Reliability:** `ag-grid/ag-grid` closes GitHub issues on triage into a private tracker, so
  `closed` never means "fixed" there — only the merged PR bodies [S5] are cited. `WebSearch` was
  non-functional this run (returned Wikipedia for every developer query), so this survey is built
  from repository APIs and source, not from blog posts or benchmark write-ups. That is a real gap:
  **no independent benchmark write-up was located** — see *Not researched*.

## Evidence

### 1. Recursion depth / stack

- The only located stack overflow in a tree row model, CDK `#29733`, is triggered by **breadth**
  (~500 children), explicitly "does not need to be deeply nested, just 1 level deep is enough" [S8].
- It reproduces **only** with `cdk-nested-tree-node`, never with the flat node [S8]. The reporter
  also confirms `treeControl` vs `childrenAccessor` makes no difference — it is the renderer, not
  the data API [S8].
- CDK's fix is a guard in `_renderNodeChanges`, carrying the reasoning in-source: *"Note: we only
  `detectChanges` from a top-level call, otherwise we risk overflowing the call stack since this
  method is called recursively (see #29733.)"* [S3]. The recursion was kept; only the per-level
  change-detection call was moved to the top frame.
- MUI X also reports `Maximum call stack size exceeded` from a tree operation — but from a
  **cyclic/orphaned tree state** after moving the last child out of a row group, not from depth
  [S13]. Open since 2023 [S13].
- **No library found converted its row-model walk to an explicit stack.** TanStack's
  `accessRows` [S1] and `expandRows` [S14] are both plainly recursive in the shipped 9.x line.

### 2. Allocation and GC churn

- The measured allocation problems are **per-node array operations inside the walk**, not node
  allocation. TanStack grouping of 50,000 rows into few clusters took ~30s purely from
  `[...previous, row]`; replacing it with `.push()` gave <100ms, i.e. ~300× [S4]. A second reporter
  confirmed the same fix "makes all the difference" at 200,000 rows [S4].
- AG Grid's `AG-11586` reached its tree-data win the same way: a pre-built `TreeDataNodeCache`
  populated up front so inserts *query the cache* instead of running "expensive array splice
  operations that were the root of the performance issues" [S5].
- MUI X's v6 tree-data regression was a **10× render-time increase** on ~18,200 rows × 25 columns:
  `sortRowTree` at ~600ms in v5 became ~6s across `rowsStateInitializer` + `createRowTree` in v6
  [S6]. The fix, PR `#9682`, optimized `removeNodeFromTree` alone for **>3× on 10,000 top-level
  rows**; the reviewer called it "a super easy win" [S7].
- **Sub-tree memoization across an immutable rebuild was not found in any surveyed library.** All
  four memoize at the *stage* level, keyed on state atoms, and rebuild the whole level below on a
  miss — see §3.

### 3. Recompute granularity

- TanStack does **not** do dirty-subtree updates. `createExpandedRowModel` is one
  `tableMemo` whose `memoDeps` are `[expanded, preExpandedRowModel, paginateExpandedRows,
  manualPagination]` — so **toggling one row invalidates the memo and re-runs the entire walk**
  [S14]. This is the shipped 9.2.4 design.
- The walk it re-runs is exactly the proposed `flattenVisible`: push the row, recurse into
  `subRows` only `if (row.subRows.length && row_getIsExpanded(row))` [S14].
- Notably, that full re-walk is **skipped entirely in the common case**: `_createExpandedRowModel`
  returns the pre-expanded model unchanged unless expanded rows are being paginated [S14] — the
  hierarchy is otherwise carried through the stages and flattened at render time.
- The core walk is memoized on `[table.options.data]` alone [S1], so a reference-stable data input
  makes the expensive tree construction a once-per-data-change cost, not a per-interaction one.
- **No number was found for the cost of one whole-walk re-flatten.** The re-walk being cheap is an
  inference from its shape (one pass, push-only), not a measured claim — listed in *Unverified*.

### 4. Virtual scrolling interaction

- MUI X solves it with **two flat structures beside the tree**: `GridRowsMeta` holds
  `{ totalHeight: number; positions: number[] }` — an explicit prefix-sum array over visible rows —
  while the tree itself is the id-keyed `GridTreeNode` map [S2].
- Because `GridBasicGroupNode` carries `children: GridRowId[]` and `childrenExpanded?: boolean`
  [S2], visibility is a property of the node map, and the materialized visible list plus its
  prefix sums are derived separately. The virtualizer never walks the tree.
- Angular CDK never solved it: `cdkVirtualFor` over a tree was requested twice and **both requests
  were closed as duplicates of `#10122`** with no implementation [S15][S16]. The reporter of
  `#16225` was specifically blocked on "2000+ nodes" after Expand All [S15].
- MUI X `#4268` is the direct statement of the cost of *not* virtualizing a tree: "slowly expands
  heavily nested trees if virtualization is disabled" [S17].

### 5. Reactivity specifics

- CDK's tree renderer uses `IterableDiffer.forEachOperation` with insert/remove/move, plus a
  separate `forEachIdentityChange` pass that patches `context.$implicit` in place — because "the
  data itself changes, but keeps the same trackBy" [S3]. A rebuilt flat output array with stable
  ids therefore costs moves, not re-creates — **provided ids are stable**, which the proposed
  `RenderNode.id` gives.
- The same source block documents the ordering hazard: change detection is skipped while
  `!this._viewInit`, "if change detection is called while the component's view is still initing,
  then the order of child views initing will be incorrect" [S3].
- CDK's own TODO in that block is the relevant trajectory note: *"TODO: change to
  `markForCheck()`, or just switch this component to use signals."* [S3] — i.e. the first-party
  Angular tree considers a signal-driven recompute the fix, not the risk.
- `cdk-tree` was reported at **~6s for 1,000 nodes at a single level**, with even 100 nodes
  visibly delayed; the root cause was `detectChanges` per node insert, and moving it to
  `renderNodes` was estimated at a 6× improvement [S18]. This is a rendering-layer cost, independent
  of the IR, and it is the cost this engine's zoneless `computed()` + one flat output already avoids.

### 6. Maintenance cost

Handsontable's `NestedRows` plugin is the clearest documented evidence, and every entry is the
**same** root cause — a nested source tree and a flat index space that must be kept in agreement:

- Insert next to a top-level parent used the **top-level array position** where the grid counts
  **flattened rows** (0,1,2 vs 0,6,12). "One `alter()` call cannot serve both halves of the
  operation." It survived undetected because "an insert next to the *first* parent is correct by
  coincidence" [S9].
- Removing a nested parent walked only **one level down**, because the data side (`filterData()`
  splices the subtree out) and the index side (`removeIndexes()` sees only the listed rows) are
  driven by different things. Result: orphan rows reading back `null` that no further remove could
  clear — 2 blank rows on a four-level chain [S10].
- Undo stored the parent object and **dropped `__children`**, restoring a flat row and leaving grid
  and source tree out of step; the fix had to capture subtree, physical row maps, collapsed state,
  metadata and merge anchors [S11].
- Collapse is backed by a TrimmingMap, so collapsed rows "leave visual index space altogether and
  `countRows()` drops" — invalidating the stored **visual** selection row, leaving focus on
  `<body>` and the grid unresponsive to the keyboard, while `isListening()` still reported `true`
  [S12].
- Even the row-header width is derived from nesting depth alone and never measures the label:
  `Math.max(50, padding*2 + 10*levelCount + 25)` [S19].

Counterweight: **no migration in either direction was located.** Nobody found who moved tree → flat
or flat → tree and wrote about it. TanStack, MUI X, AG Grid and CDK all shipped hybrid from the
start and have only optimized within it [S1][S2][S3][S5].

### 7. The counter-case — documented problems of flat + parent pointers

- MUI X `#8238`: moving the last child between row groups throws `Maximum call stack size
  exceeded`, and the emptied group is not deleted [S13]. This is a **parent-pointer consistency**
  failure, not a depth failure — the class of bug a derived-from-structure walk cannot produce.
  **Open since March 2023** [S13].
- Handsontable `#13401`'s "correct by coincidence" finding is the flat-index failure mode in its
  purest form: two index spaces agreed only while no preceding parent had children, and both shared
  fixtures happened to satisfy that [S9]. This is a direct analogue of this engine's *"correct only
  because parents are emitted immediately before descendants (unchecked invariant)"*.
- AG Grid's pre-cache rewrite exists specifically because incremental maintenance of flat structure
  under tree mutation required `splice` — it replaced mutation-in-place with rebuild-from-cache
  [S5]. The direction of travel is *away* from incrementally patched flat state.

## Comparison

| Dimension | flat + `parentId` + prune pass | tree IR + `flattenVisible` |
|---|---|---|
| Stack depth | no risk | no documented risk from walk depth; the one overflow found is a *renderer* recursion at ~500 siblings, flat-node variant unaffected [S8][S3] |
| Allocation | one array per stage | +1 node per row per rebuild. Not the measured bottleneck anywhere; the measured ones were `spread`-in-loop [S4] and `splice` [S5], both of which a push-only walk avoids |
| Recompute granularity | whole pass per toggle | whole walk per toggle — **same**, and this is what ships in TanStack 9.2.4 [S14]. No library found does dirty-subtree |
| Virtualization | direct: output *is* the list | needs the flat list + prefix sums materialized beside the tree, as MUI X does [S2]. CDK, which never materialized one, **still has no tree virtual scroll** [S15][S16] |
| Reactivity | one `computed()`, stable ids | same, if the walk emits stable ids; CDK's differ then produces moves not re-creates [S3] |
| Maintenance | ordering invariant is unchecked and silent — exactly Handsontable's "correct by coincidence" class [S9]; `depth`/`parentId` hand-stamped per stage, so a new stage can stamp them wrong | `depth`/`parentId`/`hasChildren` derived by the walk — that whole bug class disappears. **But** two representations is the source of all five Handsontable bugs [S9][S10][S11][S12]. The mitigation is that here one function owns both and the tree is engine-internal |
| Feature friction (sort/filter/paginate/aggregate) | evidence thin — see below | evidence thin. TanStack keeps `flatRows` beside the tree at every stage [S1] precisely so flat-wanting features never walk it; that is the mitigation, and it costs a second array per stage |

**Where the evidence is thin, plainly:** (a) no independent benchmark write-up comparing the two IRs
was located; (b) no maintainer post-mortem stating "we chose flat *because* tree hurt" was found —
the libraries surveyed all chose hybrid and never wrote a rationale doc for it; (c) the
feature-friction row is inference from library *shape*, not from a cited complaint.

## Synthesis

The libraries disagree on **where the tree lives**, not on whether to have one:

- **TanStack (9.2.4)** — nesting in the row objects themselves (`row.subRows`), with `flatRows` and
  `rowsById` built in the same recursive pass [S1]. Closest to the proposal. Confirms the whole-walk
  recompute is acceptable in production at scale.
- **MUI X (9.13.0)** — no object nesting at all: a flat `id → node` map where edges are id arrays
  [S2]. This is the design that survives mutation best (updating one node does not reallocate its
  ancestors) and it is the one with a virtualizer that works. It is the *third* option this
  discovery's framing omitted, and it is the strongest one if row mutation becomes a concern.
- **AG Grid** — moved from incremental flat patching to a pre-built cache [S5]; the disagreement
  with MUI's incremental `removeNodeFromTree` optimization [S7] is really a difference in mutation
  frequency, not in principle.
- **CDK** — nested data, flat cache, recursion retained with a change-detection guard [S3], and the
  maintainers' own stated direction is signals [S3]. Its one unfixed gap (virtual scroll) is exactly
  the one the other three closed by materializing a flat visible list.

The disagreement that matters for this decision: MUI X's id-map proves you can get derived
`depth`/`parent` **without** object nesting. If the motivation for the change is "stop hand-stamping
`depth` and `parentId` per stage", an id-keyed node map delivers that with strictly less allocation
churn and no recursion at all — at the cost of the walk being less obvious to read.

## Against

- **The tree IR buys nothing measurable at this scale.** Every cited number sits at 10k–200k rows
  [S4][S6][S7]; nothing found suggests the two IRs are distinguishable below ~10k. The change is a
  correctness/maintainability argument, not a performance one, and should be argued as such.
- **Two representations is the documented bug generator.** Five Handsontable bugs, one root cause
  [S9][S10][S11][S12]. The proposal creates a second representation inside the engine where today
  there is one.
- **The unchecked ordering invariant can be fixed without the rewrite** — a dev-mode assertion in
  the prune stage that a row's `parentId` has already been seen closes the "correct by coincidence"
  hole [S9 analogue] at a fraction of the cost.

## Not researched

- Independent benchmark write-ups / blog posts. `WebSearch` returned Wikipedia results for every
  developer query this run; nothing outside repository APIs and source was reachable.
- SlickGrid — not examined at all.
- `TanStack/virtual` and `cdk-virtual-scroll` internals; only the CDK feature requests were read.
- Lazy/async children as a feature axis — no evidence gathered either way.
- React/Angular reconciliation cost measured against a rebuilt flat array; only CDK's differ
  *mechanism* was read [S3], not any timing for it.

## Unverified

- That a whole-walk re-flatten on expansion toggle is cheap at this engine's row counts. Inferred
  from the walk's shape (single pass, `push`-only, no allocation per visited-but-skipped subtree)
  and from TanStack shipping exactly that [S14] — **not measured**. A repro harness over the
  engine's own `render-stages.ts` would confirm it.
- That `RenderNode` allocation per rebuild is immaterial. No allocation/GC measurement for a tree
  row-model rebuild was located in any tracker.
- Whether MUI X's `GridRowsMeta.positions` is rebuilt fully or incrementally on expansion — the type
  was read [S2], the update path was not.
- Whether AG Grid's `TreeDataNodeCache` survives an immutable data replacement — the PR body
  describes the cache [S5]; the invalidation rule was not read.

## Sources

| | Source | Version | Verified |
|---|---|---|---|
| S1 | https://github.com/TanStack/table/blob/main/packages/table-core/src/core/row-models/createCoreRowModel.ts | 9.2.4 line | yes — source read; shows `accessRows` building `subRows`, `flatRows` and `rowsById` in one recursive pass, memoized on `[table.options.data]`. Corrects the premise that TanStack is "flat" |
| S2 | https://github.com/mui/mui-x/blob/master/packages/x-data-grid/src/models/gridRows.ts | 9.13.0 line | yes — source read; `GridTreeBasicNode`/`GridBasicGroupNode` carry `depth`, `parent`, `children: GridRowId[]`, `childrenExpanded`; `GridRowsMeta` carries `positions: number[]`. Establishes the id-map-not-nesting third option |
| S3 | https://github.com/angular/components/blob/main/src/cdk/tree/tree.ts | main, read 2026-09-17 | yes — source read; `_flattenedNodes` cache, the `#29733` stack-overflow comment, the `forEachOperation`/`forEachIdentityChange` differ pair, and the signals TODO |
| S4 | https://github.com/TanStack/table/pull/4495 | v8 | yes — page read; 50k rows ~30s → <100ms by replacing spread with `push`; 200k-row confirmation in thread |
| S5 | https://github.com/ag-grid/ag-grid/pull/7995 | AG-11586 | yes — page read; `TreeDataNodeCache`, avoidance of `splice` named as the root cause |
| S6 | https://github.com/mui/mui-x/issues/8581 | v6 | yes — page read; 18,200 rows × 25 cols, `sortRowTree` ~600ms (v5) → ~6s (v6) |
| S7 | https://github.com/mui/mui-x/pull/9682 | merged 2023-07-18 | yes — page read; `removeNodeFromTree`, >3× on 10,000 top-level rows |
| S8 | https://github.com/angular/components/issues/29733 | cdk 18.2.0 regression | yes — issue body read; ~500 children, 1 level deep, nested node only, flat unaffected |
| S9 | https://github.com/handsontable/handsontable/pull/13401 | — | yes — PR body read; top-level index vs flattened index, "correct by coincidence" |
| S10 | https://github.com/handsontable/handsontable/pull/13457 | — | yes — PR body read; subtree removal stopped one level down, 2 orphan rows on a four-level chain |
| S11 | https://github.com/handsontable/handsontable/pull/13471 | — | yes — PR body read; undo dropped `__children` |
| S12 | https://github.com/handsontable/handsontable/pull/13492 | — | yes — PR body read; TrimmingMap collapse invalidates the stored visual selection row |
| S13 | https://github.com/mui/mui-x/issues/8238 | open since 2023-03 | yes — issue body read; `Maximum call stack size exceeded` moving the last child out of a row group |
| S14 | https://github.com/TanStack/table/blob/main/packages/table-core/src/features/row-expanding/createExpandedRowModel.ts | 9.2.4 line | yes — source read; `memoDeps: [expanded, …]` = whole-walk recompute per toggle; `expandRows` is the recursive visible-flatten |
| S15 | https://github.com/angular/components/issues/16225 | — | yes — issue + comments read; closed as duplicate of #10122, blocked at 2000+ nodes |
| S16 | https://github.com/angular/components/issues/19162 | — | yes — issue + comments read; closed as duplicate of #10122 |
| S17 | https://github.com/mui/mui-x/issues/4268 | — | yes — issue body read; slow expansion of heavily nested trees with virtualization off |
| S18 | https://github.com/angular/components/issues/11101 | cdk 6.0.0-rc.1 | yes — page read; ~6s for 1,000 nodes, `detectChanges` per insert, ~6× estimated win |
| S19 | https://github.com/handsontable/handsontable/pull/13454 | 16.2+ | yes — PR body read; row-header width from `levelCount` only |
| R1 | libs/table/src/engine/render-stages.ts | — | no — located only; not read this run |
