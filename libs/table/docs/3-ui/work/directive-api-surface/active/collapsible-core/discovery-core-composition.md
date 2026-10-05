# How should an internal "collapsible trigger" core attach to two public toggle directives?

**Date:** 2026-10-02 · **Depth:** standard

## Answer

The framing "functional vs classes" is partly wrong. In Angular 22.1.2, host bindings can only
come from decorator `host` metadata. There is no public function that binds a host attribute
[R29]. A function-style core can only reach the DOM through an effect, and ng-primitives does
exactly that [S5], which the repo bans. So the real choice is between a base class and
`hostDirectives`.

**Recommendation: (1) a selectorless abstract `@Directive()` base class, one level deep, holding
only the four core bindings.**

- **It survives library packaging.** ng-packagr turns on `flatModuleOutFile` [S8]. With that
  flag, ngc adds every `hostDirectives` entry to its reference graph [R16][R14][R15] and fails
  any class in that graph not exported from `index.ts` (NG3001, "Unsupported private class")
  [R13]. Base classes never enter that graph [R16].
- **It keeps the core's host bindings type-checked** [R18][R19].
- **It costs no extra directive instance per row** [R11][R7].

The `hostDirectives` option (2) works today, because the lib is not built with ng-packagr
[R24]. But the core must then be exported under a `ɵ` prefix the day the lib is packaged, as
`@angular/aria` does [S7]. That reverses this work folder's own "not exported" contract.

## Method

- Versions pinned:
  - `@angular/core`, `@angular/compiler`, `@angular/compiler-cli` @22.1.2 — installed
    `node_modules`, `package.json` read.
  - ng-packagr@22.2.4 — `registry.npmjs.org/ng-packagr/latest` [S9]. Not installed here.
  - ng-primitives@0.130.3 — caller pin, read on unpkg.
  - `@angular/aria`@22.2.1 — unpkg. Not installed; the pin comes from the anchors file.
- Angular behavior comes from the installed `fesm2022` runtime and the compiler-cli bundles,
  read directly (2026-10-02). angular.dev pages were fetched only for the documented intent.
- WebFetch output for unpkg files (`@angular/aria`, ng-primitives, ng-packagr) is
  model-extracted. Code was asked for verbatim, but treat line-level detail as a quote, not a
  diff.
- Line numbers on `node_modules` files are exact (Read tool).

## Evidence

**Runtime: hostDirectives**

- Host directives are put _before_ the matched directives, so their constructors and host
  bindings run first. The host's binding to the same attribute runs last and wins.
  [R6][S1]
- In 22.1.2, a host directive reached twice is de-duplicated: binding maps merge, nothing
  throws [R2].
- A host directive that the template also matched is dropped in favor of the template match
  [R2].
- NG0309 ("matches multiple times") now fires only on a duplicate in the final list [R5].
- Two paths exposing one input under different aliases throw NG0312 [R3].
- A host directive must be standalone (NG0308) and must not be a component (NG0310) [R4].
- Its selector is ignored [S1].
- A host directive's inputs and outputs stay hidden unless the host lists them in `inputs` /
  `outputs` [R12].
- A signal `input()` on the core cannot be set by the host directive's own host, because
  `InputSignal` is read-only from code. The core would have to expose it to the consumer, or
  take state through DI or a method. [R12]
- Each host directive gets its own directive slot, injector entry and host-binding opcode per
  element [R7][R8]. One tree toggle per visible row means one extra instance per row.
- The host and the host directive "can inject the instances of those host directives and vice
  versa" [S1].
- If both inject each other during construction, the node injector's `resolving` flag throws
  NG0200 "Circular dependency detected" [R8][R9].
- The host's providers win over the host directive's providers for the same token [S1].
- The host's `.d.ts` carries `hostDirectives: [{ directive: typeof Core; … }]`, so the
  internal class is referenced from the public typings [R21].

**Runtime: inheritance**

- `ɵɵInheritDefinitionFeature` walks the base chain and merges the base's inputs, outputs,
  host attributes and host-binding count into the subclass definition [R10].
- Base host bindings run first and the subclass's run second, inside one function on one
  instance [R11].
- `ɵɵHostDirectivesFeature` has `ngInherit = true`. A base can later carry its own
  `hostDirectives` and every subclass gets them. [R1]

**Compiler and packaging**

- The private-export check runs only when a flat-module entry point exists. That happens only
  when `flatModuleOutFile` is set. [R14][R15]
