# ng-table build conventions

Read this before building any component, layout region, or page block. It fixes the contract every
domain's implementation must follow so parallel agents never need to coordinate live.

## Ground rules

- **Spec wins over frame.** `docs/design-handoff/frames/*.dc.html` are reference renders only; where a
  frame and a moved spec disagree, the spec is right. Frame copy is `data-content="MOCK"` — never ship it.
- **Never hardcode a value that has a `--ngpt-*` token.** No `var(--x, fallback)` literals — the token file
  is the single source, a fallback duplicates it and can drift. The one accepted exception in this build is
  `index.html`'s inline `background` on `<html>`, which exists only to prevent a white flash before CSS
  loads and intentionally mirrors `--ngpt-bg-app`.
- **Dark-only.** No theme toggle, no `light-dark()`, no light-mode branch.
- Read your spec's full front-matter (`owns` / `does_not_own` / `depends_on` / `states` / `a11y` /
  `tokens`) — one component spec is enough context to build that component.

## Angular conventions (repo-wide, restated for this app)

- Standalone components, `ChangeDetectionStrategy.OnPush`, zoneless (already configured in
  `app.config.ts` — don't touch it).
- Separate `.html` / `.css` files via `templateUrl` / `styleUrl` — **no inline templates**, matching every
  other Angular app in this repo.
- Signals + `inject()`; new control flow (`@if`/`@for`/`@switch`, always with `track` on `@for`).
- `input()` / `output()` functions, not decorators. `readonly` fields. Explicit return types everywhere.
- No `any`, no `as` assertions — type guards instead (repo TypeScript conventions).
- Class names without a `Component` suffix (`PillButton`, not `PillButtonComponent`), matching the file
  name (`pill-button.ts`).

## This app's conventions

1. **Selector prefix `ngpt`.** Which _kind_ of selector depends on what the domain is (ADR-0005):

   **Attribute-hosted** — **camelCase** attribute naming the elements it is valid on. Use this
   whenever the domain exists to style or add behavior to an element that already has semantics:

   ```ts
   selector: 'button[ngptPillButton], a[ngptPillButton]';
   ```

   camelCase is the Angular directive-selector convention and what the rest of this repo already
   uses — `acmeDropdown`, `acmeAutocompleteInput`, `ngpTableCell`, and `ng-primitives`' own
   `ngpMenuTrigger`/`ngpSelect`. (Angular Material's `button[mat-button]` is a legacy exception;
   `matTooltip`/`matInput`/`cdkDrag` are the rule.) Element selectors stay kebab-case — the two
   naming styles are how a reader tells at a glance which kind of selector a domain declares.
   Declared as a `@Component` with `template: '<ng-content />'` and a `styleUrl`, so the CSS stays
   colocated in the domain folder under `:host()`. It hosts on the consumer's element — no wrapper
   ships.

   **Element** — kebab-case (`ngpt-code-block`), only for a domain that composes real structure of
   its own and shadows no native element.

   **The test:** if the template's root would be a semantic native element, or the host needs a
   `role=`/`aria-*` to compensate for being a custom element, it is attribute-hosted. `<ngpt-callout
role="note">` was the tell for `aside[ngptCallout]`.

   **Never re-declare native capability as an input.** `disabled`, `href`, `target`, `rel`, `type`
   are set by the consumer on the element. Inputs carry only what is the primitive's own
   (`variant`, `active`, `state`). An element wrapper forces every native affordance to be
   re-plumbed one input at a time, and whatever isn't re-plumbed is simply unavailable.

   **Opt-in behavior is a separate `@Directive` the consumer places** beside the component on the
   same element — `<button ngptIconButton ngptCopyConfirm>`. Legal because only _component +
   component_ is forbidden on one host. Do not reach for `hostDirectives`: it is statically
   resolved, so it applies the behavior to every consumer and forces the component to re-declare
   the directive's inputs (`libs/table/CLAUDE.md`). Behavior imported from `ng-primitives`
   is the exception — it arrives through `hostDirectives` because it is unconditional for the
   domain that declares it (`dropdown-pill`'s `NgpMenuTrigger`).

   **Boolean inputs mirroring a native attribute need `transform: booleanAttribute`.** Without it,
   `<button ngptPillButton disabled>` passes the string `''`, which is falsy, so a
   `'[disabled]': 'disabled() || null'` host binding _removes_ the attribute and silently
   un-disables the button. Prefer dropping the input and letting the consumer set the native
   attribute; keep it only where the value also drives styling.

2. **Variants via input + `data-variant` host attribute.**
   ```ts
   variant = input<PillButtonVariant>('default');
   ```
   ```ts
   host: { '[attr.data-variant]': 'variant()' }
   ```
   ```css
   :host([data-variant='on-band']) { ... }
   ```
   Variant unions live in `<component>.types.ts` — never inline in the component file
   (`.claude/rules/file-organization.md`).
3. **State as `data-*` attributes** — never state classes, never inline styles. Mirrors the table
   library's own invariant ("state as `data-*` attributes, values as CSS custom properties",
   `libs/table/CLAUDE.md`). Examples: `data-scrolled`, `data-open`, `data-copy-state="idle|copied|failed"`.
4. **Real interactive elements.** `<button>` for actions, `<a>` for navigation — never a `<div>` with a
   click handler. `aria-*` attributes per each spec's `a11y` front-matter. Focus ring comes from the global
   `:focus-visible` policy in `src/styles/global.css` — don't restyle focus locally unless your spec says
   an element needs a different treatment.
5. **Fixtures and copy.** Any sample/fixture data goes in `<name>.mock.ts`. Home's authored marketing copy
   goes in `pages/home/home.content.ts` as typed constants — page-local blocks (`hero-band`,
   `feature-grid`, `install-row`) take copy via `input()` / content projection, they never hardcode it.
6. **No barrels** (ADR-0002). Import other components directly from their file:
   ```ts
   import { PillButton } from '../pill-button/pill-button';
   ```
7. **Icons: local registration only** (ADR-0004).
   ```ts
   viewProviders: [provideIcons({ lucideCopy, lucideCheck })];
   ```
   Never touch `app.config.ts`. Icon sizes only via the `--ngpt-sys-icon-size-*` tokens
   (`src/styles/tokens/icons.css`). Map each spec's placeholder glyph (`▾ ⧉ ⚡ ← → ≡ × ⌕ ✓ ⓘ ⚠`) to
   the nearest real Lucide icon per `src/styles/docs/Iconography.md`'s mapping table, and record your
   choice in your domain's `docs/decisions.md`.
8. **Styling projected content: directive-per-part first, `ViewEncapsulation.None` only for
   genuinely arbitrary content.** Emulated encapsulation stamps projected nodes with the
   _declaring_ component's id, so a component can never reach markup a consumer passed into it
   with a normal descendant selector. Default fix: give each structured part its own
   attribute-hosted component (`h3[ngptFeatureGridTitle]`, `p[ngptFeatureGridText]` —
   `feature-grid/docs/decisions.md`) that styles only its own `:host` — stays under default
   encapsulation, zero leak risk. Reach for `ViewEncapsulation.None` only when the content has no
   fixed part-set to hang directives on (`ngptProse`'s arbitrary rich text — any heading level,
   lists, links, inline code). When you do use `None`: every selector in that stylesheet must be
   scoped under the component's own host class (`.ngpt-prose`) so the global-scope rules cannot
   leak, and `:host` stops working — don't reach for it. Do **not** use `::ng-deep` instead: it is
   deprecated. A component that styles only its own template never needs any of this.
9. **Reduced motion is each component's own job where it applies transforms.** `src/styles/global.css`
   handles the global scroll-behavior toggle and the generic transition-duration collapse under
   `prefers-reduced-motion: reduce`. A component that transforms on open/close (`dropdown-menu`, the
   search overlay) must itself suppress that transform under the same media query — this was intentionally
   not centralized (ADR-0003).
10. **Write your `docs/decisions.md`.** Every build agent's domain folder has a `docs/` next to its
    `spec.md` — before finishing, write `docs/decisions.md` there: glyph mapping choices, any spec-vs-frame
    call you had to make, and any delta from the fixed contract below that you couldn't avoid (report,
    don't silently improvise past it).

## Fixed component contracts

The shipped public surface of every domain. Code against this rather than reading the implementation.
Attribute-hosted rows carry the elements the selector permits — that list _is_ the contract, so
`a[ngptPillButton]` is a supported call form and `div[ngptPillButton]` is not.

Where a row says an input was **dropped**, that capability is now the consumer's native attribute
(ADR-0005); do not reintroduce it.

| Component                                             | Selector(s)                                              | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pill-button                                           | `button[ngptPillButton], a[ngptPillButton]`              | `variant: input<'default'\|'on-band'\|'on-band-inverse'>('default')`; projected label. `disabled` **dropped** — set the native attribute, `:host(:disabled)` reacts. `type="button"` applied as a constructor default only on a `<button>` without one                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| icon-button                                           | `button[ngptIconButton]`                                 | `size: input<IconButtonSize>(30)` — the only input. `icon`, `label`, `pressed`, `state` all **dropped**: the consumer authors the `<ng-icon>` and registers it locally, sets native `aria-label`, binds native `(click)`, and adds `[ngptCopyConfirm]` for confirmation. Host `[attr.data-size]`; keeps `:host([data-copy-state=…])` coloring as the contract with that directive                                                                                                                                                                                                                                                                                                                                    |
| copy-confirm                                          | `button[ngptCopyConfirm]`, `exportAs: 'ngptCopyConfirm'` | A `@Directive`, placed _beside_ a component on the same `<button>` — never via `hostDirectives`. `text: input<string>()` (unset/empty = no-op), `idleLabel`/`copiedLabel`/`failedLabel`. Exposes `state: Signal<CopyConfirmState>`, `label: Signal<string>`, `copy(): void`. Host `[attr.data-copy-state]`, `[attr.aria-label]`, `[attr.title]`, `(click)`. Hold duration read from `--ngpt-comp-icon-btn-confirm-hold`; announces through one app-wide `role="status"` region                                                                                                                                                                                                                                       |
| category-badge                                        | `span[ngptCategoryBadge]`                                | projected text only. Selector deliberately not widened — see its `docs/decisions.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| code-chip                                             | `code[ngptCodeChip]`                                     | projected code text only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| inline-link                                           | `a[ngptInlineLink]`                                      | `external: input(false, { transform: booleanAttribute })` composes `target`/`rel` and the visually-hidden "(opens in new tab)" text, falling back to any `target`/`rel` the consumer authored. `href` **dropped**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| nav-item                                              | `a[ngptNavItem]`                                         | `active`, `nested`, both `input(false, { transform: booleanAttribute })`; `data-active`, `data-nested` and `aria-current` all on the one anchor. `href` **dropped**. No router wiring this round                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| tab-switcher                                          | `ngpt-tab-switcher`                                      | `tabs: input<readonly TabItem[]>()`, `selected`/`selectedChange` via `ng-primitives/tabs` (`NgpTabset`+`NgpTabList` hostDirectives, `NgpTabButton` per item, `activateOnFocus: false`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| pagination                                            | `nav[ngptPagination]` + `a[ngptPaginationLink]`          | The consumer authors both anchors; omit one (or wrap it in their own `@if`) for the one-sided case. Link takes `side: input.required<PaginationSide>()`, which drives `data-side`, the arrow, the Previous/Next label _and_ grid placement — only the title is projected. `PaginationEntry` + `pagination.mock.ts` kept as a typed content source                                                                                                                                                                                                                                                                                                                                                                    |
| dropdown-menu                                         | `ngpt-dropdown-menu`                                     | `items: input<readonly DropdownMenuItem[]>()`, `select = output<string>()`. Wired onto `ng-primitives/menu` (`hostDirectives: [NgpMenu]`, `ngpMenuItem`/`ngpMenuItemRadio` per option) — no `open` input, no `closed` output; caller renders this inside an `<ng-template>` bound to a real `[ngpMenuTrigger]`, which owns opening/closing, positioning, portal, ARIA sync, focus trap/return, outside-click, Escape. Floating-surface box/motion recipe from `src/styles/docs/Radius and Elevation.md`; motion now keyed off `[data-enter]`/`[data-exit]`, not `[data-open]`                                                                                                                                        |
| search                                                | `button[ngptSearchField]` + `ngpt-search-overlay`        | field: `variant: input<'default'\|'on-band'>('default')`; `open` output **dropped** — bind native `(click)`. Icon, placeholder and `<kbd>⌘K</kbd>` stay in its template (the content is its identity), so it keeps local `provideIcons`. No `a[…]` host: it opens an overlay, it never navigates. The overlay stays an element component — it composes real structure and shadows no native element. overlay: `open: input<boolean>(false)`, `closed = output<void>()`, ⌘K + Esc handling, scrim, focus trap/return. Index is **stubbed**: types from `Search Index.md` (still in `docs/design-handoff/specs/`), `search.mock.ts` ships an empty index + in-memory recent-searches list — no persistence, no ranking |
| callout                                               | `aside[ngptCallout]`                                     | `kind: input<'note'\|'tip'\|'warning'>('note')`, `heading: input<string>()`; local lucide icons per kind. Keeps its own template (icon + content column) — only the host moved. `role="note"` stays explicit: `<aside>` gives `complementary`, or `generic` once nested in prose, and neither is what the spec requires. The input is `heading`, **not `title`** — `title` is a global attribute on this host and would double as a native tooltip and an accessible name                                                                                                                                                                                                                                            |
| page-footer                                           | `footer[ngptPageFooter]` + `a[ngptPageFooterLink]`       | No inputs on either; the consumer authors the link row and the copyright line is projected content. `links` **dropped**; `FooterLink` kept for `home.content.ts`. No explicit `role` — `<footer>` is `contentinfo` natively, provided it is not nested inside `<article>/<aside>/<main>/<nav>/<section>`                                                                                                                                                                                                                                                                                                                                                                                                             |
| code-block                                            | `ngpt-code-block`                                        | `code: input<string>()`, `language: input<string>()`, `showGutter: input<boolean>(true)`. The copy button is a consumer-authored `<button ngptIconButton ngptCopyConfirm>` in its template, so it registers its own lucide icons. **No Shiki this round** — plain `<pre><code>` in the spec'd container; syntax-highlight gap noted in `docs/decisions.md`                                                                                                                                                                                                                                                                                                                                                           |
| dropdown-pill                                         | `button[ngptDropdownPill]`                               | consumes dropdown-menu; host is the real trigger `<button>` itself, `hostDirectives: [NgpMenuTrigger]`; inlines pill-button's default-variant CSS rather than composing `<button ngptPillButton>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| select-trigger                                        | `button[ngptSelectTrigger]`                              | consumes dropdown-menu; host is the real trigger `<button>` itself, `hostDirectives: [NgpMenuTrigger]`, `role="combobox"` set manually alongside it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| prose                                                 | `article[ngptProse], div[ngptProse]`                     | consumes code-chip + inline-link; `measure: input<'default'\|'marketing'>('default')` drives `data-measure` for Home's headline scale. `ViewEncapsulation.None` + the `.ngpt-prose` host class are both load-bearing (rule 8) — `<article>` for a doc page, `<div>` for a Home section fragment where `<article>` would be a false claim                                                                                                                                                                                                                                                                                                                                                                             |
| preview-window                                        | `ngpt-preview-window`                                    | consumes tab-switcher + code-block + icon-button; leaf this round, no render surface yet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| navbar                                                | `ngpt-navbar`                                            | consumes search-field, pill-button, icon-button; `variant: input<'docs'\|'band'>('docs')`; band variant is transparent-over-band, white treatment, on-band search well, Documentation+GitHub only, inner row at the 1080px measure; owns its own scroll state — `signal` + passive `window` scroll listener registered via `afterNextRender`, cleaned up via `DestroyRef`, `scrolled = scrollY > 24` written to a signal (not a template expression) so zoneless CD picks it up, host `[attr.data-scrolled]`, 180ms surface transition, boolean threshold (no flicker)                                                                                                                                               |
| hero-band (page-local, `pages/home/hero-band/`)       | `ngpt-home-hero-band`                                    | consumes pill-button (on-band variants); projects the navbar via `<ng-content select="[navbar]">` so the band visually contains it per spec; owns the announcement pill, H1 clamp, lede, two filled buttons, decorative shape (`overflow: hidden`, left-anchored per spec)                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| feature-grid (page-local, `pages/home/feature-grid/`) | `div[ngptHomeFeatureGrid]`                               | No inputs — the consumer authors each `<article><ng-icon/><h3>…</h3><p>…</p></article>`, with `h3`/`p` styled via the directive-per-part `ngptFeatureGridTitle`/`ngptFeatureGridText` (no `ViewEncapsulation.None` in this domain). Owns only the track formula (`repeat(auto-fit, minmax(240px, 1fr))`) and the gap. No cards/borders/tint. Icons added per explicit user request (2026-08-23, `docs/decisions.md`) — `FeatureCell.icon` names a Lucide icon, registered locally on `Home` (not `FeatureGrid`, which stays icon-agnostic) since `home.html` authors the `<ng-icon>` directly. `FeatureCell` kept for `home.content.ts`; "six cells" is now an authoring convention, not a type constraint           |
| install-row (page-local, `pages/home/install-row/`)   | `ngpt-home-install-row`                                  | `command: input<string>()` — the only input. **Not** a code-block: a flex row in a bordered `--ngpt-bg-deep` surface. The copy button is a consumer-authored `<button ngptIconButton ngptCopyConfirm>` in its template, which owns the clipboard write and the hold; this component supplies `text` and the spec's `idleLabel`/`failedLabel`                                                                                                                                                                                                                                                                                                                                                                         |

`home.content.ts` (the authored marketing copy) is written only by the Wave 3 home-composition task —
every page-local block above takes its copy through inputs or projection, never hardcodes placeholder text.
