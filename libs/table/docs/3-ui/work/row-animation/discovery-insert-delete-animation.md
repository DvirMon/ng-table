# How do rows animate on insert and delete (AG Grid 36.2.0), and how can ngpTable collapse a deleted row that holds form controls, CSS only?

**Date:** 2026-09-23 · **Depth:** standard

## Answer

**AG Grid uses one path for all of these.** `applyTransaction`, `applyTransactionAsync` and
`rowData` replaced _with_ `getRowId` all end in
`refreshModel({ step: 'group', keepRenderedRows: true, animate: !suppressAnimationFrame })`
[S2][S3][S4]. From there they use the same renderer path, the same enter/exit handling and the
same zombie delay as sort and group [S10][S11][S12][S13]. The rows that stay slide by
`translateY` [S9]. Replacing `rowData` _without_ `getRowId` is the exception: it animates
nothing and destroys every row controller at once [S4][S10][S15].

**For ngpTable, the obstacle is layout, not the transition.** AG Grid's rows are absolutely
positioned. A removed row takes no space, so the rows below slide at once while it fades
[S12][S14]. A `<tr>` stays in the table layout. Once the preset lives in `@layer ngp-table`,
its `padding`/`font-size` overrides lose to any unlayered consumer rule on the controls
[S27][R10]. **Keyframe animations beat every normal declaration, layered or not** [S27]. So the
CSS-only fix is to move the collapse from `transition` to `@keyframes`, plus a
`max-block-size` clamp on the cell contents. That works in every browser. A smooth
`block-size: auto → 0` works only in Chromium (`interpolate-size`) [S17][S18].

**The id-sharing risk does not happen.** `@for` destroys the leaving view in the same
reconcile pass, so the row unregisters before the DOM node goes [S28][S29]. When a rolled-back
row is inserted straight after its own leaving `<tr>`, Angular removes the leaving node at once
[S30]. **A risk that is new here:** FLIP keeps the tops it measured while the leaving row still
had full height. The next `renderRows()` change after a delete then glides the rows below
from a stale position [R1] (inference).

## Method

- AG Grid is pinned to tag **`b36.2.0`**. The pin is carried over from
  [discovery-ag-grid-group-animation.md](discovery-ag-grid-group-animation.md), which read
  `registry.npmjs.org/ag-grid-community/latest` = `36.2.0` on 2026-09-23. It was not re-read
  here. Source is read as raw files at the tag, and docs as tag-pinned `.mdoc`.
