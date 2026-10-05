# How should ng-table expose styling once it is headless like ng-primitives, with optional stylesheets like Angular Material?

**Date:** 2026-09-23 · **Depth:** standard

## Answer

**The question folds together two kinds of CSS custom property, and the precedents split along
that line.** Headless libraries expose only **output** variables. The library writes them from
a measurement (`--ngp-popover-available-width`, Base UI `--anchor-width`) [S3][S14]. Material
exposes **input** tokens instead. The consumer sets them, and CSS the library ships reads them
(`var(--mat-table-background-color, var(--mat-sys-surface))`) [S9]. A directive that ships no
CSS has nothing that reads an input token. So in ng-table, **input tokens exist only inside
the optional stylesheets that read them**, and each sheet owns its own token list.

Proposed contract:

- State goes out as `data-*`: presence for booleans, a value for enums [S1][S2].
- Measured values go out as output `--ngp-table-*` variables.
- The library sets classes only where Angular's `animate.enter`/`animate.leave` needs one
  [S17].
- The library ships one opt-in sheet per capability, never loaded automatically. Each sheet
  sits in a cascade layer and reads its own input tokens [S12][S20].

This keeps D3–D5. It questions D6's `ngp-table-row--flip` class. It reverses
`styling-tokens.md`'s rejection of the headless model, along with its directive-level tokens.

## Method

- **ng-primitives 0.130.3**, from `node_modules/ng-primitives/package.json`. The brief said
  `^0.130.1`, and the installed copy resolves to `.3`. All reads are of `fesm2022/*.mjs` and
  `example-theme/index.css`. The docs site (angularprimitives.com) has no version marker, so
  doc claims were checked against the 0.130.3 source. One doc claim did not hold (S6).
- **@angular/cdk 22.1.7**, from `node_modules/@angular/cdk/package.json`.
  **@angular/material 22.1.7**, from `registry.npmjs.org/@angular/material/latest` (not
  installed). Material files were read from `unpkg.com/@angular/material@22.1.7`. The Material
  theming guide was read from the `22.1.x` **branch** on raw.githubusercontent. That is a
  branch, not a tag, so the prose is only pinned to a minor line.
- **@angular/core and @angular/platform-browser 22.1.2**, installed.
- Broadening: **@base-ui/react 1.8.0** (from the registry). Its docs pages show `1.8.0`.
- Repo read on 2026-09-23 at `main` (`3c72f70`), including uncommitted working-tree state.
- Reliability: in these sources, "CSS variable" can mean an output (the library writes it) or
  an input (the consumer writes it). Every cell below says which one.

## Evidence

**ng-primitives 0.130.3**

- `dataBinding()` throws unless the name starts with `data-`. It maps `true`→`""` (the
  attribute is present), `false`→removed, and anything else to a string value [S1]
- Booleans use presence: `data-hover`, `data-press`, `data-focus`, `data-disabled`,
  `data-checked`, `data-selected`, `data-active` [S1][S2][S4]
- Enums carry a value: `data-orientation`, `data-placement`, and `data-focus-visible` holds
  the focus origin, e.g. `keyboard` [S2][S4][S5]
- Hover, press and focus attributes come from shared interaction helpers. The global switch is
  `provideInteractionsConfig({ hover, press, focus, focusVisible, disabled })` [S2]
- Every `--ngp-*` variable the directives write is a measured or computed output:
  `--ngp-popover-trigger-width`, `--ngp-popover-transform-origin`,
  `--ngp-popover-available-width/height`, `--ngp-toast-offset-*`, `--ngp-color-swatch-color`,
  and the collapsible content width and height [S3][S7]
- The directives also write inline **geometry** styles: `left.px`/`top.px` on overlays,
  `width.%` on progress, and a visually-hidden style set in a11y [S3]
- **No class bindings anywhere in fesm2022** (negative result:
  `[class.`, `classList.add`, `classList.toggle`) [S3]
