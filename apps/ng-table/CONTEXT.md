# ng-table — context

## What this is

A dark-only documentation and marketing website for **NGP Table** (`@acme/table`, `libs/shared/table`), a
headless Angular table primitive: `createTable()` + `with-*()` feature plugins + attribute-only directives.
Two zones: a marketing page at `/`, and docs under `/docs`. This app is the site; it does not implement the
table itself.

**This build round:** token foundations + 16 DS components + the Home landing page (`/`) only. Docs
pages, the sidebar/TOC/3-column shell, article content, and the nav tree are a later round — see
`docs/design-handoff/README.md` § Two open items and `specs/Content Model.md` for what's still mock there.

Source of truth for design: `docs/design-handoff/` (46 specs + 6 reference frames + screenshots, copied
from the design handoff). **Spec wins over frame** on any conflict. The specs that this round's domains
actually build against have been moved to sit next to the code that implements them — see below.

## Zones and archetypes (glossary)

- **Zone** — `/` (marketing, no sidebar/TOC, not on the 3-column grid) vs. `/docs/*` (docs shell). This
  round only builds the marketing zone.
- **Archetype** — one of six page templates (Home, Doc Article, Section Landing, API Reference, Examples
  Gallery, Not Found), each a `specs/pages/*.md` spec. Only `Home` is built this round.
- **Nav tree / Content Model** — the site's one page list (`specs/Content Model.md`, still in
  `docs/design-handoff/`); sidebar, TOC, pagination, search, and active-state all derive from it. Not
  wired this round — Home is not a tree entry and has no sidebar.
- **Page state** — the one URL → `{archetype, entry, section, eyebrow, h1, prev/next, headings, title}`
  resolution (`specs/Routing and Page State.md`). Not implemented this round (single static route).
- **Band navbar vs. docs navbar** — the navbar has two variants (`layout/Top Navbar.md` +
  `pages/Home.md` §Hero): `band` sits inside Home's full-bleed accent hero and is sticky/two-state
  (transparent-over-band → `--ngpt-navbar-scrolled` past 24px scroll); `docs` is the plain sticky bar the
  docs shell will use later. Only `band` is exercised by Home; `docs` is built but unused this round.
- **Eyebrow** — the `category-badge` text above a heading, resolved from page state
  (`entry.eyebrow ?? section.label`). Home uses it per-section as a page-local convention, not from page
  state (Home isn't a tree entry).
- **Prose measure / wide measure** — Home's two horizontal caps: 1080px centered "wide measure" for every
  section's content box, 720px "prose cap" (from the same left rail, not re-centered) for headings and
  paragraphs. See `pages/home/docs/spec.md` § Section rhythm.

## Where specs live now

Distributed during Wave 0 per the repo's docs-by-responsibility convention (`.claude/rules/file-organization.md`
§ Domain-scoped docs, colocated) — each domain owns its spec, not a central dump:

| What | Where |
| --- | --- |
| Each of the 16 component specs | `src/app/design-system/<id>/docs/spec.md` |
| Navbar, Page Footer specs | `src/app/layout/<id>/docs/spec.md` |
| Home page spec | `src/app/pages/home/docs/spec.md` |
| The 8 foundations token specs | `src/styles/docs/*.md` (mirrored as CSS in `src/styles/tokens/`) |
| Everything not built this round (other 5 archetypes, sidebar/TOC/content-column/page-shell layout, Content Model, Routing and Page State, Search Index, Assets and Content Source, Frame Annotation, reviews, frames, screenshots) | `docs/design-handoff/` — untouched, for the next round |

Each moved spec carries a one-line provenance note pointing back to `docs/design-handoff/`.

**Descoped:** the handoff's `specs/index.md` lists 17 components; `Table Row.md` was dropped. It mocked
the shipped NGP Table product's own row rendering (out of scope per `specs/index.md` § Out of scope: "The
NGP Table product component itself — styled by the shipped library"), not a docs-site DS primitive. Its
spec is recoverable from git history (moved in the spec-distribution commit) if a real need for it
surfaces later.

## Build-time decisions

Each domain's `docs/decisions.md` (written by the agent that built it) records spec-vs-frame calls, lucide
glyph choices for placeholder glyphs, and any contract delta from what `docs/CONVENTIONS.md` fixed in
advance. Cross-domain decisions are ADRs in `docs/adr/`.

## Deliberate gaps

Known and accepted, not oversights. Each is out of scope for the current round rather than unfinished
within it — check here before "fixing" one.

| Gap | Status |
|---|---|
| **Home page** | Built (Wave 3) — `pages/home/home.*` composes hero-band/feature-grid/install-row per `pages/home/docs/spec.md`; `home.content.ts` copy is sourced from `libs/shared/table`'s own docs. See `pages/home/docs/decisions.md` |
| **`preview-window`** | Built (Wave 3), narrowed to `docs/CONVENTIONS.md`'s fixed contract (tab-switcher + code-block + one copy icon-button) — no consumer yet, so the "Example CSS" dropdown-pill and Run button aren't built. See `design-system/preview-window/docs/decisions.md` |
| **`feature-grid`, `page-footer`** | Called by Home (Wave 3) — the ADR-0005 inversion held, no friction surfaced |
| **Duplicate copy button** | Resolved — `code-block` gained `showCopyButton: input<boolean>(true)`; `preview-window`'s Source tab passes `false` so only the toolbar's Copy button shows. See `design-system/code-block/docs/decisions.md` |
| **Source panel radius** | Resolved — `code-block` gained `radius: input<'standalone' \| 'panel'>('standalone')`; `preview-window`'s Source tab passes `'panel'` for the spec's 12px. See `design-system/code-block/docs/decisions.md` |
| **`tab-switcher`** | Still an element selector with an array input, being wired onto `ng-primitives`' `NgpTabset` in separate in-flight work. Do not convert it independently |
| **`search-overlay`** | Stays an element component (composes real structure, shadows no native element). Earmarked for `NgpDialog` |
| **Search index** | Stubbed — `search.mock.ts` ships an empty index and an in-memory recents list. No persistence, no ranking |
| **Syntax highlighting** | No Shiki. `code-block` ships plain `<pre><code>`; the `.line` split is where Shiki output would slot in |
| **`docs` navbar variant** | Built but unused — only `band` is exercised, by Home |
| **Brand assets** | Logo, favicon and OG image are missing. Reserve boxes at the dimensions the Assets spec gives rather than inventing artwork |
| **`icon-button/docs/spec.md`** | Describes a hidden-textarea + `document.execCommand` clipboard fallback that no implementation ever had. `execCommand` is deprecated — needs a deliberate add-or-strike decision |
| **Visually-hidden utility** | Review issue C2 converged the *class name* on `.visually-hidden`, not the *definition* — the recipe still exists three times: `inline-link.css`, `search-overlay.css`, and inlined as `style.*` assignments in `copy-confirm.announcer.ts` (which needs inline styles only because its node is created outside any component's view). One rule in `src/styles/global.css` collapses all three |
