# Row expansion / detail panel — what a person can click, press and see, across five table libraries

**Date:** 2026-09-30 · **Mode:** competitor-capabilities

Scope: a row opens an inline panel of arbitrary markup beneath it (master/detail).
Tree / nested child rows (`withTree`) are out of scope.

## Answer

- Every library puts the toggle on a **dedicated button/cell**; none makes plain row click the
  built-in default. Row click exists only as a recipe (MUI) or in an example (Material).
  AG Grid is the exception on the pointer side: **double-click and Enter expand by default**.
- **Multi-open is the default everywhere a default exists** (MUI, PrimeNG, TanStack's state
  shape). Single-open is built in only in PrimeNG (`rowExpandMode="single"`); elsewhere a recipe.
- **Expand-all is never a shipped button.** It is an API or a recipe in all five.
- The two virtualized grids (AG Grid, MUI) **paywall the whole feature** and ship a fixed
  default panel height (300px / 500px). The three non-virtualized tables give it free, with
  natural height. That split is the sharpest finding.
- ARIA is thin: only MUI (source) sets `aria-expanded` on the toggle; only PrimeNG (docs)
  claims `aria-controls`. No vendor documents panel loading or error states.

## Method and source reliability

All pages read 2026-09-30. Version pins from the npm registry `/latest` endpoint the same day.

| Library            | Pin                               | Pin source | What was read                                                                                                                         |
| ------------------ | --------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| AG Grid            | `36.2.0`                          | [R1]       | `.mdoc` docs at tag `b36.2.0`; `.d.ts` on unpkg `@36.2.0`                                                                             |
| TanStack Table     | `9.2.4` latest; **read `8.21.3`** | [R2]       | v9 ships no `src/`, so v8 source + v8 docs tag were read. v9 behavior unverified                                                      |
| MUI X DataGrid Pro | `9.14.0`                          | [R3]       | docs markdown + source at tag `v9.14.0`                                                                                               |
| PrimeNG            | `22.1.2`                          | [R4]       | `primeng-table.mjs` on unpkg `@22.1.2` (truncated by fetch); showcase doc on `master` (**unpinned**); primeng.dev page (shows 22.1.2) |
| Angular Material   | `22.2.1`                          | [R5]       | `components-examples` on branch `22.2.x` (**unpinned branch**, not tag)                                                               |

Reliability notes carried into this read:

- AG Grid docs: the `.mdoc` source at a tag beats the rendered site. Several master/detail
  topics (expand-all, single-open, row click) are **absent** from the `b36.2.0` pages read —
  absence is reported as absence, not as "not supported".
- MUI: the Pro badge lives in the docs markdown (`plan-pro` span), not always the rendered page.
- PrimeNG: `primeng-table.mjs` and `table.ts` are too large for WebFetch; both truncated before
  the `RowToggler` class. Everything about the toggler's own host bindings is therefore
  **docs-only**, not source-confirmed.
- Angular Material: there is no expansion feature in the library. Everything in its column is
  an official **example** (`components-examples`), which is evidence of intended usage, not a
  shipped behavior.
- TanStack is headless. Its column describes state and handlers only; any UI is the official
  example's.

## Findings — matrix (axis × library)

Each cell carries its own citation; IDs resolve in Sources.

### Toggle affordance

