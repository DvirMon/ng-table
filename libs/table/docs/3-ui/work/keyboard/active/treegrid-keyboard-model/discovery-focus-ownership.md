# Where does the active/focused cell or row position live in grid libraries — state layer or view layer — and how is it exposed outside the grid?

**Date:** 2026-10-10 · **Depth:** standard

## Answer

Reframing: the split is not "store vs. directive". It is **key-addressed state
in some non-DOM object** vs. **element/index-addressed state in the view**.
Every library that survives virtualization or remove/filter keeps the position
as data keyed by row id (+ column id) outside the DOM: TanStack v9, React
Stately, MUI X [S1][S6][S16]. AG Grid also keeps it outside the DOM, but keyed
by row _index_ [S12]. Libraries that track it in the view (CDK key managers,
`@angular/aria` grid, PrimeNG) hold element or index references, and none
documents virtualization support [R2][S26][S23].
**Headless** does not settle the layer either: TanStack puts it in table state
next to selection, while React Aria puts it in a stately hook that is **not
controllable** and has no change callback [S1][S7].

## Method

- Versions pinned:
  - from the npm registry `latest` (read 2026-10-10):
    `@tanstack/table-core@9.2.8`, `react-stately@3.51.0`,
    `react-aria-components@1.22.1`, `ag-grid-community@36.2.0`,
    `@mui/x-data-grid@9.15.0`, `primeng@22.1.2`, `@angular/aria@22.2.2`,
    `@glideapps/glide-data-grid@6.0.3`.
  - from the installed `node_modules`: `@angular/cdk@22.1.7`. Angular Material
    was read from unpkg at `@22.1.7`.
- Reading method:
  - Published bundles were read on unpkg (`.mjs` / `.d.ts`).
  - AG Grid and MUI X source was read at tags `b36.2.0` and `v9.15.0`.
  - CDK was grepped locally.
- `@react-stately/grid@3.12.1` is now a shim that depends on `react-stately`.
  The source lives in `react-stately/dist/private/`.
- PrimeNG: `primeng-table.mjs` truncates in WebFetch before `SelectableRow`, and
  the GitHub tags stop at v14. PrimeNG claims therefore come from the
  `types/primeng-table.d.ts` declarations only, not from method bodies.
- TanStack v9 differs from v8 here. `@8.21.3` `src/features` has no cell-level
  feature [S5]. v9 adds `cell-selection` [S2]. Do not transfer v8 reads.

## Evidence

### TanStack Table v9 (headless, state only)

- Has a `cellSelection` state slice: an array of ranges
  `{ anchorRowId, anchorColumnId, focusRowId, focusColumnId }`. The "focused
  cell" is the anchor of the last range [S1].
- Read: `table.getFocusedCell()`, `cell.getIsFocused()`. Write:
  `table.setFocusedCell(rowId, columnId)`, `moveCellSelection(direction)`.
  Controlled through `onCellSelectionChange` [S1].
- `cell.getTabIndex()` returns `0`/`-1` "for roving tabindex". No code calls
  `.focus()` or touches the DOM [S3].
- `moveCellSelection` steps over `table.getRowModel().rows`, the rendered order
  after pagination, not over DOM siblings [S3].
- `getFocusedCell` looks the row up by id in `getPrePaginatedRowModel().rowsById`,
  then falls back to `getCoreRowModel().rowsById`, and returns `undefined` if the
  row is gone [S3].
- `autoResetCellSelection` defaults to `true`. It resets the whole selection,
  focus included, through `_reactivity.schedule` [S3]. The trigger site was not
  read — see Unverified.
- Opt-in: features are registered per table through `features` [S4].
  `cellSelectionFeature` is part of the `stockFeatures` bundle [S2].
  `enableCellSelection` defaults to `true` once the feature is registered [S2].

### React Aria / React Stately

- `focusedKey` lives in `useMultipleSelectionState`: a `useRef` for synchronous
  reads plus `useState` to trigger re-renders, per a source comment [S6].
- There is no controlled `focusedKey` prop and no `onFocusChange`. The props
  read are `selectionMode`, `disallowEmptySelection`,
  `allowDuplicateSelectionEvents`, `selectionBehavior`, `disabledBehavior` [S7].
