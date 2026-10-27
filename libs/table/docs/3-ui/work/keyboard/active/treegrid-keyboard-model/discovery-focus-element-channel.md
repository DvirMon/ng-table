# When a programmatic write moves the focused position and the caller also wants DOM focus moved, how does that request cross from the state layer to the view layer?

**Date:** 2026-10-27 · **Depth:** standard

Extends [discovery-focus-ownership.md](discovery-focus-ownership.md) (R4). Pins
from there are reused where the same package was read.

## Answer

Reframing: most libraries do not have a "position-only" write at all. In MUI X,
EUI, AG Grid's public API and the CDK focus managers, writing the position _is_
the request to move DOM focus [S14][S15][S29][S30][S11][R1][R3]. A
position-only write appears only where a library ships **two verbs** (Ariakit
`move` vs `setActiveId` [S25]; CDK `setActiveItem` vs `updateActiveItem` [R2])
or a **flag** (AG Grid internal `forceBrowserFocus` [S9][S10], Handsontable
`changeListener` [S23]). Where the "also move DOM focus" request does cross a
seam, five distinct carriers are shipped. They are listed under Patterns. They
split on one axis that matters for "add a row, then focus it": **does the
request survive until the target element exists?**

## Method

- Versions pinned:
  - Reused from R4 (npm `latest`, read 2026-10-10): `react-stately@3.51.0`,
    `react-aria-components@1.22.1`, `ag-grid-community@36.2.0` (source tag
    `b36.2.0`), `@mui/x-data-grid` source tag `v9.15.0`,
    `@tanstack/table-core@9.2.8`, `@angular/aria@22.2.2`,
    `@glideapps/glide-data-grid@6.0.3`.
  - `react-aria@3.53.1`, the exact dependency declared by
    `react-aria-components@1.22.1/package.json` [S7].
  - From the npm registry `latest` (read 2026-10-26): `handsontable@18.1.2`,
    `@ariakit/core@0.4.20`, `@ariakit/react-core@0.4.26` (its `@ariakit/core`
    dependency is pinned to `0.4.20`), `@elastic/eui@123.2.0`.
  - From installed `node_modules`: `@angular/cdk@22.1.7`.
- Reading method: published `.mjs`/`.js`/`.d.ts` files on unpkg, or source at
  the matching git tag on raw.githubusercontent (AG Grid, MUI X, EUI). CDK was
  read locally. Every file was read 2026-10-26/27.
- WebFetch returns at most 125 characters per verbatim quote. Long bodies were
  read in line-sized pieces. Code fences below are rebuilt from those pieces.
- Handsontable `core.js` is 261 KB. `selectCells` was found at offset 200000.

## Evidence

### React Aria / React Stately — persistent `isFocused` boolean, public

- `FocusState` declares `readonly isFocused`, `setFocused(isFocused)`,
  `readonly focusedKey`, `childFocusStrategy`, and
  `setFocusedKey(key, child?: FocusStrategy)` [S3].
- `setFocusedKey` defaults `childFocusStrategy` to `'first'`. Both values are
  refs plus a `useState` that forces a re-render [S1].
- `SelectionManager.setFocusedKey` forwards only when the key is `null` or
  `this.collection.getItem(key)` exists. Otherwise it does nothing, silently
  [S2].
- View reaction: `useSelectableItem` computes `isFocused = key ===
manager.focusedKey`. It runs an effect guarded by `if (isFocused &&
manager.isFocused)`, which calls `focusSafely(ref.current)` only when that
  element is not already the active element [S4].