| Axis                   | AG Grid (Enterprise)                                                   | MUI X (Pro)                                                                                                   | PrimeNG                                                                  | TanStack                                                                                             | Angular Material (example)                                                           |
| ---------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Where the toggle lives | Chevron inside the first column's cell, via `agGroupCellRenderer` [A1] | Dedicated toggle column, width 40, not sortable/filterable/resizable/reorderable, header visually hidden [M5] | Any element carrying `pRowToggler`; demo uses a rounded text button [P2] | Nothing shipped: "will not add a toggling handler UI" [T6]; example uses a `<button>` in a cell [T7] | Dedicated `expand` column appended **last** (`[...columnsToDisplay, 'expand']`) [N2] |
| Icon states            | Not read (see Unverified)                                              | Slots `detailPanelExpandIcon` / `detailPanelCollapseIcon`; docs call it "the **+** icon" [M1]                 | `pi-chevron-right` collapsed → `pi-chevron-down` expanded (demo) [P2]    | Example: 👉 collapsed / 👇 expanded [T7]                                                             | `keyboard_arrow_down`, rotated 180° when expanded, 225ms transition [N1] [N3]        |
| Row click              | Not documented [A1]                                                    | Recipe only: "toggle the detail panel by clicking anywhere on the row" [M2]                                   | Not built in; only the `pRowToggler` element [P2]                        | Consumer's choice [T6]                                                                               | Example toggles on row click; button calls `$event.stopPropagation()` [N1]           |
| Double-click           | **Expands by default**; opt out with `suppressDoubleClickExpand` [A2]  | Not in the click handler (toggle-cell only) [M4]                                                              | Not found                                                                | n/a                                                                                                  | n/a                                                                                  |
| Row that has no panel  | `isRowMaster` returns false → row cannot expand [A4]                   | `getDetailPanelContent` returns null → toggle disables itself [M1] [M3]                                       | Not read                                                                 | `getRowCanExpand` [T1]; example shows 🔵 [T7]                                                        | Not handled in example                                                               |

### Keyboard

| AG Grid                                                                                                                                                                       | MUI X                                                                                                                                                                           | PrimeNG                                        | TanStack                          | Material                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| **Enter** on a group element expands/collapses [A3]; `suppressEnterExpand` opts out [A2]. Custom detail panels "need to implement [their] own keyboard navigation" [A3] [A11] | **Space** on the toggle cell (docs [M1], source [M4]). The a11y page separately lists **Ctrl+Enter** "Toggle the detail panel of a row" [M7] — the hook read does not handle it | Docs list only generic button Space/Enter [P3] | Native `<button>` in example [T7] | Native `matIconButton`; row click is mouse-only [N1] |

### Expand all / collapse all

| AG Grid                                                                                                                               | MUI X                                                                            | PrimeNG                                                                                 | TanStack                                                                                                              | Material |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| API `expandAll()` / `collapseAll()`, documented as "Expand all groups" [A5]; initial `masterDefaultExpanded: -1` "to expand all" [A4] | No shipped control. Recipe: custom header calling `setExpandedDetailPanels` [M2] | No shipped control. Demo: two buttons **outside** the table rewrite `expandedRows` [P2] | `toggleAllRowsExpanded()`; `getToggleAllRowsExpandedHandler()` "meant to be used with an `input[type=checkbox]`" [T1] | None     |

### Single vs multi open

| AG Grid                  | MUI X                                                     | PrimeNG                                                                                              | TanStack                                                                                | Material                                                                |
| ------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Not stated in pages read | Multi by default; single via controlled-state recipe [M2] | `rowExpandMode` input, default `"multiple"`; `"single"` resets `expandedRowKeys = {}` on expand [P1] | `ExpandedState = true \| Record<string, boolean>` → multi; single is consumer code [T1] | Example is **single** (`expandedElement: PeriodicElement \| null`) [N2] |

### Panel content — loading, error, lifecycle

| AG Grid                                                                                                                                                                                                                                                                                                 | MUI X                                                                                                                                                                      | PrimeNG                                        | TanStack                                   | Material                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Arbitrary content via `detailCellRenderer`: "no restrictions as to what can appear" [A11]. Data via `getDetailRowData` success callback, sync or async [A8]. No loading/error UI documented [A8]. **Destroyed on collapse** unless `keepDetailRows` (cache, `keepDetailRowsCount` default 10) [A8] [A6] | Content fetched by the panel component on mount (recipe); warns "lazy loading panels with auto height can lead to scrolling issues" [M1] [M2]. No loading/error UI shipped | `#expandedrow` template [P2]; no loading state | Consumer renders `renderSubComponent` [T7] | Detail row rendered for **every** row, hidden by `grid-template-rows: 0fr` + `overflow: hidden` [N1] [N3] |