- ng-packagr sets `flatModuleOutFile: \`${entryPoint.flatModuleFile}.js\`` for every entry
  point [S8].
- The directive handler adds `hostDirectives` references to that graph [R16].
- The only other `referencesRegistry.add` site is NgModule `exports` [R16]. Base classes are
  never added, so they never trip NG3001.
- The lib's `build` target is `@angular/build:application` over `src/index.ts`, not
  ng-packagr [R24]. NG3001 does not fire today; it is a packaging-day failure.
- A directive with no `selector` key compiles. The selector error fires only for an explicit
  empty selector [R17].
- An NgModule declaration also requires a selector [R17]. Neither case applies to a
  standalone abstract base.
- `typeCheckHostBindings` defaults to `true` [R22] and is set in the lib's tsconfig [R23].
- Type-checking sees only literal `PropertyAssignment` entries of `host` [R18]. The
  language-service source comments: "We only support type checking of static bindings." [R19]
- The static evaluator _does_ resolve `host: { ...SHARED_CONST }` [R20]. Spread-in bindings
  compile, but are never type-checked [R18].

**Precedence on the host element**

- Host binding vs consumer template on one property: "If one value is static and the other
  dynamic, the dynamic value wins" [S2].
- "If both values are static, the instance binding wins" [S2].
- So D7's always-`type="button"` must be the dynamic binding `'[attr.type]': '"button"'`. A
  static `'type': 'button'` host attribute loses to a consumer's `type="submit"`. This holds
  for every option.

**The functional-API trend, tested**

- Real for DI and the member APIs: the style guide says to prefer `inject()` over constructor
  parameters [S3].
- Angular's guidance on host bindings is "Always prefer using the `host` property over
  `@HostBinding`" [S2]. That is decorator metadata, not a function.
- The installed `core.d.ts` has no public host-binding function. The only matches are
  `ɵɵHostDirectivesFeature`, `ɵɵsyntheticHostProperty` and `ɵɵsyntheticHostListener` [R29].
- ng-primitives' `createPrimitive` runs a plain function inside `runInInjectionContext` and
  publishes its state through an `InjectionToken` [S6].
- Its `attrBinding` and `dataBinding` write the DOM inside
  `afterRenderEffect` (browser) or `effect` (server). `listener` uses `addEventListener` plus
  `DestroyRef`. [S5]
- `NgpCollapsibleTrigger` is still a class: its constructor calls `ngpCollapsibleTrigger({ id })`
  [S4].
- `@angular/aria`, Angular's own headless library, uses class directives with `host:`
  metadata that reads a plain `AccordionTriggerPattern` object built in `ngOnInit` [S7].
- `@angular/aria` shares `DeferredContentAware` through `hostDirectives` and exports it as
  `ɵɵDeferredContentAware` [S7].
- `@angular/aria`'s `AccordionTrigger` sets `type="button"` with a one-off `setAttribute`, and
  only when the attribute is absent [S7].

**Repo**

- Today's tree toggle binds `(click)`, `aria-expanded` and `data-expanded` through `host:` on
  protected members. Protected access in host bindings already type-checks. [R25]
- The repo has no `hostDirectives` or `extends` in `src/` (grep, 2026-10-02).
- TR37: no attribute is bound by two directives on one element [R27].
- `expansion.md` already blesses "a private `NgpActivation` directive … host-composed … never
  exported from `index.ts`" [R26]. Under ng-packagr, that sentence describes an NG3001 build
  failure [R13][R16].

## Comparison

Requirements come from the caller's constraints and from D1, D2, D4 and D7 [R30].

