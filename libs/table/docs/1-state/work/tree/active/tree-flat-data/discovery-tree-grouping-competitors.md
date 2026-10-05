# Tree data + row grouping by a column: what does a person see when a child's group value differs from its parent's?

**Date:** 2026-09-27 · **Mode:** competitor-capabilities

## Answer

- No surveyed library groups every tree row by its own value.
  Nobody splits a child from its parent into another group.
- Only TanStack runs both at once: root rows are grouped by
  their own value, and each subtree follows its root. The
  child's own value is ignored. An open issue (#5594, since
  2024-06) is a person expecting the opposite.
- AG Grid and MUI X let you turn on both, but one silently
  wins. They disagree on which one: in AG Grid tree data wins,
  in MUI X row grouping wins. Neither documents the collision.
- The dedicated tree components (PrimeNG TreeTable, DevExtreme
  TreeList, Syncfusion TreeGrid, Kendo TreeList) have no row
  grouping at all. Syncfusion closed the request "Declined -
  Won't do".
- Filtering defaults split in two: keep the ancestors of a
  match, or keep the descendants of a match. Group counts in
  AG Grid and MUI include all descendants, not just direct
  children.

## Method and source reliability

Read 2026-09-27 over WebFetch. No packages installed.

| Library                | Pin             | Pin source                                                   | What was read                                              |
| ---------------------- | --------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| AG Grid Enterprise     | 36.2.0          | `registry.npmjs.org/ag-grid-enterprise/latest`               | docs `.mdoc` and source at tag `b36.2.0`                   |
| MUI X Premium/Pro      | 9.14.0          | `registry.npmjs.org/@mui/x-data-grid-premium/latest`         | docs `.md` and source at tag `v9.14.0`                     |
| TanStack Table         | 8.21.3 (source) | registry latest is **9.2.4**                                 | v8 `src/` on unpkg. v9 ships no `src/`, so v9 was not read |
| PrimeNG                | 22.1.1          | `registry.npmjs.org/primeng/latest`                          | `fesm2022/primeng-treetable.mjs` on unpkg, primeng.dev     |
| DevExtreme             | 26.1.5          | `registry.npmjs.org/devextreme/latest`                       | docs site, version selector shows v26.1                    |
| Syncfusion TreeGrid    | 34.2.8          | `registry.npmjs.org/@syncfusion/ej2-angular-treegrid/latest` | docs site, no version marker (dated 08 Aug 2026)           |
| Kendo Angular TreeList | 25.2.0          | `registry.npmjs.org/@progress/kendo-angular-treelist/latest` | docs site, no version marker                               |

Reliability notes that change how to read the evidence:

- **AG Grid issue state:** `closed` means "moved to the
  private tracker or answered", not "fixed". #11314 was closed
  by staff who sent the person to the paid support portal.
- **Reaction counts are not used.** AG Grid 👍 carries no
  signal. TanStack #5594 has 0 reactions. That is not the same
  as "nobody wants it".
- **The docs site is not the pin** for Syncfusion, Kendo and
  DevExtreme. Their pages carry no package version. The claims
  are from the live page on 2026-09-27.
- **A negative read of a large bundle over WebFetch can miss
  text.** The PrimeNG "no grouping" finding is backed by the
  docs section list as well, not only by the bundle.
- **Two collision findings (AG Grid, MUI X) come from source,
  not docs.** No vendor page states what happens when both are
  on. The MUI X one is an inference from registration order,
  see Unverified.

## Findings

### Axis 1 — can tree data and row grouping run together, and what does a person see?