### Panel height and scroll

| AG Grid                                                                                                                                                                                                                                                                                                                                 | MUI X                                                                                                                                                                                                                    | PrimeNG                                | TanStack                                           | Material                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| Fixed **300px** default; `detailRowHeight`; `detailRowAutoHeight` (min 150px rows section, no max; disables detail virtualization); per-row `getRowHeight` [A7] [A6]. Detail **does not** move with master's horizontal scroll by default; `embedFullWidthRows` syncs it and renders the panel **three times** (left/centre/right) [A9] | Fixed **500px** default; `getDetailPanelHeight` → number or `"auto"` [M1]; auto measured by `ResizeObserver` [M6]. Content **does** scroll horizontally by default; recipe pins it with `position: sticky; left: 0` [M1] | Natural `<tr><td colspan>` height [P2] | Natural height, `<td colSpan={visibleCells}>` [T7] | Natural height, animated 0fr→1fr over 225ms [N3] |

### What survives sort / filter / page / refetch

| AG Grid                                                                                                                                                                                                                                                                      | MUI X                                                                                                                                          | PrimeNG                                                                          | TanStack                                                                                                                                                                                            | Material                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Master row data update with row ids → `refreshStrategy` `rows` (keeps detail instance), `everything` (rebuild, loses scroll/selection), `nothing` (stale) [A10]. Master and detail "filter and sort independently" [A9]. Master sort/filter effect on open state: not stated | Expanded set keyed by row id (`detailPanelExpandedRowIds`) [M1]; caches recomputed on `sortedRowsSet`, no pruning of ids seen in the hook [M4] | Keyed by `dataKey` (required) [P2] [P1]; reset on sort/filter/page not confirmed | Keyed by row id; auto-reset (`autoResetExpanded`) is queued only from `getGroupedRowModel` [T2], not from core/sorted/filtered models [T3] [T4] [T5]. `paginateExpandedRows` concerns sub-rows [T1] | Keyed by **object identity** (`this.expandedElement === element`) [N2] |

### ARIA

| AG Grid                                                                                                                                                         | MUI X                                                                                                                                                                                                | PrimeNG                                                                                          | TanStack             | Material                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------- | --------------------------------------------------------- |
| Master/detail grid is `role="grid"`; `aria-expanded` documented "only present in row groups" / "only present in a group cell" [A12] — master rows not addressed | Toggle: `aria-expanded={isExpanded}`, `aria-label` flips between locale keys `expandDetailPanel` / `collapseDetailPanel`, `tabIndex={-1}`, no `aria-controls` [M3]. Panel element `role="none"` [M6] | Docs: toggler "is a button with `aria-expanded` and `aria-controls`" [P3] (source not confirmed) | None in example [T7] | Static `aria-label="expand row"`, no `aria-expanded` [N1] |

### Tier gating

| AG Grid                                                                                                                                                     | MUI X                                              | PrimeNG | TanStack   | Material |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------- | ---------- | -------- |
| **Enterprise** (`enterprise: true`) [A1]; options tagged `MasterDetailModule` [A6]. Community **Full Width Rows** is not enterprise but has no toggle [A13] | **Pro** plan badge [M1]; not in the MIT `DataGrid` | Free    | Free (MIT) | Free     |

## Synthesis — where they disagree

**Pointer affordance: button-only vs. cell gestures.**
AG Grid alone binds double-click and Enter to the expand cell by default [A2].
MUI, PrimeNG and TanStack confine it to one control. Material's example makes the whole row a
click target. Implication: "the chevron button" is the only affordance every library agrees on;
row-level gestures are a per-product choice and collide with row selection/editing.

