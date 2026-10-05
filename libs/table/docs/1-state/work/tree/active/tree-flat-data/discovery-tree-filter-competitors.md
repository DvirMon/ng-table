# Filtering rows in a tree grid: what does a person see when a filter matches a child but not its parent, or a parent but not its children?

**Date:** 2026-09-27 · **Mode:** competitor-capabilities

Feeds D2 (orphan / filter rule) in [`1-decisions.md`](1-decisions.md).

## Answer

- Six libraries ship **the same two behaviours under six vocabularies**.
  "Matches plus their ancestors" is AG Grid `excludeChildrenWhenTreeDataFiltering: true`,
  TanStack `filterFromLeafRows: true`, MUI default, PrimeNG `strict`,
  DevExtreme `withAncestors`, Syncfusion `Parent`.
  "Matches plus ancestors plus every descendant of a match" is AG Grid default,
  PrimeNG `lenient` (default), DevExtreme `fullBranch`, Syncfusion `Both`.
- The **default** splits 2 vs 4: AG Grid and PrimeNG show a matched parent's
  whole subtree by default; MUI, DevExtreme, Syncfusion and TanStack (leaf mode)
  do not.
- **Orphans get three different answers**: Syncfusion promotes them to root
  level, DevExtreme `matchOnly` leaves them at their own depth under no parent,
  TanStack's default drops them unseen. AG Grid, MUI and PrimeNG never produce
  an orphan.
- **Nobody documents a visual style for "context" ancestors** (shown only
  because a descendant matched). The closest are MUI's filtered-descendant count
  in the group cell and Syncfusion's `hasFilteredChildRecords` data flag.
- **Only DevExtreme auto-expands matched paths by default**
  (`expandNodesOnFiltering: true`). TanStack and PrimeNG verifiably do not.

## Method and source reliability

Read 2026-09-27. Every option name below was read from a published
package, a pinned doc source, or the vendor docs page. None from memory.

| Library                       | Pin                    | Where the pin came from                                      | How it was read                                                                                               |
| ----------------------------- | ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| AG Grid                       | 36.2.0                 | `registry.npmjs.org/ag-grid-community/latest`                | Docs `.mdoc` and source at git tag `b36.2.0`                                                                  |
| TanStack Table                | 9.2.4 (latest), 8.21.3 | registry `latest` = 9.2.4                                    | v9 `dist/*.js` + `.d.ts` on unpkg; v8 `src/` on unpkg (v9 ships no `src/`)                                    |
| MUI X Data Grid Pro           | 9.14.0                 | `registry.npmjs.org/@mui/x-data-grid-pro/latest`             | Docs markdown and source at git tag `v9.14.0`                                                                 |
| PrimeNG                       | 22.1.1                 | registry `latest`; docs site footer also shows 22.1.1        | Docs page; filter source from GitHub **`master` (unpinned)** — the unpkg bundle truncated and tag paths 404'd |
| Kendo UI for Angular TreeList | 25.2.0                 | `registry.npmjs.org/@progress/kendo-angular-treelist/latest` | Docs pages (no version marker); bundle truncated on fetch                                                     |
| DevExtreme TreeList           | 26.1.5                 | registry `latest`; docs page shows v26.1                     | `ui/tree_list.d.ts` on unpkg; source from GitHub **branch `26_1`** (a branch, not a tag)                      |
| Syncfusion EJ2 TreeGrid       | 34.2.8                 | `registry.npmjs.org/@syncfusion/ej2-treegrid/latest`         | `.d.ts` and `src/*.js` on unpkg; docs page (updated 08 Aug 2026)                                              |

Reliability notes that change how a row should be read:

- **Source over docs.** AG Grid's and MUI's docs describe ancestor
  retention in one sentence each. What happens to a matched parent's
  _non-matching_ children is stated only in source for MUI, and only
  for the default mode in AG Grid docs. Those cells cite source.
- **WebFetch summarises.** Every quote was requested verbatim. Where a
  fetch returned a paraphrase, the cell says what the code does rather
  than quoting.
- **"Kendo" here means Kendo UI for Angular.** Kendo's jQuery TreeList
  and Angular TreeView are different components. Evidence from them is
  flagged **secondary** and never fills an Angular TreeList cell.
- **Line numbers are not cited.** Cells cite function names, which
  survive a WebFetch that reflows the file.

## Findings

Cell citations use reference links; each resolves to one deep URL in
**Sources**. `—` means "this axis does not apply"; **unverified** means
looked for and not confirmed.

