# How do real Angular directive libraries share one core behaviour across several public directives?

**Date:** 2026-10-02 · **Depth:** standard

## Answer

Each library uses a different mechanism. **None of them composes *host bindings* without
inheritance, `hostDirectives` or DOM-writing effects.**

- **CDK** inherits from a selectorless abstract `@Directive` that carries its own `host:`
  bindings [S9][S11]. It uses `hostDirectives` nowhere [S15].
- **`@angular/aria`** composes *logic*, as plain undecorated classes (`ListExpansion` shared by
  accordion, tree and tabs) [S17][S18][S19][S20]. The host bindings are not shared: each
  directive writes its own `host:` block reading `_pattern.*` [S16][S21].
- **ng-primitives** composes a function (`ngpCollapsibleTrigger`) that both the collapsible and
  accordion triggers call [S2][S1]. That function writes the DOM through effects [S6].

Our core *is* four host bindings and no logic, so only CDK's mechanism shares what we need to
share. **I agree with the prior discovery: use a selectorless abstract base class.** One change:
unlike CDK, keep the base out of `index.ts`.

## Method

- Versions pinned:
  - `ng-primitives@0.130.3`: installed in the main checkout
    (`C:/Users/dmena/git/ng-table/node_modules/ng-primitives/package.json:5`).
  - `@angular/cdk@22.1.7`: installed (`node_modules/@angular/cdk/package.json:3`). Its bundles
    declare `version: "22.1.6"` as the compiler that built them.
  - `@angular/aria@22.2.1`: not installed. `registry.npmjs.org/@angular/aria/latest` returns
    22.2.1 [S22].
- ng-primitives and CDK: the published `fesm2022` bundles were read with the Read tool, so line
  numbers are exact. The unpkg URLs in Sources serve the same files.
- `@angular/aria`: read on unpkg through WebFetch, asking for verbatim code. **No line numbers.**
  WebFetch does not give reliable line numbers, and every GitHub tag URL tried for
  `angular/components@22.2.1` returned 404. Aria claims are cited by file and symbol instead.
- Picks, at most 3 per library, all with the shape "one core, several directives on top":
  - ng-primitives: collapsible vs accordion trigger (disclosure, the closest match),
    `ngpButton` reuse, and interactions plus `state` (the mechanism under both).
  - CDK: `cdk/menu` triggers (the named example) and menu selectable items (two feature
    directives on one bindings-only base, the closest shape to ours). Also `cdk/accordion`,
    as a negative: it has no trigger directive.
  - aria: accordion, tree and tabs, which share `ListExpansion`.

## Evidence

**ng-primitives 0.130.3: functions called inside class directives**
- `NgpAccordionTrigger` adds no bindings of its own. Its primitive is
  `ngpCollapsibleTrigger({ id })` [S1].
- The source comments say: "The accordion trigger is the shared collapsible trigger" [S1].
- The feature supplies `isOpen` and `toggle` through state, not through the trigger:
  - `ngpAccordionItem` builds the collapsible core with
    `open: computed(() => accordion().isOpen(value()))` and
    `onOpenChange: () => accordion().toggle(value())` [S1].
  - It then provides the state with `provideCollapsibleState({ inherit: false })` [S1].
- The trigger core gets that state through DI (`injectCollapsibleState()`), and binds `type`,
  `aria-expanded`, `data-open` and `click` itself [S2].
- `type` is bound only when the host tag is `button` (`HOST_TAG_NAME`) [S2].
- The shared core is **public**: `ngpCollapsibleTrigger` and `provideCollapsibleState` are in
  the export list of `ng-primitives/collapsible` [S3].
- `ngpButton(...)` is reused as a function inside other primitives: `ngpPaginationButton`, and
  the date-picker, menu and ai primitives [S4][S5].
- The interactions setup has the doc comment "Setup the interactions without relying on
  HostDirectives. @internal". It is still exported [S7][S8].
- That setup stops double setup with an expando flag on the element (`__ngp-interactions`),
  not with Angular metadata [S7].
- How bindings reach the DOM:
  - `attrBinding` and `dataBinding` call `setAttribute` inside `isomorphicEffect`. That is
    `afterRenderEffect` in the browser and `effect` on the server.
  - `listener` calls `addEventListener` and removes it on `DestroyRef`.
  - Decorator `host` metadata is not used. [S6]
- `createPrimitive` runs the function in `runInInjectionContext` and publishes the result
  through an `InjectionToken` [S6].
