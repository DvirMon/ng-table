# How do table/grid libraries model "hide rows under a collapsed group header / tree row"?

**Date:** 2026-09-16 · **Depth:** standard

> Plan mode was active, so the findings could not be written to
> `libs/shared/table/docs/1-state/work/grouping-expansion-coupling/prior-art.md`.
> This file holds the full findings; copy it there when writes are allowed.

## Answer

Prior art is unanimous on the parent link: **every** surveyed library stores an explicit parent
reference on the node (`row.parentId` [S1], `RowNode.parent` [S4], `GridTreeNode.parent` [S6]),
and none models hierarchy by `depth` alone — `depth` exists everywhere but is used for indentation
and aria-level, never for pruning. It is also unanimous that the prune walk is **engine-owned and
terminal**: a single recursive descent that emits a node only if every ancestor is expanded
(`expandRows` [S2], `getVisibleRowsLookup` [S7], `doRowsToDisplay` [S5], `CdkTree._flattenedNodes`
[S9]). On the third question prior art is **also one-sided but for a subtler reason**: TanStack,
AG Grid, MUI X and CDK all use **one** expansion state covering synthetic group headers and real
data rows alike, because in all four a synthetic group header _is_ a node in the same tree with the
same id space. MUI X is the sharpest evidence: row grouping and tree data register the _same_
`getVisibleRowsLookup` function as their `visibleRowsLookupCreation` strategy [S7][S8].

## Method

- Versions pinned from published npm artifacts fetched over `curl` on 2026-09-16:
  `@tanstack/table-core@8.21.3` (published `src/` ships in the tarball), `ag-grid-community@33.3.2`
  (`dist/types/**.d.ts`), `@mui/x-data-grid@8.5.0`, `@mui/x-data-grid-pro@8.5.0`,
  `@mui/x-data-grid-premium@8.5.0` (`.d.ts` + compiled `esm/**.js`), `@angular/cdk@20.1.0`
  (`tree/index.d.ts`).
- All claims below are from published package contents, not docs sites and not memory. The one
  docs-site fetch attempted (AG Grid client-side row model page) did not contain the pipeline
  detail and is **not** cited.
- Reliability note: AG Grid ships no `.d.ts` for `flattenStage`/`doRowsToDisplay` — the stage list
  is read from the published `ClientSideRowModelStage` union and `doRowsToDisplay` is visible only
  as a private member. The _existence and ownership_ of the stage is verified; its body is not.

## Evidence

### Q1 — parent link vs depth only

- TanStack `CoreRow` carries **both**: `depth: number` and `parentId?: string`, documented as "If
  nested, this row's parent row id." [S1]
- `createRow(table, id, original, rowIndex, depth, subRows?, parentId?)` — `parentId` is a
  constructor parameter, so it is set at row-creation time, not derived later. [S1]
- `getParentRow: () => row.parentId ? table.getRow(row.parentId, true) : undefined`, and
  `getParentRows()` walks `getParentRow()` in a loop and `.reverse()`s. [S1]
