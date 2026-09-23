# Does AG Grid animate grouping-driven row movement through the same mechanism as sort and drag-drop — and what does that mean for ngpTable's FLIP?

**Date:** 2026-09-23 · **Depth:** standard

## Answer

**One mechanism, not one per trigger.** Sort, filter, group expand/collapse, a change to the
row-group columns, and managed row drag all end in the same call:
`clientSideRowModel.refreshModel({ keepRenderedRows: true, animate })` [S3][S4][S5][S6]. That
feeds one renderer path, gated once by `_isAnimateRows` [S7][S8]. Row controllers are reused
by `rowNode.id` [S9]. Each node's new `rowTop` is written as `translateY` [S10][S11][S12], and
one CSS rule animates it [S14]. **Grouping with drag-drop off uses exactly this path.** There
is no group-specific animation class [S15]. Drag only adds `ag-row-dragging`, which sets
`z-index: 4` [S16][S14].

**For ngpTable:** the existing `renderRows()` effect already covers every grouping *move* for
free [R1]. What grouping adds, and sort never needed, is **enter and exit**. AG Grid handles
these with a fade plus a 400 ms "zombie" delay [S13][S17]. ngpTable's FLIP skips them today
[R1], and a directive that is not allowed to change the DOM cannot delay an exit [R3].

## Method

- AG Grid pinned to tag **`b36.2.0`**, which matches registry latest `ag-grid-community@36.2.0`
  (read from `registry.npmjs.org/ag-grid-community/latest`, 2026-09-23). Source was read as raw
  files at that tag. Published CSS was read from `unpkg.com/ag-grid-community@36.2.0`.
- **Locators are method names, not line numbers.** The fetch tool gave line counts that
  contradicted each other within one file (the same line number came back for two different
  statements). Every `S*` row names the method, which a search of the pinned file finds. The
  line numbers are listed under **Unverified**.
- Angular pinned to `@angular/core@22.1.2`, read from the installed `node_modules` copy.
- Repo source read on 2026-09-23 at `main` (`c3359c0`).

## Evidence

**Trigger → model refresh (all triggers converge)**

- Sort: `onSortChanged` → `refreshModel({ step: 'sort', keepRenderedRows: true, animate: _isAnimateRows(gos) })` [S3]
- Group expand/collapse: `rowExpansionStateChanged` → `onRowGroupOpened` → `refreshModel({ step: 'map', keepRenderedRows: true, animate: _isAnimateRows(gos) })` [S4]
- Group-by columns changed: `columnRowGroupChanged` → `onColumnsChanged` → `refreshModel({ step: 'group', keepRenderedRows: true, animate: !suppressAnimationFrame })` [S4][S5]
- Filter: `onFilterChanged` → `refreshModel({ ..., keepRenderedRows: true, animate: _isAnimateRows(gos) })` [S5]
- Managed row drag: `csrmMoveRowsReorder` reorders the leaf array itself (`_csrmReorderAllLeafs`, `treeParent` reassignment), then calls `refreshModel({ step: 'group', keepRenderedRows: true, animate: !suppressAnimationFrame, changedRowNodes })` with `reordered = true` [S6]
- `refreshModel` dispatches `modelUpdated { animate, keepRenderedRows }` [S5]; `rowRenderer` handles it through `paginationChanged` → `onPageLoaded` → `redrawAfterModelUpdate` [S8]

**One gate, one renderer path**

- `_isAnimateRows` returns `gos.get('animateRows')`, but always `false` under `ensureDomOrder`. The comment says "never allow animating if enforcing the row order" [S7]
- `redrawAfterModelUpdate` re-gates with `params.animate && _isAnimateRows(gos)` [S8]. So the grouping and drag paths' `!suppressAnimationFrame` [S4][S6] never animates when `animateRows` is off. **Verification changed this:** read alone, the call sites suggest those two paths ignore `animateRows`. They do not.
- `getRowsToRecycle` keys every live `RowCtrl` by `rowNode.id`. `createOrUpdateRowCtrl` reuses the controller for an id that is still displayed [S9]

**Position → transform**

