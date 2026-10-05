# Which table/grid/tree libraries keep a nested tree intermediate representation and flatten to a visible-row list on read?

**Date:** 2026-09-17 · **Depth:** standard

> Complement to
> `../../../grouping/archive/grouping-expansion-coupling/prior-art.md`, which asked _how is a
> collapsed descendant hidden_. This asks _what shape does the pipeline hold before it renders_.
> That file's two AG Grid "Unverified" entries are **resolved here** [S12]; one of its CDK claims
> is **narrowed** (see Contradictions).

## Answer

The proposed shape — features emit nested nodes, one engine-owned recursive `flattenVisible` walk
produces the flat list, `depth`/`parentId` derived by the walk — is the **majority design**, and
the walk-does-not-descend form is **unanimous among the libraries that hold a tree at all**
[S3][S6][S11][S12][S20]. AG Grid is the closest match: `FlattenStage` is a named pipeline stage
(`step: 'map'`) whose recursion stamps `uiLevel` as it emits and skips a subtree when
`rowNode.expanded` is false [S12]. TanStack holds **both at once** in one type — `RowModel.rows`
is nested before the expanded stage and flat after it, while `flatRows` stays the full
expansion-blind pre-order list [S1][S3]. The dissenters are instructive rather than
counter-examples: Angular Material's legacy `MatTreeFlattener` and Handsontable both flatten
_everything_ first and prune afterwards, and both pay for it — Material with a second level-tracking
pass [S9], Handsontable with a recursive descendant enumeration per collapse [S17].

## Method

- Versions pinned from the npm registry `latest` on 2026-09-17, then fetched from unpkg:
  `@tanstack/table-core@8.21.3` (ships `src/`), `@angular/cdk@20.1.0`,
  `@angular/material@20.1.0`, `primeng@22.1.1`, `@mui/x-data-grid@9.13.0`,
  `@glideapps/glide-data-grid@6.0.3`, `handsontable@18.1.1`, `@syncfusion/ej2-treegrid@34.2.8`,
  `slickgrid@5.20.1`.
- AG Grid source read from the GitHub repo at tag **`b36.2.0`** (the repo's tag prefix is `b`, not
  `v`; `v36.2.0` 404s). `FlattenStage` moved to `packages/ag-grid-enterprise/src/rowHierarchy/`,
  which is why the earlier discovery could not find it under `clientSideRowModel/`.
- Angular reads are of the published `fesm2022` bundles (unminified, comments intact), not `.d.ts`
  — the prior file read only `.d.ts` and so could not see the walk bodies.
- Reliability: Angular ships two tree engines side by side in v20 — the deprecated
  `TreeControl`/`MatTreeFlattener` pair and the `levelAccessor`/`childrenAccessor` pair. They take
  **opposite** approaches. Any claim about "how Angular does it" must name which.

## Evidence

### Tree held internally, flattened on read

- AG Grid `FlattenStage.execute()` starts from `rootNode.childrenAfterSort` and calls
  `recursivelyAddToRowsToDisplay(details, topList, result, skipLeafNodes, 0)` — the tree is the
  `RowNode.childrenAfterSort` links, the flat output is a fresh `RowNode[]` [S12].
- The descent is guarded exactly as proposed: `if (rowNode.expanded || excludedParent) { …
this.recursivelyAddToRowsToDisplay(details, rowNode.childrenAfterSort, result, skipLeafNodes,
uiLevelForChildren); }` — no descent into a collapsed node [S12].
- Depth is **derived by the walk**, not stamped by a feature: `addRowNodeToRowsToDisplay` ends with
  `rowNode.setUiLevel(details.isGroupMultiAutoColumn ? 0 : uiLevel)`, where `uiLevel` is the
  recursion parameter [S12].
- The walk is also where synthetic rows are injected — group total/footer rows
  (`_createRowNodeFooter`) and master-detail rows (`masterDetailSvc?.getDetail(rowNode)`) are
  pushed inline at the right position and level during the descent [S12].
- The stage is declared as one pipeline slot: `public readonly step: ClientSideRowModelStage =
'map'` [S12], consumed by `private doRowsToDisplay()` as `rowsToDisplay = flattenStage.execute()`
  [S13]. The stage list is documented in the model: "The ordered list of row processing stages:
  group → filter → pivot → aggregate → filterAggregates → sort → flatten." [S13]