**Keyboard key: Enter vs Space vs Ctrl+Enter.**
AG Grid: Enter [A3]. MUI: Space in its own source [M4], Ctrl+Enter on its own a11y page [M7].
A native button (PrimeNG, Material, TanStack) gets both Enter and Space for free.
No agreement — and MUI disagrees with itself. The safe floor is a real `<button>`.

**Toggle placement: first vs last.**
AG Grid puts it in the first column's cell [A1]; Material's example puts a column last [N2].
MUI and PrimeNG placement is configurable and was not pinned from what was read.

**Default open mode.** Multi in MUI [M2] and PrimeNG [P1]; single in Material's example [N2].
PrimeNG is the only one making single-open a one-word switch — evidence that the choice is a
real product question, not an edge case.

**Panel lifecycle: destroy vs keep.**
AG Grid destroys on collapse and makes keeping opt-in with a count cap [A8].
Material keeps every panel mounted, hidden by CSS [N3] — which also leaves hidden panel content
in the DOM (inference: focusable controls inside a 0fr panel are still tabbable unless made
`inert`; not stated by the example).
MUI warns that remounting breaks auto height [M1]. The split is: state preservation vs.
memory, and nobody documents what a person loses when a panel closes.

**Height: fixed default vs natural.**
Virtualized grids need a known height, so they ship 300px (AG) / 500px (MUI) fixed defaults and
make auto opt-in with caveats [A7] [M1]. Non-virtualized tables never face the question.
The number itself disagrees (300 vs 500), so neither is a convention.

**Horizontal scroll: panel pinned vs panel scrolls.**
AG Grid's panel stays put while the master scrolls [A9]; MUI's panel scrolls with it [M1]. Each
offers the other as an opt-in. Direct disagreement on the default.

**Identity across data changes.**
AG Grid / MUI / PrimeNG / TanStack key by row id [A10] [M1] [P1] [T1]; Material's example keys
by object reference [N2] (inference: a refetch returning new objects collapses every panel).
Only AG Grid documents what happens to an open panel when its row's data changes [A10].

**ARIA: which attribute on which element.**
MUI: `aria-expanded` on the button, no `aria-controls` [M3]. PrimeNG: both, per docs [P3].
AG Grid: silent for master rows [A12]. Material example: neither [N1]. No agreement; the WAI
disclosure pattern (button + `aria-expanded`, optional `aria-controls`) is the neutral anchor
(not re-read this run — see Not researched).

**Tier line.**
Both paywalled vendors are the virtualized grids; all three free options are plain HTML tables.
Inference, not a vendor statement: what is metered is not "a row with a panel under it" (trivial
in a `<table>`) but panel height management inside a virtualized, pinned-column grid.
AG Grid draws the line tighter than MUI: its community tier already has spanning full-width
rows [A13], so the paid part is the toggle + lifecycle, not the spanning row.

**Everyday expectation (what a person already knows from these tools).**
A chevron/plus button on the row, several rows open at once, the panel sized to its content,
panels staying open across sort. Anything beyond that (row click, single-open, expand-all) is
recipe territory in every library surveyed.

## Not researched

- WAI-ARIA APG disclosure / grid patterns — not re-read this run.
- TanStack v9 behavior (no `src/` published; v9 docs page returned not-found).
- Community pain (issue trackers) — belongs to the `community-pain` node.
- Server-side row model variants (AG Grid SSRM master/detail, MUI server-side data).
- Export/print of detail panels; detail panels with pinned rows; nested master/detail.
- Other vendors (Syncfusion, DevExtreme, Handsontable, Material React Table).

## Unverified

- **AG Grid default icons** for master rows (assumed chevrons from the group cell renderer's
  `groupExpanded`/`groupContracted` icons) — the icons page was not read.
- **AG Grid `expandAll()` on master rows.** Its doc comment says "groups" [A5]; a web-search
  summary claimed it expands master rows. Not confirmed from a page.