- ng-primitives does use `hostDirectives`, but only for whole cross-cutting directives:
  - `NgpExitAnimation` on dialog and overlay [S10].
  - `NgpFocusTrap` on popover and dialog [S10].
  - `NgpExitAnimation` comes from the published `ng-primitives/internal` entry point, which is
    in the package `exports` map. It is public API with an "internal" name. [S10][S8]

**Angular CDK 22.1.7: abstract base classes with decorator `host`**
- `CdkMenuTriggerBase` is a selectorless `@Directive` with
  `host: { '[attr.aria-controls]', '[attr.data-cdk-menu-stack-id]' }` [S9].
- `CdkMenuTrigger` and `CdkContextMenuTrigger` both `extends CdkMenuTriggerBase` [S11][S12].
- Their definitions carry `usesInheritance: true` [S11][S12].
- The base is declared `abstract`, with the doc comment "This class can be extended to create
  custom menu trigger types" [S13].
- **A subclass overrides a base binding on purpose.** `CdkContextMenuTrigger` declares
  `'[attr.data-cdk-menu-stack-id]': 'null'` over the base's `'menuStack.id'`. [S12][S9]
- `CdkMenuItemSelectable` is a selectorless abstract base that holds only `checked` plus two
  host bindings (`aria-checked`, `aria-disabled`) [S14].
- `CdkMenuItemRadio` and `CdkMenuItemCheckbox` extend it, and add only `role`, a class and a
  `trigger()` override [S14].
- They also re-provide the base as a DI token
  (`{ provide: CdkMenuItemSelectable, useExisting: … }`) [S14].
- The shared bases are **public**: `CdkMenuTriggerBase` and `CdkMenuItemSelectable` are in
  the `cdk/menu` export list [S11].
- The base class is listed in the public `.d.ts` export list [S13].
- CDK does **not** share the `type="button"` logic. `_setType()` (a one-off `setAttribute` when
  the tag is `BUTTON` and has no `type`) is copied into both `CdkMenuTrigger` and
  `CdkMenuItem` [S11].
- `hostDirectives` has 0 matches across every CDK `fesm2022/*.mjs` bundle [S15].
- `usesInheritance: true` has 22 matches, across portal, dialog, table, menu, scrolling and
  tree [S15].
- `cdk/accordion` has no trigger directive and no `host:` block:
  - `CdkAccordionItem` exposes `expanded` and `toggle()` through `exportAs: 'cdkAccordionItem'`.
  - The consumer binds `aria-expanded` on its own button.
  - Negative result: no shared trigger core. [S23]

**`@angular/aria` 22.2.1: plain pattern classes, host bindings per directive**
- `AccordionTriggerPattern` and `AccordionGroupPattern` are plain ES classes with no Angular
  decorator [S17].
- The group composes `new ListFocus`, `new ListNavigation` and `new ListExpansion` [S17].
- The trigger pattern's `toggle()` delegates to `accordionGroup().expansionBehavior.toggle(this)`
  [S17].
- `ListExpansion` is the shared behaviour. It is a plain class with `open`, `close`, `toggle`,
  `openAll`, `closeAll` and `isExpandable`, and nothing else [S18].
- `ListExpansion` is reused by `TreePattern` (`new ListExpansion(inputs)`) [S19] and by
  `TabListPattern` (`new ListExpansion({ ...inputs, multiExpandable: () => false })`) [S20].
- **`ListExpansion` is internal.** `private.mjs` imports `_expansion-chunk.mjs` only for its
  side effects and never re-exports it [S21].
- The `*Pattern` classes *are* public, re-exported through the `@angular/aria/private` entry
  point [S21][S22].
- The directive builds its pattern in `ngOnInit` with
  `new AccordionTriggerPattern({ ...this, element, accordionGroup, accordionPanelId })`.
  The directive instance itself is spread in as the pattern's inputs. [S16]
- Bindings reach the DOM through decorator `host` metadata that reads the pattern. Examples:
  `"attr.aria-expanded": "expanded()"`, `"attr.aria-controls": "_pattern.controls()"`,
  `"attr.tabindex": "_pattern.tabIndex()"` [S16].
- `TreeItem` follows the same shape (`"attr.aria-expanded": "_expanded()"`,
  `"attr.aria-level": "level()"`) [S24].
