# Home page composition — decisions

## Navbar/search-overlay wiring lives in `home.ts`

`search-overlay.ts`'s own doc comment defers the ⌘K listener and the `open` toggle to "the
app-level composition." Home is that composition this round (single route, no shell above it): a
`window` `keydown` listener registered via `afterNextRender`/cleaned up via `DestroyRef` (same
pattern `navbar.ts` uses for its scroll listener) flips a local `searchOpen` signal; `ngpt-navbar`'s
`openSearch` output and `ngpt-search-overlay`'s `closed` output both target it.

## Hero CTAs: real in-page action for primary, documented no-op for secondary

`hero-band`'s own decisions record that `pill-button` only ever renders a `<button>`, so real
navigation is the consumer's job. Primary ("Get Started") does `document.getElementById('install')
?.scrollIntoView()` — a real, verifiable behavior with no invented target. Secondary ("View on
GitHub") has no URL to wire: `CONTEXT.md` § Deliberate gaps lists brand assets as missing, and no
GitHub URL exists anywhere in the repo's own docs — inventing one would violate the "no invented
claims" rule as much as fabricated copy would. Left as a documented no-op instead of a dead `#`
href.

## Navbar's product name isn't a link yet

`docs/spec.md`'s Open section asks whether it should link to `/` or `/docs`. Resolved: `/` (Home
is already `/`, matches marketing-site convention). Not implemented — `navbar.html`/`navbar.ts`
are a different, already-built domain and out of this task's scope ("do not modify any other
component"); flagged for whoever next touches `navbar` rather than edited here.

## Copy sourced from `libs/table`'s own docs only

Every claim in `home.content.ts` traces to `libs/table/README.md` or `CLAUDE.md` verbatim
(e.g. "Angular 19+", `createTable()`, `columnSchema()`, `withSorting()`/
`withExpansion()`, "`rows()` never returns wrapper objects", "zero runtime dependencies beyond
`@angular/core`"). Deliberately did not repeat `CLAUDE.md`'s "div-grid" mention in the
attribute-only-directives cell — its own doc marks that path `status: proposed`, not implemented,
so claiming it on the marketing page would be an invented capability.

## Feature-grid and page-footer's link row are Home's first real callers

`CONTEXT.md` § Deliberate gaps flagged both as "inverted... but never yet called." Home wires them
as their fixed contracts specify (`<article><h3>/<p></article>` cells into
`div[ngptHomeFeatureGrid]`; a consumer-authored `<nav>` of `a[ngptPageFooterLink]` plus a literal
`<p>` copyright line into `footer[ngptPageFooter]`) — no friction surfaced from either inversion.

## Prose paragraph styling added in `home.css`, not `prose.css`

`prose.css` has no bare `p` rule (`code-chip`/`inline-link` own inline styling instead, per its own
decisions). The section paragraphs under `[ngptProse]` here are light-DOM children of Home's own
template (not content projected across an encapsulation boundary — `[ngptProse]` is
attribute-hosted with no wrapper), so `home.css`'s `[ngptProse] p` rule is ordinary parent-scoped
styling, not a `::ng-deep` reach. Kept in `home.css` since it's a page-only layout decision (margin

- tertiary color), not a `prose` typographic default worth promoting.

## Install section paragraph, not `install-row`

The spec's "H2 + one paragraph" for the install section's own intro copy is separate from
`install-row`'s command surface — the paragraph sits in the shared `[ngptProse]` block above the
row, matching every other section's rhythm (eyebrow → H2 → optional paragraph → content).

## Install section is centered, not left-rail-aligned — the one exception to "Section rhythm"

`home.css`'s "Prose cap is on the copy, not a re-centered container" comment documents the shared
convention: `.home-section__measure` centers the 1080px measure box, but content inside it
(eyebrow, prose, row) stays left-aligned by normal flow, matching `hero-band`'s own "left-aligned,
not centered" spec. On wide viewports this left the install CTA (eyebrow + H2 + description +
command box) flush against the left rail with a large empty area to its right — confirmed via
screenshot to read as broken, not as an intentional left-rail block like the hero band or features
section. Fixed by centering only `.home-section--install`'s eyebrow/prose (`text-align: center` +
`margin-inline: auto`, since they're already capped at `--ngpt-sys-layout-prose-measure`) and the
`ngpt-home-install-row` box (`margin-inline: auto`, added from `home.css` rather than the
component's own `install-row.css`, since the component itself stays layout-agnostic even though
it's currently only used here). Hero band and features section are unaffected — they keep the
left-rail convention.