### Axis 1 — a child matches, its parent does not (ancestor retention)

| Library                                            | What a person sees                                                                                                                       | Cite                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| AG Grid                                            | Parent shown. A group stays if it has any filtered child (`passesFilter`: "has filtered children — keep the group"). Same in both modes. | [ag-gfs]                   |
| TanStack (default)                                 | **Nothing.** Filtering is top-down; parent fails, so its subtree is never tested.                                                        | [ts9-fru], [ts9-types]     |
| TanStack `filterFromLeafRows: true`                | Parent shown: "parent rows will be included so long as one of their child or grand-child rows is also included".                         | [ts9-types], [ts9-fru]     |
| MUI Pro                                            | Parent shown: "a node is included if it _or_ any of its descendents passes".                                                             | [mui-td], [mui-utils]      |
| PrimeNG (both modes)                               | Parent shown. `isFilterMatched` recurses into children when the node itself does not match.                                              | [png-src]                  |
| Kendo Angular TreeList                             | **Unverified.** Angular docs silent. jQuery TreeList (secondary): "all of their parents until the root element are visualized".          | [kd-basics], [kd-jq-forum] |
| DevExtreme `withAncestors` (default), `fullBranch` | Parent shown.                                                                                                                            | [dx-types], [dx-demo]      |
| DevExtreme `matchOnly`                             | Parent **not** shown. The child still is — see Axis 4.                                                                                   | [dx-demo], [dx-nodes]      |
| Syncfusion `Parent` (default), `Both`              | Parent shown.                                                                                                                            | [sf-doc], [sf-types]       |
| Syncfusion `Child`, `None`                         | Parent not shown; child promoted — see Axis 4.                                                                                           | [sf-doc], [sf-filter]      |

### Axis 2 — a parent matches, its children do not (descendant retention)

| Library                                              | What a person sees                                                                                                                    | Cite                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| AG Grid default                                      | **All children**: "By default, when a group row passes a Filter, the children will also be displayed."                                | [ag-tdf], [ag-gfs]    |
| AG Grid `excludeChildrenWhenTreeDataFiltering: true` | Parent alone; children filtered on their own merit.                                                                                   | [ag-tdf], [ag-gfs]    |
| TanStack default                                     | Parent shown; each child must pass too (top-down chain).                                                                              | [ts9-fru]             |
| TanStack `filterFromLeafRows: true`                  | Parent shown with only its matching children, possibly none (`newRow.subRows = recurseFilterRows(...)`, kept if `filterRow(newRow)`). | [ts9-fru]             |
| MUI Pro default                                      | Parent shown; each child filtered on its own (`isMatchingFilters` evaluated per node).                                                | [mui-utils]           |
| MUI Pro `disableChildrenFiltering`                   | Only top-level rows are filtered; every child inherits its parent's result, so **all children** show.                                 | [mui-td], [mui-utils] |
| PrimeNG `lenient` (default)                          | **All descendants** ("includes all descendants"). A matched node is not recursed into.                                                | [png-doc], [png-src]  |
| PrimeNG `strict`                                     | Parent shown; children filtered "every level independently".                                                                          | [png-doc], [png-src]  |
| Kendo Angular TreeList                               | **Unverified.** Kendo Angular _TreeView_ (secondary, different component): "in strict mode, children of matched nodes are not shown". | [kd-tv]               |
| DevExtreme `fullBranch`                              | All descendants ("their ancestors and descendants").                                                                                  | [dx-demo], [dx-types] |
| DevExtreme `withAncestors`, `matchOnly`              | Children not shown unless they match.                                                                                                 | [dx-demo]             |
| Syncfusion `Child`, `Both`                           | Children shown ("along with their child records").                                                                                    | [sf-doc]              |
| Syncfusion `Parent`, `None`                          | Children not shown unless they match.                                                                                                 | [sf-doc]              |

### Axis 3 — leaf-only filtering

No library evaluates the predicate on leaves only. What exists:

| Library                                | Nearest capability                                                                                                                                                                                                                       | Cite                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| AG Grid                                | Rows with no data (filler groups) are never tested — `!!(child.data && fm.doesRowPassFilter(child))`; they survive only through children. Tree-shaped filter UI: Tree Filter (`treeList: true`).                                         | [ag-gfs], [ag-tdf]                          |
| TanStack                               | `maxLeafRowFilterDepth` is **depth-limited from the top**, the opposite of leaf-only: `0` filters root rows only, "with all sub-rows remaining unfiltered". `filterFromLeafRows` is bottom-up, not leaf-only — parents are still tested. | [ts9-types], [ts9-fru]                      |
| MUI Pro                                | `disableChildrenFiltering` = top-level only.                                                                                                                                                                                             | [mui-td]                                    |
| PrimeNG, DevExtreme, Syncfusion, Kendo | None found.                                                                                                                                                                                                                              | [png-src], [dx-types], [sf-types], [kd-api] |

