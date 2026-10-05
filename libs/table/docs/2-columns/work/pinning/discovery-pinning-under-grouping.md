# Can column pinning be per-column declarative state, or must it be a table-level feature — tested against row grouping?

**Date:** 2026-09-18 · **Depth:** standard

## Answer

Pinning + row grouping is shipped and combinable in every library that has both (AG Grid,
MUI X Premium, Syncfusion, DevExtreme, TanStack); no vendor disallows it. [S1][S6][S15][S17][S22][S23]
The hypothesis is **refuted for the storage question in 4 of 8 libraries**: TanStack, MUI X and
devextreme-reactive store pinning as _table-level ordered id arrays_ (`{left: string[], right: string[]}`),
Handsontable and Syncfusion as a _count integer_. [S12][S16][S26][S28][S22]
Only AG Grid and DevExtreme keep pinning per-column — and AG Grid still needs a _grid-level_
callback (`processUnpinnedColumns`) because total pinned width is a cross-column invariant. [S1][S24]
Grouping's real pressure is not on pinning _state_ but on **row rendering**: a spanning group row is
the only shape that breaks, and it only breaks in libraries that split pinned columns into separate
scroll regions. [S3][S27] Libraries whose group row is an ordinary row carrying the label in a
generated group column (AG Grid `singleColumn`, MUI X, TanStack) have no conflict at all. [S4][S19][S14]
No library auto-pins its generated group column. [S18][S6]

## Method

- Versions pinned from the npm registry `latest` on 2026-09-18: `ag-grid-community@36.2.0` [S33],
  `@tanstack/table-core@9.2.4` [S34], `@mui/x-data-grid-pro@9.14.0` [S35], `primeng@22.1.1` [S36],
  `devextreme@26.1.5` [S37]. Syncfusion, Handsontable and Ant Design were read from docs pages with
  no version selector — treat those as "current docs", not pinned.
- Source reads: AG Grid `colDef.ts` at tag `b36.2.0` (raw.githubusercontent), MUI X `GridRow.tsx`,
  `createGroupingColDef.tsx`, `gridRowGroupingUtils.ts` and `column-pinning.md` at `master`,
  `primeng@22.1.1` published `fesm2022` bundle. Everything else is docs-page fetch.
- Reliability: MUI X source was read at `master`, not at the 9.14.0 tag — the grouping-column
  constant and the three-section row render are stable across that line, but treat them as
  branch-read rather than release-pinned.
- **TanStack v8 was asked for; `@tanstack/table-core` latest is 9.2.4.** The v8 docs pages cited
  here are the v8 tree (`/table/v8/docs/...`); the `ColumnPinningState` shape is unchanged between
  them, but the version number below is the registry's, not v8's.

## Comparison — Q1 (combination shipped?), Q2 (group row under pinning), Q4 (auto-pin?)