- The flat output is private: `private rowsToDisplay: RowNode[] = []` [S13]. The nested links
  (`childrenAfterGroup`/`childrenAfterSort`) are public on `IRowNode`.
- PrimeNG TreeTable is the purest form. Public input is nested `TreeNode[]`; the render list is a
  derived `serializedValue`. The whole mechanism is nine lines [S11]:
  ```ts
  serializeNodes(parent, nodes, level, visible) {
    if (nodes && nodes.length) {
      for (let node of nodes) {
        node.parent = parent;
        const rowNode = { node, parent, level, visible: visible && (parent ? parent.expanded : true) };
        this.serializedValue.push(rowNode);
        if (rowNode.visible && node.expanded) {
          this.serializeNodes(node, node.children, level + 1, rowNode.visible);
        }
      }
    }
  }
  ```
  `level` and `parent` are walk-derived; expansion is read off the node during the descent [S11].
- CDK `CdkTree` (the `childrenAccessor` path) does the same, and says so in its own doc comment:
  "Given a set of root nodes and the current node level, flattens any nested nodes into a single
  array. **If any nodes are not expanded, then their children will not be added into the array.
  This will still traverse all nested children in order to build up our internal data models, but
  will not include them in the returned array.**" [S6]
- Its recursion returns `this._flattenNestedNodesWithExpansion(childNodes, level + 1).pipe(map(
nestedNodes => (this.isExpanded(node) ? nestedNodes : [])))` — descends always, emits only when
  expanded — and stamps `this._parents.set(childKey, node)` and `this.\_levels.set(childKey, level
  - 1)` inside the same walk [S6].
- SlickGrid's `DataView` builds a nested `SlickGroup` tree (`g.groups`, `g.rows`) and flattens it
  with `flattenGroupedRows(groups, level)`: `groupedRows[gl++] = g; if (!g.collapsed) { rows =
g.groups ? this.flattenGroupedRows(g.groups, level + 1) : g.rows; … }`, injecting `g.totals`
  during the same walk [S20].

### Both a tree and a derived flat list, in one type