- Enter/exit animation is a presence attribute pair, `data-enter`/`data-exit`. The library
  waits for `element.getAnimations()` to settle before it removes the element [S8]. Collapsible
  sets them only after the first render, "preventing animation on page load" [S7]
- The docs animation example is `:host[data-enter] { animation: … }` [S10]
- The docs say it "ships with no built-in styles" [S11]. The package **does** export
  `./example-theme/index.css`: "a sample theme for the ng-primitives examples". It has only
  `:root`/`.dark` custom properties (a semantic layer, `--ngp-background`, `--ngp-text-primary`,
  `--ngp-border`, …) and no component selectors [S12]
- Styled components are distributed as copied source: the `primitive` schematic has
  `styles: 'css' | 'unstyled'` ("`css` includes the full example styles") [S13]

**Angular Material 22.1.7**

- Component CSS is embedded in the component (`ViewEncapsulation.None`) and reads component
  tokens through a fallback chain. Example:
  `var(--mat-table-background-color, var(--mat-sys-surface))`, and
  `var(--mat-table-row-item-container-height, 52px)` [S9]
- Component tokens map to system values in the `_m3-*.scss` file. Example:
  `table-background-color: map.get($system, surface)` [S15]
- `mat.table-overrides($tokens)` → `batch-create-token-values`. An unknown token name is a
  Sass `@error` that lists the valid names [S16][S18]. Tokens are emitted as `--mat-#{$key}` [S18]
- The prebuilt themes (`prebuilt-themes/*.css`, exported with the `style` condition) contain
  **only** `--mat-sys-*` declarations under `html`. There are no component selectors and no
  component tokens [S19][S21]
- The theming guide says that overriding component CSS outside the theming APIs is strongly
  discouraged and not directly supported. DOM structure and classes are private. It also says
  "CSS variables used by the Angular Material components should be defined through the
  `overrides` API instead of defined explicitly." [S22]
- The guide shows `--mat-sys-*` being **read** by the consumer's own CSS
  (`background: var(--mat-sys-primary-container)`) [S22]

**Angular CDK 22.1.7**

- Three CSS files ship, exported with the `style` condition: `a11y-prebuilt.css`
  (`.cdk-visually-hidden`), `overlay-prebuilt.css`, and `text-field-prebuilt.css` [S20]
- **These files are redundant at runtime.** `_CdkPrivateStyleLoader.load()` creates a hidden
  `ViewEncapsulation.None` component the first time the feature is used, once per app. The
  text-field loader's `styles` string is the prebuilt file word for word [S23][S24]
- All of that CSS is structural or behavioral: positioning, `pointer-events`, `z-index`, and
  autofill-detection keyframes. The one visual default, the dark backdrop colour, is an opt-in
  class (`.cdk-overlay-dark-backdrop`). There are no custom properties [S20]
- The backdrop transition has a `@media (prefers-reduced-motion)` override [S20]
- Drag-drop wraps its reset in `@layer cdk-resets` [S25]
- State is exposed as **classes**: `cdk-drag-dragging`, `cdk-drop-list-dragging`,
  `cdk-drag-animating`, `cdk-drag-placeholder`. Motion is inline
  `style.transform = translate3d(…)` on real sibling elements [S25]
- CDK Table ships one rule, `.cdk-table-fixed-layout { table-layout: fixed }`. Sticky writes
  inline `position`/`z-index`/offsets plus a `cdk-table-sticky` class [S26]

**Base UI 1.8.0 (broadening)**

- "Base UI components are unstyled, don't bundle CSS." State is exposed as presence attributes
  (`[data-checked]`). Its CSS variables "often contain dynamic numeric values",
  e.g. `--available-height` and `--anchor-width` [S14]
- For transitions, `[data-starting-style]`/`[data-ending-style]` hooks. The docs prefer
  transitions because they can be "smoothly cancelled midway" [S27]

**Angular 22.1.2 (bearing on D5)**

- The core `applyStyling` passes the `DashCase` flag for any property containing `-`. The DOM
  renderer's `setStyle` sends any `--`-prefixed name through `el.style.setProperty` [S28][S29]