- **Locators are method names.** The fetch tool summarises. Every method named in Evidence was
  asked for verbatim and came back as code. The one paraphrase ("slides to just outside the
  viewport") was checked against the code it quoted, and corrected in Evidence.
- Angular is pinned to `@angular/core@22.1.2`, read from `node_modules/@angular/core/package.json`.
  Runtime behaviour was read from `fesm2022/_debug_node-chunk.mjs`, the installed and published
  bundle, **with line numbers** because this file was read locally.
- Browser support was read from `@mdn/browser-compat-data@8.1.2` (registry latest on
  2026-09-23) as raw per-feature JSON at tag `v8.1.2`. MDN pages were used for prose.
  **Reliability:** a WebFetch summary of MDN's `interpolate-size` page said "Safari 18.1+".
  The BCD JSON behind that page says Safari is **not supported** (WebKit bug 295132). BCD wins,
  and the summary is treated as a fetch error.
- Repo source was read on 2026-09-23 at `main` (`3c72f70`, with a dirty tree). Nothing was run.

## Evidence

**AG Grid: insert and delete through transactions**

- `updateRowData`, which backs `applyTransaction`, sets `animate = !gos.get('suppressAnimationFrame')`. It passes that to `nodeManager.updateRowData`, then to `commitTransactions` [S2]
- `commitTransactions` → `refreshModel({ step: 'group', rowDataUpdated: true, keepRenderedRows: true, animate, changedRowNodes })` [S2]
- `applyTransactionAsync` → `batchUpdateRowData` queues the transaction. `executeBatchUpdateRowData` runs later from a `setTimeout`, applies every queued transaction into one `ChangedRowNodes`, and makes **one** `commitTransactions` call with the same `animate` [S3]. `flushAsyncTransactions` runs it early [S3]
- Remove: `executeRemove` → `destroyNode(rowNode, animate)` → `rowNode._destroy(animate)` [S6]. `_destroy(true)` calls `clearRowTopAndRowIndex`, which leaves `rowTop = null` and `oldRowTop` = the last top [S9]
- Add: `executeAdd` creates nodes with `createRowNode`. An add in the middle of the list sets `changedRowNodes.reordered = true` [S6]. A new node has no `oldRowTop` [S13]
- `rowNode.setRowTop` saves `oldRowTop = rowTop`, then dispatches `topChanged` [S9]. That is the same move event the earlier discovery traced to `translateY` [S1]

**AG Grid: replacing `rowData` wholesale**

- `onPropChange` sets `immutable` when there is no `extractData`, the model already has leaves, the new data is not empty, `gos.exists('getRowId')` is true and `resetRowDataOnUpdate` is off [S4]
- Immutable: `keepRenderedRows = true`, `animate = !suppressAnimationFrame`, and `setImmutableRowData` diffs by id. Removed nodes go through `deleteUnusedNodes(…, !!params.animate)`. A node that moved up sets `reordered` [S4][S7]
- Not immutable: `rowDataUpdated = true` and `newData = true`, with **no `animate`, no `keepRenderedRows`**. `setNewRowData` → `destroyAllNodes` calls `_destroy(null)`, which clears `rowTop`/`oldRowTop` **without** a `topChanged` event [S4][S8][S9]
- The docs agree: with row ids, "Moved rows animate to new position" and "Row Selection maintained". Without them there is "No row animation" [S15]. The transactions page says only "the grid animates the rows to the new location" [S16]. The row-animation page lists filter, sort and group expand/collapse, and does not list transactions [S14]

**AG Grid: the renderer (shared by every path above)**

- `onPageLoaded` maps `keepRenderedRows` → `recycleRows` and `animate` → `animate` [S10]
- `redrawAfterModelUpdate`: `animate = params.animate && _isAnimateRows(gos)`. With no `recycleRows`, it calls `removeAllRowComps(!animate)`, so a non-immutable `rowData` destroys every controller with animation suppressed [S10]
- `recycleRows` → `createOrUpdateRowCtrl` for each row to draw. Controllers left in `rowsToRecycle` go to `destroyRowCtrls(rowsToRecycle, animate)` [S11]
- `destroyRowCtrls` calls `destroyFirstPass(!animate)`. If `animate` is set, it keeps the controller in `zombieRowCtrls` and runs `destroySecondPass` after `ROW_ANIMATION_TIMEOUT` (400 ms) [S11]
- `destroyFirstPass`: if `rowNode.rowTop != null` (the node is still in the model, only outside the rendered range), the row moves to `oldRowTop`. If not (the node was deleted), it gets `ag-opacity-zero`. **Verification changed this:** the fetch summary said "slides to just outside the viewport". The quoted code moves the row to `roundRowTopToBounds(oldRowTop)`, and a deleted row takes the fade branch [S12]
- `setAnimateFlags`: a new controller with `oldRowTop` slides in. One without it fades in [S13]. A transaction-added node has no old top, so it **fades in** [S6][S13]
- The docs say: "Rows that are no longer in the grid are left in the same position and faded out", and "old rows are placed behind new rows such that moving rows are on top of old rows" [S14]

**Angular 22.1.2: what `animate.leave` does to a `@for` row**

- `ɵɵrepeater` → `reconcile` → `liveCollection.destroy(liveCollection.detach(i))` for removed items, in the same pass [S28 L14351-14355]
- `detach` → `detachView` → `removeViewFromDOM` → `applyView(…, 2)` (detach). When a leave animation is registered, `nativeRemoveNode` runs **in the callback** after the animation [S29 L4699-4710]
- `destroy` → `destroyLView` → `destroyViewTree` → `cleanUpView` → `processCleanups`. This runs `ON_DESTROY_HOOKS` (`DestroyRef.onDestroy`) and destroys effects **synchronously** [S28 L4773-4852]. So the view and its directives die at once, and only the `<tr>` node stays
- `addViewToDOM` → `applyView(…, 1)` → `cancelLeavingNodes`. If the new element's `previousSibling` is a leaving node of the same template node, that node gets a synthetic `animationend {cancel}` and is **removed immediately** [S30 L4118-4145][S29 L4695-4698]
- Leave and enter classes are added inside the animation queue [S32 L13995-13997, L14114-14116]. The queue runs in an `afterNextRender` registered with the queue's **environment** injector [S31 L4513-4527]
- `refreshView` runs `executeTemplate` (the `@for` reconcile) **before** `runEffectsInView` (the FLIP effect) [S33 L6034, L6054]. `AfterRenderImpl` runs sequences in `Set` insertion order. A sequence with no view is added at once, and one tied to a view is added later [S31 L4306-4361]
- Leave completes on `transitionend`/`animationend` whose target is **the `<tr>` itself**. The longest animation is measured on that element only, with a fallback of `duration + 50 ms` [S32 L14091-14131]

**ngpTable today**

- The FLIP effect reads `renderRows()`. In `afterNextRender` it measures `offsetTop` for every id in the registry, sets deltas only for ids that have both an old and a new top, then **stores those tops as `previousRowTops`** [R1]
- Nothing measures again when a leaving node finishes and is removed. `previousRowTops` stays as it was measured until the next `renderRows()` change [R1]
- `registerRowElement` always overwrites. `unregisterRowElement` deletes only if the stored element is the caller's own [R2]. The row registers from an `effect` and unregisters in `DestroyRef.onDestroy` [R3]
- The story's leave rule: `.row-leave > td, .row-leave > td *` → `padding-block: 0; border-block-width: 0; font-size: 0` as **transitions**, `opacity` on the `<tr>` [R4]
- The story's controls: `.story-host__cell input, select` → `padding: 0.2rem 0.3rem; border: 1px` (rem and px, which do not follow `font-size`), and `font: inherit` [R5]. The icon button's `svg` is `height: 1rem` [R6]
- `.row-leave > td *` and `.story-host__cell input` both have specificity (0,1,1), so source order decides between them today [R4][R5]. Under ADR-0026 the preset sits in `@layer ngp-table` and **loses to both, whatever the specificity** [R10][S27]
- `removeEdit` removes the row and stores `{ row, at, op: 'delete' }`. `revertEdit` puts it back with `insertRow(value, { at: snapshot.at })`, at the same index in `data` [R7][R8]

**CSS facts**

- Row height is the maximum of the row's `height`, each cell's `height`, and "the minimum height (MIN) required by the cells". "The height of a cell box is the minimum height required by the content" [S25]. A `<td>` cannot shrink below its content
- In CSS 2.2, `min-height`/`max-height` on table cells and rows is undefined, so a clamp has to go on the cell's **descendants** [S25]. `max-height` applies to all elements except non-replaced inline elements, table columns and column groups. It animates as a length, and `min-height` wins over `max-height` [S23]
- Cascade order: author normal < **keyframe animations** < author `!important` < … < transitions. "Normal styles declared outside of any layer" beat layered normal styles "regardless of specificity" [S27]
- `interpolate-size: allow-keywords` is inherited. It enables length ↔ `auto` interpolation (one end must be a length) [S20]. Support: Chrome/Edge 129, **Firefox no, Safari no**, experimental [S18]
- `calc-size()`: Chrome 129, **Firefox no, Safari no**, experimental [S17][S21]
- `visibility` animates as a **discrete** step. Between visible and collapse it stays `visible` for the whole duration and flips at the end [S22]. `collapse` on a `<tr>` removes its space while column widths stay as if the row were there [S22][S25]. Chrome has done this since 62 [S19]. BCD's Safari note says "Safari treats `visibility: collapse` like `hidden`, leaving a white gap", with no version bound [S19]
- `position: absolute` sets a `table-row`'s computed display to `block` [S24]. The leaving `<tr>` stops being part of the table grid

## Comparison

### Insert and delete paths

| Trigger                                              | AG Grid 36.2.0                                                                                                                 | ngpTable today                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Add row (transaction / `insertRow`)                  | new node fades in; rows below slide via `translateY` [S2][S13][S9]                                                             | `animate.enter` fades it in; rows below get a FLIP glide (old and new tops both known) [R1]                                      |
| Remove row (transaction / `removeRow`, `removeEdit`) | fades out at its old top, zombie for 400 ms, out of flow; rows below slide into its space at once, **over** it [S11][S12][S14] | `animate.leave` keeps the `<tr>` **in flow**; rows below move only as its height shrinks; they snap if it can't reach 0 [R4][R1] |
| Async batch                                          | one `refreshModel` for the whole batch [S3]                                                                                    | n/a — every `update()` is one `renderRows()` change                                                                              |
| `rowData` replaced, ids kept                         | diff → same path as a transaction [S4][S7]                                                                                     | same as insert/remove — `@for` tracks by id                                                                                      |
| `rowData` replaced, no ids                           | no animation; every controller destroyed, suppressed [S4][S10]                                                                 | n/a — `trackBy` is required                                                                                                      |
| Delete then re-add same id                           | new `RowNode`, new controller → fade in; old one still a zombie (see Unverified) [S6][S11]                                     | cancelled: the leaving `<tr>` is removed when the new one lands right after it; the new one fades in [S30]                       |

### CSS-only collapse of a control row (leave)

| Approach                                                                                                                                                   | Collapses controls?                                                                                              | Survives `@layer` vs consumer CSS?                    | Rows below                                             | Support                                                                               | Status                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Today: `transition` on `padding`/`border`/`font-size` of `td *` [R4]                                                                                       | only font-relative sizes                                                                                         | **no** — layered transition targets lose [S27]        | follow layout, snap at the end                         | all                                                                                   | shipped (story), layer not yet                                                                     |
| **A. `@keyframes` on `> *` and `> * *`: `to { padding-block:0; border-block-width:0; font-size:0; min-block-size:0 }`, `max-block-size` from a token → 0** | yes — the clamp stops rem/px/UA heights [S23]                                                                    | **yes** — keyframes beat unlayered normal rules [S27] | follow layout, no snap if the clamp reaches 0          | all (length animation) [S23]                                                          | inferred, not run                                                                                  |
| A + `interpolate-size: allow-keywords` → `block-size: auto → 0`                                                                                            | yes, eased from the real height                                                                                  | yes (in keyframes)                                    | follow layout                                          | Chromium 129+ only; elsewhere `auto` ↔ `0` is not interpolable → discrete [S18][S20] | progressive enhancement                                                                            |
| `calc-size(auto, size * p)`                                                                                                                                | same as above                                                                                                    | yes                                                   | follow layout                                          | Chromium 129+ only [S17]                                                              | no gain over `interpolate-size`                                                                    |
| `grid-template-rows: 1fr → 0fr`                                                                                                                            | needs a grid container around the content; making the `<td>` `display: grid` stops it being a `table-cell` [S25] | —                                                     | —                                                      | all                                                                                   | **rejected**: breaks cell semantics and `colspan`; direct text needs a wrapper (a template change) |
| `line-height: 0`                                                                                                                                           | only line boxes; not controls with rem/px padding                                                                | no (layer)                                            | —                                                      | all                                                                                   | not enough on its own; `font-size: 0` already zeroes a `normal` line-height [R4]                   |
| `visibility: collapse` on the `<tr>`                                                                                                                       | removes the row, column widths kept [S22]                                                                        | —                                                     | **glide via FLIP** if set at the start (see Synthesis) | Chrome ≥62, Firefox; Safari leaves a gap per the BCD note [S19]                       | no fade (discrete); Safari gap                                                                     |
| `position: absolute` on the `<tr>`                                                                                                                         | removes the row from the table at once [S24]                                                                     | —                                                     | **glide via FLIP** (AG Grid's shape)                   | all                                                                                   | row becomes a block; its cells stop lining up with the columns; see Unverified                     |

## Synthesis

- **AG Grid and ngpTable split the same work differently.** AG Grid can fade a deleted row
  "in the same position" while the others slide over it, because no row takes flow space
  [S12][S14]. ngpTable's rows are in DOM order and in flow, which is why it uses FLIP (the earlier
  discovery's `ensureDomOrder` finding) [S1]. So a leaving `<tr>` either **keeps its space and
  shrinks** (approach A) or **gives up its space at once** (absolute or collapse). No option does
  both.
- **The order in which things run decides between those two, and it favours giving up space.**
  The leave and enter classes go in through the animation queue, whose `afterNextRender` is
  registered during the template pass. The FLIP effect registers its own afterwards [S31][S33].
  So FLIP measures **after** the classes are on the element (a source-read inference). A
  _transition_ has not moved anything yet when it is measured, so rows below get no delta. A
  _discrete_ change in the class (`position: absolute`, `visibility: collapse`) has already
  moved them, so FLIP glides them. This changes the D2 limitation: it is a property of the
  collapse-in-place preset, not a limit of the mechanism.
- **Collapsing in place leaves FLIP's baseline stale.** The tops stored after a delete include
  the leaving row's full height [R1]. After the node goes, rows below sit one row higher than
  FLIP recorded. On the next unrelated `renderRows()` change (a sort, an edit), a row below that
  does not move gets `oldTop ≠ newTop` and glides by that height. The grouping header's exit
  shares this. Giving up space at once (absolute or collapse) avoids it, because the measured
  tops are already final. Collapsing in place needs a JS re-measure, the maintainer's last
  resort.
- **The layer, not the control, is the main reason the leave preset fails.** ADR-0026 puts
  shipped rules below every unlayered consumer rule [R10][S27]. A consumer who styles
  `input { padding: … }` beats a layered `padding-block: 0` for the transition's end value. So
  a transition preset in the layer does not work reliably in practice. Keyframes sit above that
  whole layer and are the only CSS way for a layered sheet to drive another element's box for a
  short time. This fits ADR-0026 as it stands: keyframes are CSS, the classes are the preset
  names passed to `animate.leave`, and the tokens are inputs.
- **Two general mechanisms, one per phase, not one fix per control type.** "Clamp everything
  under the row to 0" (`max-block-size` on every descendant, `min-block-size: 0`) covers
  inputs, selects, SVGs and badges at once [S23]. Listing `input`, `select`, `svg` separately
  would repeat what the clamp already does. Same instinct as
  [[general-mechanism-over-enumerated-cases]].
- **Insert needs nothing new, as long as enter changes no layout.** An inserted row is at full
  size when FLIP measures, so every row below gets its delta and glides down while the new
  row fades in. That is AG Grid's pattern [S13][S14][R1]. An enter preset that grows height (or
  starts at `max-block-size: 0`) would be measured collapsed, and would break the glide and
  the baseline in the same way as above.
- **Rollback is not a special case for the registry.** The old view is destroyed, and so
  unregistered, in the reconcile that removed it [S28]. The re-inserted row registers in a
  later pass [R3]. The two cannot overlap in the map. The "only if still my element" guard [R2]
  is never hit through `@for`. It is harmless, and useful for any other host. In the DOM, a
  rollback that lands inside the 200 ms leave removes the old `<tr>` at once, because the new
  one's `previousSibling` is the leaving node [S30]. Visually: the row blinks back and fades
  in, instead of two rows cross-fading. With collapse in place, the rows below jump back down
  by however much they had already closed up (no FLIP delta, stale baseline). If the row gave
  up its space at once, they glide back down.

## Proposed mapping (discovery only — nothing decided)

1. **Move the leave preset from `transition` to `@keyframes`** in `row-animation.css`. Select
   with `.ngp-table-row--leave > *` and `> * *`, not `td`, so the `div` grid host (ADR-0005)
   is covered [R10]. Leave out `from` for `padding-block`/`border-block-width`/`font-size`
   (implicit from = the consumer's computed value), and add `min-block-size: 0`. Clamp
   `max-block-size` from `var(--ngp-table-row-leave-max-block-size, 3rem)` to `0`. Put
   `opacity` on the row itself, so Angular's end detection (it watches the `<tr>` only) sees
   the longest animation [S32]. Add `animation-fill-mode: forwards` so nothing flashes back
   before removal. Tokens: `--ngp-table-row-leave-duration` (already reserved by D7) and the
   max-block-size bound.
2. **Chromium enhancement, in `@supports (interpolate-size: allow-keywords)`:** set
   `interpolate-size: allow-keywords` on the leaving row and animate `block-size` to `0`,
   letting it inherit to the descendants. It eases from the real height instead of from the
   token's upper bound. Firefox and Safari keep (1) [S18].
3. **Keep enter opacity-only**, and write down why: FLIP must measure the entering row at full
   height [R1][S31].
4. **Offer "collapse in place" vs "give up space at once" as a named choice, not a hidden
   default.** A second preset, e.g. `ngp-table-row--leave-lift`, sets
   `position: absolute` (plus opacity) as a normal declaration, so FLIP glides the rows below.
   This matches AG Grid and avoids the stale baseline. It depends on the order in which things
   run, and on what happens to cell widths (Unverified), so it should be a Storybook
   experiment before it goes in the plan. `visibility: collapse` is the fallback for tables
   that need their column widths fixed, and it gives up the fade.
5. **Record the stale-baseline issue** in `row-animation.md`'s Open Questions next to the
   interruption item. It affects the planned grouping-header exit too. The only full fix for
   collapse in place is JS (measure again once a leaving node is removed), which stays a last
   resort.
6. **Add three items to the plan's Verification list:** delete a control row (it collapses to 0
   with no snap); delete, then sort so the rows below stay where they are (no spurious glide);
   delete, then roll back within 200 ms (one row, it fades in, no duplicate).

## Not researched

- The `div` grid host (ADR-0005): how a CSS-grid or flex row collapses. Everything above
  assumes table layout.
- AG Grid's Server-Side and Viewport row models, `enableCellSpan`/`suppressRowTransform` (which
  use `top`), and the full-width and detail rows that `_destroy` cascades to [S9].