### Axis 4 — orphans (a match whose parent is filtered out)

| Library                    | Behaviour                                                                                                                                                                                                                                             | Cite                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| AG Grid                    | Cannot occur — ancestors are always kept.                                                                                                                                                                                                             | [ag-gfs]                 |
| TanStack default           | **Dropped.** A failing parent's children are never visited.                                                                                                                                                                                           | [ts9-fru]                |
| TanStack leaf mode         | Cannot occur.                                                                                                                                                                                                                                         | [ts9-fru]                |
| MUI Pro                    | Cannot occur (with `disableChildrenFiltering`, children are not tested at all).                                                                                                                                                                       | [mui-utils]              |
| PrimeNG                    | Cannot occur in either mode.                                                                                                                                                                                                                          | [png-src]                |
| DevExtreme `matchOnly`     | **Shown in place, without its parent.** Non-matching nodes get `visible = false`; `collectVisibleNodes` still descends through invisible nodes, and `node.level` keeps the original depth. Indentation follows `level` — _inference_, see Unverified. | [dx-nodes], [dx-adapter] |
| Syncfusion `Child`, `None` | **Promoted to root.** `updateFilterLevel` sets `filterLevel = 0` for any result whose parent is absent.                                                                                                                                               | [sf-filter]              |
| Kendo Angular              | Unverified.                                                                                                                                                                                                                                           | —                        |

### Axis 5 — auto-expansion of matched paths

| Library                | Behaviour                                                                                                                                                                                                                                        | Cite                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| AG Grid                | **Unverified.** Opening-groups docs cover `groupDefaultExpanded` / `isGroupOpenByDefault` and say nothing about filtering.                                                                                                                       | [ag-open]                                      |
| TanStack               | None. No filter-driven expansion in `RowExpanding`.                                                                                                                                                                                              | [ts8-exp]                                      |
| MUI Pro                | Unverified. Grouping cell hides the expand toggle when `filteredDescendantCount` is 0.                                                                                                                                                           | [mui-cell]                                     |
| PrimeNG                | None. `expanded` is never assigned in `_filter` or `findFilteredNodes`.                                                                                                                                                                          | [png-src]                                      |
| DevExtreme             | **Yes, by default.** `expandNodesOnFiltering` (default `true`): "whether nodes appear expanded or collapsed after filtering is applied." Source pushes each visible node with children to `expandedRowKeys`; clearing the filter collapses them. | [dx-cfg], [dx-types], [dx-nodes], [dx-adapter] |
| Syncfusion             | Unverified — no `expanded` write seen in `filter.js`.                                                                                                                                                                                            | [sf-filter]                                    |
| Kendo Angular TreeList | Unverified. Kendo Angular _TreeView_ (secondary): `expandOnFilter`, `expandMatches`, `maxAutoExpandResults` ("max amount of nodes to be auto-expanded on filter").                                                                               | [kd-tv]                                        |

### Axis 6 — visual distinction of context rows vs matched rows

| Library       | Behaviour                                                                                                                                                 | Cite        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| AG Grid       | None documented.                                                                                                                                          | [ag-tdf]    |
| TanStack      | Headless — no rendering. Each filtered row carries `columnFilters` copied from the source row, so a consumer _could_ tell context from match (inference). | [ts9-fru]   |
| MUI Pro       | No row style. Group cell shows the filtered descendant count `(n)` unless `hideDescendantCount`.                                                          | [mui-cell]  |
| PrimeNG       | None documented.                                                                                                                                          | [png-doc]   |
| DevExtreme    | None documented.                                                                                                                                          | [dx-demo]   |
| Syncfusion    | No style; a `hasFilteredChildRecords` flag is set on ancestor records.                                                                                    | [sf-filter] |
| Kendo Angular | Unverified.                                                                                                                                               | —           |

### Axis 7 — configurability