- ng-primitives ships `'[style.--ngp-combobox-available-width.px]'` as a host binding [S30]

**ng-table today**

- `ngpTableRow` binds `[style.transform]` and `[class.ngp-table-row--flip]` [R1]
- The JSDoc in `ngpTable` says the offset feeds a `--ngp-table-row-flip-offset` binding and a
  `data-row-flip` binding. Neither exists [R2]
- No `--ngp-table-*` variable and no `data-sort-direction` exists in `src/`. Both appear only in
  docs [R3][R4]
- `row-flip.css` is the only shipped sheet, one rule, with no reduced-motion handling [R5]
- Stories import it by relative path (`../../../row-flip.css`) [R6]. `@ngp/table` is only a
  `tsconfig.base.json` path alias to `index.ts`, and `libs/table` has no `package.json`/`exports`
  [R7][R8]

## Comparison

| Axis                              | ng-primitives 0.130.3                             | Material 22.1.7                                                | CDK 22.1.7                                                  | Base UI 1.8.0                                   | ng-table today                            |
| --------------------------------- | ------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| Boolean state                     | presence `data-*` [S1]                            | private classes [S22]                                          | classes [S25]                                               | presence `data-*` [S14]                         | none shipped                              |
| Enum state                        | valued `data-*` [S4]                              | private classes [S22]                                          | —                                                           | —                                               | valued `data-row-kind`, `data-depth` [R1] |
| Library-applied animation phase   | `data-enter`/`data-exit` [S8]                     | —                                                              | class `cdk-drag-animating` [S25]                            | `data-starting-style`/`data-ending-style` [S27] | class `ngp-table-row--flip` [R1]          |
| Output variables (library writes) | yes, measured [S3]                                | no                                                             | no [S20]                                                    | yes, measured [S14]                             | none (JSDoc claims one) [R2]              |
| Input tokens (consumer writes)    | none read by components; example theme only [S12] | component + system, Sass-validated [S9][S16]                   | none [S20]                                                  | none [S14]                                      | none in src [R3]                          |
| Inline geometry styles            | yes [S3]                                          | —                                                              | yes, transform/sticky [S25][S26]                            | not checked                                     | yes, `transform` [R1]                     |
| CSS shipped                       | example theme, tokens only [S12]                  | embedded component CSS + optional tokens-only themes [S9][S21] | structural, **auto-loaded**; prebuilt copies optional [S23] | none [S14]                                      | 1 opt-in sheet [R5]                       |
| Public styling contract           | `data-*` + output vars [S11]                      | Sass mixins; classes and vars are private [S22]                | classes [S25]                                               | `data-*` + output vars [S14]                    | `data-*` + class [R1]                     |

## Synthesis

- **State channel: ng-primitives and Base UI agree, and CDK disagrees.** The two headless
  libraries use `data-*` with a strict presence-for-booleans rule [S1][S14]. CDK uses classes
  [S25]. Material keeps its classes private [S22]. The existing repo convention already
  matches the headless pair. The only class ng-table applies is `ngp-table-row--flip`, and it
  follows CDK's `cdk-drag-animating` pattern [S25][R1]. In ng-primitives, that spot would be a
  presence attribute, as `data-enter`/`data-exit` are [S8].
- **Classes have one legitimate place: Angular's `animate.*` API.** `animate.enter`/
  `animate.leave` are _class_ bindings [S17]. So preset enter/leave hooks have to be class
  names. The library ships them and the **consumer** applies them. The library never binds
  them itself. That gives a clean rule: a class the library _applies_ is state and should be
  `data-*`; a class the library only _names_ is a preset argument for `animate.*`.
- **Variables: the headless libraries and Material do opposite things.** Headless means
  output-only variables [S3][S14]. Material means input-only tokens with private names and a
  Sass gate [S9][S22]. A token needs a reader. With no shipped CSS, `--ngp-table-cell-bg` is
  just a name the consumer both writes and reads, not an API. So each input token belongs to
  the sheet that reads it.