|                                                  | Pinning + row grouping shipped                                                                                        | Where the group label lives                                                                                                                | Group row under pinned regions                                                                                                                                                                                                         | Auto-pins the group column?                                                                                                                                                                                                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AG Grid** `36.2.0`                             | yes — pinning is Community (`pinned` on `ColDef`) [S2], row grouping is Enterprise [S38]                              | `groupDisplayType: 'singleColumn'` / `'multipleColumns'` → a generated group **column**; `'groupRows'` → a **full-width row** [S4]         | full-width group rows "span the entire grid, including the pinned left and pinned right sections"; with `embedFullWidthRows=true` AG Grid creates **separate renderer instances for pinned-left, pinned-right and non-pinned** [S3]    | no. `autoGroupColumnDef` takes ordinary Column Options, so `pinned` is settable by the consumer [S6]; no documented default pin                                                                                                                                       |
| **TanStack Table** (v8 docs; `table-core@9.2.4`) | yes — both features exist, rendering is the consumer's [S13][S14]                                                     | grouped rows are ordinary rows with per-column `aggregatedCell`; no spanning row shipped [S14]                                             | the guide names **two consumer strategies**: split tables (`getLeftVisibleCells` / `getCenterVisibleCells` / `getRightVisibleCells`) or one table with sticky CSS [S13]                                                                | no group column is generated at all [S14]                                                                                                                                                                                                                             |
| **MUI X Data Grid** `9.14.0`                     | yes — pinning is **Pro** [S16], row grouping is **Premium** [S17]; the combination therefore needs a Premium licence  | generated grouping column, field `__row_group_by_columns_group__` (single) or `__row_group_by_columns_group_<criteria>__` (multiple) [S19] | one row element renders `leftCells` → offset → `cells` → filler → `rightCells`; `colSpan` is resolved per cell and spanned-by cells return `null` [S20] — no separate region trees                                                     | no. `GROUPING_COL_DEF_DEFAULT_PROPERTIES` sets `type`, `disableReorder`, `rowHeader`, `chartable`, `aggregable` — **no `pinned` or `pinnable`** [S18]. Pinning autogenerated columns by field constant is documented for checkbox-selection and reorder columns [S16] |
| **Syncfusion EJ2 Grid**                          | yes — grouping is **not** in the frozen-column limitation list ("Detail Template, Hierarchy Grid, Autofill") [S22]    | group caption row (not verified structurally — see Unverified)                                                                             | not verified                                                                                                                                                                                                                           | not verified                                                                                                                                                                                                                                                          |
| **DevExtreme DataGrid** `26.1.5`                 | yes — `columnFixing.enabled` + `groupIndex` on columns, both documented, no cross-feature exclusion stated [S23][S24] | group row; `showWhenGrouped` controls whether the grouped column itself stays visible [S24]                                                | not verified for `devextreme`; the sibling React product **devextreme-reactive** has an open-then-archived report that "the group row content is not fixed when `TableGroupRow.COLUMN_TYPE` is specified as a fixed column type" [S27] | not verified                                                                                                                                                                                                                                                          |
| **Handsontable**                                 | **no row grouping.** `NestedRows` (parent/child tree) is the nearest feature [S29]                                    | n/a — tree rows, not group headers [S29]                                                                                                   | frozen columns are a separate **`ht_clone_inline_start` overlay clone table** [S28 + see Unverified]                                                                                                                                   | n/a                                                                                                                                                                                                                                                                   |
| **Ant Design Table**                             | **no native row grouping** — only column-header grouping, `summary`, `expandable`, tree data [S30]                    | n/a                                                                                                                                        | n/a                                                                                                                                                                                                                                    | n/a                                                                                                                                                                                                                                                                   |
| **PrimeNG Table** `22.1.1`                       | both features exist separately; **no combined example in the docs** [S31]                                             | `groupRowsBy` + `groupheader`/`groupfooter` subheader templates, or `rowGroupMode="rowspan"` [S31]                                         | frozen cells get `p-datatable-frozen-column` / `-left` classes on the cell in the normal row — one table, sticky cells [S32]                                                                                                           | no group column is generated; grouping is template-driven [S31]                                                                                                                                                                                                       |
| **Angular Material table**                       | neither feature — noted as an absence, not investigated                                                               | —                                                                                                                                          | —                                                                                                                                                                                                                                      | —                                                                                                                                                                                                                                                                     |

## Q3 — evidence that pinning state is _not_ per-column

This is the section that argues against the hypothesis. Five independent forms found.

- **Ordered id arrays at table level — TanStack.** `ColumnPinningState = { left?: string[]; right?: string[] }`,
  mutated by `setColumnPinning` / `resetColumnPinning`. The per-column `column.pin(position)` and
  `getIsPinned()` are _views onto_ that table state, not the storage. [S12]
- **Ordered id arrays at table level — MUI X.** `GridPinnedColumnFields { left?: string[]; right?: string[] }`,
  set via `initialState.pinnedColumns`, the controlled `pinnedColumns` prop, or `apiRef.setPinnedColumns()`. [S15][S16]
- **Arrays at plugin level, admitting non-column members — devextreme-reactive.** `TableFixedColumns`
  takes `leftColumns: Array<string | symbol>` / `rightColumns: Array<string | symbol>`. The **symbol**
  admits `TableGroupRow.COLUMN_TYPE` — i.e. the pin list can name a _row type_, not just a column. [S26][S27]