| Library                | Knob                                                                                                                 | Modes                | Cite                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------- |
| AG Grid                | `excludeChildrenWhenTreeDataFiltering: boolean`                                                                      | 2                    | [ag-tdf]             |
| TanStack               | `filterFromLeafRows: boolean` + `maxLeafRowFilterDepth: number`                                                      | 2 × depth            | [ts9-types]          |
| MUI Pro                | `disableChildrenFiltering: boolean`                                                                                  | 2                    | [mui-td]             |
| PrimeNG                | `filterMode: 'lenient' \| 'strict'`, default `lenient`                                                               | 2                    | [png-doc], [png-src] |
| Kendo Angular TreeList | `HierarchyBindingDirective` inputs: `filter`, `sort`, `aggregate`, `childrenField` — no mode input                   | 1 (unverified which) | [kd-api]             |
| DevExtreme             | `filterMode: 'fullBranch' \| 'withAncestors' \| 'matchOnly'`, default `withAncestors`; plus `expandNodesOnFiltering` | 3                    | [dx-types], [dx-cfg] |
| Syncfusion             | `filterSettings.hierarchyMode: 'Parent' \| 'Child' \| 'Both' \| 'None'`, default `Parent`                            | 4                    | [sf-types], [sf-doc] |

### Axis 8 — free vs paid tier

| Library    | Where the line is drawn                                                                                                                                                         | Cite                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| AG Grid    | **Feature-metered.** Tree Data and its filtering are `enterprise: true`. Community `FilterStage` is flat-only (`filterFlat`).                                                   | [ag-td], [ag-tdf], [ag-fs] |
| MUI X      | **Feature-metered.** Tree data is Pro.                                                                                                                                          | [mui-td]                   |
| TanStack   | Not re-read this run — see Not researched.                                                                                                                                      | —                          |
| PrimeNG 22 | **Company-size-metered, whole package.** "PrimeUI License": free Community License under $1M revenue, <5 developers, <10 employees, <$3M funding; otherwise per-developer paid. | [png-lic]                  |
| Syncfusion | **Company-size-metered, whole suite.** Community License under $1M revenue and <5 developers.                                                                                   | [sf-lic]                   |
| Kendo      | **Whole suite, commercial.** "This is commercial software." Trial only.                                                                                                         | [kd-lic]                   |
| DevExtreme | Unverified — README points to js.devexpress.com/licensing, not read.                                                                                                            | —                          |

### Axis 9 — interaction with sorting

| Library                       | Siblings sorted within parent?                                                                                                                                             | Cite       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| AG Grid                       | **Secondary** (row grouping, not tree data): "Sorting a leaf column sorts the rows inside each group; groups stay in structural order." Tree-data sort source not reached. | [ag-sort]  |
| TanStack                      | Yes — `sortData` recurses into `row.subRows`.                                                                                                                              | [ts8-sort] |
| MUI Pro                       | Yes, every level by default; `disableChildrenSorting` limits to top level.                                                                                                 | [mui-td]   |
| PrimeNG                       | Yes: "siblings are sorted against each other while the hierarchy stays intact."                                                                                            | [png-doc]  |
| Kendo, DevExtreme, Syncfusion | Unverified.                                                                                                                                                                | —          |

### Axis 10 — interaction with select-all

| Library                       | Header checkbox under an active filter                                                                                                                                                                                                                                            | Cite                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| AG Grid                       | Configurable. `selectAll: 'all'` (default) selects every selectable row; `'filtered'` selects "all rows that satisfy the currently active filter". Tree propagation is separate: `groupSelects: 'filteredDescendants'` "will select all of its descendants that pass the filter". | [ag-msel], [ag-tsel]            |
| TanStack                      | `toggleAllRowsSelected` iterates `getPreGroupedRowModel().flatRows`, which is `getFilteredRowModel()` — so filtered rows only, **including context ancestors** kept in leaf mode.                                                                                                 | [ts8-sel], [ts8-grp], [ts9-fru] |
| MUI Pro                       | Selects `gridExpandedSortedRowIdsSelector` (or current page with `checkboxSelectionVisibleOnly`). Rows that leave the filter are deselected unless `keepNonExistentRowsSelected`.                                                                                                 | [mui-hdr], [mui-sel]            |
| PrimeNG                       | Header checkbox iterates `this.filteredNodes \|\| this.value` — filtered result, including context ancestors.                                                                                                                                                                     | [png-src]                       |
| Kendo, DevExtreme, Syncfusion | Unverified. DevExtreme has `selection.recursive` ("whether selection is recursive"); its filter interaction was not found.                                                                                                                                                        | [dx-types]                      |

## Synthesis — where they disagree

### One behaviour, six names — and "strict" means the narrow one