- `_pattern` is a public, unmodified field in the `.d.ts`, typed from `./private.js` [S25].
- Directive-level sharing does use `hostDirectives`, and the shared directive is then exported
  under `ɵɵ`:
  - `AccordionPanel` uses `hostDirectives: [{ directive: DeferredContentAware, … }]` [S16].
  - `TreeItemGroup` uses `hostDirectives: [{ directive: DeferredContent }]` [S24].
  - `accordion` exports `DeferredContentAware as ɵɵDeferredContentAware` [S16].
  - `tree` exports `DeferredContent as ɵɵDeferredContent` [S24].
- The host directive type appears in the panel's public `ɵɵDirectiveDeclaration` [S25].

## Comparison

| | ng-primitives@0.130.3 | CDK@22.1.7 | @angular/aria@22.2.1 |
|---|---|---|---|
| What is shared | a setup function per primitive [S1][S2] | an abstract `@Directive` base [S9][S14] | a plain behaviour class, inside a plain pattern class [S17][S18] |
| Shares host bindings? | yes, as effects [S6] | yes, as decorator `host` [S9][S14] | **no**, each directive has its own `host:` [S16][S24] |
| Bindings reach DOM via | `afterRenderEffect` + `setAttribute` [S6] | decorator `host`, merged by inheritance [S11] | decorator `host` reading `_pattern.*` [S16] |
| `hostDirectives` used | yes, for exit animation and focus trap only [S10] | no, 0 matches [S15] | yes, deferred content only [S16][S24] |
| Shared piece visibility | public (`ngpCollapsibleTrigger` exported) [S3] | public base, a documented extension point [S11][S13] | `ListExpansion` internal [S21]; patterns public via `/private` [S21]; host directive `ɵɵ`-exported [S16] |
| Feature supplies state by | DI token from an ancestor (`provideCollapsibleState`) [S1] | overriding methods (`trigger()`, `isOpen()`) [S11][S14] | inputs object (`{ ...this }`) given to the pattern [S16] |

**Our constraints applied to each mechanism**

| Constraint | Base class (CDK) | Plain class plus per-directive `host` (aria) | Function + effects (ng-primitives) | `hostDirectives` (aria `ɵɵ`) |
|---|---|---|---|---|
| No `effect()` DOM write | yes [S9] | yes [S16] | **no** [S6] | yes [S16] |
| One writer per attribute | one directive. A subclass can override silently, and CDK does so on purpose [S12] | one directive | not detectable: effect writes bypass binding precedence [S6] | two directives on one element |
| Single public barrel, core internal | yes, if left out of `index.ts` (CDK chose to export it [S11]) | yes: the class is plain, not a directive [S21] | yes (plain function) | needs a `ɵ` export under ng-packagr (prior discovery, R13/R16 there) [S16] |
| Shares *our* four bindings | yes | **no**, the bindings are copied into both directives | yes | yes |

## Synthesis

- **"Composition" means two different things in this survey.**
  - aria composes *behaviour* (focus, navigation, expansion): stateful logic with many
    methods [S17][S18].
  - It never composes *bindings*. Every directive writes its own `host:` block [S16][S24].
  - Our core is the opposite case: four bindings and no logic. Copying aria leaves a pattern
    object holding `isOpen` and `toggle` that the feature already owns, and still repeats
    the four `host:` entries in both directives. That adds a layer and shares nothing.
- **ng-primitives is the only library that composes bindings without inheritance**, and it can
  do so only because its bindings are effects [S6]. The comment "without relying on
  HostDirectives" [S7] shows it chose functions to *avoid* `hostDirectives`, not to avoid
  inheritance. The repo's ban on effect DOM writes rules this out.
- **CDK is the direct precedent for our shape.** `CdkMenuItemSelectable` is a selectorless
  abstract base whose whole contribution is two host bindings and one field, with two thin
  feature subclasses [S14]. That is the prior discovery's sketch, almost line for line.
- **CDK and aria disagree on visibility.**
  - CDK publishes its bases as extension points [S13].
  - aria keeps its truly shared behaviour unexported [S21], and `ɵɵ`-exports only what the
    compiler forces it to (host directives) [S16].
  - Our contract sides with aria on visibility and with CDK on mechanism. Nothing in either
    library says those two cannot be combined. The remaining `.d.ts` risk is carried over in
    Unverified.
- **Silent override is a real property of the base-class route, and CDK uses it on purpose**
  [S12]. For TR37 that makes it a review rule, not something the compiler checks. The prior
  discovery found the same for every option.