- **A count integer — Handsontable.** `fixedColumnsStart: number` freezes the first N columns;
  there is no per-column frozen flag. `manualColumnFreeze` moves a column into that leading run. [S28]
- **A count integer — Syncfusion.** Grid-level `frozenColumns` (number of columns frozen from the
  left) coexists with the per-column `column.freeze: 'Left' | 'Right' | 'Fixed'`. Two spellings of
  the same state, one of them cross-column. [S22]
- **Pinning must coordinate with column ordering — MUI X states it as a rule:** "Pinned columns
  cannot be reordered, except by unpinning and repinning." [S16] Same doc: "You may encounter issues
  if the sum of the widths of the pinned columns is larger than the width of the Grid." [S16]
- **Even the per-column libraries need a table-level resolver.** AG Grid's `pinned` is per-column
  (`boolean | 'left' | 'right' | null`, "A value of `true` is converted to `'left'`") [S2], but the
  grid ships `processUnpinnedColumns`, a **grid-level** callback that decides _which columns to
  unpin_ when the pinned sections exceed the grid width [S1]. The trigger is a sum over all pinned
  columns; the resolution changes other columns' state.
- **Not pinning, but adjacent and worth not confusing with it:** AG Grid's `groupLockGroupColumns`
  is a numeric grid option that locks the first N entries of the **Row Group Panel** against removal
  or reorder [S8]. That is an integer over the grouping _rule list_, not over pinned columns — cited
  here only to keep it out of the pinning column.

## Evidence — Q2, what actually renders

- The whole question turns on one architectural fork: **does the library split pinned columns into
  separate scroll regions, or keep one row element with sticky cells?**
- Split-region, and AG Grid says so explicitly: full-width rows "are not impacted by pinned sections
  of the grid, will span left and right pinned areas regardless" — the default is a single spanning
  element ignoring the regions. [S3]
- Turning on `embedFullWidthRows` reverses that: non-pinned full-width rows scroll horizontally, and
  "separate renderer instances are created for pinned left, pinned right, and non-pinned sections". [S3]
  That is the duplication case the question asked about — **the group cell renderer runs three
  times**, once per region.
- Without `embedFullWidthRows`: "The pinned full width rows are not impacted by either vertical or
  horizontal scrolling", unpinned full-width rows are affected by vertical scrolling only. [S3]
- AG Grid's other two display types avoid the problem entirely by not spanning: `'singleColumn'`
  and `'multipleColumns'` put the group label in a generated **column**, and `'custom'` puts it in an
  ordinary `columnDefs` entry carrying `showRowGroup: true` + `cellRenderer: 'agGroupCellRenderer'`. [S4][S7]
  An ordinary column is pinnable by the ordinary mechanism.
- MUI X never spans: `GridRow` renders `leftCells`, a `cellOffsetLeft` spacer, the middle `cells`, an
  empty filler cell, then `rightCells`, all inside one row element; `colSpan` is per-cell and
  spanned-by cells render `null`. [S20] A group row is just a row whose grouping-column cell holds
  the label. [S19]
- devextreme-reactive is the counter-example where it went wrong: report #1798 (opened 2019-01-24,
  repo archived 2026-02-26 with the issue closed and labelled `enhancement`, not `bug`) —
  "The group row content is not fixed when the `TableGroupRow.COLUMN_TYPE` is specified as a fixed
  column type." Seven years, never implemented. [S27]
- AG Grid has two open community reports at the pinning/grouping seam: #2498 "when we place group by
  column as pinned column, it is getting repeated" [S10], and #8660 — pinning one column inside a
  column group hides its siblings, and setting `pinned` on `autoGroupColumnDef` did not help [S9].
  Both are community-support threads with no maintainer resolution shown.
- PrimeNG is single-table/sticky-cell: the frozen directive applies `p-datatable-frozen-column` and
  `p-datatable-frozen-column-left` classes to the cell, with `alignFrozen` choosing the side. [S32][S31]
  Its group header is a `groupheader` template row, not a region-split construct. [S31]