- The narrow behaviour (matches + ancestors, matched parent loses its
  non-matching children) is: AG Grid `excludeChildren…: true`, TanStack
  `filterFromLeafRows`, MUI default, PrimeNG `strict`, DevExtreme
  `withAncestors`, Syncfusion `Parent`. Six names; the code paths agree
  ([ag-gfs], [ts9-fru], [mui-utils], [png-src], [dx-demo], [sf-doc]).
- The wide behaviour (plus every descendant of a match) is AG Grid default,
  PrimeNG `lenient`, DevExtreme `fullBranch`, Syncfusion `Both`.
- **Implication:** the category has converged on two behaviours, not on
  names. A name that says what gets _added_ (`withAncestors`, `fullBranch`)
  reads better than one that says how hard the filter is (`strict`,
  `lenient`) — a reader cannot guess which of those keeps the children.
- **TanStack's name is a trap:** `filterFromLeafRows` sounds like
  leaf-only filtering but is bottom-up with parents still tested
  ([ts9-types]).

### Default: does a matched parent keep its children?

- **Yes:** AG Grid, PrimeNG. **No:** MUI, DevExtreme, Syncfusion, TanStack.
- AG Grid and PrimeNG agree with each other against four others. This is
  the axis with no obvious answer — the one needing a product decision.
- Arguments each side implies: "yes" treats a matched parent as a
  _container the person was looking for_ (a folder named "Q3"); "no"
  treats every row as an independent record.

### Orphans: three answers where the rest refuse the question

- Syncfusion **promotes to root** ([sf-filter]); DevExtreme `matchOnly`
  **keeps depth, drops the parent row** ([dx-nodes]); TanStack's default
  **drops silently** ([ts9-fru]).
- AG Grid, MUI and PrimeNG simply do not offer a mode that creates
  orphans. That is a design position in itself: every match is always
  shown with its path.
- TanStack's default is the only one where a match can be **hidden** by
  a filter. Per `classify-errors-construction-vs-runtime`-style
  reasoning, hiding data is the unrecoverable direction; it is also the
  one library of seven that does it by default.

### Auto-expansion: only DevExtreme owns it

- DevExtreme expands matched paths by default ([dx-cfg]). TanStack and
  PrimeNG never do ([ts8-exp], [png-src]). AG Grid and MUI docs are
  silent.
- Kendo moves this to the _TreeView_, with a cap (`maxAutoExpandResults`)
  and a restore rule (`expandedOnClear`) ([kd-tv]). The cap is the
  detail worth copying: auto-expanding 10 000 matches is its own problem.
- **Implication:** a filter that keeps a collapsed ancestor shows the
  person a row with nothing visibly matching. Only DevExtreme addresses
  that out of the box.

### Context rows are invisible as context everywhere

- No vendor styles a context ancestor differently from a match.
  Syncfusion carries a flag ([sf-filter]); MUI a count ([mui-cell]);
  TanStack leaves per-row filter results reachable ([ts9-fru]).
- Silence across seven libraries is one data point about convention,
  not seven about correctness.

### Mode count and knob shape

- 2 (AG Grid, TanStack, MUI, PrimeNG) vs 3 (DevExtreme) vs 4
  (Syncfusion). AG Grid and MUI ship a **boolean**; PrimeNG, DevExtreme
  and Syncfusion ship a **string union**.
- Syncfusion's 4 = {ancestors?} × {descendants?}. DevExtreme's 3 omits
  "descendants without ancestors" (Syncfusion `Child`). Syncfusion's
  `Child` is the only mode anywhere that keeps children of a match
  while dropping its parents — and it is the one that forces promotion.

### Paywall: metered by feature vs by company

- AG Grid (Enterprise) and MUI (Pro) **meter tree data as a feature**
  ([ag-td], [mui-td]). PrimeNG 22, Syncfusion and Kendo **meter the whole
  package** by company size or outright ([png-lic], [sf-lic], [kd-lic]).
- Nobody meters the _filter mode_ separately from tree data. The paid
  thing is hierarchy; the filter semantics come with it.
- **PrimeNG 22 is no longer MIT** — "PrimeUI License" ([png-lic]). Worth
  knowing before citing it as the free Angular baseline.

### Select-all: filtered by default in some, all rows in AG Grid

- TanStack, MUI and PrimeNG select the filtered set, **context ancestors
  included** (TanStack, PrimeNG: [ts8-sel], [png-src]). AG Grid selects
  all rows unless `selectAll: 'filtered'` ([ag-msel]).
- AG Grid is the only one that separates "which rows does the header
  select" from "does selecting a parent select filtered-out children"
  (`groupSelects: 'filteredDescendants'`) ([ag-tsel]).