- Write API: `selectionManager.setFocusedKey(k, childFocusStrategy)`, available
  on the state object [S7].
- Outside access in Components: `TableStateContext` and `TreeStateContext` are
  exported. `GridListStateContext` is not [S11].
- Removal: a `useGridState` effect detects a `focusedKey` missing from the new
  collection. It walks forward from the old index (from the cached collection),
  then backward, skipping disabled and header rows. It keeps the column index
  when the old key was a cell, and sets `null` if nothing is left [S8].
- Virtualization: `useDndPersistedKeys` returns `Set([focusedKey, dropTargetKey])`
  and passes it as `persistedKeys` [S10]. The `Virtualizer` checks
  `isPersistedKey` (the key or an ancestor) [S9b]. `ListLayout.isVisible`
  treats persisted keys as visible, so the focused row stays mounted [S9c].
- Default: `Table` always wires `useTable` keyboard navigation [S11b]. No opt-out
  prop was found.

### AG Grid

- `FocusService` holds `private focusedCell: CellPosition | null`, shaped as
  `{ rowIndex, rowPinned, column }`. It is keyed by **row index**, not row id
  [S12].
- API: `getFocusedCell()` ("or the last focused cell if the grid lost focus"),
  `setFocusedCell(rowIndex, colKey, rowPinned?)`, `clearFocusedCell()`,
  `ensureIndexVisible`, `ensureNodeVisible` [S13].
- Events: `cellFocused` carries the position plus `previousParams`, and
  `cellFocusCleared` [S12].
- Persistable: `GridState.focusedCell?: FocusedCellState` (`RowPosition &
{ colId }`), "Client-Side Row Model only" [S14].
- Focus is cleared on `columnPivotModeChanged`, `columnGroupOpened` and
  `columnRowGroupChanged`. The column is revalidated on `newColumnsLoaded`.
  There is no listener for `modelUpdated`, `sortChanged`, `filterChanged` or
  `rowDataUpdated` [S12].
- Virtualization: `setFocusedCell` calls `navigation.ensureCellVisible` before
  focusing [S12].
- Default on. `suppressCellFocus` and `suppressHeaderFocus` turn it off [S15a].

### MUI X DataGrid

- Grid state holds two slices with the same shape: `focus` (`GridFocusState`)
  and `tabIndex` (`GridTabIndexState`). `cell: GridCellCoordinates | null` is
  keyed by row id + field [S16].
- API: `apiRef.current.setCellFocus(id, field)`. Events `cellFocusIn` and
  `cellFocusOut` [S17].
- Exported selectors: `gridFocusCellSelector`, `gridTabIndexCellSelector`, and
  others [S18].
- `setCellFocus` carries a source comment that state and DOM "can get out of
  sync after `updateRows()` remounts the cell". It does not steal focus from
  portals or dialogs [S17].
- Removal: `handleRowsSet` focuses the row at the clamped last index, or clears
  focus. `handlePaginationModelChange` clears `tabIndex` when the focused cell
  leaves the page [S17].
- Virtualization: `gridFocusedVirtualCellSelector` is non-null only when the
  focused cell is outside the render context [S19]. It is passed to the
  virtualizer [S20], which `unshift`s or `push`es that row index into the
  rendered rows [S21].
- Default on [S22].

### PrimeNG Table

- Row keyboard navigation exists only on the `[pSelectableRow]` directive:
  `onArrowDownKey`, `onArrowUpKey`, `onHomeKey`, `onEndKey`, `onEnterKey`,
  `onSpaceKey`, and `setRowTabIndex(): 0 | -1 | undefined` [S23].
- The next target is found by a DOM walk:
  `findNextSelectableRow(row: HTMLTableRowElement): HTMLTableRowElement | null`
  [S23].
- `Table` and `TableService` declare no focus or tabindex member. No focus
  position is exposed [S23].
- Opt-in: only through the selectable-row directive [S23].

### Angular CDK / Material table

- `@angular/cdk/table` and `@angular/material/table` contain no `keydown`, key
  manager, `tabindex` or `focus()` [R1][S24].
- `ListKeyManager` stores `_activeItemIndex` and `_activeItem` as signals,
  emits `change` (a Subject of the index), and takes a `QueryList`, an array or a
  signal of items [R2].
