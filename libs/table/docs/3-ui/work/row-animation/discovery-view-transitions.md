# Can the View Transitions API replace our Web Animations FLIP for row-reorder animation in an Angular table library, and should it?

**Date:** 2026-09-23 · **Depth:** standard

## Answer

**The question assumes the directive can start the transition. It can't.** A view transition has
to be started *before* the state write, because the browser captures the old state at the next
rendering update [S6][S7]. `ngpTableRowAnimation` only watches `renderRows()` and reacts after
Angular has already changed the DOM [R1]. And the writes come from many places the library does not
own: sort toggles, grouping, row edits, and the consumer's own `data` signal [R3]. So the only way
to use View Transitions is for every write site to wrap its own write. That breaks the spec's rule
that any `renderRows()` reshuffle animates, whatever caused it [R3].

**Should it: no, keep WAAPI FLIP.** On the requirements it does worse or no better:

- It blocks interaction page-wide.
- Only one transition can run per document, so it fights `withViewTransitions()` [S4][S8][S9].
- A row removed by `animate.leave` part-way through skips the whole transition [S10].
- It is not clipped by scroll containers [S11][S13].
- The version that fixes most of this, element-scoped, ships only in Chromium 147 [S3].

**Revisit when** element-scoped view transitions (`Element.startViewTransition`) are Baseline, and
the library owns a single seam where writes happen. The cheap win today is in FLIP itself: measure
with `getBoundingClientRect()` so the interruption jump goes away [S21][R1].

## Method

- **Versions pinned:**
  - `@angular/core@22.1.2` and `@angular/router@22.1.2`, from the installed bundles (the
    `version: "22.1.2"` fields in `_router-chunk.mjs`). Read locally, with line numbers.
  - `@mdn/browser-compat-data@8.1.2` and `web-features@3.39.0`, both registry latest on
    2026-09-23, read as raw files at their tags.
  - `react@19.3.0` and `@formkit/auto-animate@0.10.0`: registry latest, read on unpkg.
- **Browser support:** web-features `.yml.dist` at tag `v3.39.0`, plus `api.webstatus.dev`, which
  gives dates. Where they overlap they agree. Element-scoped view transitions have no
  `.yml.dist` file at the tag (two guessed names returned 404), so that row comes from webstatus
  only.
- **Spec:**
  - The W3C TR is the 2024-03-28 Candidate Recommendation Draft (CRD), and WebFetch truncates it
    at §7.7.
  - The Editor's Draft page (dated 2025-02-16) was used for the method steps.
  - The frame algorithms (§7.8 and §7.9) came from `csswg-drafts` `main` `Overview.bs`, which is
    **unpinned**.
- **Reliability:**
  - react.dev's `<ViewTransition>` page says "canary", but the published `react@19.3.0` exports
    `ViewTransition` as stable [S16][S17]. Where they disagree, this doc follows the published
    package.
  - Chrome's nested-groups page lists Safari and Firefox as unsupported. BCD 8.1.2 agrees [S13][S14].
- Repo files were read at `main` on 2026-09-23. Nothing was built or run.

## Evidence

**1. Browser support**

- Same-document view transitions (`document.startViewTransition`, `view-transition-name`, the
  `::view-transition-*` pseudo-elements): **Baseline newly available since 2025-10-14**. Chrome/Edge
  111, Firefox 144, Safari 18 [S1][S2]
- `view-transition-class`: Baseline newly available since 2025-10-14. Chrome 125, Firefox 144,
  Safari 18.2 [S2][S15]
- `view-transition-name: match-element`: Chrome 137, Firefox 144, Safari 18.4 [S12]
- `startViewTransition({ update, types })`, the options form: Chrome 125, Firefox 147, Safari 18.2 [S1]
- **Element-scoped view transitions** (`Element.startViewTransition`): **limited availability**.
  Only Chrome/Edge 147, since 2026-04-07. MDN marks it experimental [S2][S3][S5]
- `view-transition-group` (nested groups, which bring clipping back): only Chrome 140. Firefox and
  Safari have `false` [S13][S14]