- `positionRows` walks `rowsToRender` in order and calls `rowNode.setRowTop(nextRowTop)` on every node [S10]
- `RowNode.setRowTop` saves `oldRowTop = rowTop`, then dispatches `topChanged`. The doc comment on `oldRowTop` says: "used so new rows can animate in from their old position" [S11]
- `RowCtrl` listens for `topChanged` → `onTopChanged` → `setRowTop` → `setRowTopStyle`. That method writes `translateY(${topPx})`, or `top` when `suppressRowTransform`/`enableCellSpan` is set [S12]
- `gridBodyCtrl.setupRowAnimationCssClass` switches the container class between `ag-row-animation` and `ag-row-no-animation` [S18][S19]

**Enter / exit (the part sort does not use)**

- A new `RowCtrl` slides in from `oldRowTop` when the node has one. Otherwise it gets `fadeInAnimation`, which starts from `ag-opacity-zero` and removes that class after it is created (`setAnimateFlags`, `getInitialRowTopShared`) [S13]
- Exit, `destroyFirstPass`: a node still in the model (`rowTop != null`) slides; a node that left the model gets `ag-opacity-zero` [S13]
- With `animate`, `destroyRowCtrls` holds the removed controllers as `zombieRowCtrls` and runs `destroySecondPass` after `ROW_ANIMATION_TIMEOUT = 400` ms. **The DOM node outlives the model row** [S17]
- The docs name this four-part sequence (new rows fade in, old rows fade out in place, moved rows transition, resized rows transition height). They list "Expanding / Collapsing Row Groups" as an animated action and do not mention row drag [S20]

**CSS**

- `.ag-row-animation .ag-row { transition: transform 0.4s, top 0.4s, opacity 0.2s }`, with `height 0.4s` added once `.ag-after-created` is set [S14]
- `.ag-row-no-animation .ag-row { transition: none }`, `.ag-opacity-zero { opacity: 0 !important }`, `.ag-row-dragging { z-index: 4 }` [S14]
- The only `.ag-row-group` rule is `.ag-cell-wrapper.ag-row-group`, which has no transition, transform or animation [S15]

**ngpTable today**

- The FLIP effect reads `ngpTable().renderRows()` and nothing else, so it has no notion of what triggered a change [R1]
- It computes a delta only for ids that have **both** an old and a new top (`oldTop !== undefined && oldTop !== newTop`). An entering row has no old top, so it gets no delta. An exiting row is not in `newTops`, so it is never visited [R1]
- It measures with `querySelectorAll('[data-row-kind]')`, matched by index against `renderRows()` ids, using `offsetTop` [R1]
- Group-header ids are `group:${path}`, and the path is `parentPath>columnId:key` [R2]
- Grouping stories already render rows with `@for (row of table.renderRows(); track row.id)` [R4]
- `animate.enter` / `animate.leave` exist as template instructions in the installed `@angular/core@22.1.2` [S21]

## Comparison

How each grouping-driven change classifies, and who covers it today.

| Grouping change | Row classes | AG Grid 36.2.0 | ngpTable FLIP today |
|---|---|---|---|
| Row's group-by value changes (header ids stable) | data row **moves** across a group boundary; siblings move | slide via `translateY` [S10][S12] | covered — same id, both tops known [R1][R2] |
| Group order (`groupOrder`) changes | headers + members **move** (paths unchanged) | slide [S10][S12] | covered [R1][R2] |
| Group collapses | descendants **exit**; rows below **move** up | exits fade, zombie 400 ms; movers slide [S13][S17] | movers covered; exits vanish instantly [R1] |
| Group expands | descendants **enter**; rows below **move** down | enters fade in, or slide from `oldRowTop` [S13] | movers covered; enters appear instantly [R1] |
| A group level is added, removed or reordered | **every** header id changes → all headers exit and enter; data rows move | header ids here — see Unverified | data rows covered; every header vanishes and reappears with no transition [R1][R2] |
| Cluster appears or dissolves (filter/data) | one header enters or exits | fade [S13] | instant [R1] |

## Synthesis

- **AG Grid decides "why a row moved" nowhere in rendering.** The trigger only chooses a
  `refreshModel` step. Below that, a row has an id and a `rowTop`, and nothing else counts
  [S9][S10][S12]. ngpTable's effect is keyed on `renderRows()` in the same trigger-blind way
  [R1]. So both libraries agree that grouping needs no new trigger hook.