- When items change, it re-finds the active item by reference. If the item is
  gone (`indexOf === -1`), nothing is updated: the stale index and item remain
  [R2].
- `FocusKeyManager` calls `activeItem.focus()` [R3].
  `ActiveDescendantKeyManager` calls `setActiveStyles()` and
  `setInactiveStyles()` [R4].

### `@angular/aria` grid

- Ships `ngGrid`, `ngGridRow`, `ngGridCell` and `ngGridCellWidget`, each with a
  matching `exportAs` [S25].
- Inputs: `focusMode` (`'roving'` default), `rowWrap` and `colWrap` (`'loop'`),
  `enableSelection`, `selectionMode` [S25].
- The active cell lives in an internal `GridPattern`/`GridFocus`:
  `activeCell = signal(undefined)` (a cell-pattern reference) plus
  `activeCoords = signal({row,col})` [S26].
- The directive exposes only the `activeDescendant` computed. There is no
  `activeCell` input or model [S25].
- Cells are matched by DOM element (`cell.element() === target`) [S25].
- Recovery: `resetState()` tries, in order: the previous cell if it is still
  focusable, the stored coordinates, clamped bounds, then the first cell. This
  runs from `afterRenderEffect` [S26].
- No virtualization handling appears in source [S26].

### Glide Data Grid (canvas)

- The position is `GridSelection.current.cell: Item`, where
  `Item = [col, row]` are **indexes** [S27].
- It is consumer-controllable through `gridSelection` + `onGridSelectionChange`
  [S28].
- `DataEditorRef.focus()` "focus[es] itself or the correct accessibility
  element" [S28].

## Comparison

| Axis                                    | TanStack 9.2.8                                | React Stately 3.51.0                        | AG Grid 36.2.0                      | MUI X 9.15.0                                 | PrimeNG 22.1.2                    | CDK 22.1.7                           | `@angular/aria` 22.2.2              | Glide 6.0.3                   |
| --------------------------------------- | --------------------------------------------- | ------------------------------------------- | ----------------------------------- | -------------------------------------------- | --------------------------------- | ------------------------------------ | ----------------------------------- | ----------------------------- |
| Layer                                   | table state [S1]                              | state hook [S6]                             | grid service [S12]                  | grid state [S16]                             | view directive [S23]              | view helper [R2]                     | directive-internal pattern [S26]    | consumer prop [S28]           |
| Keyed by                                | row id + col id [S1]                          | collection key [S6]                         | row index [S12]                     | row id + field [S16]                         | DOM element [S23]                 | item ref + index [R2]                | cell ref + coords [S26]             | indexes [S27]                 |
| Public read                             | `getFocusedCell()` [S1]                       | `selectionManager.focusedKey` [S7]          | `api.getFocusedCell()` [S13]        | `gridFocusCellSelector` [S18]                | none [S23]                        | `activeItem`, `activeItemIndex` [R2] | `activeDescendant` only [S25]       | `gridSelection` [S28]         |
| Public write                            | `setFocusedCell(rowId,colId)` [S1]            | `setFocusedKey` [S7]                        | `api.setFocusedCell(idx,col)` [S13] | `apiRef.setCellFocus(id,field)` [S17]        | none [S23]                        | `setActiveItem` [R3]                 | none [S25]                          | controlled prop [S28]         |
| Change signal                           | `onCellSelectionChange` [S1]                  | none (no callback) [S7]                     | `cellFocused` event [S12]           | `cellFocusIn` / `cellFocusOut` [S17]         | —                                 | `change` Subject [R2]                | —                                   | `onGridSelectionChange` [S28] |
| Focused row unmounted by virtualization | n/a, state only [S3]                          | kept mounted via `persistedKeys` [S9c][S10] | `ensureCellVisible` on set [S12]    | kept rendered via `focusedVirtualCell` [S21] | not handled (DOM walk) [S23]      | not handled [R2]                     | not handled [S26]                   | canvas, index state [S27]     |
| Focused row removed/filtered            | lookup → `undefined`; data change resets [S3] | nearest row by old index, column kept [S8]  | not reconciled on sort/filter [S12] | clamp to last index [S17]                    | —                                 | stale index/item kept [R2]           | prev → coords → clamp → first [S26] | —                             |
| Default                                 | opt-in feature [S2][S4]                       | on [S11b]                                   | on, `suppressCellFocus` [S15a]      | on [S22]                                     | opt-in via `pSelectableRow` [S23] | opt-in helper [R2]                   | opt-in directive [S25]              | not checked                   |