| Library                       | Both on at once?                                               | What a person sees when a child's value differs from its parent's                                                                                                                                                                                                                 | Source                                                                                                                                                                                       |
| ----------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AG Grid 36.2.0                | Config accepts both. No warning for `rowGroup` + `treeData`    | **Tree wins.** Row group columns are skipped. The child stays under its parent                                                                                                                                                                                                    | [groupStage.ts `getWantedStrategyType()`](https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-enterprise/src/rowHierarchy/groupStage.ts)                              |
| AG Grid 36.2.0                | No validation rule for this pair                               | Only pivot and `groupHideOpenParents` are rejected with tree data                                                                                                                                                                                                                 | [gridOptionsValidations.ts](https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/validation/rules/gridOptionsValidations.ts)                             |
| AG Grid 36.2.0                | —                                                              | No colDef rule mentions tree data                                                                                                                                                                                                                                                 | [colDefValidations.ts](https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/validation/rules/colDefValidations.ts)                                       |
| MUI X 9.14.0                  | Both props accepted. Only one "rowTree" strategy can be active | **Row grouping wins** when `rowGroupingModel` is non-empty (inference, see Unverified). Tree hierarchy is not shown                                                                                                                                                               | [useGridStrategyProcessing.ts](https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid/src/hooks/core/strategyProcessing/useGridStrategyProcessing.ts)                      |
| MUI X 9.14.0                  | —                                                              | Row grouping is available whenever the sanitized model has length > 0. Tree data does not check it                                                                                                                                                                                | [gridRowGroupingUtils.ts `setStrategyAvailability`](https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-premium/src/hooks/features/rowGrouping/gridRowGroupingUtils.ts) |
| MUI X 9.14.0                  | —                                                              | Tree data is available when `props.treeData && !props.dataSource`                                                                                                                                                                                                                 | [useGridTreeDataPreProcessors.tsx](https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/hooks/features/treeData/useGridTreeDataPreProcessors.tsx)                |
| MUI X 9.14.0                  | —                                                              | Row grouping preprocessors are registered before tree data ones                                                                                                                                                                                                                   | [useDataGridPremiumComponent.tsx](https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-premium/src/DataGridPremium/useDataGridPremiumComponent.tsx)                      |
| TanStack 8.21.3               | **Yes**, `getSubRows` + `getGroupedRowModel` compose           | **Tree never split.** Only root rows are grouped by their own value. Each subtree follows its root. Once grouping depth is reached, `row.subRows` is recursed with no more grouping                                                                                               | [getGroupedRowModel.ts](https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/getGroupedRowModel.ts)                                                                                       |
| TanStack                      | —                                                              | A person expected the opposite: "I'd expect to have 'John (4)', and to actually have all rows and subRows grouped by firstName". Actual: "only the top-level rows are grouped by firstName". Open, opened 2024-06-06, 3 comments, last 2026-05-26 ("any progress on this issue?") | [TanStack/table#5594](https://api.github.com/repos/TanStack/table/issues/5594)                                                                                                               |
| TanStack                      | —                                                              | Contributor workaround: "The `groupBy` function only handles top-level rows… I was able to go around this… by making it recursive"                                                                                                                                                | [#5594 comments](https://api.github.com/repos/TanStack/table/issues/5594/comments)                                                                                                           |
| TanStack                      | —                                                              | Related open question, unanswered: "Is it possible to have a (sub)row appear in multiple groups?" (2024-05-17)                                                                                                                                                                    | [Discussion #5564](https://github.com/TanStack/table/discussions/5564)                                                                                                                       |
| PrimeNG 22.1.1 TreeTable      | **No grouping**                                                | Not applicable. The section list has "Column Group" (header grouping) and no row grouping                                                                                                                                                                                         | [primeng.dev/treetable](https://primeng.dev/treetable)                                                                                                                                       |
| PrimeNG 22.1.1 TreeTable      | —                                                              | `groupRowsBy`, `rowGroupMode`, `rowGroup` not found in the bundle                                                                                                                                                                                                                 | [primeng-treetable.mjs](https://unpkg.com/primeng@22.1.1/fesm2022/primeng-treetable.mjs)                                                                                                     |
| DevExtreme 26.1 TreeList      | **No grouping**                                                | Column API has no `groupIndex`, `allowGrouping`, `autoExpandGroup`, `groupCellTemplate`                                                                                                                                                                                           | [dxTreeList columns](https://js.devexpress.com/Angular/Documentation/ApiReference/UI_Components/dxTreeList/Configuration/columns/)                                                           |
| DevExtreme 26.1 TreeList      | —                                                              | Configuration has no `grouping` or `groupPanel`. It does have `dataStructure`, `parentIdExpr`, `itemsExpr`                                                                                                                                                                        | [dxTreeList configuration](https://js.devexpress.com/Angular/Documentation/ApiReference/UI_Components/dxTreeList/Configuration/)                                                             |
| Syncfusion TreeGrid           | **No grouping**                                                | Feature list has no grouping                                                                                                                                                                                                                                                      | [TreeGrid overview](https://ej2.syncfusion.com/angular/documentation/treegrid/overview)                                                                                                      |
| Syncfusion TreeGrid           | —                                                              | Angular request "In a tree grid, I want to group the data of a specified level" (2022-07-18, 1 vote): **Declined - Won't do**                                                                                                                                                     | [Syncfusion feedback 36412](https://www.syncfusion.com/feedback/36412/how-to-group-the-data-in-a-tree-grid)                                                                                  |
| Kendo Angular TreeList        | **No grouping**                                                | `TreeListComponent` API has no `group` / `groupable` input                                                                                                                                                                                                                        | [TreeListComponent API](https://www.telerik.com/kendo-angular-ui/components/treelist/api/treelistcomponent)                                                                                  |
| Kendo (jQuery, **secondary**) | —                                                              | Staff: drag-to-group "is not included with the Kendo UI TreeList". Feature request opened 2020                                                                                                                                                                                    | [Telerik forum](https://www.telerik.com/forums/treelist-with-groupable-header-columns)                                                                                                       |
| AG Grid (demand)              | —                                                              | Enterprise customer asks for a hybrid of row grouping and tree data (2025-07-11). Staff sent them to the support portal. Closed 2025-07-17                                                                                                                                        | [ag-grid#11314](https://api.github.com/repos/ag-grid/ag-grid/issues/11314)                                                                                                                   |

### Axis 2 — filtering on a hierarchy (default behavior)

| Library                | Default                                                                                                          | Opt-outs                                                                                                                       | Source                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AG Grid tree data      | "when a group row passes a Filter, the children will also be displayed"                                          | `excludeChildrenWhenTreeDataFiltering`                                                                                         | [tree-data-filtering](https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-filtering/index.mdoc) |
| MUI X tree data        | "a node is included if it _or_ any of its descendents passes". "filtering is applied at every level of the tree" | `disableChildrenFiltering` (top level only)                                                                                    | [tree-data.md](https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/tree-data/tree-data.md)                                              |
| TanStack               | Parent-down: "if a parent row is filtered out, all of its children will be filtered out as well"                 | `filterFromLeafRows: true` (keep ancestors of a match), `maxLeafRowFilterDepth` (default 100)                                  | [column-filtering.md @ v8.21.3](https://raw.githubusercontent.com/TanStack/table/v8.21.3/docs/api/features/column-filtering.md)                             |
| PrimeNG TreeTable      | `filterMode` "lenient" (default)                                                                                 | "_lenient_ (includes all descendants) or _strict_ (filters every level independently)"                                         | [primeng.dev/treetable](https://primeng.dev/treetable)                                                                                                      |
| PrimeNG TreeTable      | —                                                                                                                | Default `'lenient'` in the input declaration                                                                                   | [primeng-treetable.mjs](https://unpkg.com/primeng@22.1.1/fesm2022/primeng-treetable.mjs)                                                                    |
| DevExtreme TreeList    | `filterMode` default `'withAncestors'`                                                                           | Three modes: "matching rows only, matching rows with ancestors, or matching rows with ancestors and descendants (full branch)" | [dxTreeList configuration](https://js.devexpress.com/Angular/Documentation/ApiReference/UI_Components/dxTreeList/Configuration/)                            |
| Syncfusion TreeGrid    | `hierarchyMode` Parent (default): "Filtered records are displayed along with their parent records"               | Child, Both, None                                                                                                              | [TreeGrid filtering](https://ej2.syncfusion.com/angular/documentation/treegrid/filtering/filtering)                                                         |
| Kendo Angular TreeList | Not stated on the page                                                                                           | —                                                                                                                              | [TreeList filtering](https://www.telerik.com/kendo-angular-ui/components/treelist/filtering)                                                                |

### Axis 3 — counts and aggregates on parent / group rows

| Library             | What the count or aggregate covers                                                                                                                                                              | Source                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AG Grid tree data   | "the child count is a count of all descendants, including groups" (filler groups count)                                                                                                         | [tree-data-group-column](https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-group-column/index.mdoc) |
| AG Grid             | `allChildrenCount`: "Number of children and grand children". `allLeafChildren` excludes filler nodes and group nodes                                                                            | [iRowNode.d.ts](https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/interfaces/iRowNode.d.ts)                                                               |
| AG Grid tree data   | With aggregation, "any supplied group data will be ignored in favour of the aggregated values" — the parent's own value is replaced                                                             | [tree-data-paths](https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-paths/index.mdoc)               |
| AG Grid tree data   | Aggregates use filtered rows only by default. `suppressAggFilteredOnly` includes all                                                                                                            | [tree-data-filtering](https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-filtering/index.mdoc)       |
| MUI X tree data     | Group cell shows `(${filteredDescendantCount})` — filtered descendants                                                                                                                          | [GridTreeDataGroupingCell.tsx](https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/components/GridTreeDataGroupingCell.tsx)          |
| MUI X row grouping  | Same selector, same filtered descendant count                                                                                                                                                   | [GridGroupingCriteriaCell.tsx](https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-premium/src/components/GridGroupingCriteriaCell.tsx)      |
| MUI X row grouping  | "By default, row group cells display the number of descendant rows they contain". `hideDescendantCount` hides it                                                                                | [row-grouping.md](https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/row-grouping/row-grouping.md)                                           |
| MUI X aggregation   | Aggregated value "always takes precedence over any existing row data". "By default, aggregation only uses filtered rows". `aggregationRowsScope: 'all'`                                         | [aggregation.md](https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/aggregation/aggregation.md)                                              |
| TanStack 8.21.3     | Group `leafRows` = `depth ? flattenBy(groupedRows, row => row.subRows) : groupedRows`. At grouping depth 0, tree descendants are **left out** of `leafRows`. At depth ≥ 1 they are **included** | [getGroupedRowModel.ts](https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/getGroupedRowModel.ts)                                                            |
| TanStack 8.21.3     | `flattenBy` pushes each row, then recurses into its children                                                                                                                                    | [utils.ts](https://unpkg.com/@tanstack/table-core@8.21.3/src/utils.ts)                                                                                            |
| Syncfusion TreeGrid | `showChildSummary` shows "child row aggregate values in their respective parent row". Direct children or all descendants is not stated                                                          | [TreeGrid aggregates](https://ej2.syncfusion.com/angular/documentation/treegrid/aggregates/aggregates)                                                            |

### Axis 4 — tier split

| Library  | Tree data                        | Row grouping                                                                     | Source                                                                                                                                              |
| -------- | -------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| MUI X    | **Pro**                          | **Premium**                                                                      | [tree-data.md](https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/tree-data/tree-data.md)                                      |
| MUI X    | —                                | Premium badge in heading                                                         | [row-grouping.md](https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/row-grouping/row-grouping.md)                             |
| AG Grid  | Enterprise                       | Enterprise ("As row grouping and tree data are some of our Enterprise features") | [ag-grid#11314 comments](https://api.github.com/repos/ag-grid/ag-grid/issues/11314/comments)                                                        |
| AG Grid  | Tree data page marked enterprise | —                                                                                | [tree-data-paths](https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-paths/index.mdoc) |
| TanStack | Free (MIT)                       | Free                                                                             | Unverified licence read, see Unverified                                                                                                             |

### Side finding — flat parent-id input (relevant to `tree-flat-data`)

| Library             | Flat parent-id input                                                                                                          | Source                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AG Grid             | `treeDataParentIdField`. Needs `getRowId`. "cycles and missing parent rows are not allowed". Called "the most performant way" | [tree-data-self-referential](https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-self-referential/index.mdoc) |
| DevExtreme TreeList | `dataStructure` + `parentIdExpr` (plain) or `itemsExpr` (nested)                                                              | [dxTreeList configuration](https://js.devexpress.com/Angular/Documentation/ApiReference/UI_Components/dxTreeList/Configuration/)                                          |

## Synthesis — where they disagree

### Split the tree, or keep it whole?

- **No one splits.** Five of seven have no answer to the
  question: four tree components have no grouping, and AG
  Grid drops grouping. MUI X drops the tree instead.
  TanStack is the only one that composes, and it keeps the
  subtree whole under its root's group.
- **Every library does something different, and the
  differences are silent.** AG Grid: tree wins. MUI X: grouping
  wins. TanStack: grouping on roots, tree below. No vendor
  documents the collision or warns about it. A person turning
  on "group by status" in a tree grid gets one of three
  results depending on the vendor, and no feedback.
- **The only person voice on record wanted the opposite of the
  one library that composes.** TanStack #5594 expected
  descendants regrouped by their own value ("John (4)"). Open
  2+ years, no maintainer answer. Syncfusion's version of the
  request was declined. One need, two vendors, no delivery.
- **Implication:** "children follow their root" is the only
  shipped behavior. It is defensible, but it is precedent by
  default, not a stated decision anywhere. "Group by own value"
  has demand evidence (thin: 1 issue, 1 declined request, 1
  unanswered discussion) and no implementation.

### Filtering: keep ancestors, or keep descendants?

- **Keep ancestors of a match by default:** MUI X, DevExtreme
  (`withAncestors`), Syncfusion (Parent).
- **Keep descendants of a match by default:** AG Grid (children
  shown when a parent passes), PrimeNG (`lenient`).
- **Keep neither, parent gates children:** TanStack (parent-down
  by default; ancestors only with `filterFromLeafRows`).
- DevExtreme and Syncfusion expose all combinations as one
  mode option. AG Grid and MUI X expose one opt-out flag each.
  TanStack exposes two independent knobs.
- **Implication:** there is no category default. The three-way
  split is the product decision, and a mode-style option is the
  shape two vendors converged on.

### Counts and aggregates

- AG Grid and MUI X count **all descendants**, not direct
  children. AG Grid counts filler groups too. MUI X counts
  filtered descendants.
- Both replace a parent's own data with the aggregate when
  aggregation is on. Neither blends the parent's own value in.
- TanStack is internally inconsistent when tree and grouping
  combine: tree descendants enter `leafRows` only below the
  first grouping level. That is a source reading, not a
  documented rule.

### Tier split

- MUI X meters the two features at **different tiers**: tree
  data Pro, grouping Premium. So the combination is a Premium
  question, even though its strategy system lets only one
  run. AG Grid puts both in Enterprise.
- The four tree-component vendors do not sell grouping on the
  tree at any tier.

## Not researched

- TanStack v9 behavior (9.2.4 ships no `src/`). All TanStack
  claims are v8.21.3.
- AG Grid server-side row model (SSRM) tree data + grouping.
- MUI X `dataSource` (server) strategies.
- DevExtreme DataGrid grouping with a hierarchy (DataGrid has
  no tree mode; not read).
- Syncfusion and Kendo DataGrid products (they have grouping,
  but no tree).
- Licence tiers for DevExtreme, Syncfusion, Kendo, TanStack.
- Forums and Stack Overflow.

## Unverified

- **MUI X "row grouping wins"** is an inference: `getActiveStrategy`
  returns the first available entry via `Array.find` over a
  `Map`, and row grouping preprocessors register first. The
  insertion point of each strategy into the `Map` was not
  traced line by line, and no MUI doc states it. Confirm by
  reading `setStrategyAvailability` in
  `useGridStrategyProcessing.ts` or by a demo with both on.
- **AG Grid runtime:** that a `rowGroup` column with `treeData`
  is silently ignored and shows no warning is read from
  `groupStage.ts` and the two validation files. Other warning
  sites (for example column model services) were not read.
- AG Grid row-grouping group count (leaf count vs. all
  children, filtered or not): the `grouping-group-column` slug
  returned 404.
- Whether AG Grid `allChildrenCount` is filtered.
- TanStack's grouping-cell count shown in the guide example.
- DevExtreme `filterMode` enum names (`fullBranch`,
  `withAncestors`, `matchOnly`): only `'withAncestors'` was
  seen on the page.
- Kendo Angular TreeList filter behavior on ancestors and
  descendants.
- Syncfusion `showChildSummary` scope.
- Syncfusion forum 184584 staff reply (page truncated).
- TanStack licence (MIT) — not read this run.

## Sources

| Claim                                                           | Source                                                                                                                                             |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| AG Grid pin 36.2.0                                              | https://registry.npmjs.org/ag-grid-enterprise/latest                                                                                               |
| MUI X pin 9.14.0                                                | https://registry.npmjs.org/@mui/x-data-grid-premium/latest                                                                                         |
| TanStack registry latest 9.2.4                                  | https://registry.npmjs.org/@tanstack/table-core/latest                                                                                             |
| PrimeNG pin 22.1.1                                              | https://registry.npmjs.org/primeng/latest                                                                                                          |
| DevExtreme pin 26.1.5                                           | https://registry.npmjs.org/devextreme/latest                                                                                                       |
| Syncfusion TreeGrid pin 34.2.8                                  | https://registry.npmjs.org/@syncfusion/ej2-angular-treegrid/latest                                                                                 |
| Kendo TreeList pin 25.2.0                                       | https://registry.npmjs.org/@progress/kendo-angular-treelist/latest                                                                                 |
| AG Grid: tree strategy returned before group strategy           | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-enterprise/src/rowHierarchy/groupStage.ts                               |
| AG Grid: pivot and groupHideOpenParents rejected with tree data | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/validation/rules/gridOptionsValidations.ts                |
| AG Grid: no colDef rule for tree data                           | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/validation/rules/colDefValidations.ts                     |
| AG Grid: tree data overview silent on grouping                  | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data/index.mdoc                         |
| AG Grid: aggregates replace supplied group data; enterprise     | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-paths/index.mdoc                   |
| AG Grid: tree filtering defaults                                | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-filtering/index.mdoc               |
| AG Grid: tree child count = all descendants                     | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-group-column/index.mdoc            |
| AG Grid: allChildrenCount / allLeafChildren                     | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/interfaces/iRowNode.d.ts                                                                 |
| AG Grid: treeDataParentIdField                                  | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-self-referential/index.mdoc        |
| AG Grid: hybrid request, enterprise statement                   | https://api.github.com/repos/ag-grid/ag-grid/issues/11314                                                                                          |
| AG Grid: staff reply                                            | https://api.github.com/repos/ag-grid/ag-grid/issues/11314/comments                                                                                 |
| MUI X: one active strategy per group, Array.find                | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid/src/hooks/core/strategyProcessing/useGridStrategyProcessing.ts            |
| MUI X: grouping availability = model length > 0                 | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-premium/src/hooks/features/rowGrouping/gridRowGroupingUtils.ts            |
| MUI X: grouping preprocessor does not check treeData            | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-premium/src/hooks/features/rowGrouping/useGridRowGroupingPreProcessors.ts |
| MUI X: tree availability = treeData && !dataSource              | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/hooks/features/treeData/useGridTreeDataPreProcessors.tsx          |
| MUI X: hook registration order                                  | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-premium/src/DataGridPremium/useDataGridPremiumComponent.tsx               |
| MUI X: tree data Pro, filtering rules                           | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/tree-data/tree-data.md                                                     |
| MUI X: row grouping Premium, descendant count                   | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/row-grouping/row-grouping.md                                               |
| MUI X: aggregation precedence, filtered rows                    | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/aggregation/aggregation.md                                                 |
| MUI X: tree cell filtered descendant count                      | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/components/GridTreeDataGroupingCell.tsx                           |
| MUI X: group cell filtered descendant count                     | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-premium/src/components/GridGroupingCriteriaCell.tsx                       |
| TanStack: grouping recursion and leafRows                       | https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/getGroupedRowModel.ts                                                                      |
| TanStack: flattenBy                                             | https://unpkg.com/@tanstack/table-core@8.21.3/src/utils.ts                                                                                         |
| TanStack: filterFromLeafRows / maxLeafRowFilterDepth            | https://raw.githubusercontent.com/TanStack/table/v8.21.3/docs/api/features/column-filtering.md                                                     |
| TanStack: person expects subRows regrouped                      | https://api.github.com/repos/TanStack/table/issues/5594                                                                                            |
| TanStack: #5594 comments                                        | https://api.github.com/repos/TanStack/table/issues/5594/comments                                                                                   |
| TanStack: sub-row in multiple groups                            | https://github.com/TanStack/table/discussions/5564                                                                                                 |
| PrimeNG: TreeTable sections, filterMode                         | https://primeng.dev/treetable                                                                                                                      |
| PrimeNG: no grouping strings, filterMode default                | https://unpkg.com/primeng@22.1.1/fesm2022/primeng-treetable.mjs                                                                                    |
| DevExtreme: TreeList column API has no grouping                 | https://js.devexpress.com/Angular/Documentation/ApiReference/UI_Components/dxTreeList/Configuration/columns/                                       |
| DevExtreme: TreeList config, filterMode, parentIdExpr           | https://js.devexpress.com/Angular/Documentation/ApiReference/UI_Components/dxTreeList/Configuration/                                               |
| Syncfusion: TreeGrid feature list                               | https://ej2.syncfusion.com/angular/documentation/treegrid/overview                                                                                 |
| Syncfusion: grouping request declined                           | https://www.syncfusion.com/feedback/36412/how-to-group-the-data-in-a-tree-grid                                                                     |
| Syncfusion: hierarchyMode                                       | https://ej2.syncfusion.com/angular/documentation/treegrid/filtering/filtering                                                                      |
| Syncfusion: showChildSummary                                    | https://ej2.syncfusion.com/angular/documentation/treegrid/aggregates/aggregates                                                                    |
| Kendo: TreeList API has no grouping                             | https://www.telerik.com/kendo-angular-ui/components/treelist/api/treelistcomponent                                                                 |
| Kendo: filtering page silent on hierarchy                       | https://www.telerik.com/kendo-angular-ui/components/treelist/filtering                                                                             |
| Kendo (jQuery, secondary): no drag-to-group on TreeList         | https://www.telerik.com/forums/treelist-with-groupable-header-columns                                                                              |