- **Implication:** once context ancestors exist, "select all filtered"
  silently selects rows that did not match. No vendor documents this.

### TanStack v8 → v9 fixed a leaf-mode bug

- v8 leaf mode, at `depth >= maxLeafRowFilterDepth`, rebuilds the row
  with `subRows` undefined, which `createRow` turns into `[]` — the
  children vanish, contradicting the JSDoc ([ts8-fru], [ts8-row]).
- v9 assigns `newRow.subRows = row.subRows` there ([ts9-fru]). Source
  comparison only; no issue traced.

## Not researched

- Community pain (issues, forums) — the sibling `-community.md` node.
- TanStack licence — not re-read this run.
- DevExtreme licensing page.
- Server-side / remote filtering modes in any library (AG Grid SSRM,
  MUI `filterMode="server"`, DevExtreme `remoteOperations`).
- Search panels / quick filter as distinct from column filters — only
  DevExtreme and Syncfusion state that the mode applies to search too.
- Aggregation under filter (AG Grid `suppressAggFilteredOnly` noted in
  [ag-tdf], not followed).
- Keyboard and screen-reader behaviour of context rows.

## Unverified

- **Kendo UI for Angular TreeList**: every behaviour axis. Angular docs
  are silent; the bundle truncated on fetch. Would confirm: a Kendo
  Angular TreeList demo with a nested filter, or the
  `HierarchyBindingDirective` implementation in
  `@progress/kendo-angular-treelist@25.2.0`.
- **AG Grid and MUI auto-expansion on filter**: docs silent. Would
  confirm: AG Grid `rowHierarchy` expansion source at `b36.2.0`; MUI
  `useGridTreeData` / `useGridRowExpansion` source at `v9.14.0`.
- **AG Grid tree-data sorting**: only the row-grouping page was read.
  Would confirm: the enterprise sort stage source at `b36.2.0`.
- **AG Grid `selectAll: 'filtered'` with context ancestors** — whether a
  group kept only for its children counts as "satisfying the filter".
- **DevExtreme `matchOnly` indentation**: source keeps original
  `node.level`; that the row renders indented at that level is an
  inference, not read from the renderer.
- **MUI header select-all exclude-model branch**: `toggleAllRows` has a
  second path ("exclude" model) whose conditions were not quoted.
- **Syncfusion and DevExtreme** sorting-within-parent and select-all
  under filter.
- **PrimeNG filter source is from `master`**, not the 22.1.1 tag. The
  behaviour matches the 22.1.1 docs page ([png-doc]), which is
  corroboration, not a pin.
- **DevExtreme source is from branch `26_1`**, not a release tag.

## Sources