| Requirement                                         | (1) abstract base `@Directive`                                     | (2a) hostDirective, core injects token (`useExisting`)                           | (2b) hostDirective, host injects core and pushes                                   | (3) ng-primitives-style function                                  | (4) shared `host` const spread                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Core not exported from `index.ts`, ng-packagr build | yes [R16]                                                          | **no, NG3001** [R13][R16][S8]                                                    | **no, NG3001** [R13][R16][S8]                                                      | yes (plain function)                                              | yes (const only)                                                                          |
| No `effect()` DOM write                             | yes [R11]                                                          | yes [R6]                                                                         | yes [R6]                                                                           | **no** [S5]                                                       | yes                                                                                       |
| TR37 single writer per attribute                    | one directive; a subclass rebinding a core key silently wins [R11] | two directives; the host's same-key binding silently wins [R6][S1]               | same as 2a [R6]                                                                    | not detectable: effect plus `setAttribute` bypass precedence [S5] | one directive; a later literal key silently replaces the spread key (JS object semantics) |
| Core bindings type-checked                          | yes, against the base's abstract members [R18][R19]                | yes, against the core [R18]                                                      | yes [R18]                                                                          | n/a (no template expression)                                      | **no**, spread entries are skipped [R18][R19]                                             |
| `isOpen` / `toggle` can stay `protected`            | yes (`protected abstract`) [R25]                                   | no: the token type needs public members on the exported directive                | yes, but the core needs a public `connect()`                                       | yes                                                               | no if enforced with `implements` (interfaces are public-only)                             |
| DI wiring                                           | none                                                               | token, provider, `forwardRef`; NG0200 if the host also injects the core [R8][R9] | `inject(Core)` in the host constructor; works because the core is built first [R6] | `runInInjectionContext` [S6]                                      | none                                                                                      |
| Extra instance per toggle                           | 0 [R11]                                                            | +1 [R7]                                                                          | +1 [R7]                                                                            | 0, plus effect nodes [S5]                                         | 0                                                                                         |
| Composition vs inheritance                          | inheritance (one abstract level)                                   | composition                                                                      | composition                                                                        | composition                                                       | composition (metadata)                                                                    |
| Leaks the internal type into public `.d.ts`         | `extends Core` in the subclass `.d.ts`                             | `typeof Core` in `ɵdir` [R21]                                                    | `typeof Core` in `ɵdir` [R21]                                                      | no                                                                | no                                                                                        |

## Synthesis

- **Composition preference vs packaging.** `hostDirectives` is Angular's composition mechanism,
  and `@angular/aria` uses it [S7]. But Angular's own library had to export the shared
  directive (as `ɵɵ`) to ship it. NG3001 would force the same here [R13][R16]. The user's
  preference and the settled "not exported" contract conflict under (2), and only one can hold.
- **Functional vs repo rules.** ng-primitives gets its function shape _because_ it writes the
  DOM from effects [S5]. Copying the shape without the effects leaves only (4). (4) gives up
  type-checking of exactly the strings that carry the contract [R18][R19].
- **Inheritance cost, concretely.** The usual objections are deep hierarchies, shared mutable
  state and constructor coupling. A selectorless abstract class with no constructor, no state
  and four host entries has none of them. Its real costs:
  - It uses up the single `extends` slot.
  - A subclass can silently override a core binding [R11]. This is the same silent-override
    property (2) has [R6].
- **Who wins on override.** Every option resolves a same-attribute collision silently (subclass,
  host, or later literal key). TR37 stays a review rule in every option and no mechanism enforces
  it. That does not tell the options apart.
- **Trajectory.** If a second shared mechanism appears later (the `NgpActivation` idea [R26]), a
  base class can carry it through inherited `hostDirectives` [R1]. That returns to (2)'s
  packaging question only for that mechanism.

## Against

- **The user's preference has backing.** Angular added de-duplication to `hostDirectives` in
  22.1.2 [R2], and its newest library composes this way [S7]. If the lib never goes through
  ng-packagr (source-consumed via path alias, as today [R24]), (2a) has no blocker beyond public
  `isOpen`/`toggle`.
- **(2) keeps the feature directive free of any base.** `ngpTableTreeToggle` stays a flat class,
  and its tests need no knowledge of a parent.
- **The `ɵ`-prefix export is a recognized Angular convention** for "visible to the compiler, not
  API" [S7]. Accepting it is a defensible amendment to the "not exported" contract rather than
  a hack.
- **(1) puts `extends NgpCollapsibleTrigger` in the public `.d.ts`.** Consumers can see the base
  name, even though they cannot import it.

## Recommended shape (sketch, not a spec)

```ts
// directives/collapsible-trigger.ts — not re-exported from index.ts
@Directive({
  host: {
    '[attr.type]': '"button"',
    '(click)': 'toggle()',
    '[attr.aria-expanded]': 'isOpen() ? "true" : "false"',
    '[attr.data-expanded]': 'isOpen() ? "" : null',
  },
})
export abstract class NgpCollapsibleTrigger {
  protected abstract readonly isOpen: () => boolean;
  protected abstract toggle(): void;
}
```

`export` is on the file only, so the subclass `.d.ts` can name it. The feature directive keeps
its own selector, its disabled/`aria-hidden` branch and its dev throw, per D1 and D9 [R30].