## Synthesis

- **Layer.** The libraries split three ways:
  - Table/grid state that the consumer can address: TanStack, MUI, AG Grid.
  - A framework-internal state object reached through context: React Stately.
  - Pure view: PrimeNG, CDK, `@angular/aria`.

  Only the first two groups handle virtualization. Virtualization support follows
  from **non-DOM addressing**, not from the layer as such: React Stately's
  position is state-layer but _not_ consumer-writable, and it still survives
  virtualization.

- **Survival under virtualization takes two mechanisms**:
  - React Aria and MUI keep the focused row _mounted_ outside the window, so DOM
    focus never drops [S10][S21].
  - AG Grid and TanStack keep the position _as data_ and scroll or render on
    demand [S12][S3].

  The first needs the virtualizer to read the focus position. The second needs
  the navigator to read row order from the model.

- **Removal policy disagrees outright.** The options seen:
  - nearest row at the old index (React Stately, MUI)
  - a full reset (TanStack, on data change)
  - nothing (AG Grid on sort/filter; CDK keeps a stale reference)
  - a fallback chain (`@angular/aria`)

  No convention exists. Every policy that recovers needs the **previous order**,
  either a cached collection [S8] or the last row index [S17].

- **Tab stop vs. focus.** MUI separates `tabIndex` (the remembered roving stop)
  from `focus` (live) as two slices [S16]. AG Grid's getter returns the last
  focused cell after blur [S13]. TanStack has one value.
  `cell_getTabIndex` returns `-1` everywhere until a cell is focused [S3]; that
  this leaves no tab stop is an inference (see Unverified).
- **Exposure to outside code.** Libraries that store state give a read path
  _and_ a change notification (TanStack, AG Grid, MUI, Glide). React Aria is the
  outlier: readable, but there is no callback, so a side panel must sit inside
  the context provider and re-render [S7][S11].

## Against

- Store-level positions are index-keyed in AG Grid and Glide [S12][S27]. Being in
  the store does not by itself make the position stable under sort or filter;
  the key choice matters as much as the layer.
- React Aria shows a production a11y-first library that deliberately does
  **not** make focus controllable [S7], yet it handles both virtualization and
  removal. Consumer-writable focus is not required for either.
- TanStack bundles focus into `cellSelection` [S1]. That couples focus to
  selection reset (`autoResetCellSelection`), which is a cost of the
  store-member route, not a free win.

## What this implies for the two options

**Store-level member** (core, always present):

- Matches TanStack, MUI and AG Grid. Arrow-key stepping over `renderRows()` order
  is TanStack's `moveCellSelection` shape over `getRowModel().rows` [S3].
- An id-keyed position plus the existing `onRowsRemoved` hook (ADR-0006) is the
  natural place for the removal policy. Every recovering library also needed the
  previous order [S8][S17].
- A side panel reads it without DOM or directive access. This matches the
  `getFocusedCell` + event pattern [S1][S13].
- The virtual-scroll feature can read it to keep the focused row mounted (the
  MUI/React Aria mechanism) without a directive-to-feature channel.
- Cost: a core member on every table, including tables that never render
  directives. TanStack avoided this by making the feature opt-in [S4].

**Directive-only, read-only via `exportAs`**:

- Matches `@angular/aria` (`exportAs` + `activeDescendant`) [S25] and the CDK
  key managers [R2].
- None of the directive-layer libraries surveyed handles virtualization or
  documents removal recovery beyond `@angular/aria`'s fallback chain
  [S23][R2][S26].
- K13 already requires id-keyed, non-DOM storage. Here it would be a directive
  that owns data state, which ADR-0029 allows ("directives own a11y").
- A `withVirtualScroll()` feature in the state layer would need a path _from_
  the directive to keep the focused row mounted. React Aria solves this by
  living in one hook tree [S10]; a feature/directive split has no equivalent
  today.
- A side panel outside the `exportAs` template scope needs a template reference
  or an injected handle. This is React Aria's context constraint [S11].