| Ref         | Claim it supports                                                                                                     | URL                                                                                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ag-tdf      | Default shows children; `excludeChildrenWhenTreeDataFiltering`; enterprise; Tree Filter; `suppressAggFilteredOnly`    | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-filtering/index.mdoc                        |
| ag-gfs      | Ancestor keep rule, two filter paths, filler groups not tested                                                        | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-enterprise/src/rowHierarchy/groupFilterStage.ts                                  |
| ag-fs       | Community filter stage is flat-only                                                                                   | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/clientSideRowModel/filterStage.ts                                  |
| ag-td       | Tree data is enterprise                                                                                               | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data/index.mdoc                                  |
| ag-open     | Expansion options; silent on filter                                                                                   | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/grouping-opening-groups/index.mdoc                    |
| ag-sort     | Sort within group (row grouping, secondary)                                                                           | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/grouping-sorting/index.mdoc                           |
| ag-msel     | `selectAll` values                                                                                                    | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/row-selection-multi-row/index.mdoc                    |
| ag-tsel     | `groupSelects: 'filteredDescendants'`                                                                                 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-selection/index.mdoc                        |
| ts9-fru     | v9 filter algorithms, both modes                                                                                      | https://unpkg.com/@tanstack/table-core@9.2.4/dist/features/column-filtering/filterRowsUtils.js                                                              |
| ts9-types   | v9 JSDoc for `filterFromLeafRows`, `maxLeafRowFilterDepth`                                                            | https://unpkg.com/@tanstack/table-core@9.2.4/dist/features/column-filtering/columnFilteringFeature.types.d.ts                                               |
| ts8-fru     | v8 leaf-mode depth bug                                                                                                | https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/filterRowsUtils.ts                                                                                  |
| ts8-row     | v8 `createRow` defaults `subRows` to `[]`                                                                             | https://unpkg.com/@tanstack/table-core@8.21.3/src/core/row.ts                                                                                               |
| ts8-sort    | Sort recurses into `subRows`                                                                                          | https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/getSortedRowModel.ts                                                                                |
| ts8-sel     | `toggleAllRowsSelected` row model                                                                                     | https://unpkg.com/@tanstack/table-core@8.21.3/src/features/RowSelection.ts                                                                                  |
| ts8-grp     | `getPreGroupedRowModel = getFilteredRowModel`                                                                         | https://unpkg.com/@tanstack/table-core@8.21.3/src/features/ColumnGrouping.ts                                                                                |
| ts8-exp     | No filter-driven expansion                                                                                            | https://unpkg.com/@tanstack/table-core@8.21.3/src/features/RowExpanding.ts                                                                                  |
| mui-td      | Filtering and sorting rules, `disableChildrenFiltering`, `disableChildrenSorting`, Pro plan                           | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/tree-data/tree-data.md                                                              |
| mui-utils   | `filterRowTreeFromTreeData` per-node logic                                                                            | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/hooks/features/treeData/gridTreeDataUtils.ts                               |
| mui-cell    | Descendant count, toggle hidden at 0                                                                                  | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/components/GridTreeDataGroupingCell.tsx                                    |
| mui-hdr     | Header checkbox row set                                                                                               | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid/src/components/columnSelection/GridHeaderCheckbox.tsx                              |
| mui-sel     | `getRowsToBeSelected`, `removeOutdatedSelection`                                                                      | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid/src/hooks/features/rowSelection/useGridRowSelection.ts                             |
| png-doc     | `filterMode` meanings, sort per level, version 22.1.1                                                                 | https://primeng.dev/treetable                                                                                                                               |
| png-src     | `isFilterMatched`, `findFilteredNodes`, no `expanded` write, header checkbox over `filteredNodes` (unpinned `master`) | https://raw.githubusercontent.com/primefaces/primeng/master/packages/primeng/src/treetable/treetable.ts                                                     |
| png-lic     | PrimeUI License terms                                                                                                 | https://unpkg.com/primeng@22.1.1/LICENSE.md                                                                                                                 |
| kd-basics   | Angular TreeList filtering page, silent on hierarchy                                                                  | https://www.telerik.com/kendo-angular-ui/components/treelist/filtering/basics                                                                               |
| kd-api      | `HierarchyBindingDirective` inputs                                                                                    | https://www.telerik.com/kendo-angular-ui/components/treelist/api/hierarchybindingdirective                                                                  |
| kd-jq-forum | jQuery TreeList ancestor rule (secondary, 2020-04-27)                                                                 | https://www.telerik.com/forums/treelist-filter-parents-only                                                                                                 |
| kd-tv       | Angular TreeView `expandMatches`, `maxAutoExpandResults`, strict mode (secondary)                                     | https://www.telerik.com/kendo-angular-ui/components/treeview/filtering                                                                                      |
| kd-lic      | Commercial licence                                                                                                    | https://unpkg.com/@progress/kendo-angular-treelist@25.2.0/LICENSE.md                                                                                        |
| dx-types    | `TreeListFilterMode` union, `expandNodesOnFiltering`, `selection.recursive`                                           | https://unpkg.com/devextreme@26.1.5/ui/tree_list.d.ts                                                                                                       |
| dx-cfg      | Defaults: `filterMode` `withAncestors`, `expandNodesOnFiltering` `true`                                               | https://js.devexpress.com/Angular/Documentation/ApiReference/UI_Components/dxTreeList/Configuration/#filterMode                                             |
| dx-demo     | Definitions of the three modes                                                                                        | https://js.devexpress.com/Angular/Demos/WidgetsGallery/Demo/TreeList/FilterModes/                                                                           |
| dx-nodes    | `node.visible`, `collectVisibleNodes`, `level`, expansion push                                                        | https://raw.githubusercontent.com/DevExpress/DevExtreme/26_1/packages/devextreme/js/__internal/grids/tree_list/data_source_adapter/utils/nodes.ts           |
| dx-adapter  | `matchOnly` → `visibleItems`; `expandVisibleNodes` / `collapseVisibleNodes`                                           | https://raw.githubusercontent.com/DevExpress/DevExtreme/26_1/packages/devextreme/js/__internal/grids/tree_list/data_source_adapter/m_data_source_adapter.ts |
| sf-doc      | Four `hierarchyMode` definitions                                                                                      | https://ej2.syncfusion.com/angular/documentation/treegrid/filtering/filtering                                                                               |
| sf-types    | `hierarchyMode` default `Parent`                                                                                      | https://unpkg.com/@syncfusion/ej2-treegrid@34.2.8/src/treegrid/models/filter-settings.d.ts                                                                  |
| sf-filter   | `updateFilterLevel` promotion, `hasFilteredChildRecords`                                                              | https://unpkg.com/@syncfusion/ej2-treegrid@34.2.8/src/treegrid/actions/filter.js                                                                            |
| sf-lic      | Community License thresholds                                                                                          | https://unpkg.com/@syncfusion/ej2-treegrid@34.2.8/license                                                                                                   |