- For comparison, Web Animations is **Baseline widely available** (low 2020-09-16, high
  2023-03-16) [S2]

**2. Angular integration**

- Angular core ships **no** View Transitions API. `startViewTransition` and `viewTransition` do not
  appear anywhere in `@angular/core@22.1.2/fesm2022` [R4]
- The router is the only user. `createViewTransition` calls
  `document.startViewTransition(() => createRenderPromise(injector))`. That promise resolves from
  `afterNextRender({ read: () => setTimeout(resolve) })` [R5]
- The router skips the transition when `!document.startViewTransition` or when
  `skipNextTransition` is set, and logs rejections only in dev mode [R5]
- `withViewTransitions()` is `@developerPreview 19.0`, and `ViewTransitionsFeatureOptions` is
  `@developerPreview 20.0` [R6]
- The only feature request for view transitions outside the router, angular/angular#55829
  ("on-site" transitions such as sorting lists), was **closed as not planned** on the day it was
  opened (2024-05-16) [S18]
- The team's answer there (atscott): "call that directly yourself, make updates to application
  state, and return a promise that resolves with `afterNextRender`". It also pointed at scoped
  transitions [S18]
- `ApplicationRef.tick()` is synchronous. In one `synchronizeOnce` pass it runs root effects, then
  view refresh, then `afterRenderManager.execute()`. If it is re-entered it throws
  `ApplicationRef.tick is called recursively` [R7]
- `refreshView` reconciles `@for` **before** it runs view effects. The `animate.enter`/`leave`
  classes go in through an `afterNextRender` queue in that same tick [S19]
- **So any Angular hook sees the DOM only after it has changed.** `startViewTransition` captures the
  old state later still, at the next rendering update [R7][S7]
- Spec method steps: create the transition, reject if the document is hidden, **skip any active
  transition with `AbortError`**, set this one active, return. Capture happens later, in "perform
  pending transition operations" during update-the-rendering [S7]
- The callback must update the DOM or return a promise. A rejected promise abandons the transition
  [S6]
- While the callback is pending, rendering is suppressed and "all pointer hit testing must target
  its document element" [S8]

**3. Fit with the table**

- `view-transition-name` "applies to all elements", `<tr>` included. A non-`none` value makes the
  element a stacking context and a backdrop root [S9]
- An element is left out of capture if it has more than one box fragment, is not rendered, or sits
  under an ancestor that skips its contents [S9]
- A custom-ident name must be unique among rendered elements. A duplicate rejects `ready` and skips
  the transition [S12]
- `match-element` generates an internal name from the element's identity [S12][S20]. With
  `@for (track row.id)` the `<tr>` survives a reorder, so no per-row name binding is needed [R3]
- **Every frame, the group's width, height and transform are reset from the new element's
  *current live* border box.** If that element is "not rendered", the frame algorithm **skips the
  whole transition with `InvalidStateError`** [S10]
- The default group keyframes have only a `from` step (the old box), so each group animates toward
  the live element [S10]
- `::view-transition-old` is a static image. `::view-transition-new` is a live representation [S7]
- While the transition animates, the boxes of captured elements "are not painted … and do not
  respond to hit-testing (as if they had `pointer-events: none`)" [S8]
- `::view-transition` is `position: fixed; inset: 0` over the viewport [S11]
- Element-scoped transitions keep the rest of the page interactive, and "respect overflow
  clipping (unlike document-scoped transitions)" [S4][S5]
- Element-scoped transitions set `view-transition-name: root` and `view-transition-group: contain`
  on the scope automatically, and clip when the scope clips its overflow [S4]
- Document-scoped groups are flat siblings, so "view transition group siblings cannot clip each
  other". Getting clipping back needs `view-transition-group` [S13]
- "Only one view transition is allowed to run at a time … the old transition skips to the end"
  [S20]. React's docs say the same from the framework side: another view transition on the page
  "React will interrupt" [S16]

**4. Consumer styling**