- **Material's system layer comes from owning a design system.** Its prebuilt themes are
  nothing but `--mat-sys-*` [S21]. ng-primitives ships its semantic layer only as an "example"
  [S12]. A table library owns no palette. So the layering that transfers is Material's
  **fallback chain** (component token → literal), not a shipped system layer.
- **Material's Sass gate buys validation.** A misspelled override is a compile error [S18]. A
  plain-CSS token has no such check, and a typo silently does nothing. That is the honest cost
  of choosing CSS-only tokens.
- **CDK auto-loads because its CSS is needed for correctness** (overlay positioning) [S23].
  Every ng-table sheet is optional motion or appearance. So "never auto-loaded" is consistent
  with CDK's reasoning, not against it.
- **Inline styles: both precedents write inline geometry** (overlay `left/top`, drag
  `transform`) [S3][S25]. The CLAUDE.md "no inline styles" invariant is stricter than either.
  D5 meets it by writing a variable and leaving the `transform` to CSS. What that buys:
  without a sheet, the row gets **no** visual effect at all, where today it gets an invisible
  invert-then-clear [R1].
- **D5's host attribute removes a limitation that row-animation.md records.** The doc says
  `border-collapse: separate` "cannot be shipped inside `row-flip.css`" because the sheet
  cannot know the table's selector [R9]. With `data-row-animation` on the table (D5), the sheet
  can target `table[data-row-animation]`. Whether it _should_ is a separate decision, because
  it changes how the consumer's table looks.

## Proposed contract (discovery only, nothing decided)

**1. What directives expose**

| Channel                             | Rule                                                                                         | Examples                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| State                               | `data-*`. Presence for booleans (`""`/absent), a value for enums. Never `="true"`/`="false"` | `data-row-kind="group"`, `data-depth="2"`, `data-row-animation` |
| Measured values                     | output `--ngp-table-<part>-<measure>`, written by the library, read-only to the consumer     | `--ngp-table-row-flip-offset`                                   |
| Animation phase the library applies | `data-*` presence attribute, not a class                                                     | `ngp-table-row--flip` → e.g. `data-flipping` (see Conflicts)    |
| Preset hooks the consumer applies   | class names, **only** as arguments to Angular `animate.enter`/`animate.leave`                | `ngp-table-row--enter`, `ngp-table-row--leave`                  |
| Inline styles                       | none, which keeps the invariant. Geometry goes out as an output variable                     | D5                                                              |

**2. What the library ships**

- One opt-in sheet per capability (`row-animation.css`, later e.g. `sort-indicator.css`). No
  theme bundle. If a bundle ever ships, it should follow Material's prebuilt themes: only
  custom properties on a root selector, never component rules [S21].
- Never imported by `index.ts`, and no `_CdkPrivateStyleLoader`-style automatic loading.
- Every sheet:
  - wrapped in `@layer ngp-table`, so the consumer's unlayered rules always win without
    specificity fights (the `@layer cdk-resets` precedent) [S25];
  - selects only on the public `data-*` hooks, never on directive selectors [R9];
  - has a `prefers-reduced-motion` branch for any motion [S20].
- Published through a package `exports` entry with the `style` condition, as all three
  precedents do [S19][S20][S12]. The lib has no package manifest today [R8].

**3. Tokens**

- Name: `--ngp-table-<part>-<property>`, e.g. `--ngp-table-row-flip-duration`,
  `--ngp-table-row-flip-easing`.
- **Input tokens exist only in a shipped sheet, and each sheet lists the tokens it reads.**
- Each read carries a literal fallback, Material-style:
  `transition: transform var(--ngp-table-row-flip-duration, 300ms) …` [S9].
- No shipped system layer. A consumer maps tokens to their own design system:
  `--ngp-table-row-flip-duration: var(--my-motion-medium)`.
- Docs mark each variable **output** (the library writes it) or **input** (the consumer
  writes it).

**4. Consumer-authored styling without the sheets**