[ag-tdf]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-filtering/index.mdoc
[ag-gfs]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-enterprise/src/rowHierarchy/groupFilterStage.ts
[ag-fs]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/clientSideRowModel/filterStage.ts
[ag-td]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data/index.mdoc
[ag-open]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/grouping-opening-groups/index.mdoc
[ag-sort]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/grouping-sorting/index.mdoc
[ag-msel]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/row-selection-multi-row/index.mdoc
[ag-tsel]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-selection/index.mdoc
[ts9-fru]: https://unpkg.com/@tanstack/table-core@9.2.4/dist/features/column-filtering/filterRowsUtils.js
[ts9-types]: https://unpkg.com/@tanstack/table-core@9.2.4/dist/features/column-filtering/columnFilteringFeature.types.d.ts
[ts8-fru]: https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/filterRowsUtils.ts
[ts8-row]: https://unpkg.com/@tanstack/table-core@8.21.3/src/core/row.ts
[ts8-sort]: https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/getSortedRowModel.ts
[ts8-sel]: https://unpkg.com/@tanstack/table-core@8.21.3/src/features/RowSelection.ts
[ts8-grp]: https://unpkg.com/@tanstack/table-core@8.21.3/src/features/ColumnGrouping.ts
[ts8-exp]: https://unpkg.com/@tanstack/table-core@8.21.3/src/features/RowExpanding.ts
[mui-td]: https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/tree-data/tree-data.md
[mui-utils]: https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/hooks/features/treeData/gridTreeDataUtils.ts
[mui-cell]: https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/components/GridTreeDataGroupingCell.tsx
[mui-hdr]: https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid/src/components/columnSelection/GridHeaderCheckbox.tsx
[mui-sel]: https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid/src/hooks/features/rowSelection/useGridRowSelection.ts
[png-doc]: https://primeng.dev/treetable
[png-src]: https://raw.githubusercontent.com/primefaces/primeng/master/packages/primeng/src/treetable/treetable.ts
[png-lic]: https://unpkg.com/primeng@22.1.1/LICENSE.md
[kd-basics]: https://www.telerik.com/kendo-angular-ui/components/treelist/filtering/basics
[kd-api]: https://www.telerik.com/kendo-angular-ui/components/treelist/api/hierarchybindingdirective
[kd-jq-forum]: https://www.telerik.com/forums/treelist-filter-parents-only
[kd-tv]: https://www.telerik.com/kendo-angular-ui/components/treeview/filtering
[kd-lic]: https://unpkg.com/@progress/kendo-angular-treelist@25.2.0/LICENSE.md
[dx-types]: https://unpkg.com/devextreme@26.1.5/ui/tree_list.d.ts
[dx-cfg]: https://js.devexpress.com/Angular/Documentation/ApiReference/UI_Components/dxTreeList/Configuration/#filterMode
[dx-demo]: https://js.devexpress.com/Angular/Demos/WidgetsGallery/Demo/TreeList/FilterModes/
[dx-nodes]: https://raw.githubusercontent.com/DevExpress/DevExtreme/26_1/packages/devextreme/js/__internal/grids/tree_list/data_source_adapter/utils/nodes.ts
[dx-adapter]: https://raw.githubusercontent.com/DevExpress/DevExtreme/26_1/packages/devextreme/js/__internal/grids/tree_list/data_source_adapter/m_data_source_adapter.ts
[sf-doc]: https://ej2.syncfusion.com/angular/documentation/treegrid/filtering/filtering
[sf-types]: https://unpkg.com/@syncfusion/ej2-treegrid@34.2.8/src/treegrid/models/filter-settings.d.ts
[sf-filter]: https://unpkg.com/@syncfusion/ej2-treegrid@34.2.8/src/treegrid/actions/filter.js
[sf-lic]: https://unpkg.com/@syncfusion/ej2-treegrid@34.2.8/license