- The effect's deps are `[ref, key, manager.focusedKey,
manager.childFocusStrategy, manager.isFocused, shouldUseVirtualFocus]`. A
  source comment says `useLayoutEffect` was avoided because it breaks menus
  inside dialogs [S4].
- Grid cells pass a custom `focus` to `useSelectableItem`. It uses
  `childFocusStrategy` (`'last'` vs first) to pick a focusable child, then
  falls back to the cell [S6].
- Who clears `isFocused`: the collection's `onBlur` calls
  `manager.setFocused(false)` only when `relatedTarget` is outside the
  collection. `onFocus` sets it `true` [S5].
- `useSelectableCollection` scrolls the newly focused key into view, but only
  when `manager.isFocused` is true [S5].
- Outside access: `TableStateContext` is exported from
  `react-aria-components` [R4 → its S11].

### AG Grid — one-shot flag inside the change event; public API always forces

- `focusSvc.setFocusedCell(params)` destructures `forceBrowserFocus = false` and
  `preventScrollOnBrowserFocus = false`. It writes `this.focusedCell`, then
  dispatches `cellFocused` with both flags spread into the event [S9].
- Public type: `CellFocusedParams.forceBrowserFocus?: boolean` — "Whether
  browser focus is also set (false when editing)" [S12].
- Public `api.setFocusedCell(rowIndex, colKey, rowPinned?)` takes no option
  [S13]. It calls `focusSvc.setFocusedCell({ rowIndex, column: colKey,
rowPinned, forceBrowserFocus: true })` — hard-coded [S11].
- View reaction: `CellCtrl.onCellFocused(event)` focuses when
  `cellFocused && (event?.forceBrowserFocus || (!this.hasBrowserFocus() &&
focusSvc.shouldTakeFocus()))`. It then calls `focusEl.focus({ preventScroll
})` [S10].
- Unmounted target: when the cell has no component yet, `onCellFocused` stores
  the event in `focusEventWhileNotReady` and returns early [S10].
- `shouldTakeFocus()` returns `false` under `suppressFocusAfterRefresh`. It
  returns `true` once when `needsFocusRestored` is set ("If a cell was
  destroyed that previously had focus") and resets it through
  `setFocusRecovered()`. Otherwise it returns `doesRowOrCellHaveBrowserFocus()`
  [S9].

### MUI X DataGrid — the `focus` slice is the request

- `setCellFocus(id, field)` on a new cell writes both `tabIndex.cell` and
  `focus.cell` = `{ id, field }`, then publishes `cellFocusOut`/`cellFocusIn`.
  It never calls `.focus()` itself [S14].
- View reaction: `GridCell` has `hasFocus` = `gridFocusCellSelector` matches
  `(rowId, field)`. A `useEnhancedEffect` on `[hasFocus, cellMode, apiRef]`
  calls `focusElement(...)` when the cell does not already contain
  `activeElement`. It is gated only by the `canUpdateFocus` pipe processor and
  by edit mode [S15].
- `focusElement` = `element.focus({ preventScroll: true })`, or a manual
  scroll save/restore [S16].
- The "don't steal from a portal/dialog" guard (`allowTakingFocus`: active
  element is null, body, `documentElement`, or inside the grid root) sits only
  in the **already-focused-cell** branch of `setCellFocus` [S14].
- Who clears: `handleDocumentClick` sets `focus.cell = null` when a mouseup
  lands outside a cell. `handleBlur` (header) and `handleRowsSet` clear it too
  [S14].

### EUI DataGrid — same shape as MUI, via callback registry

- `setFocusedCell` only calls `_setFocusedCell` (React state) and
  `setIsFocusedCellInView(true)` [S29].
- Cells are notified through `onFocusUpdate` callbacks, not a state read.
  `onFocusUpdate(true)` calls `takeFocus`, which runs `cell.focus({
preventScroll })` if `!cell.contains(document.activeElement)` [S30].
- The docs page says `setFocusedCell` "focuses the specified cell in the
  grid", with no option [S31].

### Ariakit composite — monotonic counter in public state

- `move(id)` is documented as "Moves focus to a given item id and sets it as
  the active item". `setActiveId` "Sets the `activeId` state _without moving
  focus_" [S25].
- `moves: number` is public state: "The number of times the `move` function has
  been called" [S25].
- Store body [S26]:

  ```js
  move: (id) => {
    if (id === void 0) return;
    composite.setState("activeId", id);
    composite.setState("moves", (moves) => moves + 1);
  },
  ```

- View reaction: `useEffect` on `[store, moves, composite, focusOnMove]`
  returns early on `!moves`. It reads `activeId` from `store.getState()` and
  calls `focusIntoView(itemElement)` [S27].
- Nothing in the view resets `moves` [S27]. Its initial value is 0, or a synced
  store's value [S26].
- View gate: `focusOnMove?: boolean`, `@default true`. It applies both to
  arrow-key navigation and to calling `move` directly [S28].

### Handsontable — write option, scoped suspend flag

- `selectCell(row, column, endRow, endColumn, scrollToCell = true,
changeListener = true)`. `@param changeListener` reads: "If `true`, switches
  the keyboard focus to Handsontable. If `false`, keeps the previous keyboard
  focus" [S23].
- `selectCells` body [S23]:

  ```js
  if (changeListener === false) {
    focusGridManager.suspend();
  }
  try {
    wasSelected = selection.selectCells(coords);
  } finally {
    // Always release the suspended state even if `selection.selectCells` throws …
    viewportScroller.resume();
    focusGridManager.resume();
  }
  if (wasSelected && changeListener) {
    instance.listen();
  }
  ```

- `suspend()`/`resume()` toggle a private `_isSuspended` [S24].
- `afterSelection` sets a dirty flag, `_hasSelectionChange`. `afterRender`
  clears it and calls `focusCell()` [S24].
- `focusCell()` honours `_isSuspended` only when an outside input owns focus
  [S24].

### Glide Data Grid — separate imperative method; selection never focuses

- `DataEditorRef.focus` "Triggers the data grid to focus itself or the correct
  accessibility element". `appendRow: (col: number, openOverlay?: boolean) =>