- **AG Grid default open mode** and whether open state survives master sort/filter/page.
- **AG Grid `aria-expanded` on a master row's cell** — the a11y page only names row groups and
  group cells [A12].
- **Whether Enter/double-click apply to master rows.** The `suppress*Expand` params belong to
  the group cell renderer [A2], which master rows use [A1]; applying them to master rows is an
  inference.
- **MUI Ctrl+Enter.** Listed on [M7]; not found in `useGridDetailPanel` [M4]. Could live in
  another hook. Confirm by reading MUI keyboard-navigation source at `v9.14.0`.
- **MUI toggle column default position** and default glyph beyond "the + icon" [M1].
- **MUI pruning of expanded ids** for rows that are filtered out or removed — the hook read shows
  none [M4]; another hook may do it.
- **PrimeNG `pRowToggler` host bindings** (keyboard, `aria-expanded`, `aria-controls`,
  disabled input) — docs claim [P3], source truncated [P1].
- **PrimeNG expansion reset** on sort/filter/page, and toggler column position in the demo.
- **TanStack `_autoResetExpanded` call sites** beyond the four row-model files read.

## Sources

| ID  | Claim(s)                                                                                                                        | Source                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | AG Grid pin 36.2.0                                                                                                              | https://registry.npmjs.org/ag-grid-community/latest                                                                                                         |
| R2  | TanStack pin 9.2.4                                                                                                              | https://registry.npmjs.org/@tanstack/table-core/latest                                                                                                      |
| R3  | MUI Pro pin 9.14.0                                                                                                              | https://registry.npmjs.org/@mui/x-data-grid-pro/latest                                                                                                      |
| R4  | PrimeNG pin 22.1.2                                                                                                              | https://registry.npmjs.org/primeng/latest                                                                                                                   |
| R5  | Material pin 22.2.1                                                                                                             | https://registry.npmjs.org/@angular/material/latest                                                                                                         |
| A1  | `enterprise: true`; `agGroupCellRenderer` "includes the expand / collapse functionality"                                        | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/master-detail/index.mdoc                              |
| A2  | `suppressDoubleClickExpand`, `suppressEnterExpand`                                                                              | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/interfaces/groupCellRenderer.d.ts                                                                 |
| A3  | Enter on a group element expands/collapses; custom details own keyboard nav                                                     | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/keyboard-navigation/index.mdoc                        |
| A4  | `isRowMaster`; `masterDefaultExpanded: -1`; `isMasterOpenByDefault`                                                             | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/master-detail-master-rows/index.mdoc                  |
| A5  | `expandAll()` "Expand all groups"                                                                                               | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/api/gridApi.d.ts                                                                                  |
| A6  | `MasterDetailModule`; `keepDetailRowsCount` default 10; height options                                                          | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/entities/gridOptions.d.ts                                                                         |
| A7  | 300px default; auto height min 150px, no max, disables virtualization                                                           | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/master-detail-height/index.mdoc                       |
| A8  | Destroyed on collapse; `keepDetailRows`; async `getDetailRowData`                                                               | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/master-detail-grids/index.mdoc                        |
| A9  | Detail overlays master on horizontal scroll; `embedFullWidthRows` renders 3×; sort/filter independent                           | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/master-detail-other/index.mdoc                        |
| A10 | Refresh strategies on master data update                                                                                        | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/master-detail-refresh/index.mdoc                      |
| A11 | Custom detail: "no restrictions"; own keyboard navigation                                                                       | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/master-detail-custom-detail/index.mdoc                |
| A12 | `role="grid"` for master/detail; `aria-expanded` scope                                                                          | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/accessibility/index.mdoc                              |
| A13 | Full Width Rows not enterprise; no toggle                                                                                       | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/full-width-rows/index.mdoc                            |
| M1  | Pro badge; Space; + icon; 500px; `"auto"`; lazy warning; controlled ids; icon slots; null disables toggle; sticky scroll recipe | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/master-detail/master-detail.md                                                      |
| M2  | Multi by default; one-at-a-time, expand-all header, row-click recipes                                                           | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/row-recipes/row-recipes.md                                                          |
| M3  | Toggle `aria-expanded`, `aria-label` keys, `tabIndex -1`, `disabled`                                                            | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/components/GridDetailPanelToggleCell.tsx                                   |
| M4  | Space-only key handler; click handler; `sortedRowsSet` cache update                                                             | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/hooks/features/detailPanel/useGridDetailPanel.ts                           |
| M5  | Toggle column width 40, not sortable/filterable, hidden header                                                                  | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/hooks/features/detailPanel/gridDetailPanelToggleColDef.tsx                 |
| M6  | Panel `role="none"`; `ResizeObserver` for auto height                                                                           | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/components/GridDetailPanel.tsx                                             |
| M7  | Ctrl+Enter "Toggle the detail panel of a row"                                                                                   | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/accessibility/accessibility.md                                                      |
| T1  | `ExpandedState`; `getRowCanExpand`; `toggleAllRowsExpanded`; checkbox handler; `paginateExpandedRows`; auto-reset condition     | https://unpkg.com/@tanstack/table-core@8.21.3/src/features/RowExpanding.ts                                                                                  |
| T2  | `_autoResetExpanded` queued in grouped row model                                                                                | https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/getGroupedRowModel.ts                                                                               |
| T3  | No `_autoResetExpanded` in sorted model                                                                                         | https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/getSortedRowModel.ts                                                                                |
| T4  | No `_autoResetExpanded` in filtered model                                                                                       | https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/getFilteredRowModel.ts                                                                              |
| T5  | No `_autoResetExpanded` in core model                                                                                           | https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/getCoreRowModel.ts                                                                                  |
| T6  | "will not add a toggling handler UI"; colSpan row pattern                                                                       | https://raw.githubusercontent.com/TanStack/table/v8.21.3/docs/guide/expanding.md                                                                            |
| T7  | Example button, emoji states, `<td colSpan>` sub-component                                                                      | https://raw.githubusercontent.com/TanStack/table/v8.21.3/examples/react/sub-components/src/main.tsx                                                         |
| P1  | `rowExpandMode` default `"multiple"`; single resets keys; `expandedRowKeys`; `dataKey`                                          | https://unpkg.com/primeng@22.1.2/fesm2022/primeng-table.mjs                                                                                                 |
| P2  | Demo: chevron-right/down toggler; `#expandedrow`; Expand/Collapse All outside table; `dataKey` required                         | https://raw.githubusercontent.com/primefaces/primeng/master/apps/showcase/doc/table/rowexpansion-doc.ts                                                     |
| P3  | Toggler "is a button with aria-expanded and aria-controls"; page shows 22.1.2                                                   | https://primeng.dev/table                                                                                                                                   |
| N1  | Template: last `expand` column, `aria-label="expand row"`, row click, `stopPropagation`                                         | https://raw.githubusercontent.com/angular/components/22.2.x/src/components-examples/material/table/table-expandable-rows/table-expandable-rows-example.html |
| N2  | Single `expandedElement`, identity comparison, column appended last                                                             | https://raw.githubusercontent.com/angular/components/22.2.x/src/components-examples/material/table/table-expandable-rows/table-expandable-rows-example.ts   |
| N3  | 0fr→1fr 225ms; chevron rotate 180°; detail row height 0                                                                         | https://raw.githubusercontent.com/angular/components/22.2.x/src/components-examples/material/table/table-expandable-rows/table-expandable-rows-example.css  |
| N4  | `multiTemplateDataRows`; `when` unsupported with virtual scroll                                                                 | https://raw.githubusercontent.com/angular/components/22.2.x/src/material/table/table.md                                                                     |
