# Where does a headless table directive stop being "primitive"? (row-disclosure directives: tree toggle, panel toggle, tree row)

**Date:** 2026-10-01 · **Depth:** standard

## Answer

The question assumes ng-primitives means "a11y only, no behavior". It doesn't. ng-primitives
ships behavior: click toggling, find-in-page reveal, enter/exit attributes, size variables, and
outputs [S1][S5]. The line every peer draws runs along **who owns the state**, not along
behavior versus no behavior.
- **Change events sit on the state owner, never on the trigger.** This holds for ng-primitives,
  Radix, Zag, React Aria, TanStack and AG Grid [S1][S3][S17][S23][S21][S25][S26].
- In @ngp/table the owner is `table.tree`, and it already emits `changed` [R7].
- So an `expandedChange` output on `ngpTableTreeToggle` would only duplicate `changed` — unless
  its payload carries something the store can't: the user's gesture, a pre-write cancel, or
  animation completion [S26][S31][S16][S11].
- Row-click-to-toggle inside the row primitive is shipped by React Aria, @angular/aria and
  AG Grid. Each avoids collisions structurally, never with a bare boolean
  [S18][S14][S27][S28].

## Method

- Versions pinned:
  - `ng-primitives@0.130.3` and `@angular/cdk@22.1.7` come from the repo's installed
    `node_modules` (`fesm2022/*.mjs`, unminified). Registry latest for ng-primitives is
    `0.131.1` [S6]; nothing was read from it.
  - `@angular/material@22.1.7` and `@angular/aria@22.2.1` (registry latest [S32]) were read
    from unpkg.
  - The installed CDK bundle declares `version: "22.1.6"` inside the `ɵɵngDeclare*` metadata,
    even though `package.json` says `22.1.7`.
- React family, all at registry latest on 2026-10-01: `@radix-ui/react-collapsible@1.1.20`,
  `@radix-ui/react-accordion@1.2.20`, `@radix-ui/primitive@1.1.7`, `react-aria@3.52.1`,
  `react-aria-components@1.21.1`, `@zag-js/collapsible@1.44.0`, `@headlessui/react@2.2.10`,
  `primeng@22.1.2`. All read as unpkg `dist` files.
- TanStack: `@tanstack/table-core@8.21.3` `src/` (v9 ships no `src/` — see anchors). AG Grid:
  `ag-grid-community@36.2.0` types from unpkg, plus enterprise source at tag `b36.2.0`.