- **The recommendation, under the repo's three constraints:**
  - No `effect()` DOM write: rules out ng-primitives.
  - Single public barrel with an unexported core: rules out `hostDirectives` once the lib is
    packaged.
  - aria's mechanism meets every constraint but shares nothing for our case.
  - That leaves the base class.
  - **Agree with the prior discovery's abstract-base recommendation.** One-level, selectorless,
    no constructor, `protected abstract isOpen` and `toggle`, and not re-exported from
    `index.ts`.

## Against

- **Duplication is a precedent too.** CDK copies `_setType()` rather than sharing it [S11].
  Four `host:` lines repeated in two directives, guarded by one shared spec, keeps both
  directives flat. It also gives the user composition-free code with no inheritance, at the
  cost of drift between the two copies.
- **aria's split becomes the right one if the core gains logic** (keyboard handling,
  `aria-controls` id registration, disabled guards). Then a plain internal class composed in
  each directive mirrors `ListExpansion` [S18][S21], and the bindings stay per directive.
- **ng-primitives shows the feature-supplies-state seam through DI** (`provideCollapsibleState`
  on the item) [S1]. That seam would let one public trigger directive serve both features, but
  it reverses D1 (feature-specific directives).

## Not researched

- Angular Material (`MatExpansionPanel`, `MatMenuTrigger` and others subclassing CDK). It is
  not installed, and the caller's scope named CDK only.
- `cdk/tree`'s `CdkTreeNodeToggle`. It is a single directive, so it does not have the shape.
- The ng-primitives `menu` and `tabs` triggers, beyond the grep hit that `menu` calls
  `ngpButton(...)` [S5].
- Spartan, PrimeNG and Taiga UI. Out of the caller's named scope.

## Unverified

- **Line numbers for every `@angular/aria` claim.** The WebFetch extraction gives no reliable
  lines, and GitHub tag URLs for `angular/components@22.2.1` returned 404
  (`raw.githubusercontent.com/.../22.2.1/src/aria/...` and `github.com/.../tree/22.2.1/...`).
  To confirm: `npm pack @angular/aria@22.2.1`, or install it, and read the `fesm2022` files
  locally.
- The aria quotes are model-extracted from unpkg. They were asked for verbatim, but are not
  diffed. The `_tree-chunk.mjs` import list came back as a single line, which is probably
  truncated.
- That a base class exported from its own file but missing from `index.ts` emits a clean
  public `.d.ts`. Carried over from the prior discovery. CDK cannot settle it, because CDK
  exports its bases. aria's `.d.ts` shows unexported declarations bundled under chunk files
  (`./_deferred-content-chunk.js`) [S25], which suggests the API extractor inlines them. This
  is an inference; confirm with a packed ng-packagr build.
- Why aria puts its patterns on a `/private` entry point instead of keeping them internal. The
  reasonable inference is that the public `_pattern: AccordionTriggerPattern` field in the
  `.d.ts` [S25] needs a nameable type. No commit or comment was read.

## Sources