Promise<void>` [S21].
- `focus: () => gridRef.current?.focus()` [S22].
- `appendRow` calls `onRowAppended`, then polls with `setTimeout` backoff until
  the row count grows. It scrolls, then calls `setCurrent(...)`. It does not
  call `gridRef.current.focus()`. `openOverlay` only opens the editor [S22].
- No effect keyed on `gridSelection` calls `focus()` in the parts read [S22].

### TanStack Table v9 — not supported

- `setFocusedCell(rowId, columnId)` has no options parameter. The types mention
  no DOM focus, element or ref [S17].
- The utils contain no `.focus(`, `HTMLElement` or `querySelector` [S18].

### `@angular/aria` grid — internal persistent boolean, no public write

- `ngGrid` exposes only `scrollActiveCellIntoView()`. It has no `focus()`,
  `focusCell()` or `setActiveCell` [S19].
- `GridFocus.focusCell(cell)` sets `activeCoords`/`activeCell` and never
  touches the DOM [S20].
- `focusEffect()` (reruns on `activeCell`) focuses only when the
  untracked `isFocused()` is true. `isFocused` is set by `onFocusIn` and
  cleared by `onFocusOut` [S20].
- Internal one-shot signals: `_deletion` and `_stateStale` are set by
  `resetStateEffect` and cleared by the effect that consumes them
  (`restoreFocusEffect`, `resetFocusEffect`) [S20].

### Angular CDK key managers — two verbs, or always focus

- `ListKeyManager.setActiveItem` calls `updateActiveItem` and emits `change`.
  `updateActiveItem` only sets `_activeItem`/`_activeItemIndex` [R2].
- `FocusKeyManager.setActiveItem` adds `this.activeItem.focus(this._origin)`
  [R1].
- `_origin` defaults to `'program'`. It is set by `setFocusOrigin(origin)` and
  persists until the next call [R1].
- `TreeKeyManager.focusItem(itemOrIndex, options)` always calls `.focus()`. Its
  only option is `emitChangeEvent`. A focus-free path (`makeFocusable()`) exists
  only in `_initializeFocus` [R3].

## Comparison

| Lib @ version                            | Mechanism                                                                              | One-shot / persistent                                                                      | Who clears                                                 | Public / internal                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------- |
| React Stately 3.51.0 + React Aria 3.53.1 | state boolean `isFocused` + `focusedKey`; item effect focuses when both match [S3][S4] | persistent [S1]                                                                            | view: collection `onBlur` → `setFocused(false)` [S5]       | public on `selectionManager` [S2][S3]           |
| AG Grid 36.2.0 (internal)                | `forceBrowserFocus` param → copied into the `cellFocused` event [S9][S12]              | one-shot (per event); buffered in `focusEventWhileNotReady` if the cell is unmounted [S10] | nobody — the event is consumed [S10]                       | flag internal; event field public in type [S12] |
| AG Grid 36.2.0 (public API)              | `api.setFocusedCell` hard-codes `forceBrowserFocus: true` [S11]                        | one-shot                                                                                   | —                                                          | public, no opt-out [S13]                        |
| MUI X v9.15.0                            | the `focus.cell` slice itself; `GridCell` effect focuses on `hasFocus` [S14][S15]      | persistent                                                                                 | state: document click outside, header blur, rows set [S14] | public (`setCellFocus`) [S14]                   |
| EUI 123.2.0                              | `focusedCell` state → `onFocusUpdate` callback → `takeFocus` [S29][S30]                | persistent                                                                                 | not read                                                   | public (`setFocusedCell` on ref) [S31]          |
| Ariakit 0.4.20 / react-core 0.4.26       | `moves` counter in store state, effect keyed on it [S26][S27]                          | edge-triggered, monotonic                                                                  | never cleared [S27]                                        | public state + `move` vs `setActiveId` [S25]    |
| Handsontable 18.1.2                      | `changeListener` write arg → `focusGridManager.suspend()` around the write [S23]       | one-shot, scoped by `try/finally` [S23]                                                    | the writer itself (`resume()` in `finally`) [S23]          | public arg; flag internal [S23][S24]            |
| Glide 6.0.3                              | separate `ref.focus()`; selection writes never focus [S21][S22]                        | n/a                                                                                        | n/a                                                        | public view method [S21]                        |
| TanStack 9.2.8                           | not supported (no DOM) [S17][S18]                                                      | n/a                                                                                        | n/a                                                        | —                                               |
| `@angular/aria` 22.2.2                   | internal `isFocused` signal gates `focusEffect` [S20]                                  | persistent                                                                                 | view: `onFocusOut` [S20]                                   | internal; no public write [S19]                 |
| CDK 22.1.7 `FocusKeyManager`             | two verbs: `setActiveItem` (focus) vs `updateActiveItem` (none) [R1][R2]               | n/a (call-time)                                                                            | n/a                                                        | public                                          |
| CDK 22.1.7 `TreeKeyManager`              | `focusItem` always focuses [R3]                                                        | n/a                                                                                        | n/a                                                        | public                                          |

## Patterns

1. **Position = focus.** Writing the position is the DOM-focus request. There
   is no opt-out. Seen in MUI, EUI, AG Grid's public API, `TreeKeyManager`
   [S15][S30][S11][R3].
2. **Persistent "collection has focus" boolean.** The view focuses the item
   whenever `isFocused && key matches`. Blur clears it. A caller outside the
   grid sets the boolean to force focus. Seen in React Aria (public) and
   `@angular/aria` (internal) [S4][S5][S20].
3. **Flag inside the change notification.** The write carries a flag into the
   event the view already listens to. If the target is not mounted, the event
   is buffered. Seen in AG Grid [S9][S10].
4. **Monotonic counter in state.** Each focus-moving write bumps a public
   number, and the view reacts on edges. Nothing clears it. Seen in Ariakit
   [S26][S27].
5. **Scoped suspend flag around a synchronous write.** The flag is raised and
   lowered by the writer in `try/finally`. This only works because render runs
   inside the write. Seen in Handsontable [S23][S24].
6. **Two verbs** (focus-moving vs focus-free) instead of a flag. Seen in
   Ariakit, `ListKeyManager`/`FocusKeyManager` [S25][R1][R2].
7. **Separate view-level imperative method**, with state that never asks. Seen
   in Glide, and in TanStack by default [S21][S17].

## Synthesis

- **Default direction disagrees.** Handsontable and Ariakit default to moving
  focus (`changeListener = true`, `focusOnMove` default `true`)
  [S23][S28]. React Aria and `@angular/aria` move it only while the
  collection already has focus [S4][S20]. AG Grid's internal default is `false`,
  but its public API forces `true` [S9][S11]. No convention exists.
- **The "only if focus is already inside" rule appears in two forms**:
  - a persistent boolean kept by focusin/focusout (React Aria,
    `@angular/aria`) [S5][S20];
  - a live `activeElement` check at reaction time (AG Grid
    `doesRowOrCellHaveBrowserFocus`, MUI's `allowTakingFocus`) [S9][S14].

  The boolean is what lets an outside caller override the rule: it is just a
  writable field. The live-check form needs a separate flag (AG Grid) or has no
  override (MUI).

- **Surviving the not-yet-rendered target splits the carriers.** "Add a row,
  then focus it" writes before the row exists:
  - Persistent state (React Aria, MUI, Ariakit's counter) survives, because the
    view's effect runs after the row renders [S4][S15][S27].
  - AG Grid's one-shot event needs an explicit buffer for that case
    (`focusEventWhileNotReady`) [S10].
  - Handsontable's scoped flag relies on synchronous rendering [S23][S24].
  - Glide's `appendRow` polls until the row count grows [S22].

  A one-shot carrier that is cleared at write time, rather than by the
  consumer, has no shipped precedent among those read.

- **Persistent requests need an owner that clears them; edge triggers do not.**
  React Aria's boolean is cleared by view blur [S5]. MUI's slice is cleared by
  document click and row loss [S14]. Ariakit's counter is never cleared,
  because the view compares edges [S27]. `@angular/aria`'s one-shot signals are
  cleared by the consuming effect [S20], which is the Angular-signals instance
  of a consumer-cleared flag.
- **A cluster vs. its general mechanism.** Two verbs (Ariakit, CDK) and a flag
  (AG Grid, Handsontable) express the same bit. Ariakit keeps two verbs at the
  API while the store carries one general field (`moves`) [S25][S26]. The
  public spelling and the seam carrier are independent choices.

## Against

- React Aria's `setFocused(true)` is documented as "Sets whether the collection
  is focused" [S3]. Using it as a "please take focus" request from a toolbar
  outside the grid is how the source behaves, not a documented recipe (see
  Unverified).
- MUI and EUI show that production grids ship with **no** position-only write
  [S14][S29]. Their split lives elsewhere: MUI's separate `tabIndex` slice is
  the roving stop. This suggests a demand for a position-only write is not
  universal.

## Not researched

- Kendo UI Grid, Syncfusion EJ2, DevExtreme, RevoGrid, Material React Table,
  Radix (no grid primitive), ng-primitives.
- Screen-reader behavior of any carrier.
- Whether AG Grid, MUI or Handsontable document the "add row then focus"
  recipe on their docs sites.

## Unverified

- React Aria: no docs page or example was read that shows an outside caller
  calling `setFocused(true)` + `setFocusedKey`. The behavior is inferred from
  the effect guard [S4]. Confirm in the React Aria `Table` docs or tests.
- AG Grid: whether `focusEventWhileNotReady` is consumed and cleared once the
  cell component attaches. The storing path was read; the replay path was not.
  Read `cellCtrl.ts` `setComp`.
- MUI: which feature registers the `canUpdateFocus` pipe processor, and when it
  returns `false`. Grep `canUpdateFocus` at `v9.15.0`.
- EUI: when `focusedCell` is cleared (blur or outside click). `focus.ts` was not
  read for that.
- Handsontable: that `afterRender` → `focusCell()` runs synchronously inside
  `selection.selectCells` is inferred from the `finally`-scoped
  `resume()`. Otherwise the flag would already be lowered when it is read.
- Glide: the first 100 KB of `data-editor.js` were read for effects, but the
  tool's coverage of that range was summary-level. A `gridSelection`-keyed
  focus effect is "not found", not proven absent.

## Sources

|     | Source                                                                                                                   | Version  | Verified                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------- |
| S1  | https://unpkg.com/react-stately@3.51.0/dist/private/selection/useMultipleSelectionState.mjs                              | 3.51.0   | yes — `isFocused`/`setFocused` refs + returned object read                                                            |
| S2  | https://unpkg.com/react-stately@3.51.0/dist/private/selection/SelectionManager.mjs                                       | 3.51.0   | yes — `setFocusedKey` collection guard; showed an unknown key is silently dropped                                     |
| S3  | https://unpkg.com/react-stately@3.51.0/dist/types/src/selection/types.d.ts                                               | 3.51.0   | yes — `FocusState` declarations + doc comments                                                                        |
| S4  | https://unpkg.com/react-aria@3.53.1/dist/private/selection/useSelectableItem.mjs                                         | 3.53.1   | yes — focus effect guard + deps; this is where `isFocused` was shown to be the DOM-focus gate                         |
| S5  | https://unpkg.com/react-aria@3.53.1/dist/private/selection/useSelectableCollection.mjs                                   | 3.53.1   | yes — `onFocus`/`onBlur`, scroll effect                                                                               |
| S6  | https://unpkg.com/react-aria@3.53.1/dist/private/grid/useGridCell.mjs                                                    | 3.53.1   | yes — `focus` closure uses `childFocusStrategy`; no `focusWidget` option exists                                       |
| S7  | https://unpkg.com/react-aria-components@1.22.1/package.json                                                              | 1.22.1   | yes — `react-aria` 3.53.1 dependency (pin source)                                                                     |
| S9  | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/focusService.ts                 | b36.2.0  | yes — `setFocusedCell` body, `shouldTakeFocus`, `needsFocusRestored`                                                  |
| S10 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/rendering/cell/cellCtrl.ts      | b36.2.0  | yes — `onCellFocused` condition, `focusEventWhileNotReady`                                                            |
| S11 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/navigation/navigationApi.ts     | b36.2.0  | yes — public API hard-codes `forceBrowserFocus: true`; the d.ts alone does not reveal this                            |
| S12 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/events.d.ts                                                    | 36.2.0   | yes — `CellFocusedParams` doc comments                                                                                |
| S13 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/api/gridApi.d.ts                                               | 36.2.0   | yes — `setFocusedCell` signature, no option                                                                           |
| S14 | https://raw.githubusercontent.com/mui/mui-x/v9.15.0/packages/x-data-grid/src/hooks/features/focus/useGridFocus.ts        | v9.15.0  | yes — `setCellFocus` both branches; the portal guard is only in the already-focused branch                            |
| S15 | https://raw.githubusercontent.com/mui/mui-x/v9.15.0/packages/x-data-grid/src/components/cell/GridCell.tsx                | v9.15.0  | yes — `hasFocus` effect; moved "does `setCellFocus` call focus?" from no to "yes, via the cell effect"                |
| S16 | https://raw.githubusercontent.com/mui/mui-x/v9.15.0/packages/x-data-grid/src/utils/focusElement.ts                       | v9.15.0  | yes — `preventScroll` focus                                                                                           |
| S17 | https://unpkg.com/@tanstack/table-core@9.2.8/dist/features/cell-selection/cellSelectionFeature.types.d.ts                | 9.2.8    | yes — no options param                                                                                                |
| S18 | https://unpkg.com/@tanstack/table-core@9.2.8/dist/features/cell-selection/cellSelectionFeature.utils.js                  | 9.2.8    | yes — no focus/DOM calls                                                                                              |
| S19 | https://unpkg.com/@angular/aria@22.2.2/fesm2022/grid.mjs                                                                 | 22.2.2   | yes — public members of `ngGrid`/`ngGridCell`                                                                         |
| S20 | https://unpkg.com/@angular/aria@22.2.2/fesm2022/_widget-chunk.mjs                                                        | 22.2.2   | yes — `focusEffect`/`restoreFocusEffect`/`resetFocusEffect` bodies line by line                                       |
| S21 | https://unpkg.com/@glideapps/glide-data-grid@6.0.3/dist/dts/data-editor/data-editor.d.ts                                 | 6.0.3    | yes — `DataEditorRef` docs, `appendRow` signature                                                                     |
| S22 | https://unpkg.com/@glideapps/glide-data-grid@6.0.3/dist/esm/data-editor/data-editor.js                                   | 6.0.3    | yes — `appendRow`, `useImperativeHandle`; `appendRow` does not focus the grid                                         |
| S23 | https://unpkg.com/handsontable@18.1.2/core.js                                                                            | 18.1.2   | yes — `selectCell`/`selectCells` JSDoc + body (offset 200000)                                                         |
| S24 | https://unpkg.com/handsontable@18.1.2/focusManager/grid.mjs                                                              | 18.1.2   | yes — `suspend`/`resume`, `afterRender` → `focusCell`; showed the suspend only bites when an outside input owns focus |
| S25 | https://unpkg.com/@ariakit/core@0.4.20/cjs/composite/composite-store.d.ts                                                | 0.4.20   | yes — `moves`, `move`, `setActiveId` doc comments                                                                     |
| S26 | https://unpkg.com/@ariakit/core@0.4.20/esm/__chunks/LJ7CXLHP.js                                                          | 0.4.20   | yes — `move` body, `moves` initial state                                                                              |
| S27 | https://unpkg.com/@ariakit/react-core@0.4.26/esm/__chunks/NLF4OZJK.js                                                    | 0.4.26   | yes — both `moves` effects verbatim; nothing resets `moves`                                                           |
| S28 | https://unpkg.com/@ariakit/react-core@0.4.26/esm/composite/composite.d.ts                                                | 0.4.26   | yes — `focusOnMove` doc + `@default true`                                                                             |
| S29 | https://raw.githubusercontent.com/elastic/eui/v123.2.0/packages/eui/src/components/datagrid/utils/focus.ts               | v123.2.0 | yes — `setFocusedCell` is state-only                                                                                  |
| S30 | https://raw.githubusercontent.com/elastic/eui/v123.2.0/packages/eui/src/components/datagrid/body/cell/data_grid_cell.tsx | v123.2.0 | yes — `onFocusUpdate` → `takeFocus`; moved "state-only" to "state that always pulls DOM focus"                        |
| S31 | https://eui.elastic.co/docs/components/data-grid/advanced/ref/                                                           | unpinned | yes — docs page; no version marker                                                                                    |
| R1  | node_modules/@angular/cdk/fesm2022/\_focus-key-manager-chunk.mjs:9                                                       | 22.1.7   | yes — read                                                                                                            |
| R2  | node_modules/@angular/cdk/fesm2022/\_list-key-manager-chunk.mjs:100                                                      | 22.1.7   | yes — `setActiveItem`                                                                                                 |
| R2b | node_modules/@angular/cdk/fesm2022/\_list-key-manager-chunk.mjs:206                                                      | 22.1.7   | yes — `updateActiveItem`                                                                                              |
| R3  | node_modules/@angular/cdk/fesm2022/\_tree-key-manager-chunk.mjs:139                                                      | 22.1.7   | yes — `focusItem`; `makeFocusable` path at :30                                                                        |
| R4  | libs/table/docs/3-ui/work/keyboard/active/treegrid-keyboard-model/discovery-focus-ownership.md                           | —        | yes — prior discovery; reused pins and its S11 (`TableStateContext` export)                                           |