- Read-only means no `setFocusedCell` equivalent. AG Grid, MUI and TanStack all
  ship one [S13][S17][S1]. React Aria exposes it only on its state object [S7].

## Not researched

- Handsontable, Syncfusion EJ2, DevExtreme, RevoGrid, Material React Table.
- Screen-reader behavior of each library's recovery policy (no AT testing).
- ng-primitives: no grid primitive was checked.

## Unverified

- Where TanStack v9 calls `table_autoResetCellSelection`: data change only, or
  filter/sort too. Read the core row-model `.js` that schedules it to confirm.
- Whether a TanStack v9 table with no focused cell has no Tab stop. This is an
  inference from the `cell_getTabIndex` body [S3]; confirm in the React adapter
  examples.
- AG Grid keeping focus at the same _index_ (a different row) after sort/filter
  is an inference from index-keying plus the absent listeners [S12]. A runtime
  probe would confirm it.
- MUI: no controlled `focus` prop and no `initialState.focus` was checked. Read
  `DataGridProps.d.ts` and `gridStatePersistence` to confirm.
- PrimeNG method bodies (`setRowTabIndex`, `findNextSelectableRow`) were not
  read, only their declarations. The DOM walk is inferred from the
  `HTMLTableRowElement` parameter types.
- Glide removal behavior: no reconciliation code was read. Behavior is assumed
  consumer-owned because selection is controlled.
- `@angular/aria` does not document virtualization; its absence was checked in
  the source only.

## Sources