- View transitions are styled only through CSS pseudo-elements, e.g.
  `::view-transition-group(.cls) { animation-duration: … }`. `view-transition-class` does not need
  to be unique [S15]
- The current FLIP takes timing from JS (`flipTiming: KeyframeAnimationOptions`, passed to
  `animate()`). ADR-0026's amendment records that as an explicit exception to "values as CSS
  custom properties" [R1][R2]
- The shipped sheet today is `@layer ngp-table`, holds only the enter/leave classes, and has a
  `prefers-reduced-motion` branch [R8]
- Rows already carry `data-row-kind`, and the host carries `data-row-animation` [R1][R9]
- React does **not** honour reduced motion for view transitions by itself; the author has to
  [S16]

**5. Prior art**

- **React 19.3.0** `<ViewTransition>`: React wraps its *own commit* in `startViewTransition`. It
  triggers only for updates made through `startTransition`, `<Suspense>` or `useDeferredValue`
  [S16][S17]
- React: list reorder animates through keyed `<ViewTransition>` children. Shared-element
  transitions "won't work reliably for reorders since they don't animate outside the viewport".
  `flushSync` skips the animation [S16]
- **Vue** `<TransitionGroup>`: moves use a `.list-move` CSS **transition**, and the leaving item
  gets `position: absolute` "so that moving animations can be calculated correctly" [S22]
- **@formkit/auto-animate 0.10.0**: FLIP through **`el.animate()`** with translate keyframes.
  Positions come from `getBoundingClientRect()` plus scroll offset, and an unfinished animation is
  `cancel()`ed first [S21]
- **AG Grid 36.2.0**: `translateY` on absolutely positioned rows, not view transitions [S23]
- No table or grid library was found that uses view transitions for row reorder (see Not
  researched)

## Comparison

| Requirement | WAAPI FLIP (shipped) | Document VT + `match-element` | Element-scoped VT (`table.startViewTransition`) |
|---|---|---|---|
| **Trigger: any `renderRows()` change, whatever caused it** | yes: observes `renderRows()` after render [R1] | **no**: has to wrap the write, before capture [S7][R7] | **no**: same, has to wrap the write [S5][S7] |
| Attribute-only, no DOM changes | yes [R1] | yes (CSS name, plus one JS call at the write site) [S12] | yes [S5] |
| Native table layout | yes: `transform` on `<tr>` [R3] | `<tr>` is a valid target [S9]; border-collapse unverified | same as document VT |
| Row interaction during the glide | rows stay hit-testable (`animate()` does not change hit-testing) | **whole page**: captured boxes don't hit-test, and the root is captured too [S8] | only the scope is blocked [S5] |
| Re-reorder mid-animation | a new `animate()` overrides the old one, **but `offsetTop` ignores the in-flight transform, so rows jump** [R1][R3] | the active transition is skipped to its end, then the new one starts from there: a jump [S7][S20] | same, one active per scope [S4] |
| `animate.leave` interplay | registry skips the leaving row; D2 snap [R1][R3] | a named row that `animate.leave` removes mid-transition makes the frame algorithm **skip everything** [S10][S19] | same algorithm (inference) |
| `animate.enter` interplay | enter is opacity-only; FLIP measures full height [R3] | unpaired new element: UA fade **plus** the consumer's enter animation, live inside `::view-transition-new` [S7] (inference) | same |
| Scroll container clipping | normal painting | **not clipped**; needs `view-transition-group` (Chrome 140 only) [S5][S13][S14] | clipped [S4][S5] |
| Fits with `withViewTransitions()` / other tables | independent | **fights**: one active per document, `AbortError` [S7][S20] | independent per scope [S4] |
| Cost at scale | one layout read, then N compositor transforms, only for rows that moved [R1] | every named row captured, each with a group plus an image pair [S9][S10] (not measured) | same, inside the scope |
| Browser support | Baseline widely available [S2] | Baseline newly available 2025-10-14; `match-element` Safari 18.4 [S1][S12] | **Chromium 147 only** [S2][S3] |
| Consumer styling (ADR-0026) | JS input, a documented exception [R2] | pure CSS: pseudo-elements plus input tokens fit Decision 5 [S15][R2] | pure CSS, and it can be selected per scope [S4] |
| Reduced motion | `matchMedia` in the directive [R1] | CSS media query in the sheet (Decision 4) [R2][S16] | same |
| Code size | ~107 lines, one directive [R1] | directive gone, plus a sheet, plus a wrap helper the consumer has to call at every write | same |