- Other vendors (MUI X, TanStack Virtual, Handsontable) on insert/delete. This pass covered AG
  Grid only, as asked.
- The accessibility of the leaving `<tr>`: it keeps `role="row"` and a stale `aria-rowindex`
  for about 200 ms after it has left the model.
- `<select>` and `<input>` behaviour under `appearance: auto` when clamped to 0 (UA minimum
  heights), per engine.

## Unverified

- **The order in which things run: animation classes before the FLIP measurement.** This comes
  from reading the source [S31][S33], not from a run. To confirm: put a leave class with
  `position: absolute`, delete a row in Storybook, and check that the rows below glide rather
  than jump.
- **The stale-baseline glide** is inferred from R1 plus the synchronous destroy [S28]. To
  confirm: delete a middle row, wait over 200 ms, apply a sort that leaves the rows below where
  they are, and watch for a one-row glide.
- **The keyframe collapse reaching exactly 0** with the story's controls. That rests on S23/S25
  and on UA form controls honouring `max-block-size: 0` and `font-size: 0`. Not run in any
  engine.
- **`position: absolute` on a leaving `<tr>`:** where its static position lands inside a
  `<tbody>`, whether the anonymous table wrapping its cells keeps them readable, and whether
  pulling it out changes the column widths of an auto-layout table. Only the spec's
  display-to-block rule is verified [S24].