- **The two libraries differ on enter and exit, not on moves.** AG Grid owns its row DOM, so it
  can keep a removed row for 400 ms [S17]. ngpTable cannot: directives may not insert, remove
  or reorder DOM, and structure belongs to the consumer's template [R3]. Once `@for` drops an
  exiting row, nothing is left to fade. This is the same constraint that already ruled out AG
  Grid's positioning technique [R5]. Sort never exposed it because a sort changes no row's
  membership.
- **`ensureDomOrder` disables animation in AG Grid** [S7]. AG Grid treats "visual order equals
  DOM order" as incompatible with its transform animation. ngpTable is always in DOM order,
  which is why it uses FLIP [R5]. This supports the FLIP choice; it does not change it.
- **The general mechanism holds for moves and stops at membership.** The same instinct as
  [[general-mechanism-over-enumerated-cases]] applies: "the rendered index changed" is one
  operation whatever the trigger. Enter and exit are a *second* operation. Both vendors keep it
  separate from moves (a fade, not a translate) [S13].

## Proposed mapping (discovery only — nothing decided)

1. **No new hook for grouping moves.** Once `withGrouping()`'s render-stage output changes the
   order of `renderRows()`, the existing effect already animates every row whose id survives
   [R1]. A story is enough to show it; no engine or directive change is needed.
2. **Enter: gap inside the directive's own authority.** A row with no previous top could get a
   state attribute (for example `data-row-entering`) for one frame. That would let a consumer
   stylesheet fade it in, matching AG Grid's `ag-opacity-zero` step [S13]. This is an option
   for a later decision, not a proposal. Note that the existing "state as `data-*`" invariant
   [R3] and the shipped `ngp-table-row--flip` class [R5] currently point in different
   directions; any new flag must pick one.
3. **Exit: outside the directive's authority.** Delaying removal is a structural concern, so it
   belongs to the consumer template: `animate.leave` on the `@for` row [S21][R3]. The library's
   most it could do is document the pattern next to `row-flip.css`.
4. **Level add/remove/reorder rewrites every header id** [R2]. Under 2 and 3, headers would
   cross-fade rather than move. Treating a header as "the same" across a level change would
   need an id that does not depend on path. That is a grouping-identity question, not an
   animation one, so it is noted here and not pursued.
5. **Rapid collapse and expand is the one move-case that grouping stresses harder than sort.**
   See Unverified (interruption).

In passing, for drag-drop (out of scope): AG Grid's managed drag commits by reordering the model
and calling the same `refreshModel` [S6]. It has no separate drag animation. So a future
`withDragDrop()` that settles by changing `renderRows()` would get the drop-settle glide from
this FLIP for free. That says nothing about the engine-owned mediation slot.

## Not researched

- AG Grid's Server-Side Row Model and Viewport Row Model — only the client-side model was
  traced.
- Whether AG Grid's managed drag also moves sibling rows live on each drag-move, as opposed to
  only on drop.
- MUI X, TanStack and other vendors' row animation. This pass was AG Grid only, as asked.

## Unverified

- **Line numbers in AG Grid files.** Fetch-tool counts for `rowCtrl.ts` gave approximately
  `setAnimateFlags` ~298, `destroyFirstPass` ~851, `setRowTop` ~919, `setRowTopStyle` ~948,
  `onTopChanged` ~1032. These are not reliable (one number was reported for two statements).
  To confirm: open `github.com/ag-grid/ag-grid/blob/b36.2.0/<path>` and search for the method
  name.
- **AG Grid group-node id format** — whether group ids stay stable when a level is added or
  reordered. Not found in the files read; it would sit in the enterprise grouping stage. If they
  are path-based like ngpTable's [R2], AG Grid also cross-fades headers on a level change.
- **Which top `destroyFirstPass` slides an exiting-but-still-in-model row to.** It uses
  `oldRowTop` [S13], but `clearRowTopAndRowIndex` → `setRowTop` overwrites `oldRowTop`
  [S11]. The call order at destroy time was not traced.
- **Interruption snap — inference, not tested.** `offsetTop` ignores `transform`, so a second
  `renderRows()` change during a running glide would compute its invert from the old *layout*
  slot rather than the row's current visual position. A CSS transition on a reused node (AG
  Grid) starts from the current computed value. To confirm: collapse and expand quickly in a
  grouping story.