- DevExtreme exposes three per-column fixed positions — `'left'` (default), `'right'`, and `'sticky'`
  ("the column 'sticks' to the left or rightmost edge when it reaches either side"). [S25]
  `'sticky'` is a _third_ rendering mode that is neither region nor plain scroll.

## Synthesis

- **Storage disagreement is 4-2 against per-column, but it is not a disagreement about pinning — it
  is a disagreement about who owns column order.** TanStack and MUI X store arrays because the array
  _is_ the render order of the pinned region; AG Grid and DevExtreme store a per-column enum because
  they derive the region order from the global column order instead. Both are complete; the array
  form just makes "order within the pinned region" expressible without touching global order — which
  is exactly why MUI X then has to forbid reordering pinned columns [S16] and AG Grid does not.
- **The count-integer form (Handsontable, Syncfusion) is the one that is genuinely not per-column**
  and cannot be reconstructed from per-column flags: `fixedColumnsStart: 2` is a statement about a
  _prefix of the column order_, so moving a column changes what is frozen without any column's own
  state changing. [S28][S22] If per-column state is chosen, this design is simply excluded — which is
  fine, but it should be an explicit exclusion rather than an oversight.
- **Grouping does not contradict per-column pinning; full-width group rows do.** Every library whose
  group label lives in a _column_ (AG Grid singleColumn/multipleColumns/custom, MUI X, PrimeNG
  subheader-less rowspan mode) composes cleanly. The only library that ships a spanning group row
  _and_ region-split pinning is AG Grid, and it needed a dedicated grid option (`embedFullWidthRows`)
  plus a 3× renderer instantiation to reconcile them. [S3][S4]
- **Nobody auto-pins the group column, and that is a consistent, deliberate-looking silence.** MUI X's
  generated grouping column sets five defaults and pinning is not among them [S18]; AG Grid's
  `autoGroupColumnDef` documents header/width/renderer/filter customization with no pinning default [S6].
  Per the source-protocol note: three libraries sharing an omission is one data point about
  convention, not three about correctness.
- **The cross-column pressure that does exist is about width, not about which column is pinned.**
  AG Grid ships `processUnpinnedColumns` [S1], MUI X documents the overflow as a caveat it does not
  solve [S16]. Any per-column model still has to answer "pinned total exceeds viewport" somewhere
  above the column.

## Against