## Not researched

- Angular CDK and Material use of `hostDirectives` vs base classes. `@angular/cdk` is not in
  this worktree's `node_modules`.
- Measured per-row cost of +1 host directive vs inheritance. The claim rests on the shape of
  the runtime code only [R7].
- Local compilation mode (`compilationMode: 'experimental-local'`). Cross-file spreads and
  references behave differently there.
- React or Vue analogues. Out of scope for an Angular-mechanism question.

## Unverified

- That `@angular/aria` needed the `ɵɵ` export _because of_ NG3001. Inferred from the mechanism
  [R13][R16]; no Angular commit or comment was read.
- That a `.d.ts` `extends` on a class exported from its own file (but not from `index.ts`)
  emits cleanly. TS4020 ("has or is using private name") exists in the installed TypeScript at
  `node_modules/typescript/lib/typescript.js:10233`, and it is believed to fire only when the
  base is not exported from its _module_. Confirm with
  `ngc -p libs/table/tsconfig.lib.json` after writing the base.
- That host bindings on a selectorless abstract class that call `protected abstract` members
  type-check clean. The type-check path accepts a `null` selector
  (`compiler.mjs:30236-30261`), but this was not compiled. Confirm with
  `nx run shared-table:typecheck`.
- That a consumer's compiler needs no metadata from an unexported base with zero inputs. This is
  an inference; probe with a packed build.
- In which Angular version host-directive de-duplication landed. The search results
  (briantree.se, dev.to) say v22, but they were not opened. The 22.1.2 source confirms only that
  it is present [R2].
- The `@angular/aria` `_pattern` creation in `ngOnInit` comes from a WebFetch summary. The tool
  refused a verbatim quote of the full class. [S7]

## Sources

