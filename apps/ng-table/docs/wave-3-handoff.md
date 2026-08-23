# Wave 3 handoff — Home page composition + preview-window

Written 2026-08-23. Everything below Home is built and committed; this is the brief for the wave
that composes it. Read `apps/ng-table/CLAUDE.md` and `CONTEXT.md` first for what this app is.

---

## Where things stand

`apps/ng-table` is a dark-only docs/marketing site for **NGP Table** (`libs/shared/table`), a
headless Angular table primitive. This round's scope has always been: token foundations + the
design system + the Home landing page at `/`. Docs pages, the sidebar/TOC/3-column shell, article
content and the nav tree are a later round.

Waves 0–2 built the tokens, 16 DS components, 2 layout regions and 3 page-local Home blocks. A
refactor then converted the design system from element-selector wrappers to attribute-hosted
components — see **[ADR-0005](adr/0005-attribute-hosted-components.md)**, which is the single most
important document for this wave, because it changed the call form of nearly everything Home uses.

**Not yet done, and this wave's job:**

1. **Home composition** — `pages/home/home.ts|.html|.css`, `home.content.ts`, `home.types.ts`,
   and `app.routes.ts`. The current `home.*` is still the Wave-0 placeholder
   (`<p>NGP Table — under construction.</p>`).
2. **`preview-window`** — the one component from the original plan that was never built. Its
   folder may not exist yet, and its spec may still be sitting undistributed in
   `docs/design-handoff/specs/`.

**Verification is partial.** A lint pass over the refactored components is in flight separately —
among other things it added `@angular-eslint/template/elements-content` disables where an
attribute-hosted component legitimately renders an empty-looking host (`<button ngptSearchField>`,
whose content comes from its own `templateUrl`). Check `git log`/`git status` for how far that got.
`nx build` has not been run at all. Expect to find remaining fallout.

---

## Read before writing

| Document | Why |
|---|---|
| [`docs/CONVENTIONS.md`](CONVENTIONS.md) | All of it. Rule 1 (selector kinds), rule 5 (where copy lives), rule 8 (ViewEncapsulation). § "Fixed component contracts" is the shipped public surface of every component you will use — code against that table |
| [`docs/adr/0005-attribute-hosted-components.md`](adr/0005-attribute-hosted-components.md) | Why most primitives are now attributes on native elements. Explains call forms that would otherwise look wrong |
| `src/app/pages/home/docs/spec.md` | **The spec you implement.** Read the full front-matter and every section |
| `libs/shared/table/CLAUDE.md` + `libs/shared/table/docs/` | What the marketing copy must be *true about* |
| Each domain's own `docs/decisions.md` | Where the non-obvious calls are recorded. Several matter to Home specifically — flagged below |

---

## The copy is the hard part

`home.content.ts` holds real marketing copy as typed constants — not lorem, and not the handoff
frames' `data-content="MOCK"` text, which is placeholder by design.

Ground every claim in what the library actually is: a headless Angular table primitive;
`createTable()` returns an instance, not a class; `with-*()` feature plugins compose in
(`withSorting()`, `withExpansion()`, row editing); attribute-only directives that never insert or
reorder DOM; signals-native and zoneless; state exposed as `data-*` attributes with values as CSS
custom properties; the consumer owns the markup.

**Do not invent** benchmarks, adoption numbers, testimonials, version numbers, or features that do
not exist. If a claim can't be verified in the library's own docs, cut it.

