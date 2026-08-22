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

1. **Selector prefix `ngpt`**, element selectors, kebab-case (`ngpt-pill-button`). Already set in
   `project.json` `"prefix"` and `eslint.config.mjs`.
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
   `libs/shared/table/CLAUDE.md`). Examples: `data-scrolled`, `data-open`, `data-copy-state="idle|copied|failed"`.
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
   viewProviders: [provideIcons({ lucideCopy, lucideCheck })]
   ```
   Never touch `app.config.ts`. Icon sizes only via the `--ngpt-sys-icon-size-*` tokens
   (`src/styles/tokens/icons.css`). Map each spec's placeholder glyph (`▾ ⧉ ⚡ ← → ≡ × ⌕ ✓ ⓘ ⚠`) to
   the nearest real Lucide icon per `src/styles/docs/Iconography.md`'s mapping table, and record your
   choice in your domain's `docs/decisions.md`.
8. **Prose is the one `ViewEncapsulation.None` exception.** `ngpt-prose` styles arbitrary projected article
   markup (`h2`/`h3`/`p`/`ul`/`code`/…), which view encapsulation can't reach from outside. No other
   component needs this.
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

These selectors/inputs are decided now so downstream agents can code against them without waiting on the
upstream component's actual implementation to land first.

| Component | Selector(s) | Contract |
|---|---|---|
| pill-button | `ngpt-pill-button` | `variant: input<'default'\|'on-band'\|'on-band-inverse'>('default')`; projected label; renders `<button>` |
| icon-button | `ngpt-icon-button` | `icon: input<string>()`, `label: input<string>()` (aria-label/title), `size: input<24\|30\|32>()`; confirmation variant `state: input<'idle'\|'copied'\|'failed'>('idle')` swaps glyph/color, host `[attr.data-copy-state]`; `pressed = output<void>()` |
| category-badge | `ngpt-category-badge` | projected text only |
| code-chip | `ngpt-code-chip` | projected code text only |
| inline-link | `ngpt-inline-link` | `href: input<string>()`, `external: input<boolean>(false)` |
| nav-item | `ngpt-nav-item` | `active: input<boolean>(false)`, `nested: input<boolean>(false)`; no router wiring this round |
| tab-switcher | `ngpt-tab-switcher` | `tabs: input<readonly TabItem[]>()`, `selected: input<string>()`, `selectedChange = output<string>()`; roving-tabindex per spec `a11y` |
| pagination | `ngpt-pagination` | leaf this round, no consumers yet |
| dropdown-menu | `ngpt-dropdown-menu` | `items: input<readonly DropdownMenuItem[]>()`, `open: input<boolean>(false)`, `select = output<string>()`; host `[attr.data-open]`; floating-surface recipe from `src/styles/docs/Radius and Elevation.md` |
| search | `ngpt-search-field` + `ngpt-search-overlay` | field: `variant: input<'default'\|'on-band'>('default')`, `open = output<void>()`. overlay: `open: input<boolean>(false)`, `closed = output<void>()`, ⌘K + Esc handling, scrim, focus trap/return. Index is **stubbed**: types from `Search Index.md` (still in `docs/design-handoff/specs/`), `search.mock.ts` ships an empty index + in-memory recent-searches list — no persistence, no ranking |
| callout | `ngpt-callout` | `kind: input<'note'\|'tip'\|'warning'>('note')`; local lucide icons per kind |
| page-footer | `ngpt-page-footer` | `links: input<readonly FooterLink[]>([])` — non-empty renders Home's link row above the copyright line; `role="contentinfo"` |
| code-block | `ngpt-code-block` | consumes icon-button; `code: input<string>()`, `language: input<string>()`, `showGutter: input<boolean>(true)`; **no Shiki this round** — plain `<pre><code>` in the spec'd container, copy button reuses icon-button's confirmation states; note the syntax-highlight gap in `docs/decisions.md` |
| dropdown-pill | `ngpt-dropdown-pill` | consumes pill-button + dropdown-menu; leaf this round |
| select-trigger | `ngpt-select-trigger` | consumes dropdown-menu; leaf this round |
| prose | `ngpt-prose` | consumes code-chip + inline-link; `ViewEncapsulation.None`; `data-measure: input<'default'\|'marketing'>('default')` for Home's headline scale |
| preview-window | `ngpt-preview-window` | consumes tab-switcher + code-block + icon-button; leaf this round, no render surface yet |
| navbar | `ngpt-navbar` | consumes search-field, pill-button, icon-button; `variant: input<'docs'\|'band'>('docs')`; band variant is transparent-over-band, white treatment, on-band search well, Documentation+GitHub only, inner row at the 1080px measure; owns its own scroll state — `signal` + passive `window` scroll listener registered via `afterNextRender`, cleaned up via `DestroyRef`, `scrolled = scrollY > 24` written to a signal (not a template expression) so zoneless CD picks it up, host `[attr.data-scrolled]`, 180ms surface transition, boolean threshold (no flicker) |
| hero-band (page-local, `pages/home/hero-band/`) | `ngpt-home-hero-band` | consumes pill-button (on-band variants); projects the navbar via `<ng-content select="[navbar]">` so the band visually contains it per spec; owns the announcement pill, H1 clamp, lede, two filled buttons, decorative shape (`overflow: hidden`, left-anchored per spec) |
| feature-grid (page-local, `pages/home/feature-grid/`) | `ngpt-home-feature-grid` | `features: input<readonly FeatureCell[]>()` (6 cells); `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`; no cards/borders/icons |
| install-row (page-local, `pages/home/install-row/`) | `ngpt-home-install-row` | consumes icon-button (confirmation variant); `command: input<string>()`; **not** a code-block — a flex row in a bordered `--ngpt-bg-deep` surface; clipboard write drives idle → copied/failed → idle with the `--ngpt-comp-icon-btn-confirm-hold` (1400ms) hold; aria-label changes per state |

`home.content.ts` (the authored marketing copy) is written only by the Wave 3 home-composition task —
every page-local block above takes its copy through inputs or projection, never hardcodes placeholder text.