## Synthesis

- **The trigger decides this.** FLIP *observes* a finished result, and view transitions *wrap* a
  mutation. React can use view transitions because React owns the commit [S16]. The Angular router
  can because it owns navigation [R5]. ngpTable owns neither: its directives are attribute-only
  observers, and the consumer owns `data` [R1][R3]. Angular's own team gave the same answer for
  lists: there is no framework hook, so wrap your own write [S18]. Every other row in the table
  matters only if the trigger problem is solved first.
- **FLIP and view transitions fail the same way on interruption, for different reasons.** View
  transitions skip to the end, and FLIP measures a layout box that ignores the transform [S20][R1].
  auto-animate shows the FLIP fix: measure with `getBoundingClientRect()`, which includes the
  running transform, then cancel and replay [S21]. No such fix exists for view transitions.
- **Leave interplay goes from a limitation to a hazard.** Today a leaving row is a cosmetic D2
  snap [R3]. Under view transitions, a named leaving row that Angular removes after its 200 ms leave,
  inside a 300 ms transition, cancels every row's glide [S10][S19]. The mitigation would be
  `.ngp-table-row--leave { view-transition-name: none }`, so the row drops into the live root layer.
  That rests on inference, not a run.
- **Live group tracking is the one real gain.** Groups follow the *live* new box every frame
  [S10], so rows below a collapsing leave row would glide as it shrinks, and the stale-baseline
  problem from the insert/delete discovery would not happen. FLIP cannot do this without measuring
  again. This is a real argument in favour, and it is listed under Against.
- **Styling favours view transitions, and that is the ADR's own preference.** ADR-0026's amendment
  took the JS-timing exception *only because* WAAPI takes timing in JS [R2]. With view
  transitions, a shipped `row-animation.css` could hold the FLIP-equivalent rules under
  `@layer ngp-table`:
  - `[data-row-animation] [data-row-kind] { view-transition-name: match-element;
    view-transition-class: ngp-table-row }`
  - `::view-transition-group(.ngp-table-row) { animation-duration: var(--…, 300ms) }`

  That returns to Decision 5 in full [R2][S12][S15]. A document-scoped pseudo-element hangs off
  `:root`, so two tables cannot get different timing unless they use different classes (inference
  from [S11]). Element-scoped transitions fix this [S4].
- **Where the sources disagree.** The Chrome team's own guidance offers element-scoped transitions
  for "shuffling lists" [S3]. Angular's team called document view transitions "best used for
  whole-page transitions" [S18]. Both point to element-scoped transitions as the right primitive
  for a table, and it is Chromium-only today [S2]. Waiting is the answer. Rewriting now is not.
- **Do not layer them.** If a consumer wraps a write in `startViewTransition` while FLIP is on, the
  group follows the row's "current visual position" [S10], which includes FLIP's live transform.
  Both animations would then play (inference). A recipe for consumers would have to say "remove
  `ngpTableRowAnimation`".

## Against

- View transitions give **live layout tracking** for free, which ends the stale-baseline glide
  after a delete and the D2 snap below a collapsing leave row [S10][R3].
- Pure-CSS styling ends ADR-0026's only JS-timing exception, and consumers could re-style the move
  (lost in the 2026-09-23 amendment) [R2][S15].
- Document view transitions are Baseline in every engine as of 2025-10-14 [S1]. The support
  argument applies only to element-scoped transitions and nested groups [S2][S14].
- A **consumer-owned** opt-in (the consumer wraps their own sort call, and the library ships only
  the CSS) would add no library trigger at all. It would still be all-or-nothing against FLIP, and
  it only covers writes the consumer makes.

