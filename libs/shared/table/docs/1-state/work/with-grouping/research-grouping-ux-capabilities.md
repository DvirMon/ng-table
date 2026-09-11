---
title: Research — grouped-table user-facing capabilities across grid libraries
type: research
status: complete
date: 2026-09-10
audience: product, developers
issue: null
---

# What a person can *do* with a grouped table — capability inventory across grid libraries

Product-side input for `withGrouping()` user stories. This is deliberately **not** an API-shape
comparison: every row below answers "what is on screen, and what can I click or press". The
API-ownership angle is already covered by the three sibling research docs
(`research-grouping-state-ownership.md`, `research-group-ordering.md`,
`research-generic-grouping-utilities.md`) — they are not restated here.

## Method and versions

Every claim is read from published documentation or published package artefacts at the versions
below, fetched 2026-09-10. Version numbers come from the npm registry `latest` metadata unless
noted.

| Library | Version read | Grouping tier |
|---|---|---|
| AG Grid | `ag-grid-community@36.1.0` (registry `latest`) | **Enterprise only** — the Row Grouping docs page is flagged `enterprise: true` and requires `RowGroupingModule`. Community ships no row grouping at all |
| TanStack Table | v8 line, `8.21.3` (pinned by the sibling ordering research from published source; npm `latest` for `@tanstack/react-table` now resolves to `9.2.4`, a different major) | Free, headless — **no UI of any kind** |
| MUI X Data Grid | `@mui/x-data-grid-premium@9.13.0` (registry `latest`) | Row grouping + aggregation are **Premium**. Tree data is Pro; row grouping is not |
| PrimeNG `p-table` | `primeng@22.1.1` (registry `latest`) | Free |
| Material React Table | `material-react-table@3.2.1` (registry `latest`) | Free; TanStack v8 underneath, adds the UI layer TanStack omits |