```css
[data-row-kind='group'] {
  font-weight: 600;
}
[data-depth='2'] > td:first-child {
  padding-inline-start: 2rem;
}
[data-row-animation] [data-row-kind] {
  transform: translateY(var(--ngp-table-row-flip-offset, 0));
}
[data-row-animation] [data-flipping] {
  transition: transform 200ms ease-out;
}
```

Enter/exit: the consumer's own classes on `animate.enter`/`animate.leave` (D1). Tailwind reads
the same hooks: `data-[row-kind=group]:font-semibold` (styling-tokens.md, still holds).

**5. styling-tokens.md: what holds, what reverses**

- Holds: `data-*` for state; the Tailwind fit; the rejection of "fixed classes only"; no
  default sort icon.
- Reverses:
  - the rejection of ng-primitives' headless model (its premise, an in-house design-system
    component with Atera tokens, is gone);
  - `--ngp-table-cell-bg` as a directive-level token (nothing reads it);
  - "values as CSS custom properties" as a directive concern. It narrows to _measured_ values.
- Open questions to move: the row height / CDK `itemSize` question stops being a token-catalog
  question (see Unverified).

**Conflicts with existing conventions**

1. `libs/table/CLAUDE.md`: "No inline styles on directives". Shipped code binds
   `[style.transform]` [R1][R10]. D5 fixes it.
2. The same invariant, "State as `data-*`", against the applied class `ngp-table-row--flip`
   [R1]. The plan's D6 keeps it "unchanged" [R11]. The ADR has two options: make it a presence
   attribute, or record it as an exception.
3. `row-animation.md` v0.4 says the library ships enter/exit support with "no class" [R9]. Plan
   D3/D6 ships the preset classes `--enter`/`--leave` [R11]. There is no real conflict under
   the rule "names, never applies", but the doc wording has to change.
4. `row-animation.md` rejects `[style.--x.px]` as "not reliably applied" [R9]. A static read of
   Angular 22.1.2 and ng-primitives' shipped usage both point the other way [S28][S29][S30].
   See Unverified.
5. The docs promise `@import '@ngp/table/row-flip.css'` [R9], and nothing publishes it [R7][R8].
6. Stale JSDoc in `ngp-table.directive.ts` names a variable and an attribute that do not exist
   [R2].
7. `row-animation.md`: "border-collapse cannot be shipped". D5's host attribute makes it
   shippable [R9][R11].
8. The `ngp` prefix is shared with ng-primitives' own `--ngp-*` variables and `ngp*`
   selectors. There is no collision today (no `table` primitive, and no `--ngp-table` in
   0.130.3) [S12][S31].

## Against

- Material deliberately keeps its variables **private** and puts a validated Sass API in
  front of them [S18][S22]. Publishing `--ngp-table-*` names as public API gives up the ability
  to rename them without a breaking change, and it gives up typo detection.
- CDK, the closest Angular precedent for "headless with a few sheets", uses **classes** for
  state [S25]. The data-attribute rule follows the React-lineage headless libraries, not CDK.

## Not researched

- Radix, React Aria, Ark UI, TanStack Table, AG Grid's theming API. Base UI was the only
  broadening pass outside the brief.
- Material's M2 token path, and density handling.
- Whether ng-primitives' docs site has a version selector.

## Unverified

- **Does `[style.--x.px]` work in Angular 22.1.2?** A static read says yes: the suffix is
  appended by `normalizeSuffix`, and `--` names go through `setProperty` [S28][S29].
  ng-primitives ships the form [S30]. Not run. row-animation.md's failure happened alongside
  the `querySelectorAll('[ngpTableRow]')` bug, which it also records [R9], so the cause may
  have been misattributed. To confirm: the D5 devtools check in the plan's Verification
  section [R11].
- **Setting `--mat-table-background-color` in plain CSS changes a mat-table.** This is an
  inference from the `var()` read [S9]. The guide calls it unsupported [S22]. Not run.