## Not researched

- Svelte `animate:flip`, Motion `layout`, MUI X, TanStack Table, PrimeNG and Angular CDK
  drag-drop, all looked at for view-transition reorder. Web search found no grid library using
  view transitions. Search results were only blogs and demos.
- The `div` grid host (ADR-0005) under view transitions.
- Accessibility during a document view transition: focus, and screen-reader reads of a snapshot.
- Cross-document view transitions (not relevant to a table).

## Unverified

- **Border-collapse under view transitions.** It is unknown whether a captured `<tr>` image
  includes collapsed borders, which the table paints, or leaves them in the root snapshot at the
  new layout. No bug or doc was found. To confirm: a `border-collapse: collapse` table in
  Chrome/Firefox/Safari with named rows, then sort.
- **Snapshot cost at 1,000+ rows.** No primary source quantifies it. Secondary blogs (for example
  `corewebvitals.io/pagespeed/view-transition-web-performance`) say to keep named elements
  "under ~20", but that was not read and is not relied on. To confirm: a Performance-panel trace of
  a sort with `match-element` on 1,000 rows against the current FLIP.
- **Whether the group animation runs on the compositor.** It animates `width`/`height` as well as
  `transform` [S10], so it may run on the main thread. Not confirmed from any engine source.
- **The leave mitigation** (`view-transition-name: none` on the leave class) and the double fade
  on enter both come from reading the spec [S7][S10], not from running anything.
- **Whether `<table>` can be an element-scoped transition root.** The Chrome docs don't mention
  display types [S4].
- **Offscreen named rows.** Whether engines capture rows outside the viewport, or skip or clip
  them. React's note that shared transitions "don't animate outside the viewport" [S16] is about
  React, not the spec.
- **FLIP rows staying hit-testable mid-glide.** Hit-testing follows the transformed box. This is a
  general CSS fact that no source here states.

## Sources

