# How do ng-primitives and Angular CDK return focus when a region holding focus closes, hides or is destroyed?

**Date:** 2026-10-01 · **Depth:** standard

## Answer

- **No surveyed library returns focus for an inline disclosure / collapsible / accordion.**
  Focus return exists only on overlays (dialog, menu, popover) and focus traps. The panel's
  requirement goes beyond every reference library and beyond APG
  disclosure. [S1][S2][S12][S14][S15][S18][S19]
- **Everyone who does it uses the same two triggers, never an effect.** (1) A teardown hook
  (`ngOnDestroy`, React cleanup). (2) The library's own close method, called before the
  content is removed. Neither reacts to a state signal. [S3][S6][S9][S10][S11][S16][S17]
- **The guard to copy is CDK Dialog's.** It restores only when `activeElement` is null,
  `<body>`, the container, or inside the container. The `<body>` arm covers the Safari
  click-does-not-focus case and the case where the node is already removed. Restore goes
  through `FocusMonitor.focusVia(target, origin)`. [S10][S13]
- **For #199 (see Synthesis):** put one `returnFocusIfInside(origin)` behind the CDK predicate.
  Call it from the paths the panel owns: the Esc listener and `DestroyRef.onDestroy`.
  A collapse from a writer the panel does not own (the table API, a consumer's ×) has no
  close-method hook. That gap is ng-table-specific: the libraries never meet it, because
  they always own the writer.

## Method

- Versions pinned:
  - `ng-primitives@0.130.3`, `@angular/cdk@22.1.7` and `@angular/core@22.1.2`: from
    `node_modules/*/package.json`. The repo `package.json` has `ng-primitives ^0.130.1` and
    `@angular/core 22.1.2`.
  - `@angular/aria@22.1.7`: chosen to match the installed CDK. Registry latest is `22.2.1`.
  - `react-aria@3.52.1`: from the existing anchor.
  - `@radix-ui/react-focus-scope@1.1.16` and `@radix-ui/react-collapsible@1.1.20`: registry
    latest.
- How sources were read:
  - ng-primitives, CDK and core: local `fesm2022/*.mjs`, grep plus read. These are published
    artifacts, not `main`.
  - `@angular/aria`, react-aria and Radix: WebFetch of pinned `unpkg.com` files. The model
    summarised these, so the quotes are exact only where they appear in a code fence in its
    answer.
  - All read 2026-10-01.
- Line numbers point into the local bundles. They are stable for this version only.

## Evidence

**ng-primitives 0.130.3**

- The collapsible content has no focus code. It binds `hidden="until-found"` only once the
  measured height reaches 0, and drives `data-enter`/`data-exit` from an `explicitEffect` on
  `open`. [S1]
- The accordion composes the collapsible content engine and adds no focus handling. [S2]
- The overlay restores focus inside `hide()`'s `dispose`, **before** `destroyOverlay()`. It
  calls `focusMonitor.focusVia(triggerElement, origin)`, gated by `config.restoreFocus`
  (a boolean or a function). There is no check of where focus currently is. [S3]
- Popover passes `restoreFocus: true`. [S4] Menu passes
  `computed(() => openOrigin()==='keyboard' || closeOrigin()==='keyboard')`. Submenus pass
  `false` and focus their trigger explicitly from the arrow-key handler. [S5]
- Navigation menu sets `restoreFocus: false` ("We handle focus restoration ourselves"). It
  hands focus back only on a keyboard close, from the keydown handler. [S8]
- Dialog captures `document.activeElement` in `open()`. It restores on `afterClosed$`, which
  fires after the exit animation and the portal detach. The guard is
  `activeElement instanceof HTMLElement && body.contains(activeElement)`. The origin falls
  back to `focusMonitor._lastFocusOrigin`. [S6]
- The focus trap **never restores focus**. It tears down on `overlay.closing` rather than on
  destroy. Its MutationObserver refocuses the container when focus has fallen to `<body>`
  after a removal. It re-arms through `explicitEffect([overlay.isOpen])`. [S7]

**Angular CDK 22.1.7**

- `CdkTrapFocus` captures focus only when `cdkTrapFocusAutoCapture` is set: in
  `ngAfterContentInit`, or in `ngOnChanges` when the flag flips. It then calls
  `_previouslyFocusedElement.focus()` in `ngOnDestroy`. The call is unconditional, a plain
  `.focus()`, and does not use FocusMonitor. [S9]
- `CdkDialogContainer` captures `_elementFocusedBeforeDialogWasOpened` when the content
  attaches, and runs `_restoreFocus()` in `ngOnDestroy`. `restoreFocus` accepts a boolean, a
  selector string or an element, and defaults to `true`. [S10]
- The `_restoreFocus` predicate, verbatim: [S10]

```js
if (!activeElement || activeElement === this._document.body ||
    activeElement === element || element.contains(activeElement)) {
  this._focusMonitor.focusVia(focusTargetElement, this._closeInteractionType);
```

- `DialogRef.close(result, {focusOrigin})` stores the origin as `_closeInteractionType`
  before `overlayRef.dispose()`. That is how the destroy-time restore learns the close
  origin. [S10]
- `CdkMenu` carries close intent as data. Escape, Tab and item activation call
  `menuStack.close/closeAll({ focusParentTrigger: true })`. The root trigger subscribes to
  `menuStack.closed` and calls `.focus()` when `focusParentTrigger` is set. An outside click
  does not set the flag. [S11]
- `CdkAccordionItem` has no focus code: `close()` only toggles `expanded`. [S12]
- `FocusMonitor.focusVia(element, origin, options)` is public. It is the API both CDK and
  ng-primitives use for focus restore, so the focus-visible origin carries over. [S13]

**@angular/aria 22.1.7**

- `AccordionPanel` binds `[attr.inert]="!visible() ? true : null"`. That is the same shape as
  D4. [S14]
- The pattern's `close()` calls `expansionBehavior.close(this)` and contains no focus code. [S15]

**Non-Angular**

- React Aria `FocusScope restoreFocus` captures `nodeToRestore` during render. The cleanup of
  its `useLayoutEffect` restores only if `activeElement` is inside the scope, or is `<body>`
  and `shouldRestoreFocus(scope)`. The restore itself is deferred with
  `requestAnimationFrame`. [S16]
- Radix `FocusScope` captures `document.activeElement` in a `useEffect`. Unmount cleanup
  dispatches a cancelable `focusScope.autoFocusOnUnmount` event (this is how `Dialog`
  implements `onCloseAutoFocus`). If the event is not prevented it calls
  `focus(previouslyFocusedElement ?? body)` inside `setTimeout(0)`. There is no check of
  where focus currently is. [S17]
- Radix Collapsible has no focus code. It uses `hidden` and `Presence`. [S18]
- APG disclosure defines only Enter and Space. It specifies no Escape and no focus movement. [S19]

**Platform / Angular core**

- A focused element that becomes `inert` loses focus to `<body>` only after a rendering
  update. The WPT test waits two rAFs (`nextRepaint()`) before asserting
  `activeElement === body`. It does not assert that `blur` or `focusout` fire. [S20]
- `removeLViewFromLContainer` runs `detachView` (which calls `removeViewFromDOM`) **before**
  `destroyLView` (which runs the onDestroy hooks). Without a leave animation, the node is
  already disconnected when `DestroyRef.onDestroy` runs. [S21]

## Comparison

| Library / unit                        | Inline region? | Trigger for restore                              | Angular / JS mechanism                   | Checks where focus is?        | Source       |
| ------------------------------------- | -------------- | ------------------------------------------------ | ---------------------------------------- | ----------------------------- | ------------ |
| ng-primitives collapsible / accordion | yes            | — none                                           | —                                        | —                             | [S1][S2]     |
| ng-primitives overlay (popover, menu) | no             | `hide()` → before `destroyOverlay`               | imperative call + `focusVia`             | no                            | [S3][S4][S5] |
| ng-primitives dialog                  | no             | `afterClosed$` (after exit animation and detach) | RxJS subscription + `focusVia`           | only `body.contains(trigger)` | [S6]         |
| ng-primitives focus trap              | —              | never restores                                   | `onDestroy` / `overlay.closing` teardown | —                             | [S7]         |
| CDK `cdkTrapFocus` + autoCapture      | either         | `ngOnDestroy`                                    | `.focus()`                               | no                            | [S9]         |
| CDK Dialog                            | no             | `ngOnDestroy` of the container                   | `focusVia(target, closeOrigin)`          | **yes, inside / body / null** | [S10]        |
| CDK Menu                              | no             | `menuStack.closed` with `focusParentTrigger`     | Rx subscription + `.focus()`             | no; intent flag instead       | [S11]        |
| CDK Accordion                         | yes            | — none                                           | —                                        | —                             | [S12]        |
| @angular/aria Accordion               | yes            | — none (`[attr.inert]` only)                     | —                                        | —                             | [S14][S15]   |
| React Aria FocusScope                 | either         | layout-effect cleanup, then rAF                  | `.focus()`                               | **yes, inside / body**        | [S16]        |
| Radix FocusScope                      | either         | effect cleanup, then `setTimeout(0)`             | cancelable event + `.focus()`            | no                            | [S17]        |
| Radix Collapsible                     | yes            | — none                                           | —                                        | —                             | [S18]        |

## Synthesis

- **Timing.** The libraries disagree, and it does not matter for them:
  - ng-primitives' overlay restores before the DOM leaves [S3].
  - CDK Dialog restores in `ngOnDestroy`, possibly after removal; the `<body>` arm absorbs
    that [S10][S21].
  - React Aria and Radix defer to the next frame or task [S16][S17].
  - Takeaway: the predicate, not the moment, makes it correct. The CDK predicate is
    insensitive to whether focus has already fallen to `<body>`.
- **Guard vs. no guard.** ng-primitives, Radix and `cdkTrapFocus` restore unconditionally,
  because closing a modal or popover always strands focus [S3][S9][S17]. CDK Dialog and
  React Aria check, because focus may already have moved on legitimately [S10][S16]. An
  inline panel is the second case: the user can Tab out and collapse it from elsewhere. So
  the guard is required.
- **Owning the writer.** Every restore path hangs off a close the library itself performs:
  its own `hide()`, `close()`, dispose or unmount. ng-table differs. Open state lives in
  `table.expansion`, so `collapse([id])` can come from code the panel never sees. This is
  the real reason an effect got proposed. It is not a pattern the references show.
- **Effects in the references.** ng-primitives does react to open→closed through
  `explicitEffect`: collapsible `data-exit` [S1], focus-trap re-arm [S7]. So
  "an effect on open state" has precedent in the reference library, but only for attributes
  and arming, never for moving focus.
- **What fits #199, built from the parts above:**
  1. One function per panel: `returnFocusIfInside(origin)`. It applies CDK's predicate to the
     panel host and calls `focusMonitor.focusVia(registry.toggleOf(id), origin)` only when
     the toggle is still connected (D5). [S10][S13]
  2. Esc listener: call it right after `table.expansion.collapse([id])`, with origin
     `'keyboard'`. This mirrors ng-primitives `hide()` and CDK Menu Escape. [S3][S11]
  3. `DestroyRef.onDestroy`: call it before the `inert` write (D4 already orders it this
     way). This mirrors CDK Dialog and `cdkTrapFocus`. [S9][S10]
  4. In-panel ×: expose a panel-owned `close()` on the directive (`exportAs`), so the × goes
     through step 2's path. CDK Menu does the same by carrying close intent from the
     activated item. [S11] The click on × in Safari leaves focus on `<body>`, which the
     predicate's `<body>` arm covers. [S10]
  5. A collapse from an external writer while the panel stays mounted is the one path no
     reference covers. Options:
     - leave it uncovered (CDK Menu also returns focus only on intent [S11]); or
     - add an open→closed reaction. The only precedent for its shape is ng-primitives'
       `explicitEffect` [S1][S7], never used for focus.
       Ask the user which; do not invent it.

## Against

- **The effect reading.** ng-primitives itself uses `explicitEffect([open])` to react to
  open-state transitions on the collapsible [S1]. "An effect is a smell" is stronger than the
  reference library's own practice for _non-focus_ reactions to state it does not write.
- **Leaving step 5 uncovered.** A table-level `collapseAll()` while focus is inside a kept-mounted
  panel strands focus on `<body>` after the next render [S20]. No reference library has to
  answer this, so none can be cited for leaving it.

## Not researched

- The `@angular/material` expansion panel and `MatMenu`. These are CDK-derived and were not
  opened.
- Base UI, Headless UI and Ark/Zag collapsibles.
- `@angular/aria` menu, combobox and tabs focus behavior. Only accordion was read.
- ng-primitives `interactions` (`ngpFocus`, `ngpFocusVisible`). Grep shows they use
  `FocusMonitor` for state, not for return. The bodies were not read.

## Unverified

- **Timing of the effect.** "An effect, or `afterNextRender`, after the `[inert]` binding
  lands, still sees `activeElement` inside the panel." This is an inference from S20
  (focus is fixed up only at the rendering update), not a test. Pin it with a spec if any
  path relies on it. Whether Angular's tick runs inside a rAF before the fix-up is also
  unconfirmed.
- **No blur/focusout on inert.** S20 does not assert either event. WebKit/Firefox behaviour
  was not read, so a `focusout`-based design is unsupported, not disproven.
- **The spec text.** The WHATWG "focus fixup rule" was not read: WebFetch truncated
  `interaction.html`. S22 is a search pointer only. Reading the rule in the `whatwg/html`
  source would confirm it.
- **The animation case.** "With `animate.leave` the host stays connected during
  `onDestroy`" rests on the repo's D4 verification, not on this run. S21 shows only the
  order without animations.
- **The external-writer gap.** Step 5 is a gap that exists only because of ng-table's design
  (state owned by the table); no reference library documents it.

## Sources

|     | Source                                                                                                           | Version           | Verified                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| S1  | `node_modules/ng-primitives/fesm2022/ng-primitives-collapsible.mjs:188-279`                                      | 0.130.3           | yes — read; no focus code; `hidden` gated on height 0                                          |
| S2  | `node_modules/ng-primitives/fesm2022/ng-primitives-accordion.mjs:11`                                             | 0.130.3           | yes — grep; composes collapsible engine, no focus hits                                         |
| S3  | `node_modules/ng-primitives/fesm2022/ng-primitives-portal.mjs:1475-1526`                                         | 0.130.3           | yes — read; restore runs before `destroyOverlay`, unguarded                                    |
| S4  | `node_modules/ng-primitives/fesm2022/ng-primitives-popover.mjs:145`                                              | 0.130.3           | yes — read                                                                                     |
| S5  | `node_modules/ng-primitives/fesm2022/ng-primitives-menu.mjs:128`                                                 | 0.130.3           | yes — read; also lines 336, 463-469, 640-655, 921-924                                          |
| S6  | `node_modules/ng-primitives/fesm2022/ng-primitives-dialog.mjs:427-503`                                           | 0.130.3           | yes — read; also `close()` at 124-146 (restore after exit animation)                           |
| S7  | `node_modules/ng-primitives/fesm2022/ng-primitives-focus-trap.mjs:73-314`                                        | 0.130.3           | yes — read; corrected the assumption that the trap restores focus — it does not                |
| S8  | `node_modules/ng-primitives/fesm2022/ng-primitives-navigation-menu.mjs:344`                                      | 0.130.3           | yes — read; also `close()` at 518-524                                                          |
| S9  | `node_modules/@angular/cdk/fesm2022/_a11y-module-chunk.mjs:375-422`                                              | 22.1.7            | yes — read; restore is unguarded `.focus()`, not `focusVia`                                    |
| S10 | `node_modules/@angular/cdk/fesm2022/dialog.mjs:58-244`                                                           | 22.1.7            | yes — read; also `close()` at 380-387                                                          |
| S11 | `node_modules/@angular/cdk/fesm2022/menu.mjs:756-764`                                                            | 22.1.7            | yes — read; also 1234-1251, 1408-1421, 911-923                                                 |
| S12 | `node_modules/@angular/cdk/fesm2022/accordion.mjs:86-144`                                                        | 22.1.7            | yes — grep; no focus code                                                                      |
| S13 | `node_modules/@angular/cdk/fesm2022/_focus-monitor-chunk.mjs:183`                                                | 22.1.7            | yes — read signature                                                                           |
| S14 | https://unpkg.com/@angular/aria@22.1.7/fesm2022/accordion.mjs                                                    | 22.1.7            | yes — WebFetch; `[attr.inert]`, no focus return                                                |
| S15 | https://unpkg.com/@angular/aria@22.1.7/fesm2022/_accordion-chunk.mjs                                             | 22.1.7            | yes — WebFetch; `close()` has no focus code                                                    |
| S16 | https://unpkg.com/react-aria@3.52.1/dist/private/focus/FocusScope.mjs                                            | 3.52.1            | yes — WebFetch; the first summary was vague, a second read gave the cleanup predicate verbatim |
| S17 | https://unpkg.com/@radix-ui/react-focus-scope@1.1.16/dist/index.mjs                                              | 1.1.16            | yes — WebFetch; unmount restore is unguarded, `setTimeout(0)`                                  |
| S18 | https://unpkg.com/@radix-ui/react-collapsible@1.1.20/dist/index.mjs                                              | 1.1.20            | yes — WebFetch; no focus code                                                                  |
| S19 | https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/                                                             | —                 | yes — page read                                                                                |
| S20 | https://searchfox.org/firefox-main/source/testing/web-platform/tests/inert/dynamic-inert-on-focused-element.html | unpinned (`main`) | yes — test read                                                                                |
| S21 | `node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:4773-4795`                                            | 22.1.2            | yes — read; also 6271-6300                                                                     |
| S22 | WebSearch "focus fixup rule inert" (WHATWG summary)                                                              | —                 | no — search summary only                                                                       |