- **Safari and `visibility: collapse` on `<tr>` today.** The BCD note has no version bound [S19],
  so it may be out of date. Confirm in current Safari.
- **AG Grid: a zombie and a new controller with the same id side by side.** `getRowsToRecycle`
  is keyed by live controllers [S1], and zombies sit in a separate map [S11]. So both DOM rows
  probably cross-fade for up to 400 ms. The two-map separation is read. The visual result is
  inferred.
- **AG Grid: whether `executeAdd`'s `reordered = true` changes what is animated**, beyond
  sending the sort/group stages down the `changedRowNodes` path. Not traced.

## Sources

|     | Source                                                                                                                                                                                                          | Version             | Verified                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| S1  | [discovery-ag-grid-group-animation.md](discovery-ag-grid-group-animation.md) — its S9, S10, S12 (`getRowsToRecycle`, `positionRows`, `setRowTopStyle`) and the registry pin                                     | b36.2.0             | yes — read; carried over, not re-fetched                                                       |
| S2  | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/clientSideRowModel/clientSideRowModel.ts — `updateRowData`, `commitTransactions`                                       | b36.2.0             | yes — source read, verbatim                                                                    |
| S3  | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/clientSideRowModel/clientSideRowModel.ts — `batchUpdateRowData`, `executeBatchUpdateRowData`, `flushAsyncTransactions` | b36.2.0             | yes — source read; one commit per batch                                                        |
| S4  | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/clientSideRowModel/clientSideRowModel.ts — `onPropChange`                                                              | b36.2.0             | yes — source read; showed that the non-immutable branch sets no `animate`                      |
| S5  | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/clientSideRowModel/clientSideRowModel.ts — `refreshModel` `modelUpdated` dispatch                                      | b36.2.0             | yes — source read                                                                              |
| S6  | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/clientSideRowModel/clientSideNodeManager.ts — `updateRowData`, `executeRemove`, `destroyNode`, `executeAdd`            | b36.2.0             | yes — source read; `executeRemove`/`executeAdd` were summarised, `destroyNode` quoted          |
| S7  | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/clientSideRowModel/clientSideNodeManager.ts — `setImmutableRowData`, `deleteUnusedNodes` call                          | b36.2.0             | yes — source read; the `deleteUnusedNodes` call quoted                                         |
| S8  | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/clientSideRowModel/clientSideNodeManager.ts — `setNewRowData`, `destroyAllNodes`                                       | b36.2.0             | yes — source read; `_destroy(null)` quoted                                                     |
| S9  | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/entities/rowNode.ts — `_destroy`, `clearRowTopAndRowIndex`, `setRowTop`                                                | b36.2.0             | yes — source read; settles the earlier doc's Unverified item: `oldRowTop` ends as the last top |
| S10 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/rendering/rowRenderer.ts — `onPageLoaded`, `redrawAfterModelUpdate`, `removeAllRowComps`                               | b36.2.0             | yes — source read, verbatim                                                                    |
| S11 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/rendering/rowRenderer.ts — `recycleRows`, `destroyRowCtrls`, `ROW_ANIMATION_TIMEOUT`                                   | b36.2.0             | yes — source read, verbatim                                                                    |
| S12 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/rendering/row/rowCtrl.ts — `destroyFirstPass`                                                                          | b36.2.0             | yes — source read; corrected the fetch summary's "slides outside viewport"                     |
| S13 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/rendering/row/rowCtrl.ts — `setAnimateFlags`                                                                           | b36.2.0             | yes — source read                                                                              |
| S14 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/row-animation/index.mdoc                                                                                  | b36.2.0             | yes — doc read; transactions not listed                                                        |
| S15 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/data-update-row-data/index.mdoc                                                                           | b36.2.0             | yes — doc read                                                                                 |
| S16 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/data-update-transactions/index.mdoc                                                                       | b36.2.0             | yes — doc read; one animation sentence only                                                    |
| S17 | https://raw.githubusercontent.com/mdn/browser-compat-data/v8.1.2/css/types/calc-size.json                                                                                                                       | BCD 8.1.2           | yes — read 2026-09-23                                                                          |
| S18 | https://raw.githubusercontent.com/mdn/browser-compat-data/v8.1.2/css/properties/interpolate-size.json                                                                                                           | BCD 8.1.2           | yes — read 2026-09-23; overrode the MDN page summary's Safari claim                            |
| S19 | https://raw.githubusercontent.com/mdn/browser-compat-data/v8.1.2/css/properties/visibility.json — `collapse`                                                                                                    | BCD 8.1.2           | yes — read 2026-09-23                                                                          |
| S20 | https://developer.mozilla.org/en-US/docs/Web/CSS/interpolate-size                                                                                                                                               | modified 2026-07-26 | yes — prose used; compat line not trusted (see Method)                                         |
| S21 | https://developer.mozilla.org/en-US/docs/Web/CSS/calc-size                                                                                                                                                      | modified 2026-04-18 | yes — prose read                                                                               |
| S22 | https://developer.mozilla.org/en-US/docs/Web/CSS/visibility                                                                                                                                                     | —                   | yes — `collapse` and Interpolation sections read                                               |
| S23 | https://developer.mozilla.org/en-US/docs/Web/CSS/max-height                                                                                                                                                     | modified 2026-09-10 | yes — formal definition read                                                                   |
| S24 | https://www.w3.org/TR/CSS22/visuren.html — §9.7                                                                                                                                                                 | CSS 2.2             | yes — read                                                                                     |
| S25 | https://www.w3.org/TR/CSS22/tables.html — §17.5.3, §17.5.5                                                                                                                                                      | CSS 2.2             | yes — read                                                                                     |
| S26 | https://registry.npmjs.org/@mdn/browser-compat-data/latest                                                                                                                                                      | 8.1.2               | yes — set the BCD pin                                                                          |
| S27 | https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/Cascade                                                                                                                                            | modified 2025-12-16 | yes — cascade order table and the layer text read                                              |
| S28 | `node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:14351-14355` (`reconcile` destroy)                                                                                                                   | 22.1.2              | yes — installed package read                                                                   |
| S28 | `node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:4773-4852` (`destroyLView`, `cleanUpView`, `processCleanups`)                                                                                        | 22.1.2              | yes — installed package read                                                                   |
| S29 | `node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:4676-4720` (`applyToElementOrContainer`)                                                                                                             | 22.1.2              | yes — installed package read                                                                   |
| S30 | `node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:4118-4159` (`cancelLeavingNodes`)                                                                                                                    | 22.1.2              | yes — installed package read; source of the rollback finding                                   |
| S31 | `node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:4513-4527` (`scheduleAnimationQueue`)                                                                                                                | 22.1.2              | yes — installed package read                                                                   |
| S31 | `node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:4292-4365` (`AfterRenderImpl.execute`, `register`)                                                                                                   | 22.1.2              | yes — installed package read                                                                   |
| S32 | `node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:13968-14011` (`runEnterAnimation`)                                                                                                                   | 22.1.2              | yes — installed package read                                                                   |
| S32 | `node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:14085-14134` (`animateLeaveClassRunner`)                                                                                                             | 22.1.2              | yes — installed package read                                                                   |
| S33 | `node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:6034` (`executeTemplate` in `refreshView`)                                                                                                           | 22.1.2              | yes — installed package read                                                                   |
| S33 | `node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:6054` (`runEffectsInView` in `refreshView`)                                                                                                          | 22.1.2              | yes — installed package read                                                                   |
| R1  | `libs/table/src/directives/ngp-table.directive.ts:49-84`                                                                                                                                                        | —                   | yes — read                                                                                     |
| R2  | `libs/table/src/directives/ngp-table.directive.ts:98-111`                                                                                                                                                       | —                   | yes — read                                                                                     |
| R3  | `libs/table/src/directives/ngp-table-row.directive.ts:59-65`                                                                                                                                                    | —                   | yes — read                                                                                     |
| R4  | `libs/table/src/stories/row-edit/grouping-editing/grouping-editing-flip.css:17-35`                                                                                                                              | —                   | yes — read                                                                                     |
| R5  | `libs/table/src/stories/styles/story-host.css:68-79`                                                                                                                                                            | —                   | yes — read                                                                                     |
| R6  | `libs/table/src/stories/row-edit/live-table/live-table-story-host.component.css:42-46`                                                                                                                          | —                   | yes — read                                                                                     |
| R7  | `libs/table/src/mutations/optimistic-mutations.ts:88-108` (`revertEdit`)                                                                                                                                        | —                   | yes — read                                                                                     |
| R7  | `libs/table/src/mutations/optimistic-mutations.ts:140-161` (`removeEdit`)                                                                                                                                       | —                   | yes — read                                                                                     |
| R8  | `libs/table/src/mutations/row-mutations.ts:18-30` (`insertRow`)                                                                                                                                                 | —                   | yes — read                                                                                     |
| R9  | `libs/table/docs/3-ui/work/row-animation/1-plan-grouping-moves.md` — D1, D2, D3, D7                                                                                                                             | —                   | yes — read                                                                                     |
| R10 | `libs/table/docs/adr/0026-headless-styling-contract.md` — Decision 3, 4, 5                                                                                                                                      | —                   | yes — read                                                                                     |