| | Source | Version | Verified |
|---|---|---|---|
| S1 | https://raw.githubusercontent.com/web-platform-dx/web-features/v3.39.0/features/view-transitions.yml.dist | web-features 3.39.0 | yes — read; Baseline low 2025-10-14, per-browser versions, options-parameter row |
| S2 | https://api.webstatus.dev/v1/features?q=name:view%20transition | read 2026-09-23 | yes — read; gave element-scoped Chrome 147 (2026-04-07), `limited`; Web Animations row read via `?q=id:web-animations` |
| S3 | https://developer.chrome.com/blog/element-scoped-view-transitions | 2026-03-27 | yes — read; Chrome 147 stable, shuffling-lists demo |
| S4 | https://developer.chrome.com/docs/css-ui/view-transitions/element-scoped-view-transitions | — | yes — read; auto `root` name + `contain` group, clipping, interactivity outside scope |
| S5 | https://developer.mozilla.org/en-US/docs/Web/API/Element/startViewTransition | — | yes — read; "Limited availability", experimental, overflow clipping contrast |
| S6 | https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition | modified 2026-06-19 | yes — read; callback contract, reject abandons |
| S7 | https://drafts.csswg.org/css-view-transitions-1/#dom-document-startviewtransition | ED 2025-02-16 | yes — read; showed capture is deferred to the next rendering update, which is what rules out the observer-trigger design; old static / new live |
| S8 | https://www.w3.org/TR/css-view-transitions-1/ — §4.2, §6.1.1, §7.1.1 | CRD 2024-03-28 | yes — read; hit-testing text |
| S9 | https://drafts.csswg.org/css-view-transitions-1/#view-transition-name-prop | ED 2025-02-16 | yes — read; applies to all elements, capture exclusions |
| S10 | https://raw.githubusercontent.com/w3c/csswg-drafts/main/css-view-transitions-1/Overview.bs — "handle transition frame", "update pseudo-element styles", group keyframes | main, **unpinned** | yes — source read; **changed the finding**: groups track the live box each frame, and a new element becoming not-rendered skips the whole transition |
| S11 | https://developer.mozilla.org/en-US/docs/Web/CSS/::view-transition | modified 2026-04-17 | yes — read; fixed, inset 0 |
| S12 | https://raw.githubusercontent.com/mdn/browser-compat-data/v8.1.2/css/properties/view-transition-name.json | BCD 8.1.2 | yes — read; `match-element` versions |
| S13 | https://developer.chrome.com/docs/css-ui/view-transitions/nested-view-transition-groups | — | yes — read; flat-tree clipping problem |
| S14 | https://raw.githubusercontent.com/mdn/browser-compat-data/v8.1.2/css/properties/view-transition-group.json | BCD 8.1.2 | yes — read; confirmed Chrome-only |
| S15 | https://developer.mozilla.org/en-US/docs/Web/CSS/view-transition-class | modified 2026-05-07 | yes — read; `::view-transition-group(.card)` syntax; versions cross-read from https://raw.githubusercontent.com/mdn/browser-compat-data/v8.1.2/css/properties/view-transition-class.json and https://raw.githubusercontent.com/web-platform-dx/web-features/v3.39.0/features/view-transition-class.yml.dist |
| S16 | https://react.dev/reference/react/ViewTransition | page says 19.3.0-canary | yes — read; caveats list |
| S17 | https://unpkg.com/react@19.3.0/cjs/react.production.js | 19.3.0 | yes — published source read; **corrected the page**: `exports.ViewTransition` is stable in 19.3.0 |
| S18 | https://api.github.com/repos/angular/angular/issues/55829/comments | — | yes — read 2026-09-23; closed not planned 2024-05-16 by alxhub (state from https://api.github.com/repos/angular/angular/issues/55829) |
| S19 | [discovery-insert-delete-animation.md](discovery-insert-delete-animation.md) — its S31, S32, S33 (`@angular/core@22.1.2` animation queue, leave end, `refreshView` order) | 22.1.2 | yes — read; carried over, not re-read |
| S20 | https://developer.chrome.com/docs/web-platform/view-transitions/same-document | — | yes — read; one at a time / skip to end |
| S21 | https://unpkg.com/@formkit/auto-animate@0.10.0/index.mjs — `remain()`, `getCoords()` | 0.10.0 | yes — published source read |
| S22 | https://vuejs.org/guide/built-ins/transition-group | — | yes — read; "Move Transitions" section |
| S23 | [discovery-ag-grid-group-animation.md](discovery-ag-grid-group-animation.md) | b36.2.0 | yes — read; carried over |
| R1 | `libs/table/src/directives/ngp-table-row-animation.directive.ts:37-106` | — | yes — read |
| R2 | `libs/table/docs/adr/0026-headless-styling-contract.md` — Decision 4, 5; Amendment 2026-09-23 | — | yes — read |
| R3 | `libs/table/docs/3-ui/directives/row-animation.md` — Mechanism, Enter and exit (D2), Open Questions | — | yes — read |
| R4 | `node_modules/@angular/core/fesm2022/` — grep `startViewTransition\|viewTransition` | 22.1.2 | yes — 0 matches |
| R5 | `node_modules/@angular/router/fesm2022/_router-chunk.mjs:3595-3647` (`createViewTransition`, `createRenderPromise`) | 22.1.2 | yes — installed package read |
| R6 | `node_modules/@angular/router/types/router.d.ts:117-134` (`ViewTransitionsFeatureOptions`) | 22.1.2 | yes — installed package read |
| R6 | `node_modules/@angular/router/types/router.d.ts:861-864` (`withViewTransitions`) | 22.1.2 | yes — installed package read |
| R7 | `node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:12855-12947` (`tick`, `tickImpl`, `synchronizeOnce`) | 22.1.2 | yes — installed package read |
| R8 | `libs/table/src/row-animation.css:7-49` | — | yes — read |
| R9 | `libs/table/src/directives/ngp-table-row.directive.ts:22-29` | — | yes — read |