- Base UI: docs page, version 1.8.0 shown on the page. No source read.
- Repo:
  - Code and docs are from the `feat-189-tree-stories` worktree (main + docs).
  - Panel plans are from the `docs-panel-directives` worktree (#199), read-only.
  - **ADR-0029 exists only on the #199 worktree** — it is not on main as read.
- Reliability: several WebFetch reads go through a summarizing model. Every claim in Evidence
  was asked for verbatim code. The React Aria docs page's "expansion only via chevron" was a
  summary and is **contradicted by source** [S18]; Evidence uses the source.

## Evidence

### Q1 — ng-primitives

- `ngpCollapsible` (root) owns `open`, which can be controlled or uncontrolled
  (`ngpCollapsibleOpen` / `ngpCollapsibleDefaultOpen`), and has one output,
  `ngpCollapsibleOpenChange` [S1].
- `ngpCollapsibleTrigger` has no inputs besides `id` and no output. It binds `id`, `type`,
  `aria-controls`, `aria-expanded`, `data-open/closed/disabled/orientation`, and listens to
  `click` only — keyboard handling is native `<button>` [S1].
- `ngpCollapsibleContent` owns more behavior than a11y:
  - `hidden="until-found"` and a `beforematch` listener that opens on find-in-page.
  - `data-enter`/`data-exit`, skipped on first render.
  - `--ngp-collapsible-content-width/height`, written as inline style custom properties [S1].
- `controlledState` emits `onChange` only from `set()` (an internal write). A change to the
  controlled input does **not** emit. In controlled mode `set()` emits but does not update local
  state, so the output is a *request*, not a notification [S2].
- Accordion composes the collapsible with `open` derived from the group (`computed(() =>
  accordion().isOpen(value()))`) and `onOpenChange` routed to `accordion().toggle()`. Only
  `ngpAccordion` declares an output (`ngpAccordionValueChange`). Item and trigger declare none
  [S3].
- `ngpToggle` exposes `ngpToggleSelectedChange` — again on the element that owns `selected`
  [S4].
- Stated principle: the library provides "low-level component logic and behavior"; the consumer
  provides styling [S5]. Nothing on that page addresses controlled state or outputs.
- No tree or treegrid primitive exists in 0.130.3 (none in the `fesm2022/` listing) [S1].

### Q2 — Angular CDK / Material / @angular/aria

- `CdkAccordionItem` owns `_expanded`. Its `expanded` setter emits `expandedChange` plus
  `opened`/`closed` on **every** change: `toggle()`, input, sibling-close through
  `UniqueSelectionDispatcher`, and open-all. No source is carried [S7].
- `CdkAccordionItem` binds no ARIA and no listener. The consumer wires `(click)` and
  `aria-expanded` [S7].
- `CdkTreeNodeToggle`:
  - `_toggle(event)` calls `event.stopPropagation()`.
  - Host `keydown.Enter`/`keydown.Space` also call `preventDefault()`.
  - Input `cdkTreeNodeToggleRecursive` [S8].
- `CdkTreeNode`:
  - Outputs `expandedChange`, emitted from the tree's central expansion-model diff, so
    programmatic changes emit too.
  - Outputs `activation`, emitted when the key manager receives Enter/Space on the focused node
    [S9][S10].
  - Host `click` only sets the active (focused) item — a row click does not toggle [S9].
- `MatExpansionPanel` adds `afterExpand`/`afterCollapse`, emitted on the body's
  `grid-template-rows` `transitionend`. This is animation completion, not state [S11].
- `MatExpansionPanelHeader` listens to `click` → `_toggle()` and handles Enter/Space with
  `preventDefault`. It never calls `stopPropagation` [S11].
- `@angular/aria` accordion:
  - `ngAccordionTrigger` holds `expanded` as a `model()`, so `expandedChange` is its only
    output.
  - Click, keydown and focusin are delegated to `ngAccordionGroup`.
  - `ngAccordionPanel` binds `inert` while hidden [S12].
- `@angular/aria` tree:
  - `ngTreeItem` holds `expanded` as a `model()`.
  - `ngTree` delegates `click`. Its `goto(e)` resolves the item from the event and calls
    `toggleExpansion(item)` unconditionally.
  - There is no separate toggle directive [S13][S14].

### Q3 — headless and grid peers

- Radix Collapsible: `open`/`defaultOpen`/`onOpenChange` on Root via `useControllableState`.
  The trigger's `onClick` is `composeEventHandlers(props.onClick, context.onOpenToggle)` [S15].
- `composeEventHandlers` skips the library handler when the consumer's handler called
  `preventDefault()`. This is cancellation through the native event, with no output [S16].
- Radix Accordion: `onValueChange` exists only on the root implementations. `AccordionItem`
  wires `onOpenChange` internally, and `AccordionTrigger` has no callback prop [S17].
- React Aria Components Tree: `expandedKeys`/`defaultExpandedKeys`/`onExpandedChange` on `Tree`
  through `useControlledState`. Items have no callback [S21][S22].
- React Aria `useTreeItem` chevron (`expandButtonProps`):
  - `onPress` toggles and focuses the row.
  - `excludeFromTabOrder: true`, `preventFocusOnPress: true`.
  - Ships a localized expand/collapse `aria-label` [S19].
- React Aria `PressEvent` stops native propagation by default; `continuePropagation()` opts out.
  So a chevron press never reaches the row [S20].
- Zag collapsible: the machine calls `onOpenChange({ open })` on open and on close, and
  `onExitComplete()` after the exit. Controlled mode calls the callback but blocks the
  transition [S23].
- Headless UI Disclosure: `defaultOpen` only. There is no controlled `open` and no change
  callback; state is exposed through render props [S24].
- Base UI Collapsible:
  `onOpenChange(open, eventDetails)` [S31].
  - `eventDetails` carries `reason` (`'trigger-press' | 'none'`), `event`, `trigger`, `cancel()`,
    `allowPropagation()`, `isCanceled` and `isPropagationAllowed` [S31].
  - `allowPropagation()` implies that Base UI stops propagation in some cases by default [S31].
- TanStack:
  - `onExpandedChange` is a **table** option, and supplying it makes the consumer own the state.
  - `row.getToggleExpandedHandler()` is a closure that checks `getCanExpand()` and calls
    `toggleExpanded()`.
  - No event handling, no per-row callback [S25].
- AG Grid `RowGroupOpenedEvent` carries `expanded`, `node`, and `event?: Event | null` —
  "Browser event if applicable". This is the gesture/source channel [S26].
- AG Grid group cell: `suppressDoubleClickExpand` and `suppressEnterExpand` are opt-**outs**, so
  double-click and Enter expand by default [S27].

### Q4 — store-owned state: is a trigger output redundant?

- @ngp/table directives declare no outputs today — no `output(`, `@Output` or `model(` under
  `libs/table/src` [R3].
- The tree toggle writes `table.tree.toggle(row.id)` directly. Its state is read back from
  `RenderRow.isExpanded` [R1].
- `TreeSlice` already exposes `changed: Observable<ExpansionChange>`: one emission per write,
  `{ added, removed }` [R7].
- `ExpansionWriteOptions.emitEvent: false` suppresses `changed` for restore or server-sync
  writes [R8]. The store already separates a silent write from a normal one, but it does not
  separate a user gesture from a programmatic call.
- In every peer where the trigger is separate from the state owner (ng-primitives, Radix, Zag,
  RAC Tree, TanStack, AG Grid), the trigger has no event and the owner emits
  [S1][S3][S17][S23][S21][S25][S26].
- The one per-item projection of a central model is CDK `CdkTreeNode.expandedChange`. It
  carries no more than the model's diff [S9].
- What an event carries that a signal cannot:
  - **Gesture/source:** AG Grid `event` [S26]; Base UI `reason` + `event` + `trigger` [S31];
    CDK `activation` [S9].
  - **Pre-write cancellation:** Radix `preventDefault` on the consumer's `onClick` [S16];
    Base UI `cancel()` [S31]; ng-primitives controlled-mode request semantics [S2].
  - **Animation completion:** Material `afterExpand`/`afterCollapse` [S11]; Zag
    `onExitComplete` [S23]. ng-primitives uses `data-enter`/`data-exit` attributes instead of
    an event [S1].

### Q5 — row-click-to-toggle inside the row primitive

- **React Aria (GridList/Tree item):** row press toggles only as a fallback —
  `if (onAction == null && !hasLink && selectionMode === 'none' && hasChildRows) onAction =
  () => state.toggleKey(node.key)`. A row that already has a job (selection, action, link) never
  toggles on press [S18].
- **@angular/aria tree:** an item click always toggles. There is no separate trigger button, so
  double-toggle cannot occur [S14].
- **AG Grid:**
  - Expand on row/cell is **double-click**, so single-click stays free for selection [S27].
  - `onCellDblClicked` skips when the expand/contract icon is in the event path [S28].
  - The icon's click marks the event with `_stopPropagationForAgGrid` rather than calling
    native `stopPropagation()`, so AG Grid's own handlers skip it while document listeners
    still receive it [S28][S29].
- **PrimeNG TreeTable:** the selection row-click handler returns early when the target is
  `INPUT`/`BUTTON`/`A`/clickable. The guard lives inside the row primitive, keyed on the target
  [S30].
- **CDK tree:** a row click only focuses; the toggle calls `stopPropagation()` [S9][S8].
- **React Aria chevron:** a press stops propagation by default [S20].
- **TanStack, Radix, ng-primitives, Headless UI:** no row concept. Whole-row toggling is
  consumer markup [S25][S15][S1][S24].
- **@ngp/table today:**
  - TR36 makes whole-row toggling a consumer `(click)` on the `<tr>` [R4].
  - TR44: the toggle neither prevents default nor stops propagation, and the consumer's
    handler skips clicks from inside the button [R4][R5].

## Comparison

Where each peer puts the change event, and how its trigger and row behave.

| Library@version | Change event on | Event carries gesture? | Cancel before write? | Trigger stops propagation? | Row press toggles? |
|---|---|---|---|---|---|
| ng-primitives@0.130.3 | state owner (root) [S1][S3] | no [S2] | controlled = request [S2] | no [S1] | n/a — no row [S1] |
| @angular/cdk@22.1.7 accordion | item = owner [S7] | no [S7] | no [S7] | no listener [S7] | n/a |
| @angular/cdk@22.1.7 tree | node (central-model diff) + `activation` [S9] | `activation` only [S10] | no [S9] | **yes** [S8] | no — focus only [S9] |
| @angular/material@22.1.7 panel | panel + `afterExpand/afterCollapse` [S11] | no [S11] | no [S11] | no [S11] | n/a |
| @angular/aria@22.2.1 tree | item `model()` [S13] | no [S13] | no [S14] | no toggle element [S13] | **yes, always** [S14] |
| Radix collapsible@1.1.20 / accordion@1.2.20 | root only [S15][S17] | no [S15] | `preventDefault` [S16] | no [S16] | n/a |
| react-aria@3.52.1 / RAC@1.21.1 | `Tree` root [S21] | no [S21] | no [S21] | **yes** by default [S20] | **fallback only** [S18] |
| Zag collapsible@1.44.0 | machine [S23] | no [S23] | controlled blocks [S23] | not read | n/a |
| Base UI@1.8.0 | root [S31] | **yes** — `reason`, `event` [S31] | **`cancel()`** [S31] | yes, opt-out [S31] | n/a |
| Headless UI@2.2.10 | none [S24] | — | — | not read | n/a |
| TanStack table-core@8.21.3 | table option [S25] | no [S25] | consumer-owned state [S25] | no [S25] | consumer [S25] |
| AG Grid@36.2.0 | grid event [S26] | **yes** — `event` [S26] | not read | marker only [S29] | **double-click**, icon-guarded [S27][S28] |
| @ngp/table (main) | store `changed` [R7] | no [R7] | no [R1] | no (TR44) [R4] | consumer recipe [R5] |

## Synthesis

**Responsibility framework, by where peers converge.**

- **Owns, no API (all converge).** These are on every headless trigger peer
  [S1][S12][S19][S11]. CDK accordion is the lone outlier that binds no ARIA [S7].
  - ARIA state on the trigger (`aria-expanded`, `aria-controls`).
  - Native activation through the `<button>`.
  - `data-*` state hooks.
  - Disabled semantics.
  - @ngp/table already matches this [R1][R2][R6].
- **Owns, with API — the API attaches to the state owner.** This is the real ng-primitives line:
  - Behavior is fine inside a primitive (`beforematch`, enter/exit, toggling) [S1].
  - *Outputs* appear only where `controlledState` lives [S1][S3].
  - @ngp/table's owner is the store. The analog of `ngpAccordionValueChange` is
    `table.tree.changed`, which already exists [R7].
- **Must not own (converge).**
  - Styling — every library here [S5][R6].
  - DOM structure — @ngp/table's attribute-only invariant [R12]. Peers that render
    (Material, RAC) differ by design.
- **Text is NOT a convergence point.** React Aria ships a localized expand/collapse label on the
  chevron [S19]. ADR-0029 (on #199's branch) moves @ngp/table to "generic default label, no dev
  warning" [R11]. That conflicts with TR39's "no library text + dev warning" [R4]. The brief's
  "must not own text" no longer holds once ADR-0029 merges.

**Where peers disagree — and so where the decision actually is.**

- **Propagation.** Three approaches:
  - Stop it: CDK tree [S8], React Aria [S20], Base UI with opt-out [S31].
  - Leave it: Radix [S16], Material [S11], TanStack [S25], ng-primitives [S1], TR44 [R4].
  - Mark-not-stop: AG Grid [S29].
  The stoppers are exactly the libraries that also put behavior on the row: React Aria's
  fallback, CDK's focus-on-click. Stopping is what makes a row listener safe. AG Grid gets the
  same safety without breaking TR44's "other listeners still receive it".
- **Row press.** Three collision strategies:
  - Toggle only when the row has no other job — React Aria [S18].
  - A different gesture, plus an icon-path guard — AG Grid [S27][S28].
  - No separate trigger at all — @angular/aria [S14].
  None of the three is a bare `toggleOnRowClick` boolean. Each encodes which job wins.
- **Event payload.** Most peers emit the bare value. Only AG Grid and Base UI carry gesture
  [S26][S31]. Only Radix and Base UI let the consumer cancel the library's write
  [S16][S31].

**Candidate (a) — outputs on `ngpTableTreeToggle` / `ngpTablePanelToggle`.**

- **As a mirror of state** (`expandedChange(boolean)`): it would duplicate `table.tree.changed`
  scoped to one row. The only precedent is CDK `CdkTreeNode.expandedChange` [S9].
  - It fires only for clicks on this button. Programmatic `expand()`, `collapse()`, `set()`,
    row-click and filter reveal would not emit. Subscribers would see a partial stream.
  - That partial-stream gap does not exist in any owner-placed peer [S7][S9]. CDK's per-node
    event avoids it by projecting the central diff, not the click.
- **As a gesture event** (`{ event, row }`, AG Grid / Base UI style [S26][S31]): it carries
  something `changed` can't. An `ngpTableRow`-level or table-level event would cover row-click
  as well.
- **As a cancelable request:** needs a pre-write hook. The Radix-style alternative needs no new
  API: the toggle skips its write when `event.defaultPrevented` is already true [S16].
- **For the panel:** the open set lives in `table.expansion` [R10]. An `opened`/`closed` pair
  would mirror it. The non-redundant event is **leave-complete** (Material
  `afterCollapse` [S11] / Zag `onExitComplete` [S23]), and that belongs on `ngpTablePanel`,
  which already owns the leave via `DestroyRef` [R9].
- **Reopens:**
  - TR33's "toggle = `table.tree.toggle()`" contract, only if the write becomes cancelable.
  - TR44, only if it adopts a `defaultPrevented` check. That check reads the event; it does not
    change propagation.
  - Not D4/TR36.
  - Not ADR-0026: outputs are not styling.
  - The locked invariant "state lives in the store's signals" [R12] is strained by the mirror
    variant only.

**Candidate (b) — opt-in whole-row click + guard inside `ngpTableTreeRow`.**

- **Reopens TR36** (whole-row toggling is consumer `(click)`) and **TR44**: the guard moves
  inside. TR44's no-`stopPropagation` half survives if the guard is AG Grid's marker or
  event-path check [S28][S29]. It does not survive if it copies CDK or React Aria [S8][S20].
- **Does not reopen D4.** The button stays the only keyboard and AT trigger, and the row still
  carries no `aria-expanded` (TR34).
- **Does not reopen ADR-0026** unless it adds a `data-*` hook.
- **Collision with a future selection row-click** is the open design point:
  - React Aria resolves it with cross-feature knowledge — "selectionMode none" [S18]. That
    cuts against E37's "no feature reads another's state" [R10].
  - AG Grid resolves it with a different gesture [S27].
  - PrimeNG puts the target guard on the *selection* side [S30].
- **Trajectory.** ADR-0029 cat. 5 / E43 / #201 already move row-level expansion behavior
  (→/← keys) onto the row directives [R11][R10]. Row-owned *pointer* expansion would sit beside
  row-owned *keyboard* expansion. Today the row directive owns neither.

## Against

- Leaving everything to the consumer is the majority headless position for anything outside the
  trigger: Radix, TanStack, Headless UI and ng-primitives ship no row behavior at all
  [S15][S25][S24][S1].
- ADR-0029's stance argues the other way, but only for a11y. Whole-row click is mouse-only and
  not an a11y obligation [R11].
- The store-level `changed` already covers "react to expansion" for every write path [R7]. Any
  directive output is strictly narrower. Adding one teaches consumers a second, incomplete
  channel.

## Not researched

- MUI X / Material React Table row-click expand and `detailPanelExpandedRowIdsChange`.
- Ark UI wrappers (Zag was read directly).
- Spartan/Taiga Angular libraries.
- APG treegrid guidance on row activation versus expansion.
- PrimeNG `TreeTableToggler` internals (fetch truncated; see Unverified).

## Unverified

- PrimeNG `onNodeExpand`/`onNodeCollapse` payload, and whether its toggler stops propagation.
  The bundle fetch truncated before the toggler class. Confirm with a direct read of
  `primeng@22.1.2/fesm2022/primeng-treetable.mjs`.
- Zag trigger propagation and `defaultPrevented` handling (`collapsible.connect.mjs` not read).
- Base UI's default stop-propagation cases are inferred from `allowPropagation()`'s doc text
  [S31]. No source was read.
- AG Grid `rowGroupOpened` cancellation: no cancel field in the type [S26]. Whether any
  pre-expand hook exists (e.g. `isGroupOpenByDefault` is not a gesture hook) was not checked.
- React Aria docs claim expansion "only via chevron". This is a summary of the docs page,
  contradicted by `useGridListItem` source [S18]. Trust the source.

## Sources

| | Source | Version | Verified |
|---|---|---|---|
| S1 | `C:/Users/dmena/git/ng-table/node_modules/ng-primitives/fesm2022/ng-primitives-collapsible.mjs` | 0.130.3 | yes — source read; showed the "no behavior" framing wrong (beforematch, enter/exit, inline size vars) |
| S2 | `C:/Users/dmena/git/ng-table/node_modules/ng-primitives/fesm2022/ng-primitives-state.mjs` (`controlledState`, l.182-214) | 0.130.3 | yes — source read; output = request in controlled mode |
| S3 | `C:/Users/dmena/git/ng-table/node_modules/ng-primitives/fesm2022/ng-primitives-accordion.mjs` | 0.130.3 | yes — source read; only root declares outputs |
| S4 | `C:/Users/dmena/git/ng-table/node_modules/ng-primitives/fesm2022/ng-primitives-toggle.mjs` | 0.130.3 | yes — grep |
| S5 | https://angularprimitives.com/getting-started/introduction | unversioned | yes — page fetch |
| S6 | https://registry.npmjs.org/ng-primitives/latest | 0.131.1 | yes — registry |
| S7 | `C:/Users/dmena/git/ng-table/node_modules/@angular/cdk/fesm2022/accordion.mjs` (l.80-188) | 22.1.7 | yes — source read |
| S8 | `C:/Users/dmena/git/ng-table/node_modules/@angular/cdk/fesm2022/tree.mjs` (`CdkTreeNodeToggle`, l.1430-1481) | 22.1.7 | yes — source read; toggle stops propagation |
| S9 | `C:/Users/dmena/git/ng-table/node_modules/@angular/cdk/fesm2022/tree.mjs` (`CdkTreeNode`, l.927-1126; `_emitExpansionState` l.378-385) | 22.1.7 | yes — source read |
| S10 | `C:/Users/dmena/git/ng-table/node_modules/@angular/cdk/fesm2022/_tree-key-manager-chunk.mjs` (l.96-98, 254) | 22.1.7 | yes — grep |
| S11 | https://unpkg.com/@angular/material@22.1.7/fesm2022/expansion.mjs | 22.1.7 | yes — bundle fetch |
| S12 | https://unpkg.com/@angular/aria@22.2.1/fesm2022/accordion.mjs | 22.2.1 | yes — bundle fetch |
| S13 | https://unpkg.com/@angular/aria@22.2.1/fesm2022/tree.mjs | 22.2.1 | yes — bundle fetch |
| S14 | https://unpkg.com/@angular/aria@22.2.1/fesm2022/_tree-chunk.mjs (`goto`) | 22.2.1 | yes — bundle fetch |
| S15 | https://unpkg.com/@radix-ui/react-collapsible@1.1.20/dist/index.mjs | 1.1.20 | yes — bundle fetch |
| S16 | https://unpkg.com/@radix-ui/primitive@1.1.7/dist/index.mjs (`composeEventHandlers`) | 1.1.7 | yes — bundle fetch |
| S17 | https://unpkg.com/@radix-ui/react-accordion@1.2.20/dist/index.mjs | 1.2.20 | yes — bundle fetch |
| S18 | https://unpkg.com/react-aria@3.52.1/dist/private/gridlist/useGridListItem.mjs | 3.52.1 | yes — bundle fetch; overturned the docs-page summary |
| S19 | https://unpkg.com/react-aria@3.52.1/dist/private/tree/useTreeItem.mjs (`expandButtonProps`) | 3.52.1 | yes — bundle fetch |
| S20 | https://unpkg.com/react-aria@3.52.1/dist/private/interactions/usePress.mjs (`continuePropagation`) | 3.52.1 | yes — bundle fetch |
| S21 | https://unpkg.com/react-aria-components@1.21.1/dist/private/Tree.mjs | 1.21.1 | yes — bundle fetch |
| S22 | https://react-aria.adobe.com/Tree | unversioned | partly — prop descriptions only; row-press summary rejected |
| S23 | https://unpkg.com/@zag-js/collapsible@1.44.0/dist/collapsible.machine.mjs | 1.44.0 | yes — bundle fetch |
| S24 | https://unpkg.com/@headlessui/react@2.2.10/dist/components/disclosure/disclosure.js | 2.2.10 | yes — minified bundle fetch |
| S25 | https://unpkg.com/@tanstack/table-core@8.21.3/src/features/RowExpanding.ts | 8.21.3 | yes — source read (v8; registry latest is v9) |
| S26 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/events.d.ts (`RowGroupOpenedEvent`) | 36.2.0 | yes — types read |
| S27 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/interfaces/groupCellRenderer.d.ts | 36.2.0 | yes — types read |
| S28 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-enterprise/src/rowHierarchy/rendering/groupCellRendererCtrl.ts | b36.2.0 | yes — source read (community path 404s; lives in enterprise) |
| S29 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/utils/gridEvent.ts | b36.2.0 | yes — source read; marker, not native stop |
| S30 | https://unpkg.com/primeng@22.1.2/fesm2022/primeng-treetable.mjs (`handleRowClick`) | 22.1.2 | partly — row guard read; toggler truncated |
| S31 | https://base-ui.com/react/components/collapsible | 1.8.0 | yes — docs page (version on page) |
| S32 | https://registry.npmjs.org/@angular/aria/latest | 22.2.1 | yes — registry |
| R1 | `libs/table/src/directives/ngp-table-tree-toggle.directive.ts` | main (feat-189 wt) | yes — read |
| R2 | `libs/table/src/directives/ngp-table-tree-row.directive.ts` | main (feat-189 wt) | yes — read |
| R3 | grep `output\(\|@Output\|model\(` over `libs/table/src` | main (feat-189 wt) | yes — 0 hits |
| R4 | `libs/table/docs/decisions/tree.md` TR33-TR46 (l.84-97) | main (feat-189 wt) | yes — read |
| R5 | `libs/table/docs/3-ui/directives/tree.md` "Whole-row click" (l.95-113) | main (feat-189 wt) | yes — read |
| R6 | `libs/table/docs/adr/0026-headless-styling-contract.md` Decision 1-6 | main (feat-189 wt) | yes — read |
| R7 | `libs/table/src/api/features/with-tree/types.ts` `TreeSlice.changed` (l.31-34) | main (feat-189 wt) | yes — read |
| R8 | `libs/table/src/api/features/expansion/state.ts` `ExpansionWriteOptions`, `ExpansionChange` (l.12-29) | main (feat-189 wt) | yes — read |
| R9 | `.claude/worktrees/docs-panel-directives/libs/table/docs/3-ui/work/expansion/active/panel-directives/1-decisions.md` D1-D4 | #199 wt | yes — read |
| R10 | `.claude/worktrees/docs-panel-directives/libs/table/docs/decisions/expansion.md` E37, E41, E43-E47 | #199 wt | yes — read |
| R11 | `.claude/worktrees/docs-panel-directives/libs/table/docs/adr/0029-directives-own-accessibility.md` | #199 wt | yes — read; not on main |
| R12 | `libs/table/CLAUDE.md` "Locked invariants" | main (feat-189 wt) | yes — read |