| | Source | Version | Verified |
|---|---|---|---|
| S1 | https://unpkg.com/ng-primitives@0.130.3/fesm2022/ng-primitives-accordion.mjs lines 111-146 (`ngpAccordionItem`), 194-200 (`ngpAccordionTrigger`), 182 (providers) | 0.130.3 | yes, local Read of the installed bundle; changed the finding: the feature supplies `open`/`onOpenChange` to the core through state, not through the trigger |
| S2 | https://unpkg.com/ng-primitives@0.130.3/fesm2022/ng-primitives-collapsible.mjs lines 135-156 (`ngpCollapsibleTrigger`) | 0.130.3 | yes, local Read |
| S3 | https://unpkg.com/ng-primitives@0.130.3/fesm2022/ng-primitives-collapsible.mjs line 312 (export list) | 0.130.3 | yes, local Read; the shared core is public |
| S4 | https://unpkg.com/ng-primitives@0.130.3/fesm2022/ng-primitives-pagination.mjs lines 54-68 | 0.130.3 | yes, local Read |
| S5 | https://unpkg.com/ng-primitives@0.130.3/fesm2022/ng-primitives-menu.mjs line 880 | 0.130.3 | yes, grep hit only |
| S6 | https://unpkg.com/ng-primitives@0.130.3/fesm2022/ng-primitives-state.mjs lines 133-178 (`createPrimitive`), 216-238 (`attrBinding`), 281-298 (`dataBinding`), 299-313 (`listener`), 382-392 (`isomorphicEffect`) | 0.130.3 | yes, local Read |
| S7 | https://unpkg.com/ng-primitives@0.130.3/fesm2022/ng-primitives-interactions.mjs lines 454-489 | 0.130.3 | yes, local Read; the "without relying on HostDirectives" comment reframes why ng-primitives uses functions |
| S8 | https://unpkg.com/ng-primitives@0.130.3/package.json lines 162-169 (`./interactions`, `./internal` exports) | 0.130.3 | yes, local Read |
| S9 | https://unpkg.com/@angular/cdk@22.1.7/fesm2022/menu.mjs lines 264-362 (`CdkMenuTriggerBase`) | 22.1.7 | yes, local Read |
| S10 | https://unpkg.com/ng-primitives@0.130.3/fesm2022/ng-primitives-dialog.mjs lines 5, 342, 778; ng-primitives-popover.mjs line 528; ng-primitives-internal.mjs lines 49-75 | 0.130.3 | yes, local Read and grep; changed the finding: ng-primitives does use `hostDirectives`, against the "functions only" reading |
| S11 | https://unpkg.com/@angular/cdk@22.1.7/fesm2022/menu.mjs lines 566-595 (`CdkMenuTrigger`), 772-777 and 1036-1041 (`_setType` copies), 802-842 (host), 2100 (export list) | 22.1.7 | yes, local Read |
| S12 | https://unpkg.com/@angular/cdk@22.1.7/fesm2022/menu.mjs lines 1867-1878, 1991-2024 (`CdkContextMenuTrigger`) | 22.1.7 | yes, local Read; found the deliberate override of a base binding |
| S13 | https://unpkg.com/@angular/cdk@22.1.7/types/menu.d.ts lines 296-300, 714-723 | 22.1.7 | yes, local Read |
| S14 | https://unpkg.com/@angular/cdk@22.1.7/fesm2022/menu.mjs lines 1658-1856 (`CdkMenuItemSelectable`, `CdkMenuItemRadio`, `CdkMenuItemCheckbox`) | 22.1.7 | yes, local Read; the closest shape match to our core |
| S15 | node_modules/@angular/cdk/fesm2022/*.mjs, grep `hostDirectives` (0) and `usesInheritance: true` (22) | 22.1.7 | yes, grep count |
| S16 | https://unpkg.com/@angular/aria@22.2.1/fesm2022/accordion.mjs (`AccordionTrigger` `ngOnInit`, host; `AccordionPanel` `hostDirectives`; export line) | 22.2.1 | yes, WebFetch verbatim request; confirms the `_pattern`-in-`ngOnInit` detail the prior discovery left unverified; no lines |
| S17 | https://unpkg.com/@angular/aria@22.2.1/fesm2022/_accordion-chunk.mjs (imports, `AccordionTriggerPattern`, `AccordionGroupPattern` constructor) | 22.2.1 | yes, WebFetch verbatim; no lines |
| S18 | https://unpkg.com/@angular/aria@22.2.1/fesm2022/_expansion-chunk.mjs (`ListExpansion`, whole file) | 22.2.1 | yes, WebFetch verbatim of the whole file |
| S19 | https://unpkg.com/@angular/aria@22.2.1/fesm2022/_tree-chunk.mjs (`TreePattern` constructor) | 22.2.1 | yes, WebFetch verbatim; import list probably truncated |
| S20 | https://unpkg.com/@angular/aria@22.2.1/fesm2022/_tabs-chunk.mjs (imports, `new ListExpansion`) | 22.2.1 | yes, WebFetch verbatim |
| S21 | https://unpkg.com/@angular/aria@22.2.1/fesm2022/private.mjs (re-export lines) | 22.2.1 | yes, WebFetch verbatim; changed the finding: the shared behaviour is not exported, only the patterns are |
| S22 | https://registry.npmjs.org/@angular/aria/latest | 22.2.1 | yes, fetched; `exports` includes `./private` |
| S23 | https://unpkg.com/@angular/cdk@22.1.7/fesm2022/accordion.mjs lines 80-235, 275 | 22.1.7 | yes, local grep; no `host:` block, `exportAs` only |
| S24 | https://unpkg.com/@angular/aria@22.2.1/fesm2022/tree.mjs (`TreeItem` host, `TreeItemGroup` `hostDirectives`, export line) | 22.2.1 | yes, WebFetch verbatim; no lines |
| S25 | https://unpkg.com/@angular/aria@22.2.1/types/accordion.d.ts (imports, `_pattern` field, `AccordionPanel` `ɵdir`) | 22.2.1 | yes, WebFetch verbatim; no lines |