- AG Grid `BaseRowNode` has `level: number` ("How many levels this node is from the top when
  grouping"), `uiLevel: number`, **and** `parent: IRowNode<TData> | null` — an object reference, not
  an id. [S4]
- AG Grid also stores the downward links per stage: `childrenAfterGroup`, `childrenAfterFilter`,
  `childrenAfterSort`, `allLeafChildren`. [S4]
- MUI X `GridTreeBasicNode` has `depth: number`; every concrete node type adds `parent`.
  `GridLeafNode.parent: GridRowId` (non-null), `GridBasicGroupNode.parent: GridRowId | null`
  ("null for the root group"), plus `children: GridRowId[]`. [S6]
- Angular CDK `CdkTree` takes `levelAccessor` **xor** `childrenAccessor` ("must be specified, not
  both. This is enforced at run-time") and, when given only levels, reconstructs parents itself into
  a private `_parents` map — "The immediate parents for a node. This is `null` if there is no
  parent." [S9]
- CDK is therefore the one case that accepts a depth-only input, and it pays for it by deriving the
  parent link internally before it can render; the private API comment says the traversal "computes
  parents, levels, and group data". [S9]

### Q2 — who owns the prune walk

- TanStack: `expandRows(rowModel)` in `getExpandedRowModel.ts` is a plain recursive emit —
  `expandedRows.push(row); if (row.subRows?.length && row.getIsExpanded()) row.subRows.forEach(handleRow)`.
  It is a **row-model stage**, not part of the grouping feature. [S2]
- TanStack's grouping feature (`getGroupedRowModel`) builds the tree and _sets_ `depth`/`parentId`;
  it never filters for collapsed state. It even resets them when grouping is empty:
  `row.depth = 0; row.parentId = undefined`. [S3]
- The stage order is fixed centrally: `getPreExpandedRowModel = () => table.getSortedRowModel()`,
  and expansion is the terminal transform before pagination. [S2]
- MUI X: `useGridFilter` computes `visibleRowsLookup` by calling
  `applyStrategyProcessor('visibleRowsLookupCreation', { tree, filteredRowsLookup })` — one central
  call site, the strategy is pluggable. [S8]
- The flat (no-tree) strategy is the identity: "For flat tree, the `visibleRowsLookup` and the
  `filteredRowsLookup` are equals since no row is collapsed." [S8]
- The tree strategy is `getVisibleRowsLookup`, a single recursive walk threading
  `areAncestorsExpanded && !!node.childrenExpanded` down through `node.children`, marking
  `visibleRowsLookup[node.id] = false` when `!(isPassingFiltering && areAncestorsExpanded)`. [S7]
- MUI X separates the two concerns explicitly in the state types: `filteredRowsLookup` is "the
  equivalent of the `visibleRowsLookup` if all the groups were expanded", and
  `GridVisibleRowsLookupState` is "visible if it is passing the filters AND if its parents are
  expanded." [S10]
- Consumers read the pruned list through one selector: `gridExpandedSortedRowEntriesSelector` =
  `sortedRows.filter(row => visibleRowsLookup[row.id] !== false)`. [S11]
- AG Grid: the pipeline is a published union —
  `'group' | 'filter' | 'sort' | 'map' | 'aggregate' | 'filter_aggregates' | 'pivot' | 'nothing'` —
  and `refreshModel(params: RefreshModelParams)` takes `step` = "how much of the pipeline to
  execute". [S5]
- The displayed list is private engine state: `ClientSideRowModel` declares
  `private rowsToDisplay` and `private doRowsToDisplay` — no feature can write it. [S5]
- `RowNode.rowIndex` is documented as: "The current row index. **If the row is filtered out or in a
  collapsed group, this value will be `null`**" — i.e. collapsed-descendant exclusion is a property
  the row model assigns, not something a feature emits. [S4]
- CDK: the tree keeps a private `_flattenedNodes` ("synchronous cache of flattened data nodes") and
  a private `_expansionModel`; nodes never prune themselves. [S9]

### Q3 — one expansion state or two

- TanStack: `ExpandedState = true | Record<string, boolean>` — **one** map keyed by `row.id`, with a
  `true` sentinel for "everything expanded". [S12]
- `row.getIsExpanded()` reads `expanded === true || expanded?.[row.id]` with no branch on whether
  the row is a synthetic group row or a real data row. [S12]
- `row.getCanExpand()` defaults to `!!row.subRows?.length` — again type-agnostic; a grouping header
  qualifies because grouping gave it `subRows`. [S12]
- `getIsAllParentsExpanded()` walks `currentRow.parentId` upward calling `getIsExpanded()` — the
  chain crosses group-header rows and data rows indiscriminately. [S12]
- TanStack has exactly one collapse-aware model (`getExpandedRowModel`) serving both sub-row trees
  and grouping; there is no `getGroupExpandedRowModel`. [S2]
- MUI X: expansion is not a separate state object at all — it is the **`childrenExpanded` flag on
  the group node itself** ("If `true`, the children of this group are not visible." — the doc
  comment is inverted relative to the field name, but `getVisibleRowsLookup` reads it as
  _expanded_). [S6][S7]
- MUI X's root group is seeded `childrenExpanded: true`. [S13]
- The decisive one: **row grouping and tree data register the identical function.** Premium's
  `useGridRowGroupingPreProcessors` does
  `useGridRegisterStrategyProcessor(apiRef, RowGroupingStrategy.Default, 'visibleRowsLookupCreation', getVisibleRowsLookup)`
  [S8b], and Pro's `useGridTreeDataPreProcessors` does the same with `TreeDataStrategy.Default`
  [S8a] — both importing `getVisibleRowsLookup` from `@mui/x-data-grid-pro`'s tree utils. Two
  features, one prune stage, one state field.
- AG Grid: `expanded: boolean` lives on `GroupRowNode`, i.e. on the node. Master/detail expansion
  uses the same field — `master: boolean` rows are described as "row can be expanded to show
  detail", and `isExpandable()` returns true "if the node is a group **or master row**". [S4]
- AG Grid's API is likewise unified: `setRowNodeExpanded(rowNode, expanded, expandParents?, forceSync?)`,
  `node.setExpanded(expanded, sourceEvent?, forceSync?)`, and `expandAll()` / `collapseAll()`
  ("Expand all groups." / "Collapse all groups."). [S5][S4]
- CDK: one private `_expansionModel` (a `SelectionModel<K>`) for the whole tree, keyed by
  `expansionKey(dataNode)` — "Given a data node, determines the key by which we determine whether or
  not this node is expanded." [S9]

### Q4 — synthetic group row id format, and whether it is expandable through the generic API

- TanStack builds group ids as `` `${columnId}:${groupingValue}` ``, then prefixes the parent:
  `id = parentId ? `${parentId}>${id}` : id`. So a two-level group is
  `dept:Sales>role:Engineer`. [S3]
- Those ids go into the same `rowsById` map as data rows, so `table.getRow(id)`,
  `row.toggleExpanded()` and `setExpanded({ 'dept:Sales': true })` all work on them unchanged.
  [S3][S12]
- Caveat found in source: `table.getExpandedDepth()` computes depth by `id.split('.')` [S12] —
  a dot-delimiter assumption that matches _sub-row_ ids but **not** the `:`/`>` grouping ids. So
  the shared id space is real but one helper reads it with the wrong separator. This is a concrete
  cost of one id space with two id shapes.
- MUI X: `getGroupRowIdFromPath(path)` returns
  `` `auto-generated-row-${path.map(c => `${c.field}/${c.key}`).join('-')}` `` — e.g.
  `auto-generated-row-dept/Sales-role/Engineer`. [S14]
- Those ids are ordinary `GridRowId`s in `GridRowTreeConfig`, so
  `apiRef.current.setRowChildrenExpansion(id, isExpanded)` — "Expand or collapse a row children" —
  accepts them directly; it is declared on `GridRowApi`/`GridRowProApi`, not on a grouping-specific
  api. [S15][S16]
- The node type records its own provenance rather than encoding it in the id:
  `isAutoGenerated: true` with the comment "In the row grouping, all groups are auto-generated; In
  the tree data, some groups can be passed in the rows." [S6]
- AG Grid group nodes get a grid-generated `id` (`BaseRowNode.id: string | undefined` — "Either
  provided by the application, or generated by the grid if not") and are addressed by **node
  reference**, not id: `setRowNodeExpanded(rowNode, ...)` takes an `IRowNode`. [S4][S5]

## Comparison

| Axis                          | TanStack Table 8.21.3                                  | AG Grid 33.3.2                               | MUI X DataGrid 8.5.0                                | Angular CDK 20.1.0                   |
| ----------------------------- | ------------------------------------------------------ | -------------------------------------------- | --------------------------------------------------- | ------------------------------------ |
| Parent link on node           | `parentId?: string` [S1]                               | `parent: IRowNode \| null` (object ref) [S4] | `parent: GridRowId` [S6]                            | derived into private `_parents` [S9] |
| Depth also present            | `depth: number` [S1]                                   | `level` + `uiLevel` [S4]                     | `depth: number` [S6]                                | `levelAccessor` [S9]                 |
| Prune walk owner              | row-model stage `expandRows` [S2]                      | row model, `private doRowsToDisplay` [S5]    | strategy processor `visibleRowsLookupCreation` [S8] | `CdkTree._flattenedNodes` [S9]       |
| Grouping feature prunes?      | no — only sets `depth`/`parentId` [S3]                 | no — sets `childrenAfterGroup` [S4]          | no — only builds the tree [S8b]                     | n/a                                  |
| Expansion state shape         | one `Record<rowId, boolean> \| true` [S12]             | `expanded: boolean` on the node [S4]         | `childrenExpanded` on the group node [S6]           | one `SelectionModel<K>` [S9]         |
| Shared across group + tree?   | yes, one `getExpandedRowModel` [S2]                    | yes, incl. master/detail [S4]                | yes, literally the same function [S8a][S8b]         | yes [S9]                             |
| Synthetic group id            | `col:value`, nested `parent>col:value` [S3]            | grid-generated [S4]                          | `auto-generated-row-field/key-…` [S14]              | n/a                                  |
| Generic expand API accepts it | yes — `toggleExpanded`/`setExpanded` by `row.id` [S12] | by node ref: `setRowNodeExpanded` [S5]       | yes — `setRowChildrenExpansion(id, bool)` [S15]     | yes — by `expansionKey` [S9]         |

## Synthesis

**Where they agree, and why it matters here.** The agreement is not stylistic. All four make the
same structural bet: _hierarchy is a property of the node, visibility is a property of the
pipeline._ A feature's job ends at producing a correctly-linked tree; deciding what renders is one
stage that runs after every feature. That is exactly the split the proposed `RenderRow.parentId` +
terminal prune stage would introduce, and it is the split that lets `withGrouping()` stop reading
`withExpansion()`'s set.

**Where they disagree: parent as id vs parent as reference.** TanStack and MUI X store an **id**
(`parentId`, `parent: GridRowId`) and resolve through a lookup map; AG Grid stores an **object
reference**. The reference is faster to walk and impossible to dangle, but it makes the row node
non-serializable and forces the whole graph to be rebuilt on any structural change — which is why
AG Grid's `refreshModel` needs a `step` enum and a `changedPath` to avoid redoing everything [S5].
For a signals lib emitting immutable `RenderRow` objects, the id form is the one that fits: it
survives being recomputed, and it is what makes `expanded` a plain serializable id set.

**Where they disagree: prune by emit vs prune by lookup.** TanStack's `expandRows` _builds a new
array_ by recursive descent [S2]. MUI X's `getVisibleRowsLookup` _builds a `Record<id, false>`_ that
a downstream selector filters with [S7]. The lookup form has a real advantage under filtering: MUI X
can keep `filteredRowsLookup` ("the equivalent of the `visibleRowsLookup` if all the groups were
expanded" [S10]) and `visibleRowsLookup` as separate facts, so it can answer "how many descendants
pass the filter" for a collapsed group without expanding it — that is what
`filteredDescendantCountLookup` feeds, and it is why group headers can show counts [S10]. The emit
form cannot answer that without a second pass. If group-header counts, or "expand all matching",
are on this repo's roadmap, the lookup form is the one that scales; if not, the emit form is less
machinery.

**Where the one-shared-state answer is less settled than it looks.** All four share one state, but
TanStack shows the seam: `getExpandedDepth()` splits ids on `.` [S12] while grouping ids use `:`
and `>` [S3]. That is what "one id set, two id grammars" costs — a helper that silently computes
the wrong depth for grouped tables. The lesson is not "use two states"; it is that if the ids share
a set, nothing downstream may parse them. MUI X avoids this by putting provenance in a
**field** (`isAutoGenerated`, `type: 'group' | 'leaf'` [S6]) rather than in the id string, and by
never inspecting the id's shape. That is the version worth copying.

**On `withGrouping()` reading `withExpansion()` directly.** No surveyed library has a feature read
another feature's state. MUI X's pluggable-strategy indirection exists precisely so grouping and
tree data can share prune logic without either importing the other [S8a][S8b]; TanStack's
row-model chain does it by ordering rather than by reference [S2]. Both are forms of "route it
through the engine". The current coupling has no prior art supporting it.

## Against

- **A parent link is redundant when the emitted order is already a valid pre-order.** If grouping
  emits header-then-descendants contiguously, a terminal stage can prune using `depth` alone: skip
  every subsequent row whose `depth` is greater than that of a collapsed row, until `depth` drops
  back. That is O(n), needs no map lookup, and needs no `parentId`. This is the counter-case, and it
  is not a weak one — it is exactly why CDK can accept a `levelAccessor` with no parent at all [S9].
  What it costs: it makes contiguity a load-bearing, unenforced invariant, and it breaks the moment
  anything reorders rows after grouping (a post-group sort, pinning, virtual windowing). CDK pays by
  reconstructing `_parents` internally anyway [S9] — i.e. even the depth-only design ends up
  materializing the parent link.
- **One shared expansion set means a collision is possible.** A data row whose id happens to equal a
  synthetic group id toggles both. TanStack's format (`col:value`) has no reserved prefix; MUI X's
  `auto-generated-row-` prefix [S14] is a deliberate guard. If this repo goes with one set, the
  namespacing prefix is not optional.
- **Adding `parentId` to `RenderRow` widens a public-ish type.** Every consumer template and every
  `RenderRow` construction site gains a field, and features that create rows must now populate it
  correctly or produce silently-unprunable rows. Whether that construction error throws is a
  `classify-errors-construction-vs-runtime` question this discovery does not answer.

## Not researched

- Handsontable and Syncfusion — not fetched, no claim made either way.
- Server-side / lazy row models (AG Grid SSRM, MUI `GridDataSource`), where collapsed descendants
  may not exist client-side at all. `GridDataSourceGroupNode.serverChildrenCount` [S6] and AG Grid's
  `stub`/`failedLoad` [S4] suggest this changes the model materially.
- Performance: no benchmark was run comparing emit-form vs lookup-form pruning at any row count.
- Virtual scrolling interaction — how each library keeps the pruned list and the viewport window in
  sync.
- This repo's own `RenderRow`, `withGrouping()` and `withExpansion()` source were **not** read; the
  problem statement was taken from the task description as given.

## Unverified

- **AG Grid's `doRowsToDisplay` body.** Only its existence and privacy are verified from the
  published `.d.ts` [S5]. That it performs the recursive expanded-only descent is a reasonable
  inference from `RowNode.rowIndex` being `null` "if the row is filtered out or in a collapsed
  group" [S4], not a source read. Confirming it needs the un-minified `flattenStage` source from the
  AG Grid repo at the v33.3.2 tag.
- **The AG Grid pipeline stage that owns flattening.** `'map'` in the `ClientSideRowModelStage` union
  [S5] is the likely candidate by elimination, but no published artifact names it as the flatten
  stage. Not claimed above.
- **MUI X `childrenExpanded` doc comment.** The published comment reads "If `true`, the children of
  this group are **not** visible" [S6], which contradicts how `getVisibleRowsLookup` uses it
  (`areAncestorsExpanded && !!node.childrenExpanded` → visible) [S7] and how the root is seeded
  (`childrenExpanded: true` on a root whose children plainly render) [S13]. Read as a stale doc
  comment; the code is taken as authoritative. Confirming needs a MUI X issue or a runtime probe.
- **Whether TanStack's `getExpandedDepth()` `.split('.')` is a live bug for grouped tables.**
  The mismatch between it [S12] and the `:`/`>` id format [S3] is read directly from source, but no
  repro was run and no upstream issue was located.
- **CDK `_parents` reconstruction algorithm.** The private member and the comment "computes parent,
  level, and group data" are verified [S9]; the algorithm is not, since CDK ships no source map for
  private members in `index.d.ts`.

## Verdict

**Parent link + central prune: yes, strongly favoured — adopt it.**
Four out of four libraries carry an explicit parent reference on the node, and four out of four run
the collapsed-descendant walk in engine-owned code that no feature can reach into. No surveyed
library prunes inside the grouping feature. The proposed `RenderRow.parentId` + one terminal
engine-owned prune stage is the mainstream shape, not a novel one. Store the parent as an **id**
(TanStack/MUI X form), not an object reference (AG Grid form) — it keeps `RenderRow` immutable and
serializable, which is what a signals pipeline wants.

**One shared expansion state: yes, favoured — but with two conditions.**
Every surveyed library uses a single expansion state spanning synthetic group headers and real
rows, and MUI X goes furthest by having row grouping and tree data register the _identical_ prune
function. Adopt one id set. The two conditions come from what the survey also turned up:
(1) **namespace the synthetic ids** with a reserved prefix, as MUI X does with
`auto-generated-row-`, so a data row can never collide with a group header;
(2) **never parse the id** — put "is this a synthetic group row" in a field on `RenderRow`, the way
MUI X uses `type` and `isAutoGenerated`, because TanStack's `getExpandedDepth()` splitting on `.`
while grouping ids use `:` and `>` is exactly the bug that id-parsing produces.

**Which prune form.** The emit form (TanStack `expandRows`) is simpler; the lookup form (MUI X
`visibleRowsLookup` alongside `filteredRowsLookup`) is what makes "N descendants match your filter"
answerable for a collapsed group. Pick on whether group-header counts under filtering are wanted —
that is a product question, not one this survey settles.

## Sources

|     | Source                                                                                                             | Version | Verified                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | https://unpkg.com/@tanstack/table-core@8.21.3/src/core/row.ts                                                      | 8.21.3  | yes — source read; `CoreRow.parentId`, `depth`, `createRow(..., parentId?)`, `getParentRow`, `getParentRows`                                                                                             |
| S2  | https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/getExpandedRowModel.ts                                     | 8.21.3  | yes — source read; full `expandRows` recursive emit                                                                                                                                                      |
| S3  | https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/getGroupedRowModel.ts                                      | 8.21.3  | yes — source read; `` `${columnId}:${groupingValue}` ``, `parentId ? `${parentId}>${id}``, and the`row.depth = 0; row.parentId = undefined` reset                                                        |
| S4  | https://unpkg.com/ag-grid-community@33.3.2/dist/types/src/interfaces/iRowNode.d.ts                                 | 33.3.2  | yes — types read; `parent`, `level`, `uiLevel`, `expanded`, `childrenAfterGroup/Filter/Sort`, `setExpanded`, `isExpandable`, `rowIndex` null-when-collapsed                                              |
| S5  | https://unpkg.com/ag-grid-community@33.3.2/dist/types/src/interfaces/iClientSideRowModel.d.ts                      | 33.3.2  | yes — types read; `ClientSideRowModelStage` union, `refreshModel(params)`, `step` = "how much of the pipeline to execute"                                                                                |
| S5b | https://unpkg.com/ag-grid-community@33.3.2/dist/types/src/clientSideRowModel/clientSideRowModel.d.ts               | 33.3.2  | yes — types read; `private rowsToDisplay`, `private doRowsToDisplay`, `rootNode`                                                                                                                         |
| S5c | https://unpkg.com/ag-grid-community@33.3.2/dist/types/src/api/gridApi.d.ts                                         | 33.3.2  | yes — types read; `setRowNodeExpanded`, `expandAll()`, `collapseAll()`                                                                                                                                   |
| S6  | https://unpkg.com/@mui/x-data-grid@8.5.0/models/gridRows.d.ts                                                      | 8.5.0   | yes — types read; `GridTreeBasicNode.depth`, `GridLeafNode.parent`, `GridBasicGroupNode.parent/children/childrenExpanded/footerId`, `isAutoGenerated`, `serverChildrenCount`, `GridRowTreeConfig`        |
| S7  | https://unpkg.com/@mui/x-data-grid-pro@8.5.0/esm/utils/tree/utils.js                                               | 8.5.0   | yes — compiled source read; `getVisibleRowsLookup` full body, lines 160-197                                                                                                                              |
| S8  | https://unpkg.com/@mui/x-data-grid@8.5.0/esm/hooks/features/filter/useGridFilter.js                                | 8.5.0   | yes — compiled source read; `applyStrategyProcessor('visibleRowsLookupCreation', …)`, flat-strategy identity comment, the `GRID_DEFAULT_STRATEGY` registration                                           |
| S8a | https://unpkg.com/@mui/x-data-grid-pro@8.5.0/esm/hooks/features/treeData/useGridTreeDataPreProcessors.js           | 8.5.0   | yes — compiled source read; imports `getVisibleRowsLookup` from tree utils and registers it for `TreeDataStrategy.Default` (line 128)                                                                    |
| S8b | https://unpkg.com/@mui/x-data-grid-premium@8.5.0/esm/hooks/features/rowGrouping/useGridRowGroupingPreProcessors.js | 8.5.0   | yes — compiled source read; registers the same `getVisibleRowsLookup` for `RowGroupingStrategy.Default` (line 145) — this is what proves grouping and tree data share one prune stage                    |
| S9  | https://unpkg.com/@angular/cdk@20.1.0/tree/index.d.ts                                                              | 20.1.0  | yes — types read; `levelAccessor`/`childrenAccessor` xor, `expansionKey`, private `_parents`/`_levels`/`_flattenedNodes`/`_expansionModel`, `_getExpansionModel(): SelectionModel<K>`                    |
| S10 | https://unpkg.com/@mui/x-data-grid@8.5.0/hooks/features/filter/gridFilterState.d.ts                                | 8.5.0   | yes — types read; `filteredRowsLookup` / `filteredChildrenCountLookup` / `filteredDescendantCountLookup` and the `GridVisibleRowsLookupState` "passing the filters AND its parents are expanded" comment |
| S11 | https://unpkg.com/@mui/x-data-grid@8.5.0/esm/hooks/features/filter/gridFilterSelector.js                           | 8.5.0   | yes — compiled source read; `gridVisibleRowsLookupSelector`, `gridExpandedSortedRowEntriesSelector` filter at line 57                                                                                    |
| S12 | https://unpkg.com/@tanstack/table-core@8.21.3/src/features/RowExpanding.ts                                         | 8.21.3  | yes — source read; `ExpandedState` union, `getIsExpanded`, `getCanExpand`, `getIsAllParentsExpanded`, `toggleExpanded`, `toggleAllRowsExpanded`, and `getExpandedDepth`'s `id.split('.')`                |
| S13 | https://unpkg.com/@mui/x-data-grid@8.5.0/esm/hooks/features/rows/gridRowsUtils.js                                  | 8.5.0   | yes — compiled source read; `buildRootGroup()` seeds `childrenExpanded: true`, `parent: null`                                                                                                            |
| S14 | https://unpkg.com/@mui/x-data-grid-pro@8.5.0/esm/utils/tree/utils.js                                               | 8.5.0   | yes — compiled source read; `getGroupRowIdFromPath` → `` `auto-generated-row-${pathStr}` ``, lines 3-6                                                                                                   |
| S15 | https://unpkg.com/@mui/x-data-grid@8.5.0/models/api/gridRowApi.d.ts                                                | 8.5.0   | yes — types read; `setRowChildrenExpansion: (id: GridRowId, isExpanded: boolean) => void` at line 110, on `GridRowProApi`                                                                                |
| S16 | https://unpkg.com/@mui/x-data-grid-pro@8.5.0/models/gridApiPro.d.ts                                                | 8.5.0   | yes — types read; `GridApiPro extends … GridRowProApi …`, confirming the method is on the general api, not a grouping-specific one                                                                       |
| S17 | https://www.ag-grid.com/javascript-data-grid/client-side-model/                                                    | 33.x    | no — fetched, did not contain the pipeline-stage detail; cited only as the page that did **not** confirm it                                                                                              |

## Pagination vs. expanded children (relocated from ADR-0011, D7)

Both surveyed libraries put pagination last in the row-model pipeline unconditionally and expose a
flag the pagination step reads, rather than reordering the pipeline:

| Library  | Flag                   | Default | Effect                                                |
| -------- | ---------------------- | ------- | ----------------------------------------------------- |
| TanStack | `paginateExpandedRows` | `true`  | children counted; a parent's children may span pages  |
| AG Grid  | `paginateChildRows`    | `false` | page holds N top-level rows; expanding grows the page |

ADR-0011 defaults to AG Grid's behavior (stable page boundaries over strict count) and exposes it
as `paginateChildRows` on `withPagination()`, reasoning that expanding is a frequent exploratory
action on a tree table and TanStack's default reflows every subsequent page on every expand.