- **Row height / `itemSize` becomes a consumer input rather than a token.** This is an
  inference from "directives read no tokens". Not checked against `virtual-scroll.md`.
- The prebuilt-theme contents (tokens only, no `.mat-*`) come from a fetched summary of an
  8.5 KB file with a substring check, not a full read [S21].
- Material theming-guide wording is from the `22.1.x` branch, not a tag [S22].

## Sources

|     | Source                                                                                                                                              | Version       | Verified                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| S1  | `node_modules/ng-primitives/fesm2022/ng-primitives-state.mjs:281` (`dataBinding`)                                                                   | 0.130.3       | yes, source read; set the presence-vs-value rule                                                                                 |
| S2  | `node_modules/ng-primitives/fesm2022/ng-primitives-interactions.mjs:8-39` (config), `:260` (`data-hover`), `:357` (`data-press`), `:872` (exports)  | 0.130.3       | yes, source read                                                                                                                 |
| S3  | `node_modules/ng-primitives/fesm2022/ng-primitives-popover.mjs:492-497`                                                                             | 0.130.3       | yes, source read; plus a repo-wide grep of `styleBinding(`, `[class.` and `classList` (no class bindings)                        |
| S4  | `node_modules/ng-primitives/fesm2022/ng-primitives-listbox.mjs:254-256`                                                                             | 0.130.3       | yes, source read                                                                                                                 |
| S5  | `node_modules/ng-primitives/fesm2022/ng-primitives-interactions.mjs:111` (`data-focus-visible` = origin)                                            | 0.130.3       | yes, source read                                                                                                                 |
| S6  | https://angularprimitives.com/interactions/hover                                                                                                    | unmarked      | yes, page read; **corrected**: the docs say `provideInteractionConfig`, the published export is `provideInteractionsConfig` [S2] |
| S7  | `node_modules/ng-primitives/fesm2022/ng-primitives-collapsible.mjs:192-270`                                                                         | 0.130.3       | yes, source read                                                                                                                 |
| S8  | `node_modules/ng-primitives/fesm2022/ng-primitives-internal.mjs:105-170` (`setupExitAnimation`)                                                     | 0.130.3       | yes, source read                                                                                                                 |
| S9  | https://unpkg.com/@angular/material@22.1.7/fesm2022/table.mjs (MatTable `styles`)                                                                   | 22.1.7        | yes, published bundle read                                                                                                       |
| S10 | https://angularprimitives.com/primitives/popover                                                                                                    | unmarked      | yes, page read                                                                                                                   |
| S11 | https://angularprimitives.com/getting-started/styling                                                                                               | unmarked      | yes, page read; "no built-in styles" is true for components only, see S12                                                        |
| S12 | `node_modules/ng-primitives/example-theme/index.css`                                                                                                | 0.130.3       | yes, file read; exported at `node_modules/ng-primitives/package.json:62`                                                         |
| S13 | `node_modules/ng-primitives/schematics/ng-generate/schema.json`                                                                                     | 0.130.3       | yes, file read                                                                                                                   |
| S14 | https://base-ui.com/react/handbook/styling                                                                                                          | 1.8.0         | yes, page read                                                                                                                   |
| S15 | https://unpkg.com/@angular/material@22.1.7/table/_m3-table.scss                                                                                     | 22.1.7        | yes, published file read                                                                                                         |
| S16 | https://unpkg.com/@angular/material@22.1.7/table/_table-theme.scss                                                                                  | 22.1.7        | yes, published file read                                                                                                         |
| S17 | `node_modules/@angular/core/types/core.d.ts:5256-5285`                                                                                              | 22.1.2        | yes, installed package read                                                                                                      |
| S18 | https://unpkg.com/@angular/material@22.1.7/core/tokens/_token-utils.scss                                                                            | 22.1.7        | yes, published file read                                                                                                         |
| S19 | https://registry.npmjs.org/@angular/material/latest (`exports`)                                                                                     | 22.1.7        | yes, registry read                                                                                                               |
| S20 | `node_modules/@angular/cdk/package.json:21-44`                                                                                                      | 22.1.7        | yes, installed package read                                                                                                      |
| S21 | https://unpkg.com/@angular/material@22.1.7/prebuilt-themes/azure-blue.css                                                                           | 22.1.7        | partial, fetched summary plus substring check                                                                                    |
| S22 | https://raw.githubusercontent.com/angular/components/22.1.x/guides/theming.md                                                                       | 22.1.x branch | yes, raw markdown read ("Customizing Tokens", "Direct Style Overrides")                                                          |
| S23 | `node_modules/@angular/cdk/fesm2022/_style-loader-chunk.mjs:5-29`                                                                                   | 22.1.7        | yes, source read; **changed the finding**: the prebuilt CSS is not the only way the styles arrive                                |
| S24 | `node_modules/@angular/cdk/fesm2022/text-field.mjs:10-68`                                                                                           | 22.1.7        | yes, source read                                                                                                                 |
| S25 | `node_modules/@angular/cdk/fesm2022/drag-drop.mjs:239-282` (`@layer cdk-resets`), `:1146`, `:1527`, `:2808`, `:3230`                                | 22.1.7        | yes, source read                                                                                                                 |
| S26 | `node_modules/@angular/cdk/fesm2022/table.mjs:2219`, `:1066-1085`                                                                                   | 22.1.7        | yes, source read                                                                                                                 |
| S27 | https://base-ui.com/react/handbook/animation                                                                                                        | 1.8.0         | yes, page read                                                                                                                   |
| S28 | `node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:5123-5143` (`applyStyling`), `:17019` (`normalizeSuffix`)                                | 22.1.2        | yes, source read                                                                                                                 |
| S29 | `node_modules/@angular/platform-browser/fesm2022/_dom_renderer-chunk.mjs:647-655` (`setStyle`)                                                      | 22.1.2        | yes, source read                                                                                                                 |
| S30 | `node_modules/ng-primitives/fesm2022/ng-primitives-combobox.mjs:106-117`                                                                            | 0.130.3       | yes, source read                                                                                                                 |
| S31 | `node_modules/ng-primitives` (grep for `ngpTable` and `--ngp-table`)                                                                                | 0.130.3       | yes, negative result                                                                                                             |
| R1  | `libs/table/src/directives/ngp-table-row.directive.ts:20-32`                                                                                        | —             | yes, read                                                                                                                        |
| R2  | `libs/table/src/directives/ngp-table.directive.ts:87-95`                                                                                            | —             | yes, read                                                                                                                        |
| R3  | `libs/table/src` (grep for `--ngp-table-` and `data-sort-direction`)                                                                                | —             | yes, one hit only: the JSDoc in R2                                                                                               |
| R4  | `libs/table/docs/3-ui/cross-cutting/styling-tokens.md`                                                                                              | —             | yes, read                                                                                                                        |
| R5  | `libs/table/src/row-flip.css`                                                                                                                       | —             | yes, read                                                                                                                        |
| R6  | `libs/table/src/stories/row-edit/grouping-editing/grouping-editing-flip.css:1`                                                                      | —             | yes, read                                                                                                                        |
| R7  | `tsconfig.base.json:17`                                                                                                                             | —             | yes, read                                                                                                                        |
| R8  | `libs/table/project.json` (no `package.json`/`ng-package.json` in `libs/table/`)                                                                    | —             | yes, read, plus a glob                                                                                                           |
| R9  | `libs/table/docs/3-ui/directives/row-animation.md` ("Rejected: custom-property indirection", "Target `tr[ngpTableRow]` directly", "Enter and exit") | —             | yes, read                                                                                                                        |
| R10 | `libs/table/CLAUDE.md`, "Locked invariants"                                                                                                         | —             | yes, read                                                                                                                        |
| R11 | `libs/table/docs/3-ui/work/row-animation/1-plan-grouping-moves.md` D3-D6, Verification                                                              | —             | yes, read                                                                                                                        |