Docs roots used: [ag-grid.com](https://www.ag-grid.com/angular-data-grid/grouping/),
[tanstack.com/table/v8](https://tanstack.com/table/v8/docs/guide/grouping),
[mui.com/x/react-data-grid](https://mui.com/x/react-data-grid/row-grouping/),
[primeng.dev/table](https://primeng.dev/table),
[material-react-table.com](https://www.material-react-table.com/docs/guides/aggregation-and-grouping).

---

## The matrix

Legend: **✅** built in and user-operable · **⚙️** exists but developer must wire/render it ·
**❌** absent · **—** not documented.

### Choosing the grouping

| Affordance | AG Grid (Ent.) | TanStack v8 | MUI X Premium | PrimeNG | MRT |
|---|---|---|---|---|---|
| Drag column into a group panel | ✅ Row Group Panel — drag columns in, reorder pills, remove pills; `rowGroupPanelShow: 'always' \| 'onlyWhenGrouping' \| 'never'` (default `never`); needs `RowGroupingPanelModule` + `enableRowGroup: true` per column | ❌ | ❌ not built in — the docs point at a *recipe* ("Toolbar component — Row grouping bar") the developer builds | ❌ | ✅ drag handle → dropzone; `enableColumnDragging: false` turns it off while keeping the menu route |
| Column-menu item | ✅ `rowGroup` ("Group by this column", shown only when not grouped) / `rowUnGroup`; needs `ColumnMenuModule` — **AG Grid Community has no column menu at all** | ❌ | ✅ column menu items are the documented end-user route | ❌ | ✅ "group or ungroup" in the column-actions menu |
| Second drop zone (tool panel) | ✅ Columns Tool Panel has a Row Groups section; drag in, reorder, un-group via context menu | ❌ | ❌ | ❌ | ❌ |
| Programmatic only | — | ✅ **only** route: `setGrouping([...])` / `onGroupingChange`, plus `getToggleGroupingHandler()` you bind to your own button | ✅ `setRowGroupingModel()` / `initialState.rowGrouping.model` | ✅ **only** route: `groupRowsBy` input, set by the developer | ✅ |
| End user can turn grouping off entirely | ✅ remove the pill | ⚙️ | ✅ menu | ❌ | ✅ |

### Structure and depth

| Capability | AG Grid | TanStack v8 | MUI X | PrimeNG | MRT |
|---|---|---|---|---|---|
| Multi-level / nested | ✅ unlimited levels, ordered by panel pill order | ✅ unlimited, ordered by the `grouping: string[]` array | ✅ unlimited, `rowGrouping.model: string[]` | ❌ **single level only** — `groupRowsBy: any` is one field | ✅ inherits TanStack |
| Grouped column disposition | `groupDisplayType`: `singleColumn` (one auto group column, source columns hidden) / `multipleColumns` (one column per level) / `groupRows` (full-width parent rows). Also a discouraged custom-group-column route | `groupedColumnMode`: **`'reorder'` (default)** moves grouped columns to the front and keeps them; `'remove'` hides them; `false` leaves order alone | `rowGroupingColumnMode`: **`'single'` (default)** — one column named after the criterion, or "Group" for several; `'multiple'` for one per criterion. **The source column stays visible unless you opt into `useKeepGroupedColumnsHidden()`** | Column stays. `rowGroupMode: 'subheader'` adds a header/footer row per group; `rowGroupMode: 'rowspan'` merges the grouped column's cells vertically instead | `'reorder'` default, same three values as TanStack |
| Indent control | ✅ auto group column renderer | ⚙️ | ✅ CSS var `--DataGrid-cellOffsetMultiplier` (default `2`) | ❌ | ⚙️ |

### Expand / collapse

| Capability | AG Grid | TanStack v8 | MUI X | PrimeNG | MRT |
|---|---|---|---|---|---|
| Per-group toggle | ✅ chevron on the group row | ⚙️ `getToggleExpandedHandler()`, you render the control | ✅ chevron in the grouping cell | ✅ only in `subheader` mode with `expandableRowGroups`; state via `expandedRows` + `onRowToggle` |✅ |
| Expand-all / collapse-all button | ⚙️ `expandAll()` / `collapseAll()` API — no built-in button documented | ⚙️ `toggleAllRowsExpanded()`, no UI | ⚙️ `apiRef` only, no built-in button | ❌ — open request since [primeng#3670](https://github.com/primefaces/primeng/issues/3670) | ✅ **built-in expand-all button, `enableExpandAll: true` by default** |
| Expand to level N | ✅ `groupDefaultExpanded: number` (`-1` = all); default all-collapsed | ❌ — `ExpandedState` is `true` (all) or a per-row `Record<string, boolean>`; no depth concept | ✅ `defaultGroupingExpansionDepth` (`-1` = whole tree); default collapsed | ❌ | ❌ inherits TanStack |
| Per-group default via callback | ✅ `isGroupOpenByDefault` | ⚙️ `getIsRowExpanded` | ✅ `isGroupExpandedByDefault()` — takes priority over the depth prop | ❌ | ⚙️ |
| Reset to configured defaults | ✅ `resetRowGroupExpansion()` "discards all overrides and re-evaluates each group against the configured defaults" | ⚙️ `resetExpanded()` | ⚙️ | ❌ | ⚙️ |
| Survives a data refresh | ✅ persists; also savable/restorable as part of Grid State | ❌ **auto-resets** — `autoResetAll ?? autoResetExpanded ?? !manualExpanding`, so the default (client-side grouping, no `manualExpanding`) queues `resetExpanded()` on data change | ✅ in the server-side data source, "row expansion state persists across refetches by matching row IDs" (`keepChildrenExpanded` on `fetchRows()` controls it) | — | ❌ inherits TanStack |
| Survives sort / filter change | ✅ (`groupMaintainOrder` docs state group order is "preserved across filter changes and transactions") | ❌ same auto-reset path fires when the row model re-runs | — | — | ❌ |

### Group header row content

| Capability | AG Grid | TanStack v8 | MUI X | PrimeNG | MRT |
|---|---|---|---|---|---|
| Label | ✅ grouped value | ⚙️ you render `cell.getIsGrouped()` yourself | ✅ | ⚙️ `groupheader` template | ✅ |
| Child count badge | ✅ **shown by default**; `suppressCount: true` removes it | ❌ nothing rendered | ✅ **shown by default**; `hideDescendantCount` removes it | ❌ | ✅ **shown by default** — `<> ({row.subRows?.length})</>` appended when no custom `GroupedCell` (verified in `material-react-table@3.2.1/src/components/body/MRT_TableBodyCell.tsx`) |
| Aggregates inline on the group row | ✅ in `singleColumn`/`multipleColumns` modes the group row's other cells hold the aggregates. **In `groupRows` (full-width) mode they do not** — the docs give no default aggregate display; a custom renderer is required | ⚙️ `aggregatedCell` column option, you render it | ✅ aggregated values appear in group rows when row grouping is on | ❌ nothing computed; the `groupfooter` template is where consumers hand-compute totals | ⚙️/✅ `AggregatedCell` |
| Custom renderer | ✅ `groupRowRenderer` (whole row) or `innerRenderer` (inner content only) | ⚙️ | ✅ `groupingColDef` (object or per-column callback); a custom `renderCell` applies to grouping rows unless it returns `params.value` | ✅ template | ✅ `GroupedCell` / `AggregatedCell` / `PlaceholderCell` |
| Sticky while scrolling | ✅ **group rows stick to the top of the viewport by default**; `suppressGroupRowsSticky` disables. Total rows stick too (`suppressStickyTotalRow`) | ❌ | ❌ no recipe or prop found | ❌ | ❌ |

### Aggregation and totals

| Capability | AG Grid | TanStack v8 | MUI X | PrimeNG | MRT |
|---|---|---|---|---|---|
| Built-ins | `sum, min, max, count, avg, first, last` | `sum, min, max, extent, mean, median, unique, uniqueCount, count` — default `sum` for numeric columns, `count` otherwise | `sum, avg, min, max, size`, plus `size(true)` / `size(false)` for booleans | ❌ none | TanStack's set |
| Custom function | ✅ `aggFuncs` registry, referenced by name | ✅ `aggregationFns` or an inline function | ✅ object with `apply()`, `label`, optional `columnTypes` | n/a | ✅ |
| Applies at every level | ✅ every level + grand total | ✅ per group row | ✅ group rows, tree rows, footer | n/a | ✅ |
| End user picks the function | ✅ column menu `valueAggSubMenu` when `enableValue: true` | ❌ | ✅ **column menu → Aggregation** is the documented end-user route | ❌ | ❌ |
| Group footer row | ✅ `groupTotalRow: 'top' \| 'bottom'` or a per-group callback. Group row values are hidden when a total row shows, unless `groupSuppressBlankHeader` | ❌ | ⚙️ footer summary row exists at grid level; per-group footer is a recipe | ✅ `groupfooter` template, content entirely consumer-computed | ❌ |
| Grand total row | ✅ `grandTotalRow: 'top' \| 'bottom' \| 'pinnedTop' \| 'pinnedBottom'` — the pinned variants stay visible while scrolling | ❌ | ✅ footer row at the bottom of the grid | ⚙️ | ❌ |
| Aggregate over filtered vs all rows | ⚙️ `suppressAggFilteredOnly` / `groupAggFiltering` | filtered (row-model order) | ✅ `aggregationRowsScope` — **defaults to filtered rows**, `'all'` opts out | n/a | filtered |

### Ordering of the groups themselves

| Capability | AG Grid | TanStack v8 | MUI X | PrimeNG | MRT |
|---|---|---|---|---|---|
| Default order | data-insertion order | `Map` insertion (first-occurrence) order | criterion's `sortComparator` | **alphabetical-ish** — grouping *is* a sort of the whole dataset by `groupRowsBy` / `groupRowsByOrder` (default `1` = ascending) | first-occurrence |
| User clicks to sort the groups | ✅ click a pill in the Row Group Panel (unless `rowGroupPanelSuppressSort`), or sort the group column | ⚙️ your header click → `sorting` state | ✅ sort the grouping column | ✅ only the fixed `groupRowsByOrder` int, set by the developer, not the user | ⚙️ |
| Order by aggregate / child count | ✅ `initialGroupOrderComparator` gets full `IRowNode` pairs, so `allLeafChildren.length` comparisons are directly expressible | ⚙️ indirectly, by sorting on an aggregate column | ⚙️ documented **recipe**: "custom sorting by child row count" | ❌ | ⚙️ |
| Sorting a data column reorders the groups | **yes by default**; `groupMaintainOrder: true` (default `false`) turns it off, per level | **yes, always** — sorting is applied recursively to group rows and their `subRows` | yes | n/a (one is the other) | yes |
| Manual drag of *group instances* into an arbitrary order | ❌ | ❌ | ❌ | ❌ | ❌ — **no library offers this anywhere** |

### Interaction with other features

| Interaction | AG Grid | TanStack v8 | MUI X | PrimeNG | MRT |
|---|---|---|---|---|---|
| **Selection**: does checking a group check its children | `rowSelection.groupSelects` — **default `'self'`: no side effects**. Opt into `'descendants'` or `'filteredDescendants'`. In descendant modes group nodes are *excluded* from `getSelectedNodes()` / `getSelectedRows()` | **`enableSubRowSelection` default true** — selecting a parent selects all descendants | `rowSelectionPropagation` — **`descendants` and `parents` both default `true`**: selecting a parent selects filtered children, *and* selecting every child auto-selects the parent | — | inherits TanStack |
| Indeterminate / partial state | — not described in the group-selection docs | ✅ `getIsSomeSelected()` + `getIsAllSubRowsSelected()` | ⚙️ implied by upward propagation | — | ✅ |
| **Filtering**: do empty groups disappear | Filters apply to **leaf rows only** by default, so a group with no surviving leaves disappears. `groupAggFiltering` opts into filtering *on aggregated values*; a group that passes then drags all its descendants in with it, and `suppressAggFilteredOnly` becomes implicitly enabled. Set Filters only work on leaf rows | Structurally impossible to have an empty group: the row-model order is `core → filtered → grouped → sorted → expanded → paginated`, so groups are built from already-filtered rows. (`filterFromLeafRows`, default `false`, and `maxLeafRowFilterDepth`, default `100`, govern pre-existing sub-row trees, not grouping) | Per-criterion `filterOperators`; `mainGroupingCriteria` forces filtering/sorting onto a chosen criterion rather than leaves | Grouping is a sort, so filtered-out rows simply vanish and headers render over whatever contiguous runs remain | inherits TanStack |
| **Sorting**: within-group vs of-groups | Separable — see the ordering table | Not separable — one recursive pass | Group columns sort by criterion; leaves by their own comparator | Not separable at all | Not separable |
| **Pagination**: are groups split across pages | **`paginateChildRows: false` by default** — a page holds exactly N *groups*, expanding a group never pushes rows onto the next page (the page overflows instead). Set `true` for exactly N *rows*, at the cost of a group's children spilling onto the following page | **`paginateExpandedRows: true` by default** — expanded rows paginate with everything else, "which means expanded rows may span multiple pages". `false` keeps children on the parent's page and lets the page overflow | — not documented | — not documented | inherits TanStack |
| **Virtual scroll** | ✅ always virtualised, and group rows are the sticky element described above | ⚙️ bring your own virtualizer | ✅ virtualised | ⚙️ `virtualScroll` exists; combination with row grouping is not documented | ✅ optional virtualizer |
| **Inline editing** | ✅ `groupRowEditable` lets a user edit a cell *on the group row*, and the grid distributes the value across descendants. Editing a **grouped field** on a leaf re-buckets the row live: "the grid re-evaluates the grouping and moves the row to the correct group instantly" — needs `refreshAfterGroupEdit: true` + `getRowId` | — | — | — | — |
| **Row drag** | ✅ row dragging is supported with grouping | ⚙️ | ✅ `rowReordering` + `groupingValueSetter()` "converts values back during drag-and-drop reordering" — i.e. dragging a row into another group writes the new grouping value; `processRowUpdate()` persists it | ❌ | ⚙️ |

### Accessibility

| Capability | AG Grid | TanStack v8 | MUI X | PrimeNG | MRT |
|---|---|---|---|---|---|
| Container role | ✅ `role="treegrid"` "when using Tree Data or the grid has Row Grouping applied" | n/a (headless) | `role="treegrid"` documented for **tree data** (since v7, `ariaV7` flag removed and on by default); the docs do not state it for row grouping specifically | ❌ stays a plain table — "header, body and footer elements use `rowgroup`, rows use `row` role, header cells have `columnheader` and body cells use `cell` roles" | — |
| `aria-expanded` on group rows | ✅ "only present in row groups, it announces the expand state"; also `aria-rowindex`, `aria-selected` | n/a | — | ✅ but on the toggle *button*: "the element to expand or collapse a row is a `button` with `aria-expanded` and `aria-controls`" | — |
| Keyboard expand/collapse | ✅ **`Enter`** on a group element expands/collapses it. No arrow-key expand/collapse documented | n/a | ✅ **`Space`** — "toggle row children expansion when grouping cell is focused" | ⚙️ the toggle is a focusable button, so `Enter`/`Space` | — |
| Known gaps | ✅ docs admit "limitations in announcing the correct column name in grouped columns" | n/a | [mui-x#10032](https://github.com/mui/mui-x/issues/10032) — expandable rows not fully treegrid-conformant | no treegrid pattern | — |

### Server-side / lazy grouping

| Capability | AG Grid | TanStack v8 | MUI X | PrimeNG | MRT |
|---|---|---|---|---|---|
| Lazy group expansion | ✅ SSRM: expanding a group calls `getRows(params)` with `groupKeys` naming the path; the server returns only that group's children | ⚙️ `manual*` options — you own everything | ✅ Premium data source: `getGroupKey()`, `getChildrenCount()` (`-1` when unknown), `getRows()` receiving `groupKeys` + `groupFields`; children fetched only on expand, with caching | ❌ | ⚙️ |
| What the user sees while loading | loading rows during the fetch; `expandAll()` distinguishes loaded from unloaded groups and needs configuration flags | — | — not documented | n/a | — |
| Known rough edges | `serverSideOnlyRefreshFilteredGroups` can leave **empty group rows** because the grid "does not refresh the groups above the groups it deems impacted by the filter" | — | selection propagation is documented as incompatible with server-side data | n/a | — |

---

## Where the libraries disagree

Disagreement is where the product decision lives. Nine axes, ordered by how much the disagreement costs.

### 1. Selecting a group: three libraries, three different defaults

This is the sharpest split in the whole inventory, and it is a *default* split, not a
capability split — all three can be configured either way.

- **AG Grid**: `groupSelects` defaults to `'self'`. Ticking a group's checkbox selects the group
  row and nothing else. Cascading is opt-in, and comes in two flavours — `'descendants'` (all
  children) vs `'filteredDescendants'` (only children passing the current filter). When cascading
  is on, group nodes stop appearing in `getSelectedNodes()`/`getSelectedRows()` at all.
- **TanStack v8 / MRT**: `enableSubRowSelection` defaults to **true**. Ticking a parent ticks
  every descendant. Partial state is surfaced through `getIsSomeSelected()`.
- **MUI X Premium**: `rowSelectionPropagation` defaults to `{ descendants: true, parents: true }`
  — it cascades **both directions**. Ticking the last remaining child of a group silently ticks
  the group too. No other library propagates upward.

So "the user ticks a group header" means *select one row*, *select N rows*, or *select N rows and
possibly mutate the parent's state* depending on which library they last used. AG Grid's
`'filteredDescendants'` also raises a question nobody else asks out loud: when a filter is active
and the user ticks a collapsed group, do they get the 40 rows in the group or the 6 they can see?

### 2. Pagination: AG Grid and TanStack ship opposite defaults for the same trade

Both libraries frame it identically — either page sizes stay exact and groups get cut, or groups
stay whole and page sizes drift — and then choose opposite sides.

- **AG Grid** `paginateChildRows: false` (default): a page holds exactly N *groups*. Expanding a
  group never pushes anything to the next page; the page just gets taller. Groups are never split.
- **TanStack** `paginateExpandedRows: true` (default): expanded rows are paginated like any other
  row, so "expanded rows may span multiple pages". A group's header can sit at the bottom of page
  2 with its children on page 3. AG Grid's own docs flag exactly this as "potentially confusing
  users if the last row of a page expands".

MUI X and PrimeNG document neither behaviour, which is itself a signal: the question only becomes
visible once someone hits it in production.

### 3. Nobody lets a user reorder groups by hand

Every library can reorder group *levels* (drag pills in AG Grid's panel, reorder the `grouping`
array). Not one lets an end user drag **group instances** — "put Enterprise above SMB" — into an
arbitrary order. The closest anyone gets:

- AG Grid: `initialGroupOrderComparator` receives full `IRowNode` pairs, so a developer can close
  over an external ordered list. Enterprise-gated.
- MUI X: publishes it as a *recipe* ("custom sorting by child row count"), i.e. write your own
  comparator on the grouping column.
- TanStack / MRT: only via the ordinary `sorting` state, applied recursively.
- PrimeNG: a single ascending/descending integer, developer-set.

If a manual/external group order is a real product requirement, there is no prior art to copy the
UX from — it is greenfield, and it is a differentiator rather than table stakes.

### 4. What happens to the column you grouped by — four different answers

- **AG Grid** (`singleColumn`, the shape the docs lead with): a synthetic auto group column is
  added and the source columns are hidden. The user's column list visibly changes.
- **TanStack / MRT** (`'reorder'`, default): the grouped column stays, moved to the front.
- **MUI X** (`'single'`, default): the source column **stays exactly where it was**, in addition to
  the new grouping column — unless the developer opts into `useKeepGroupedColumnsHidden()`. Out of
  the box the user sees the same value twice.
- **PrimeNG**: the column stays, and `rowGroupMode: 'rowspan'` merges its cells vertically instead
  of adding a header row at all — a visually different concept of "grouped" from everyone else's.

There is also a display-mode axis AG Grid alone offers: full-width `groupRows` vs. a group
*column*. Worth noting that AG Grid's full-width group rows **lose inline aggregates** — the
default renderer shows value + count only, and aggregates need a custom renderer. Choosing
full-width group rows is therefore a trade against showing per-group numbers, not a free
cosmetic choice.

### 5. Does a collapsed group stay collapsed — TanStack says no, everyone else says yes

TanStack v8 resets expansion state on data change by default
(`autoResetAll ?? autoResetExpanded ?? !manualExpanding`). A poll, a refetch, an optimistic write
— all of it re-collapses the table under the user. Escaping it means setting `manualExpanding` or
explicitly `autoResetExpanded: false`.

AG Grid persists expansion, ships `resetRowGroupExpansion()` as the *explicit* way to discard it,
and can serialise it into Grid State. MUI X's server-side data source persists expansion across
refetches by matching row ids, with `keepChildrenExpanded` on `fetchRows()` as the control.

For a table whose rows update live, this single default is the difference between a usable and an
unusable grouped view.

### 6. Expand-to-depth exists in exactly half the libraries

AG Grid (`groupDefaultExpanded: number`, `-1` for all) and MUI X
(`defaultGroupingExpansionDepth`, `-1` for all) both model expansion as a *depth*. TanStack's
`ExpandedState` is `true | Record<string, boolean>` — all, or a hand-built set of row ids; there is
no depth concept, so "expand the first two levels" is consumer arithmetic. PrimeNG is single-level
so the question does not arise.

Conversely, the only library with a **built-in expand-all button** is MRT (`enableExpandAll`,
default true). AG Grid, MUI X and TanStack all expose `expandAll()`/`toggleAllRowsExpanded()` and
leave the button to you; PrimeNG has neither, and the request has been open since
[primeng#3670](https://github.com/primefaces/primeng/issues/3670).

### 7. Whether an empty group can exist at all

- **TanStack / MRT**: structurally impossible. The row-model order is
  `core → filtered → grouped → sorted → expanded → paginated`, so groups are computed from rows
  that already passed the filter.
- **AG Grid**: filters hit leaf rows only, so an all-filtered-out group disappears — *unless* you
  enable `groupAggFiltering`, at which point filters also run against aggregated values, a passing
  group pulls **all** its descendants back in regardless of their own match, and `Set Filters` stop
  working on group rows. Its server-side path can additionally leave genuinely empty group rows on
  screen (`serverSideOnlyRefreshFilteredGroups`).
- **MUI X**: filtering targets the grouping criterion's own `filterOperators`, and
  `mainGroupingCriteria` chooses whether the filter applies to the criterion or to leaves.
- **PrimeNG**: grouping is a sort, so there is no group object to be empty.

AG Grid's `groupAggFiltering` is the only real prior art for "filter *the groups*, not the rows"
(show me only regions whose total exceeds 1M) — and it is opt-in, Enterprise, and comes with two
documented caveats.

### 8. Sticky group headers are an AG Grid feature, full stop

AG Grid keeps a group row pinned to the top of the viewport while you scroll through its children
(`suppressGroupRowsSticky` to opt out), and does the same for total rows
(`suppressStickyTotalRow`). Grand total rows can be pinned outright
(`grandTotalRow: 'pinnedTop' | 'pinnedBottom'`). No other library in this set documents sticky
group headers, and MUI X does not even have a recipe for it. For long groups this is the single
biggest readability difference on screen.

### 9. Aggregation as a user action vs. a developer configuration

AG Grid (`valueAggSubMenu` when `enableValue: true`) and MUI X (column menu → **Aggregation**) both
let the *end user* pick sum vs. avg vs. count per column at runtime. TanStack, MRT and PrimeNG do
not — the function is fixed by the developer. PrimeNG ships no aggregation at all; its
`groupfooter` template is a blank canvas the consumer fills with hand-written totals, and no
aggregation member appears anywhere in `primeng@22.1.1`'s table type declarations.

A related split: **totals rows**. AG Grid has both per-group footers (`groupTotalRow: 'top' |
'bottom'`, or a callback for selective footers) and a grand total row with four placements. MUI X
has a grid-level footer. TanStack and MRT have neither concept — a total row is something you
render yourself outside the table.

---

## What this suggests for `withGrouping()` user stories

Not decisions — just where the inventory points.

- The **selection × grouping** default is the highest-stakes single choice, and the one where
  copying "what people expect" is impossible because the three majors expect three different
  things. It needs an explicit product decision with a stated rationale, and probably needs the
  filtered-vs-unfiltered descendants question answered at the same time.
- The **pagination × grouping** trade (exact page size vs. whole groups) is unavoidable and
  binary. Two of five libraries do not document it at all, which is a warning, not permission.
- **Expansion surviving a data refresh** is the cheapest large win in this list: TanStack's
  default is the outlier and is widely felt as a bug.
- **Sticky group headers** and a **built-in expand-all control** are the two visible affordances
  most likely to be assumed present and found missing.
- **Manual group ordering** has no prior art to imitate — treat it as design work, not as a
  feature to port.
- **Showing a child count on the group row by default** is the near-unanimous convention (AG Grid,
  MUI X, MRT all render it and all offer a switch to hide it). Not rendering one would be the
  surprising choice.

---

## Not researched

- **PrimeNG `expandableRowGroups` as a typed member.** The current docs at `primeng.dev/table`
  describe three row-group modes including an expandable one, and the Row Group section documents
  `expandableRowGroups` + `expandedRows` + `onRowToggle`. Two separate reads of
  `primeng@22.1.1/types/primeng-table.d.ts` failed to surface the identifier, and a read of
  `fesm2022/primeng-table.mjs` also failed to find it — but both reads were of large files via a
  summarising fetch and demonstrably omitted members known to be present (`rowGroupMode`), so
  **the absence is not evidence**. GitHub code search returned `0` for known-present identifiers
  too, so that route was abandoned. Treat the docs as authoritative and re-verify from a locally
  unpacked tarball before relying on it.
- **PrimeNG × pagination / virtual scroll / selection / sorting when grouped.** The PrimeNG docs
  present row grouping in isolation and document none of these combinations.
- **MUI X × pagination when grouped** — whether a group can be split across pages. Not stated on
  the pagination page, the row grouping page, or the recipes page.
- **MUI X `role="treegrid"` for row grouping specifically.** Confirmed documented for tree data
  (v7+, `ariaV7` removed); the accessibility page does not name row grouping, and
  [mui-x#10032](https://github.com/mui/mui-x/issues/10032) suggests the expandable-row a11y story
  was incomplete when filed. Current status unverified.
- **Material React Table accessibility for group rows** — no a11y documentation was read; MRT
  renders MUI components, so its story is presumably MUI's, but that was not checked.
- **AG Grid `groupHideParentOfSingleChild` / `groupRemoveSingleChildren`** — the "a group with one
  child collapses into that child" behaviour. Referenced in older AG Grid material; not found on
  the v36 pages read.
- **AG Grid SSRM loading UX in detail** — whether a loading row, skeleton, or spinner is shown per
  expanding group, and whether it is customisable. The docs read confirm lazy fetch on expand but
  do not describe the visual.
- **Screen-reader announcements in practice.** Everything in the a11y section is what the libraries
  *document emitting*; none of it was tested with an actual screen reader.
- **AG Grid Community grouping-adjacent features** (row spanning, master/detail) that might give a
  grouped *look* without `RowGroupingModule`. Out of scope here; also flagged as unresearched by
  the sibling ordering doc.
- **Touch / mobile affordances** for any library — expand targets, drag-to-group on touch (AG Grid
  mentions touch drag in the tool panel; nothing else was checked).
- **Pivot mode** in AG Grid and MUI X. Adjacent to grouping and it changes the on-screen model
  substantially, but it is a separate feature and was excluded deliberately.

## Sources

AG Grid v36 (Enterprise unless noted) —
[Row Grouping](https://www.ag-grid.com/angular-data-grid/grouping/) ·
[Grouping Data](https://www.ag-grid.com/angular-data-grid/grouping-data/) ·
[Display Types](https://www.ag-grid.com/angular-data-grid/grouping-display-types/) ·
[Group Rows](https://www.ag-grid.com/javascript-data-grid/grouping-group-rows/) ·
[Opening Groups](https://www.ag-grid.com/angular-data-grid/grouping-opening-groups/) ·
[Row Group Panel](https://www.ag-grid.com/angular-data-grid/grouping-group-panel/) ·
[Sorting Groups](https://www.ag-grid.com/angular-data-grid/grouping-sorting/) ·
[Selecting Groups](https://www.ag-grid.com/angular-data-grid/grouping-row-selection/) ·
[Editing Groups](https://www.ag-grid.com/javascript-data-grid/grouping-edit/) ·
[Total Rows](https://www.ag-grid.com/angular-data-grid/grouping-footers/) ·
[Aggregation](https://www.ag-grid.com/angular-data-grid/aggregation/) ·
[Aggregation Filtering](https://www.ag-grid.com/javascript-data-grid/aggregation-filtering/) ·
[Column Menu](https://www.ag-grid.com/angular-data-grid/column-menu/) ·
[Columns Tool Panel](https://www.ag-grid.com/angular-data-grid/tool-panel-columns/) ·
[Pagination](https://www.ag-grid.com/angular-data-grid/row-pagination/) ·
[Accessibility](https://www.ag-grid.com/angular-data-grid/accessibility/) ·
[Keyboard Navigation](https://www.ag-grid.com/angular-data-grid/keyboard-navigation/) ·
[SSRM Grouping](https://www.ag-grid.com/angular-data-grid/server-side-model-grouping/)

TanStack Table v8 —
[Grouping guide](https://tanstack.com/table/v8/docs/guide/grouping) ·
[Grouping API](https://tanstack.com/table/v8/docs/api/features/grouping) ·
[Expanding API](https://tanstack.com/table/v8/docs/api/features/expanding) ·
[Row Selection API](https://tanstack.com/table/v8/docs/api/features/row-selection) ·
[Column Filtering API](https://tanstack.com/table/v8/docs/api/features/column-filtering) ·
[Row Models guide](https://tanstack.com/table/v8/docs/guide/row-models) ·
published source `@tanstack/table-core@8.21.3/src/features/RowExpanding.ts` (via unpkg) for the
`paginateExpandedRows` / `_autoResetExpanded` defaults

MUI X v9.13.0 —
[Row grouping](https://mui.com/x/react-data-grid/row-grouping/) ·
[Row grouping recipes](https://mui.com/x/react-data-grid/recipes-row-grouping/) ·
[Aggregation](https://mui.com/x/react-data-grid/aggregation/) ·
[Server-side row grouping](https://mui.com/x/react-data-grid/server-side-data/row-grouping/) ·
[Accessibility](https://mui.com/x/react-data-grid/accessibility/) ·
[Pagination](https://mui.com/x/react-data-grid/pagination/)

PrimeNG 22.1.1 — [Table docs](https://primeng.dev/table) ·
`primeng@22.1.1/types/primeng-table.d.ts` (via jsDelivr) ·
[primeng#3670](https://github.com/primefaces/primeng/issues/3670)

Material React Table 3.2.1 —
[Aggregation and Grouping guide](https://www.material-react-table.com/docs/guides/aggregation-and-grouping) ·
published source `material-react-table@3.2.1/src/components/body/MRT_TableBodyCell.tsx` (via unpkg)