- The per-column hypothesis survives the _grouping_ test better than it survives the _state_ test.
  Grouping produced no library that requires table-level pinning state — the failures found
  (#1798, #2498, #8660) are rendering failures, not state-model failures. [S27][S10][S9]
- Conversely, "pinning is purely per-column" is contradicted by the majority of the surveyed field
  even ignoring grouping entirely. If the design goal is "look like what consumers already know",
  `{left: string[], right: string[]}` is the more common spelling, not the per-column enum. [S12][S16][S26]
- A per-column enum cannot express "pin this column _third_ from the left edge" without also moving
  it in the global column order. Whether that is a loss depends on whether the library already
  treats column order as a single ordered list a consumer can reorder.

## Not researched

- Angular Material CDK table — confirmed by the caller as having neither feature; no page was opened.
- Row pinning (frozen rows), as distinct from column pinning, in any library.
- Pinning under **tree data** (as opposed to row grouping), including AG Grid's separate
  `tree-data-group-column` surface.
- Pinning interaction with column **groups** (header groups) beyond AG Grid issue #8660.
- Virtualization/scroll-sync cost of region-split rendering.
- Stack Overflow and Reddit were not searched; per the anchors file, both have produced nothing
  citable on this corpus before.

## Unverified

- **Syncfusion group caption row structure under frozen columns.** Four fetches/searches; the EJ2
  grouping docs pages returned no DOM-level detail and the forum hits that matched were WinForms/WPF
  products, not EJ2. The frozen-column limitation list not naming grouping [S22] is evidence of
  _permission_, not of _how it renders_. Confirmed by: opening a Syncfusion EJ2 grouping + frozen
  StackBlitz and reading the emitted `<tr class="e-groupcaptionrow">` markup.
- **DevExtreme (`devextreme@26.1.5`) group row under `fixed` columns.** The only direct evidence found
  is from the _separate_ `devextreme-reactive` product [S27]; the source file path
  `.../grid_core/columns_fixing/m_columns_fixing.ts` 404'd on the branch guessed. Confirmed by:
  locating the real path in `DevExpress/DevExtreme` and reading the `rowType === 'group'` branch.
- **Handsontable's `ht_clone_inline_start` overlay architecture.** Described consistently across
  Handsontable PR bodies surfaced by search (DEV-2937, DEV-127), but the PR pages themselves were not
  opened — this is a search-snippet claim, not a read one. The `fixedColumnsStart` API [S28] _was_ read.
- **"AG Grid does not pin the auto group column by default"** is an inference from the absence of any
  stated default on the `autoGroupColumnDef` page [S6] plus `ColDef.pinned` having no documented
  default [S2] — not a doc-confirmed negative.
- **AG Grid column pinning being a Community (not Enterprise) feature** is inferred from `pinned` /
  `initialPinned` / `lockPinned` being declared in `packages/ag-grid-community/src/entities/colDef.ts` [S2];
  the licensing page lists Row Grouping under Enterprise but does not list Column Pinning at all [S38].
- **AG Grid issues #2498 and #8660 resolution.** Both pages rendered without maintainer comments.
  Per the anchors file, `closed` on `ag-grid/ag-grid` means "moved or answered", never "fixed" —
  so neither issue supports a claim about current behavior. [S10][S9]
- **MUI X source claims were read at `master`, not at the `v9.14.0` tag.** [S18][S19][S20][S16]

## Sources

|     | Source                                                                                                                                  | Version             | Verified                                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | https://www.ag-grid.com/angular-data-grid/column-pinning/                                                                               | 36.2.0              | yes — docs page; gave `pinned`, `initialPinned`, `lockPinned`, `processUnpinnedColumns`, `applyColumnState()`                                                                                                                              |
| S2  | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/entities/colDef.ts                             | b36.2.0             | yes — source read; confirms `pinned` is per-column `boolean \| 'left' \| 'right' \| null` and lives in the **community** package, which the licensing page [S38] does not state                                                            |
| S3  | https://www.ag-grid.com/angular-data-grid/full-width-rows/                                                                              | 36.2.0              | yes — docs page; the single most decision-relevant page found. Corrects the assumption that a spanning row is clipped at the region boundary: it spans regardless, and `embedFullWidthRows` instead **duplicates the renderer per region** |
| S4  | https://www.ag-grid.com/angular-data-grid/grouping-display-types/                                                                       | 36.2.0              | yes — docs page; the three `groupDisplayType` values verbatim                                                                                                                                                                              |
| S5  | https://www.ag-grid.com/angular-data-grid/grouping-group-rows/                                                                          | 36.2.0              | yes — docs page; confirms `'groupRows'` is full-width and is **silent** on pinned columns                                                                                                                                                  |
| S6  | https://www.ag-grid.com/angular-data-grid/grouping-single-group-column/                                                                 | 36.2.0              | yes — docs page; `autoGroupColumnDef` accepts Column Options; no pinning default stated                                                                                                                                                    |
| S7  | https://www.ag-grid.com/angular-data-grid/grouping-custom-group-columns/                                                                | 36.2.0              | yes — docs page; `showRowGroup` + `agGroupCellRenderer` on an ordinary `columnDefs` entry                                                                                                                                                  |
| S8  | https://www.ag-grid.com/javascript-data-grid/grouping/                                                                                  | 36.2.0              | yes — docs page; surfaced `groupLockGroupColumns`, `suppressGroupRowsSticky`, `stickyRowsMaxViewportRatio`. Reading it **narrowed** the finding: `groupLockGroupColumns` is a Row Group Panel lock, not a pinning integer                  |
| S9  | https://github.com/ag-grid/ag-grid/issues/8660                                                                                          | —                   | yes — issue page; `community-support`, no maintainer reply rendered                                                                                                                                                                        |
| S10 | https://github.com/ag-grid/ag-grid/issues/2498                                                                                          | —                   | yes — issue page; closed, no resolution text rendered                                                                                                                                                                                      |
| S11 | https://www.ag-grid.com/angular-data-grid/grid-options/                                                                                 | 36.2.0              | yes — reference page; types only, **all four description cells were empty** — do not cite this page for semantics                                                                                                                          |
| S12 | https://tanstack.com/table/v8/docs/api/features/column-pinning                                                                          | v8 docs             | yes — docs page; `ColumnPinningState` verbatim                                                                                                                                                                                             |
| S13 | https://tanstack.com/table/v8/docs/guide/column-pinning                                                                                 | v8 docs             | yes — docs page; names both the split-table and sticky-CSS rendering strategies                                                                                                                                                            |
| S14 | https://tanstack.com/table/v8/docs/api/features/grouping                                                                                | v8 docs             | yes — docs page; `GroupingState = string[]`, `aggregatedCell`, no pinning mention                                                                                                                                                          |
| S15 | https://mui.com/x/react-data-grid/column-pinning/                                                                                       | 9.14.0              | yes — docs page                                                                                                                                                                                                                            |
| S16 | https://raw.githubusercontent.com/mui/mui-x/master/docs/data/data-grid/column-pinning/column-pinning.md                                 | master              | yes — source read; Pro-plan badge, `GridPinnedColumnFields`, the reorder rule and the pinned-width caveat verbatim                                                                                                                         |
| S17 | https://mui.com/x/react-data-grid/row-grouping/                                                                                         | 9.14.0              | yes — docs page; Premium badge, `rowGroupingColumnMode`, `groupingColDef`                                                                                                                                                                  |
| S18 | https://raw.githubusercontent.com/mui/mui-x/master/packages/x-data-grid-premium/src/hooks/features/rowGrouping/createGroupingColDef.tsx | master              | yes — source read; `GROUPING_COL_DEF_DEFAULT_PROPERTIES` contains no `pinned`/`pinnable`. This is the doc-silent negative for Q4                                                                                                           |
| S19 | https://raw.githubusercontent.com/mui/mui-x/master/packages/x-data-grid-premium/src/hooks/features/rowGrouping/gridRowGroupingUtils.ts  | master              | yes — source read; `getRowGroupingFieldFromGroupingCriteria` and the `__row_group_by_columns_group_<criteria>__` field shape                                                                                                               |
| S20 | https://raw.githubusercontent.com/mui/mui-x/master/packages/x-data-grid/src/components/GridRow.tsx                                      | master              | yes — source read; the left/offset/middle/filler/right single-row structure and per-cell `colSpan` resolution. The public docs never state this                                                                                            |
| S22 | https://ej2.syncfusion.com/angular/documentation/grid/columns/frozen-column                                                             | current docs        | yes — docs page; `column.freeze` values, grid-level `frozenColumns`/`frozenRows`, and the limitation list that omits grouping                                                                                                              |
| S23 | https://js.devexpress.com/Angular/Documentation/Guide/UI_Components/DataGrid/Columns/Column_Fixing/                                     | 26.1.5              | yes — docs page; `columnFixing.enabled`, `fixed`, `fixedPosition`, `allowFixing`                                                                                                                                                           |
| S24 | https://js.devexpress.com/Angular/Documentation/ApiReference/UI_Components/dxDataGrid/Configuration/columns/                            | 26.1.5              | yes — API reference; `fixed`, `fixedPosition`, `allowFixing`, `groupIndex`, `showWhenGrouped`, `autoExpandGroup` with types and defaults                                                                                                   |
| S25 | https://js.devexpress.com/React/Demos/WidgetsGallery/Demo/DataGrid/FixedAndStickyColumns/                                               | 26.1.5              | yes — demo page; the three `fixedPosition` values including `'sticky'`                                                                                                                                                                     |
| S26 | https://devexpress.github.io/devextreme-reactive/react/grid/docs/reference/table-fixed-columns/                                         | devextreme-reactive | yes — docs page; `leftColumns`/`rightColumns` as `Array<string \| symbol>`                                                                                                                                                                 |
| S27 | https://github.com/DevExpress/devextreme-reactive/issues/1798                                                                           | 1.10.0              | yes — issue page; opened 2019-01-24, labelled `Grid`/`enhancement`, closed by repo archive 2026-02-26                                                                                                                                      |
| S28 | https://handsontable.com/docs/javascript-data-grid/column-freezing/                                                                     | current docs        | yes — docs page; `fixedColumnsStart` count integer, `manualColumnFreeze`                                                                                                                                                                   |
| S29 | https://handsontable.com/docs/javascript-data-grid/row-parent-child/                                                                    | current docs        | yes — docs page; `nestedRows`, `__children`; limitation list omits frozen columns                                                                                                                                                          |
| S30 | https://ant.design/components/table                                                                                                     | current docs        | yes — docs page; `column.fixed: boolean \| 'start' \| 'end'`; no native row grouping                                                                                                                                                       |
| S31 | https://primeng.dev/table                                                                                                               | 22.1.1              | yes — docs page; `pFrozenColumn` + `alignFrozen`, `groupRowsBy`, `rowGroupMode`, `groupheader`/`groupfooter`; **no combined frozen+grouping example**                                                                                      |
| S32 | https://unpkg.com/primeng@22.1.1/fesm2022/primeng-table.mjs                                                                             | 22.1.1              | yes — published bundle read; `p-datatable-frozen-column` / `p-datatable-frozen-column-left` applied to the cell, class-driven sticky rather than a separate region tree                                                                    |
| S33 | https://registry.npmjs.org/ag-grid-community/latest                                                                                     | 36.2.0              | yes — registry read 2026-09-18                                                                                                                                                                                                             |
| S34 | https://registry.npmjs.org/@tanstack/table-core/latest                                                                                  | 9.2.4               | yes — registry read 2026-09-18; **contradicts the "v8" framing in the brief**                                                                                                                                                              |
| S35 | https://registry.npmjs.org/@mui/x-data-grid-pro/latest                                                                                  | 9.14.0              | yes — registry read 2026-09-18                                                                                                                                                                                                             |
| S36 | https://registry.npmjs.org/primeng/latest                                                                                               | 22.1.1              | yes — registry read 2026-09-18                                                                                                                                                                                                             |
| S37 | https://registry.npmjs.org/devextreme/latest                                                                                            | 26.1.5              | yes — registry read 2026-09-18                                                                                                                                                                                                             |
| S38 | https://www.ag-grid.com/angular-data-grid/licensing/                                                                                    | 36.2.0              | yes — docs page; Row Grouping listed under Enterprise, Column Pinning listed in neither list                                                                                                                                               |

## What this means for a per-column pinning model

Observations only — the decision is the caller's.

- **Grouping alone does not refute the hypothesis.** No surveyed library needs cross-column pinning
  state _because of_ grouping. The refuting evidence (Q3) is independent of grouping and would have
  shown up in a pinning-only survey. [S12][S16][S28][S22]
- **What grouping does refute is "pinning is purely a column concern at render time."** The moment a
  group row spans, pinning stops being answerable per column and becomes a question about regions —
  and AG Grid's answer costs a grid option plus 3× renderer instantiation. [S3]
- **A per-column enum forecloses exactly one shipped design**: the count-integer form, where freezing
  is a property of a _prefix of the column order_ rather than of any column. [S28][S22]
- **A per-column enum does not by itself give a pinned-region order.** MUI X gets that order from the
  array and pays for it by forbidding reorder of pinned columns [S16]; AG Grid gets it from global
  column order and pays nothing extra. Which is cheaper depends on whether column order is already
  one ordered, consumer-reorderable list in this library.
- **One cross-column invariant survives any storage choice**: total pinned width vs. viewport width.
  AG Grid resolves it with a grid-level callback that mutates other columns' pinned state [S1];
  MUI X documents it as unresolved [S16]. A purely per-column model has no natural owner for it.
- **If the group label is placed in a generated or declared group _column_ rather than a spanning
  row**, every conflict found in this survey disappears, in every library that made that choice
  (AG Grid singleColumn/multipleColumns/custom, MUI X, TanStack). [S4][S7][S19][S14]
- **Nobody auto-pins the group column** — treat auto-pinning as a non-convention, not an unexplored
  option. [S18][S6]