- TanStack's `RowModel` is a single interface used at every stage:
  ````ts
  export interface RowModel<TData extends RowData> {
    rows: Row<TData>[]
    flatRows: Row<TData>[]
    rowsById: Record<string, Row<TData>>
  }
  ``` [S2]
  ````
- `getCoreRowModel` fills all three in one pass: `rows` gets only top-level rows
  (`rowModel.rows = accessRows(data)`), while `accessRows` recursively pushes **every** row into
  `rowModel.flatRows` and `rowModel.rowsById`, and hangs children off `row.subRows` [S1].
- So before the expanded stage, `rows` is a **tree** (nested via `subRows`) and `flatRows` is a
  complete expansion-blind pre-order list [S1].
- `expandRows(rowModel)` replaces `rows` with the flattened visible list and **passes `flatRows`
  and `rowsById` through untouched** [S3]:
  ```ts
  return { rows: expandedRows, flatRows: rowModel.flatRows, rowsById: rowModel.rowsById };
  ```
- The same field therefore changes shape mid-pipeline with no type change. The published docs
  describe the fields without mentioning this: "1. `rows` - An array of rows. 2. `flatRows` - An
  array of rows, but all sub-rows are flattened into the top level." [S4]
- Two early-outs in `getExpandedRowModel` return the _nested_ `rowModel` unchanged — when nothing
  is expanded, and when `paginateExpandedRows` is false [S3]. In the second case the consumer's
  `getRowModel()` (which is `getPaginationRowModel()` [S5]) receives nested `rows`, and child rows
  are rendered by the consumer's own row-rendering recursion instead.
- Syncfusion TreeGrid keeps both on the record itself: `ITreeData` carries `childRecords?:
ITreeData[]` **and** `parentItem?: ITreeData` **and** `level?: number` **and** `expanded?:
boolean` [S18], with a public `flatData: Object[]` on the grid [S21].

### Flat list plus a visibility predicate (the contrast group)

- Angular Material's legacy flattener is explicitly two passes. `flattenNodes(structuredData)`
  emits **every** node — "Flatten a list of node type T to flattened version of node F. Please
  note that type T may be nested, and the length of `structuredData` may be different from that of
  returned list `F[]`." [S9] Then `expandFlattenedNodes(nodes, treeControl)` — "Expand flattened
  node with current expansion status. The returned list may have different length." — walks the
  flat list keeping a `currentExpand[]` array indexed by level [S9]:
  ```ts
  let expand = true;
  for (let i = 0; i <= this.getLevel(node); i++) {
    expand = expand && currentExpand[i];
  }
  if (expand) {
    results.push(node);
  }
  if (this.isExpandable(node)) {
    currentExpand[this.getLevel(node) + 1] = treeControl.isExpanded(node);
  }
  ```
  This is the depth-only prune with no parent link at all — and it is the design Angular
  **deprecated**: `MatTreeFlatDataSource` is marked "@deprecated Use one of levelAccessor or
  childrenAccessor instead. To be removed in a future version. @breaking-change 21.0.0" [S10].
- `MatTreeFlatDataSource.connect()` recomputes the visible list on every expansion change by
  re-running `expandFlattenedNodes` over the cached full flat list [S10].
- Handsontable nested rows: the tree is the user's own data (`node.__children`), and `rewriteCache()`
  rebuilds a **complete** flat index — `cacheNode` pushes every node into `this.cache.rows` and
  records `nodeInfo.set(node, { parent, row, level })` in a WeakMap, recursing through
  `__children` [S16]. No expansion is consulted.
- Collapse is then a separate index-marking pass: `collapseChildren(row)` resolves each descendant
  to a physical row via `dataManager.getRowIndex(elem)` and calls
  `this.plugin.collapsedRowsMap.setValueAtIndex(physicalRow, true)` [S17]. Collapsing a node is
  O(descendants) of explicit marking rather than O(1) of not-descending.
- Syncfusion applies expansion as a per-record predicate over the flat data:
  `getExpandStatus(parent, record, parents): boolean` — "Returns the expand status of record …
  @param parents Parent Data collection" — i.e. an ancestor walk evaluated per row [S19].
- MUI X is in neither camp: `GridRowTreeConfig = Record<GridRowId, GridTreeNode>` [S14] — a flat
  lookup whose nodes hold `children: GridRowId[]`, `depth: number` and `childrenExpanded?: boolean`
  [S14]. A tree by id pointer, never a nested object graph, and never rebuilt into one.
- Glide Data Grid has no row model at all: `readonly rows: number` plus
  `readonly getCellContent: (cell: Item) => GridCell`, with `Item = [col, row]` [S15]. Hierarchy,
  expansion and flattening are entirely the consumer's problem. Maximal contrast.

### Public or internal

- Public nested input, internal flat output: PrimeNG (`value: TreeNode[]` in, `serializedValue`
  out) [S11]; CDK `childrenAccessor` (roots only in, flat DOM out) [S6][S8].
- Public nested output: AG Grid exposes `childrenAfterGroup`/`childrenAfterSort` on `IRowNode` but
  keeps `rowsToDisplay` private [S13].
- TanStack exposes **both** shapes as first-class public API and documents them together [S2][S4].
- CDK's docs state the trade in the library's own words: with `levelAccessor` (flat input) "The
  data source is responsible for handling node expand/collapse events and providing an updated
  array of renderable nodes"; with `childrenAccessor` (nested input) "the data provided by
  `dataSource` should _only_ contain the root nodes of the tree" and the tree does the rest [S8].

### Documented reasoning (Q4)

- Angular CDK, on why the DOM is flat even when the data is nested: "Flat trees are generally
  easier to style and inspect. They are also more friendly to scrolling variations, such as
  infinite or virtual scrolling." — with `childrenAccessor` listed as the option for when "the data
  source is already provided as a nested data structure" [S8]. This is the clearest published
  statement that _nested in, flat out_ is the intended shape, not a compromise.
- CDK, on the cost of the walk: it "will still traverse all nested children in order to build up
  our internal data models, but will not include them in the returned array" [S6] — i.e. the
  flatten walk cannot be cut short at a collapsed node if the engine also wants a complete
  parent/level index.
- AG Grid, on stage ownership: `FlattenStage` declares its own `refreshProps` —
  `['groupHideParentOfSingleChild', 'groupRemoveSingleChildren', 'groupRemoveLowestSingleChildren',
'groupTotalRow', 'masterDetail']` [S12] — so the set of options that invalidate the flat list is
  declared by the stage, not scattered across features.
- No ADR, design doc or maintainer issue comment was located for any of these choices. The
  reasoning above is all doc-comment and published-docs prose. See **Unverified**.

## Comparison

| Axis                | TanStack 8.21.3                  | AG Grid b36.2.0                                 | CDK 20.1.0 (`childrenAccessor`)         | Mat flattener 20.1.0             | PrimeNG 22.1.1                     | MUI X 9.13.0                            | Handsontable 18.1.1                    | Syncfusion 34.2.8                                | SlickGrid 5.20.1           | Glide 6.0.3 |
| ------------------- | -------------------------------- | ----------------------------------------------- | --------------------------------------- | -------------------------------- | ---------------------------------- | --------------------------------------- | -------------------------------------- | ------------------------------------------------ | -------------------------- | ----------- |
| Internal IR         | tree **and** flat, one type [S2] | tree (`childrenAfterSort`) [S12]                | nested input [S6]                       | nested input [S9]                | nested `TreeNode` [S11]            | flat map of id-linked nodes [S14]       | nested `__children` + flat cache [S16] | flat `flatData`, records cross-linked [S18][S21] | nested `SlickGroup` [S20]  | none [S15]  |
| Flatten site        | `expandRows` stage [S3]          | `FlattenStage.execute` (`step:'map'`) [S12]     | `_flattenNestedNodesWithExpansion` [S6] | `flattenNodes` [S9]              | `serializeNodes` [S11]             | n/a                                     | `rewriteCache` [S16]                   | n/a                                              | `flattenGroupedRows` [S20] | n/a         |
| Collapse applied    | during walk (don't descend) [S3] | during walk [S12]                               | during walk [S6]                        | second pass over flat list [S9]  | during walk [S11]                  | `visibleRowsLookup` filter (prior file) | index map marked per descendant [S17]  | per-row `getExpandStatus` predicate [S19]        | during walk [S20]          | consumer    |
| `depth` source      | set at row creation [S1]         | walk (`setUiLevel(uiLevel)`) [S12]              | walk (`_levels.set`) [S6]               | walk, then re-read to prune [S9] | walk (`level`) [S11]               | field on node [S14]                     | walk (`nodeInfo.level`) [S16]          | field on record [S18]                            | walk param [S20]           | n/a         |
| `parent` source     | set at row creation [S1]         | field on node                                   | walk (`_parents.set`) [S6]              | **absent** — depth only [S9]     | walk (mutates `node.parent`) [S11] | field on node [S14]                     | walk (`nodeInfo.parent`) [S16]         | field on record [S18]                            | implicit                   | n/a         |
| Nested shape public | yes, both [S2][S4]               | yes (`IRowNode` links); flat list private [S13] | input only [S8]                         | input only                       | input only [S11]                   | no nesting to expose [S14]              | it _is_ the user's data [S16]          | yes on record [S18]                              | yes (`SlickGroup`) [S20]   | n/a         |

## Synthesis

**The walk-vs-filter split tracks how much the engine wants to do during flattening, not
performance.** Every library that injects synthetic rows — AG Grid's group footers and detail rows
[S12], SlickGrid's totals rows [S20] — does it inside the flatten walk, because that is the only
place where "immediately after this node's children, at this level" is a well-defined position.
A filter over an already-flat list cannot insert; it can only remove. If `libs/table` ever
wants a group-footer row, a "load more" row under a lazy branch, or a detail row, the flatten-walk
form is the one that admits them without a second insertion pass. That is a stronger argument for
the proposal than anything about `depth` derivation.

**AG Grid shows a capability the flat+prune form cannot express at all.** `groupRemoveSingleChildren`
makes the walk _skip emitting_ a group node while still descending into it, and pass the
**parent's** level down to the children (`const uiLevelForChildren = excludedParent ? uiLevel :
uiLevel + 1`) [S12]. A terminal prune over a flat list whose `depth` was already stamped by the
grouping feature cannot do this — the depths are wrong by one for every descendant, and the
skipped node is not recoverable. Node-elision is a real feature of the nested form.

**TanStack's design is the cautionary one, and it is the closest to where this codebase is now.**
Holding a tree and a flat list in the same type, with `rows` silently changing shape at the
expanded stage [S1][S3], means no consumer can tell from the type whether `rows` is nested. Two
early-out branches [S3] make it conditional on runtime state. The public docs do not mention it
[S4]. If `libs/table` adopts a nested `RenderNode`, the lesson is to give the nested IR and
the flat `RenderRow[]` **different type names** and never let one field hold both — the stated goal
("flat data in, flat rows out") already implies the nested form stays internal, which is the right
call and the one PrimeNG and CDK also make [S8][S11].

**The two libraries that flatten-everything-then-prune are the two that regret it.** Angular
deprecated `MatTreeFlatDataSource`/`MatTreeFlattener` outright in favour of the walk-based
`childrenAccessor` [S10], and Handsontable's version needs a recursive descendant enumeration on
every collapse to mark an index map [S17] where the walk form needs one `if`. This is direct
evidence against the current terminal-prune-filter stage, from the one ecosystem (Angular) that
has shipped both designs and picked one.

**But CDK also names the cost the proposal will pay.** Its comment — the walk "will still traverse
all nested children in order to build up our internal data models, but will not include them in the
returned array" [S6] — means the O(visible) saving is illusory the moment anything needs a complete
index: a `parentId` for every row including hidden ones, "expand all", descendant counts under a
collapsed group, or keyboard navigation over the full tree. CDK keeps a separate `_flattenedNodes`
(all nodes) alongside `renderNodes` (visible) for exactly this [S7], and TanStack keeps `flatRows`
for the same reason [S1]. Plan for **two** outputs from one walk, not one.

**`depth`/`parentId` derived-by-walk is settled prior art.** AG Grid `setUiLevel(uiLevel)` [S12],
CDK `_levels.set`/`_parents.set` [S6], PrimeNG `level`/`parent` on the row node [S11], SlickGrid's
`level` recursion parameter [S20] — four independent engines derive both from the walk. Only
TanStack stamps them at row-creation time [S1], and that is what forces its grouping feature to
_reset_ them (`row.depth = 0; row.parentId = undefined`, noted in the earlier file). Deriving is
the mainstream choice and it removes exactly that reset.

## Against

- **A nested IR only pays off if a stage actually nests.** MUI X runs full tree data and row
  grouping on a flat `Record<GridRowId, GridTreeNode>` with `children: GridRowId[]` [S14] and needs
  no nested object graph at any point. If `group` and `tree` are the only nesting stages and
  neither ever needs to hand a subtree to another stage as a value, the id-pointer form gets the
  same recursion with no new type and no re-parenting on every recompute.
- **Mutation creeps in.** PrimeNG's `serializeNodes` writes `node.parent = parent` onto the
  consumer's own data object during the walk [S11], and Handsontable's `nodeInfo` WeakMap exists
  because it cannot [S16]. A walk that derives `parentId` must return it in the emitted
  `RenderRow`, never write it back into the `RenderNode` — otherwise the "derived, not stamped"
  benefit is lost on the first recompute.
- **Depth-only pruning genuinely works and needs no tree.** `MatTreeFlattener.expandFlattenedNodes`
  prunes correctly with a `currentExpand[]` array indexed by level and no parent link whatsoever
  [S9]. It is deprecated for accessibility and API reasons [S10][S8], not because it produced wrong
  rows. If the current flat pipeline is not actually broken, this is the honest counter-case.
- **AG Grid's flatten stage is enterprise-only.** `FlattenStage` ships in
  `packages/ag-grid-enterprise/src/rowHierarchy/` [S12], and `doRowsToDisplay` falls back to
  `rootNode?.childrenAfterSort` with a flat `setUiLevel(0)` loop when the stage is absent [S13].
  Even the strongest example treats the recursive flatten as an opt-in layer over a flat default.

## Contradictions and extensions vs. the earlier prior-art file

- **Resolved (was Unverified).** "AG Grid's `doRowsToDisplay` body … that it performs the recursive
  expanded-only descent is a reasonable inference … not a source read." It is now a source read:
  `recursivelyAddToRowsToDisplay` guards descent on `rowNode.expanded` [S12].
- **Resolved (was Unverified).** "`'map'` in the `ClientSideRowModelStage` union is the likely
  candidate by elimination, but no published artifact names it as the flatten stage." Confirmed:
  `FlattenStage` declares `public readonly step: ClientSideRowModelStage = 'map'` [S12].
- **Narrowed.** The earlier file says CDK "is the one case that accepts a depth-only input, and it
  pays for it by deriving the parent link internally before it can render." Accurate for the
  `levelAccessor` path (`_calculateParents`) [S7], but CDK has two paths: with `childrenAccessor`
  there is no depth-only input and parents are stamped during the flatten walk, not reconstructed
  [S6].
- **Contradicted in emphasis.** The earlier file treats "prune as a terminal stage over an already
  ordered list" as the unanimous shape. At the IR level it is not: AG Grid, CDK-with-children,
  PrimeNG and SlickGrid never build a full flat list to prune — the flat list _is_ the prune's
  output [S6][S11][S12][S20]. MUI X's `visibleRowsLookup` is the lookup form, and it is the
  minority, not the norm.
- **Extends.** The earlier file's open question "which prune form — emit or lookup" gains a third
  consideration it did not have: only the emit/walk form can **insert** synthetic rows and **elide**
  nodes mid-tree [S12][S20].

## Not researched

- react-table-library `useTree`, TreeGrid (treegrid.net), and Vaadin/Telerik grids — no claim made.
- Server-side and lazy row models, where a collapsed subtree may not exist client-side.
- Virtual scrolling interaction with either form.
- Any benchmark. No performance claim here is measured; all are structural.
- This repo's own `RenderRow` pipeline and the existing prune stage were not read — the problem
  statement is taken from the task description as given.

## Unverified

- **No ADR, design doc, RFC or maintainer issue/PR comment was found for any of these choices.**
  Searched the AG Grid repo for `flattenStage`/`doRowsToDisplay` (code search only returned source
  files) and read the TanStack and Angular published docs. Everything quoted under "Documented
  reasoning" is doc-comment or user-guide prose, not a recorded decision. Confirming would need
  issue/PR archaeology on `angular/components` for the `MatTreeFlattener` deprecation and on
  `TanStack/table` for the `rows`/`flatRows` split — not attempted.
- **Whether TanStack's shape-shifting `rows` field is intentional or incidental.** The two early-out
  branches [S3] are read directly from source; that no consumer relies on the distinction is an
  inference. No upstream issue located.
- **Syncfusion's flatten site.** `ITreeData` [S18], `flatData` [S21] and `getExpandStatus` [S19] are
  read from published `.d.ts`; the function that produces `flatData` from a hierarchical
  `dataSource` was not read (it lives in a `.js` bundle not fetched). "Filter over flat" is inferred
  from `getExpandStatus`'s signature taking a `parents` collection, not from the render loop.
- **Handsontable's render path.** `rewriteCache` [S16] and `collapsedRowsMap.setValueAtIndex` [S17]
  are read; that the collapsed map is consumed as a row-hiding index map (rather than re-entered
  into the cache) is inferred from the `trimRows`/`untrimRows` naming, not from the consuming code.
- **MUI X 9.13.0 vs 8.5.0.** Only `models/gridRows.d.ts` was re-read at 9.13.0 [S14]; the earlier
  file's 8.5.0 reads of `getVisibleRowsLookup` were not re-verified against 9.x.

## Sources

|     | Source                                                                                                                            | Version | Verified                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/getCoreRowModel.ts                                                        | 8.21.3  | yes — source read; `accessRows` fills `rows` (top-level only), `flatRows` (all), `rowsById`, and `row.subRows`                                                           |
| S2  | https://unpkg.com/@tanstack/table-core@8.21.3/src/types.ts                                                                        | 8.21.3  | yes — source read; `RowModel` interface, lines 221-225                                                                                                                   |
| S3  | https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/getExpandedRowModel.ts                                                    | 8.21.3  | yes — source read; both early-out branches and the `{ rows: expandedRows, flatRows: rowModel.flatRows, … }` return                                                       |
| S4  | https://raw.githubusercontent.com/TanStack/table/v8.21.3/docs/guide/row-models.md                                                 | 8.21.3  | yes — docs read; "Row Model Data Structure" section and the stage-order line                                                                                             |
| S5  | https://unpkg.com/@tanstack/table-core@8.21.3/src/core/table.ts                                                                   | 8.21.3  | yes — source read; `getRowModel: () => table.getPaginationRowModel()`, line 390                                                                                          |
| S6  | https://unpkg.com/@angular/cdk@20.1.0/fesm2022/tree.mjs                                                                           | 20.1.0  | yes — bundle read; `_flattenNestedNodesWithExpansion` full body and doc comment, lines 1020-1056                                                                         |
| S7  | https://unpkg.com/@angular/cdk@20.1.0/fesm2022/tree.mjs                                                                           | 20.1.0  | yes — bundle read; `_computeRenderingData` four branches and `_calculateParents`, lines 1057-1120                                                                        |
| S8  | https://raw.githubusercontent.com/angular/components/20.1.0/src/cdk/tree/tree.md                                                  | 20.1.0  | yes — docs read; "Flat trees are generally easier to style and inspect…", and the `levelAccessor`/`childrenAccessor` responsibility split, lines 26 and 157-178          |
| S9  | https://unpkg.com/@angular/material@20.1.0/fesm2022/tree.mjs                                                                      | 20.1.0  | yes — bundle read; `MatTreeFlattener._flattenNode`, `flattenNodes`, `expandFlattenedNodes`, lines 371-438                                                                |
| S10 | https://unpkg.com/@angular/material@20.1.0/fesm2022/tree.mjs                                                                      | 20.1.0  | yes — bundle read; `MatTreeFlatDataSource` `@deprecated … @breaking-change 21.0.0` and its `connect()`, lines 440-483                                                    |
| S11 | https://unpkg.com/primeng@22.1.1/fesm2022/primeng-treetable.mjs                                                                   | 22.1.1  | yes — bundle read; `serializeNodes` and `serializePageNodes`, lines 2025-2060                                                                                            |
| S12 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-enterprise/src/rowHierarchy/flattenStage.ts            | b36.2.0 | yes — source read; `step: 'map'`, `refreshProps`, `execute`, `recursivelyAddToRowsToDisplay`, `addRowNodeToRowsToDisplay`, `uiLevelForChildren`, footer/detail injection |
| S13 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/clientSideRowModel/clientSideRowModel.ts | b36.2.0 | yes — source read; stage-order comment (line 80), `private rowsToDisplay` (line 60), `doRowsToDisplay` and the no-flattenStage fallback (lines 1310-1333)                |
| S14 | https://unpkg.com/@mui/x-data-grid@9.13.0/models/gridRows.d.ts                                                                    | 9.13.0  | yes — types read; `GridRowTreeConfig = Record<GridRowId, GridTreeNode>` (line 185), `depth` (62), `children: GridRowId[]` (90), `childrenExpanded?` (105)                |
| S15 | https://unpkg.com/@glideapps/glide-data-grid@6.0.3/dist/dts/data-editor/data-editor.d.ts                                          | 6.0.3   | yes — types read; `readonly rows: number` (line 123), `readonly getCellContent: (cell: Item) => GridCell` (line 317)                                                     |
| S16 | https://unpkg.com/handsontable@18.1.1/plugins/nestedRows/data/dataManager.js                                                      | 18.1.1  | yes — source read; `rewriteCache`, `cacheNode` (`cache.rows`, `cache.levels`, `nodeInfo` WeakMap with `{parent,row,level}`), `__children` recursion, lines 45-105        |
| S17 | https://unpkg.com/handsontable@18.1.1/plugins/nestedRows/ui/collapsing.js                                                         | 18.1.1  | yes — source read; `collapseChildren`, `trimRows` → `collapsedRowsMap.setValueAtIndex(physicalRow, true)`, lines 91-140 and 429-440                                      |
| S18 | https://unpkg.com/@syncfusion/ej2-treegrid@34.2.8/src/treegrid/base/interface.d.ts                                                | 34.2.8  | yes — types read; `ITreeData` with `childRecords`, `hasChildRecords`, `expanded`, `parentItem`, `index`, `level`, lines 9-49                                             |
| S19 | https://unpkg.com/@syncfusion/ej2-treegrid@34.2.8/src/treegrid/utils.d.ts                                                         | 34.2.8  | yes — types read; `getExpandStatus(parent, record, parents): boolean` and `findParentRecords`/`findChildrenRecords`                                                      |
| S20 | https://unpkg.com/slickgrid@5.20.1/dist/browser/slick.dataview.js                                                                 | 5.20.1  | yes — source read; `flattenGroupedRows(groups, level)` with `if (!g.collapsed)` descent and inline `g.totals` push, lines 552-564                                        |
| S21 | https://unpkg.com/@syncfusion/ej2-treegrid@34.2.8/src/treegrid/base/treegrid.d.ts                                                 | 34.2.8  | yes — types read; `flatData: Object[]`, line 134                                                                                                                         |
| S22 | https://raw.githubusercontent.com/TanStack/table/v8.21.3/docs/guide/expanding.md                                                  | 8.21.3  | yes — docs read; `getSubRows`, `ExpandedState` semantics; cited as background only, no claim above rests on it                                                           |