|     | Source                                                                                       | Version         | Verified                                                                                                             |
| --- | -------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| S1  | https://angular.dev/guide/directives/directive-composition-api                               | live 2026-10-02 | yes — page fetch; dedup sentence matches R2, override sentence matches R6                                            |
| S2  | https://angular.dev/guide/components/host-elements                                           | live 2026-10-02 | yes — page fetch; gave the static-vs-dynamic rule that changes D7's binding form                                     |
| S3  | https://angular.dev/style-guide                                                              | live 2026-10-02 | yes — page fetch; has the `inject()` rule, no guidance on inheritance or composition                                 |
| S4  | https://unpkg.com/ng-primitives@0.130.3/fesm2022/ng-primitives-collapsible.mjs               | 0.130.3         | yes — read; the "functional" trigger is still a class directive wrapping a function                                  |
| S5  | https://unpkg.com/ng-primitives@0.130.3/fesm2022/ng-primitives-state.mjs                     | 0.130.3         | yes — read `attrBinding`/`dataBinding`/`isomorphicEffect`/`listener`; DOM writes go through effects                  |
| S6  | https://unpkg.com/ng-primitives@0.130.3/fesm2022/ng-primitives-state.mjs (`createPrimitive`) | 0.130.3         | yes — read                                                                                                           |
| S7  | https://unpkg.com/@angular/aria@22.2.1/fesm2022/accordion.mjs                                | 22.2.1          | yes — read export line, imports, host metadata; `_pattern` detail is a summary                                       |
| S8  | https://unpkg.com/ng-packagr@22.2.4/src/lib/ts/tsconfig.js                                   | 22.2.4          | yes — read `initializeTsConfig` overrides; this made NG3001 a real risk instead of a theoretical one                 |
| S9  | https://registry.npmjs.org/ng-packagr/latest                                                 | 22.2.4          | yes — fetched                                                                                                        |
| S10 | https://briantree.se/angular-host-directives-deduplicate-shared-directives/                  | —               | no — cited only (search result)                                                                                      |
| R1  | node_modules/@angular/core/fesm2022/\_debug_node-chunk.mjs:10490-10504                       | 22.1.2          | yes — read                                                                                                           |
| R2  | node_modules/@angular/core/fesm2022/\_debug_node-chunk.mjs:10548-10562                       | 22.1.2          | yes — read; corrects the older "NG0309 on double match" belief                                                       |
| R3  | node_modules/@angular/core/fesm2022/\_debug_node-chunk.mjs:10563-10574                       | 22.1.2          | yes — read                                                                                                           |
| R4  | node_modules/@angular/core/fesm2022/\_debug_node-chunk.mjs:10607-10620                       | 22.1.2          | yes — read                                                                                                           |
| R5  | node_modules/@angular/core/fesm2022/\_debug_node-chunk.mjs:8679-8697                         | 22.1.2          | yes — read (and `assertNoDuplicateDirectives` at 8926-8937)                                                          |
| R6  | node_modules/@angular/core/fesm2022/\_debug_node-chunk.mjs:10505-10533                       | 22.1.2          | yes — read; host directives pushed before matches                                                                    |
| R7  | node_modules/@angular/core/fesm2022/\_debug_node-chunk.mjs:8716-8767                         | 22.1.2          | yes — read                                                                                                           |
| R8  | node_modules/@angular/core/fesm2022/\_debug_node-chunk.mjs:709-723                           | 22.1.2          | yes — read                                                                                                           |
| R9  | node_modules/@angular/core/fesm2022/\_pending_tasks-chunk.mjs:519-522                        | 22.1.2          | yes — read (code -200)                                                                                               |
| R10 | node_modules/@angular/core/fesm2022/\_debug_node-chunk.mjs:10640-10692                       | 22.1.2          | yes — read                                                                                                           |
| R11 | node_modules/@angular/core/fesm2022/\_debug_node-chunk.mjs:10748-10758                       | 22.1.2          | yes — read                                                                                                           |
| R12 | node_modules/@angular/core/types/\_debug_node-chunk.d.ts:6519-6533                           | 22.1.2          | yes — read                                                                                                           |
| R13 | node_modules/@angular/compiler-cli/bundles/chunk-B4766EOF.js:2056-2100                       | 22.1.2          | yes — read                                                                                                           |
| R14 | node_modules/@angular/compiler-cli/bundles/chunk-B4766EOF.js:5155-5161                       | 22.1.2          | yes — read                                                                                                           |
| R15 | node_modules/@angular/compiler-cli/bundles/chunk-B4766EOF.js:5521-5538                       | 22.1.2          | yes — read                                                                                                           |
| R16 | node_modules/@angular/compiler-cli/bundles/chunk-GHRGMTHM.js:3258-3267                       | 22.1.2          | yes — read; grep found the only other `referencesRegistry.add` at :6853 (NgModule exports)                           |
| R17 | node_modules/@angular/compiler-cli/bundles/chunk-GHRGMTHM.js:3198-3209                       | 22.1.2          | yes — read (NgModule case at :7137-7143)                                                                             |
| R18 | node_modules/@angular/compiler-cli/bundles/chunk-GHRGMTHM.js:3380-3396                       | 22.1.2          | yes — read; the finding that rules out (4)                                                                           |
| R19 | node_modules/@angular/language-service/bundles/language-service.js:38484-38485               | 22.1.2          | yes — read                                                                                                           |
| R20 | node_modules/@angular/compiler-cli/bundles/chunk-A2CBMQIU.js:2563-2573                       | 22.1.2          | yes — read                                                                                                           |
| R21 | node_modules/@angular/compiler/fesm2022/compiler.mjs:26192-26209                             | 22.1.2          | yes — read                                                                                                           |
| R22 | node_modules/@angular/compiler-cli/bundles/chunk-B4766EOF.js:5174                            | 22.1.2          | yes — read                                                                                                           |
| R23 | libs/table/tsconfig.json:27-33                                                               | —               | yes — read                                                                                                           |
| R24 | libs/table/project.json:28-37                                                                | —               | yes — read                                                                                                           |
| R25 | libs/table/src/directives/ngp-table-tree-toggle.directive.ts:54-89                           | —               | yes — read                                                                                                           |
| R26 | libs/table/docs/3-ui/directives/expansion.md:325                                             | —               | yes — read                                                                                                           |
| R27 | libs/table/docs/decisions/tree.md:89                                                         | —               | yes — read                                                                                                           |
| R28 | libs/table/CLAUDE.md:84                                                                      | —               | yes — read ("`hostDirectives` only for unconditional or internal-mechanism behavior")                                |
| R29 | node_modules/@angular/core/types/core.d.ts:4386                                              | 22.1.2          | yes — grep `declare function \w*[Hh]ost\w*`; the only other matches are `ɵɵ`/`getHostElement` at :4735, :5707, :5857 |
| R30 | libs/table/docs/3-ui/work/directive-api-surface/active/collapsible-core/1-decisions.md:14-22 | —               | yes — read                                                                                                           |