|      | Source                                                                                                                                       | Version | Verified                                                                                        |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| S1   | https://unpkg.com/@tanstack/table-core@9.2.8/dist/features/cell-selection/cellSelectionFeature.types.d.ts                                    | 9.2.8   | yes — d.ts read; moved the finding from "no focus state" (v8) to "focus = anchor of last range" |
| S2   | https://unpkg.com/@tanstack/table-core@9.2.8/dist/features/cell-selection/cellSelectionFeature.js                                            | 9.2.8   | yes — defaults read                                                                             |
| S2b  | https://unpkg.com/@tanstack/table-core@9.2.8/dist/features/stockFeatures.js                                                                  | 9.2.8   | yes — `cellSelectionFeature` in bundle                                                          |
| S3   | https://unpkg.com/@tanstack/table-core@9.2.8/dist/features/cell-selection/cellSelectionFeature.utils.js                                      | 9.2.8   | yes — bodies read; showed no DOM calls, and an id lookup that returns `undefined`               |
| S4   | https://unpkg.com/@tanstack/table-core@9.2.8/dist/core/table/coreTablesFeature.types.d.ts                                                    | 9.2.8   | yes — `features` doc comment                                                                    |
| S5   | https://app.unpkg.com/@tanstack/table-core@8.21.3/files/src/features                                                                         | 8.21.3  | yes — listing; no cell feature                                                                  |
| S6   | https://unpkg.com/react-stately@3.51.0/dist/private/selection/useMultipleSelectionState.mjs                                                  | 3.51.0  | yes — ref + state, source comment                                                               |
| S7   | https://unpkg.com/react-stately@3.51.0/dist/private/selection/useMultipleSelectionState.mjs                                                  | 3.51.0  | yes — props destructuring; overturned the assumption that focus is controllable                 |
| S8   | https://unpkg.com/react-stately@3.51.0/dist/private/grid/useGridState.mjs                                                                    | 3.51.0  | yes — recovery effect read                                                                      |
| S9b  | https://unpkg.com/react-stately@3.51.0/dist/private/virtualizer/Virtualizer.mjs                                                              | 3.51.0  | yes — `isPersistedKey`                                                                          |
| S9c  | https://unpkg.com/react-stately@3.51.0/dist/private/layout/ListLayout.mjs                                                                    | 3.51.0  | yes — `isVisible` uses `isPersistedKey`                                                         |
| S10  | https://unpkg.com/react-aria-components@1.22.1/dist/private/DragAndDrop.mjs                                                                  | 1.22.1  | yes — `useDndPersistedKeys` body; docs said "focusedKey", source showed a DnD-named helper      |
| S11  | https://unpkg.com/react-aria-components@1.22.1/dist/exports/index.mjs                                                                        | 1.22.1  | yes — `TableStateContext` exported                                                              |
| S11b | https://unpkg.com/react-aria-components@1.22.1/dist/private/Table.mjs                                                                        | 1.22.1  | yes — `useTableState` / `useTable` wiring                                                       |
| S12  | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/focusService.ts                                     | b36.2.0 | yes — source; showed index keying and no sort/filter listener                                   |
| S13  | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/api/gridApi.d.ts                                                                   | 36.2.0  | yes — signatures + doc comments                                                                 |
| S14  | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/interfaces/gridState.d.ts                                                          | 36.2.0  | yes — `focusedCell`                                                                             |
| S15a | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/keyboard-navigation/index.mdoc         | b36.2.0 | yes — `suppressCellFocus`; page has no focus-API section                                        |
| S16  | https://raw.githubusercontent.com/mui/mui-x/v9.15.0/packages/x-data-grid/src/hooks/features/focus/gridFocusState.ts                          | v9.15.0 | yes — verbatim                                                                                  |
| S17  | https://raw.githubusercontent.com/mui/mui-x/v9.15.0/packages/x-data-grid/src/hooks/features/focus/useGridFocus.ts                            | v9.15.0 | yes — API, `handleRowsSet`, events                                                              |
| S18  | https://raw.githubusercontent.com/mui/mui-x/v9.15.0/packages/x-data-grid/src/hooks/features/focus/gridFocusStateSelector.ts                  | v9.15.0 | yes — selector list                                                                             |
| S19  | https://raw.githubusercontent.com/mui/mui-x/v9.15.0/packages/x-data-grid/src/hooks/features/virtualization/gridFocusedVirtualCellSelector.ts | v9.15.0 | yes                                                                                             |
| S20  | https://raw.githubusercontent.com/mui/mui-x/v9.15.0/packages/x-data-grid/src/hooks/core/useGridVirtualizer.tsx                               | v9.15.0 | yes — option wiring                                                                             |
| S21  | https://raw.githubusercontent.com/mui/mui-x/v9.15.0/packages/x-virtualizer/src/features/virtualization/virtualization.ts                     | v9.15.0 | yes — `unshift`/`push`; this is where the selector's purpose is confirmed                       |
| S22  | https://raw.githubusercontent.com/mui/mui-x/v9.15.0/docs/data/data-grid/accessibility/accessibility.md                                       | v9.15.0 | yes — docs; no disable prop documented                                                          |
| S23  | https://unpkg.com/primeng@22.1.2/types/primeng-table.d.ts                                                                                    | 22.1.2  | yes — declarations only (mjs truncates)                                                         |
| S24  | https://unpkg.com/@angular/material@22.1.7/fesm2022/table.mjs                                                                                | 22.1.7  | yes — no keyboard code                                                                          |
| S25  | https://unpkg.com/@angular/aria@22.2.2/fesm2022/grid.mjs                                                                                     | 22.2.2  | yes — directives, inputs, `_getCell`                                                            |
| S26  | https://unpkg.com/@angular/aria@22.2.2/fesm2022/_widget-chunk.mjs                                                                            | 22.2.2  | yes — `GridPattern` / `GridFocus`                                                               |
| S27  | https://unpkg.com/@glideapps/glide-data-grid@6.0.3/dist/dts/internal/data-grid/data-grid-types.d.ts                                          | 6.0.3   | yes — `GridSelection`, `Item`                                                                   |
| S28  | https://unpkg.com/@glideapps/glide-data-grid@6.0.3/dist/dts/data-editor/data-editor.d.ts                                                     | 6.0.3   | yes — controlled-selection doc comments                                                         |
| R1   | node_modules/@angular/cdk/fesm2022/table.mjs                                                                                                 | 22.1.7  | yes — grep, 0 hits                                                                              |
| R2   | node_modules/@angular/cdk/fesm2022/\_list-key-manager-chunk.mjs:258                                                                          | 22.1.7  | yes — `_itemsChanged` keeps a stale ref when the item is removed                                |
| R3   | node_modules/@angular/cdk/fesm2022/\_focus-key-manager-chunk.mjs:9                                                                           | 22.1.7  | yes                                                                                             |
| R4   | node_modules/@angular/cdk/fesm2022/\_activedescendant-key-manager-chunk.mjs:4                                                                | 22.1.7  | yes                                                                                             |