- Whether `unpkg.com/ag-grid-community@36.2.0/styles/ag-grid.css` is the stylesheet the
  v33+ Theming API injects at runtime, or a legacy file. The rules were read from it, but it
  has no header comment [S14].

## Sources

| | Source | Version | Verified |
|---|---|---|---|
| S1 | https://registry.npmjs.org/ag-grid-community/latest | 36.2.0 | yes — registry read; set the tag pin |
| S3 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/clientSideRowModel/clientSideRowModel.ts — `onSortChanged` | b36.2.0 | yes — source read |
| S4 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/clientSideRowModel/clientSideRowModel.ts — `addManagedEventListeners` map, `onRowGroupOpened`, `onColumnsChanged` | b36.2.0 | yes — source read; showed that expand/collapse is `rowExpansionStateChanged`, not a group-specific renderer |
| S5 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/clientSideRowModel/clientSideRowModel.ts — `onFilterChanged`, `refreshModel` `modelUpdated` dispatch | b36.2.0 | yes — source read |
| S6 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/dragAndDrop/rowDragFeature.ts — `csrmMoveRowsReorder` | b36.2.0 | yes — source read; drag reuses `refreshModel`, no drag-specific animation |
| S7 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/gridOptionsUtils.ts — `_isAnimateRows` | b36.2.0 | yes — source read; found the `ensureDomOrder` override |
| S8 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/rendering/rowRenderer.ts — `onPageLoaded`, `redrawAfterModelUpdate` | b36.2.0 | yes — source read; the re-gate changed the reading of S4/S6 |
| S9 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/rendering/rowRenderer.ts — `getRowsToRecycle`, `createOrUpdateRowCtrl`, `recycleRows` | b36.2.0 | yes — source read |
| S10 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/clientSideRowModel/clientSideRowModel.ts — `positionRows`, `positionAndClearRows`, `clearStaleRowTops` | b36.2.0 | yes — source read |
| S11 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/entities/rowNode.ts — `setRowTop`, `clearRowTopAndRowIndex`, `oldRowTop` doc comment | b36.2.0 | yes — source read |
| S12 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/rendering/row/rowCtrl.ts — `addListeners` (`topChanged`), `onTopChanged`, `setRowTop`, `setRowTopStyle`, constructor `useTopPositioning` | b36.2.0 | yes — source read; confirms the `rowCtrl.ts` finding already in row-animation.md, which the grouping path shares |
| S13 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/rendering/row/rowCtrl.ts — `setAnimateFlags`, `getInitialRowTopShared`, `destroyFirstPass` | b36.2.0 | yes — source read |
| S14 | https://unpkg.com/ag-grid-community@36.2.0/styles/ag-grid.css | 36.2.0 | yes — published CSS read |
| S15 | https://unpkg.com/ag-grid-community@36.2.0/styles/ag-grid.css — every `transition`/`animation` rule | 36.2.0 | yes — negative result: no group-specific transition |
| S16 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/rendering/row/rowCtrl.ts — `postProcessRowDragging` | b36.2.0 | yes — source read |
| S17 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/rendering/rowRenderer.ts — `destroyRowCtrls`, `ROW_ANIMATION_TIMEOUT` | b36.2.0 | yes — source read |
| S18 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/gridBodyComp/gridBodyCtrl.ts — `setupRowAnimationCssClass` | b36.2.0 | yes — source read |
| S19 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/gridBodyComp/gridBodyComp.ts — `setRowAnimationCssOnScrollableArea` | b36.2.0 | yes — source read |
| S20 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/row-animation/index.mdoc | b36.2.0 | yes — full doc read |
| S21 | `node_modules/@angular/core/types/core.d.ts:5276` (`animate.leave` instruction) | 22.1.2 | yes — installed package read |
| R1 | `libs/table/src/directives/ngp-table.directive.ts:46-106` | — | yes — read |
| R2 | `libs/table/src/engine/grouping/clusters.ts:72-78` | — | yes — read |
| R3 | `libs/table/CLAUDE.md` — Locked invariants ("Attribute-only directives", "State as `data-*` attributes") | — | yes — read |
| R4 | `libs/table/src/stories/row-edit/grouping-editing/grouping-editing-story-host.component.html:19` | — | yes — read |
| R5 | `libs/table/docs/3-ui/directives/row-animation.md` — "Why FLIP, not AG Grid's technique", "Enabling the animation" | — | yes — read |