Copy reaches the page-local blocks through inputs or projection — the blocks never hardcode it
(CONVENTIONS #5).

---

## Call forms that changed in the refactor

Verify each against the contract table and the component source. These are the current shapes.

**Hero CTAs navigate, so they are links.** This is precisely why `a[ngptPillButton]` was added to
that selector — the old element wrapper made it impossible, and the buttons currently in
`hero-band.html` carry `(click)` handlers as a placeholder:

```html
<a ngptPillButton variant="on-band" href="…">Get started</a>
<a ngptPillButton variant="on-band-inverse" href="…">View on GitHub</a>
```

**`feature-grid` and `page-footer` were inverted to consumer-authored markup and have never been
exercised.** Home is their first caller — if the inversion was wrong, this wave is where it shows:

```html
<div ngptHomeFeatureGrid>
  <article><h3>…</h3><p>…</p></article>
  <!-- ×6 -->
</div>
```

```html
<footer ngptPageFooter>
  <nav aria-label="Footer">
    <a ngptPageFooterLink href="…" target="_blank" rel="noopener noreferrer">…</a>
  </nav>
  © 2026 NGP Table
</footer>
```

**Other shapes worth knowing:**

- `hero-band` projects the navbar via `<ng-content select="[navbar]">` — the navbar goes *inside*
  it carrying a bare `navbar` attribute, with `variant="band"`.
- `install-row` takes only `command` now; the copy button and its state machine live inside it.
- `category-badge` is `span[ngptCategoryBadge]`.
- `prose` is **`div[ngptProse]`** for Home's section fragments, not `article` — a Home section is
  not independently distributable, so `<article>` would be a false claim. See `prose/docs/decisions.md`.
- `icon-button` is styling only. The consumer authors the `<ng-icon>`, registers it locally via
  `viewProviders: [provideIcons({…})]`, sets native `aria-label`, and binds native `(click)`.
  Clipboard behavior comes from placing `[ngptCopyConfirm]` beside it on the same `<button>`.

---

## Layout

Per the spec's § Section rhythm:

- One **1080px centered wide measure** for every section's content box.
- **720px prose cap** for headings and paragraphs, taken from the same left rail — not re-centered.
- Sections alternate `--ngpt-bg-app` / `--ngpt-bg-deep`.
- Per-section rhythm: eyebrow badge → marketing H2 → capped paragraph.
- DOM order: hero-band (navbar projected) → features → install → footer → search-overlay (closed).

Never hardcode a value that has a `--ngpt-*` token. Dark-only — no theme toggle, no `light-dark()`.

---

## `preview-window`

Never built. Its spec may still be in `docs/design-handoff/specs/` under a name like
`Preview Window.md` — if so, move it to `src/app/design-system/preview-window/docs/spec.md` with a
one-line provenance note pointing back to the bundle, matching how every other spec was moved.

It consumes `tab-switcher`, `code-block` and `icon-button`. Two things to decide rather than assume:

**Selector kind.** Apply ADR-0005's own test: if the template's root would be a semantic native
element, or the host needs a `role=`/`aria-*` to compensate for being a custom element, it is
attribute-hosted. If it composes real structure of its own and shadows no native element, it stays
an element selector. Both are legitimate here — `code-block` is the nearest precedent for a
structure-composing element component. State the choice and its reasoning in `docs/decisions.md`.

**The duplicate copy button — still unresolved.** `code-block`'s own spec says the copy affordance
belongs in Preview Window's toolbar, not on the code block; `code-block` ships one anyway. Render a
`code-block` inside a toolbar-bearing frame and the user may see two. Read
`code-block/docs/spec.md` and `code-block/docs/decisions.md` and settle it. If the right fix is a
change to `code-block` (an input suppressing its own button, say), that's a legitimate outcome —
just make it a deliberate, committed decision rather than shipping both buttons silently.

---

## Conventions

Standalone components, `ChangeDetectionStrategy.OnPush`, zoneless (already configured — don't touch
`app.config.ts`). Signals + `inject()`. New control flow with `track` on every `@for`. Separate
`.html`/`.css` via `templateUrl`/`styleUrl` — **no inline templates**. `input()`/`output()`
functions, `readonly` fields, explicit return types. No `any`, no `as` assertions — type guards
instead. Class names without a `Component` suffix. No barrels (ADR-0002) — import directly from
files. Icons registered locally per component, never in `app.config.ts` (ADR-0004). Boolean inputs
authored as bare attributes need `transform: booleanAttribute` (CONVENTIONS rule 1).

File-per-concern per `.claude/rules/file-organization.md`: types in `<feature>.types.ts`, fixtures
in `<feature>.mock.ts`, copy in `home.content.ts`.

Every domain writes its `docs/decisions.md` — spec-vs-frame calls, glyph mappings, and any delta
from the contract table you couldn't avoid. Report deltas, don't silently improvise past them.

---

## Verification

**Ask before running builds** — the repo has a standing rule against unprompted `nx build` / `serve`
/ `test`. With permission:

```bash
npx nx lint ng-table
npx nx build ng-table
```

Nothing here has compiled since the refactor, so expect fallout that predates this wave: stale
selectors, dropped inputs still bound, missing `provideIcons`. Small mechanical fixes are fine —
itemise them separately from Home's own work, since they belong to the refactor, not this wave.
Anything that isn't small, report rather than redesigning a component around it.

---

## Known-open items, not this wave's job

- **`tab-switcher`** is still `ngpt-tab-switcher` with an array input. It's being wired onto
  `ng-primitives`' `NgpTabset` in separate in-flight work — don't convert it.
- **`search-overlay`** stays an element component; earmarked for `NgpDialog` later.
- **No Shiki** — `code-block` ships plain `<pre><code>`. Syntax highlighting is a later round.
- **Search index is stubbed** — `search.mock.ts` ships an empty index and an in-memory recents list.
  No persistence, no ranking.
- **The `docs` navbar variant** is built but unused; only `band` is exercised by Home.
- **Brand assets** (logo, favicon, OG image) are missing — reserve boxes at the dimensions the
  Assets spec gives rather than inventing artwork.
- **`icon-button/docs/spec.md`** still describes a hidden-textarea + `document.execCommand`
  clipboard fallback that no implementation ever had. `execCommand` is deprecated; the spec needs a
  deliberate add-or-strike decision.
- **`copy-confirm`'s announcer** uses inline styles for its visually-hidden recipe because the app
  has no global utility for it. Adding one to `src/styles/global.css` would be a tidy follow-up.
