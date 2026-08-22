# feature-grid — decisions

## Scope: grid only, confirmed against spec

`docs/spec.md`'s "Feature grid" section (Page-local blocks) describes only the 3→2→1 grid and
its six cells; the section eyebrow/H2/optional paragraph are covered separately under "Section
rhythm" as a wrapper every section from slot 4 onward gets, applied by the Wave 3 home
composition (`home.html`), not by each section's own block. `CONVENTIONS.md`'s fixed-contract
row for `feature-grid` also lists only `features` + the grid CSS — no eyebrow/heading inputs. No
disagreement found; this component renders the six-cell grid and nothing above it.

## Plain `<h3>`/`<p>`, not the `ngpt-prose` component

Spec text: "Each cell is a `prose` H3 and one paragraph at body-medium." Read this as
*prose-scale* typography (title-medium for H3, body-medium for the paragraph — the same values
`Content Prose.md` assigns to H3/body), not as literally wrapping each cell in `<ngpt-prose>`.
`ngpt-prose` owns heading anchor links (`#`, revealed on hover, scroll-margin-top for the docs
TOC) — machinery for the sidebar/TOC content column that Home explicitly drops. Pulling it in
here would render six anchor-linkable, TOC-offset headings on a page with no TOC to jump from.
`CONVENTIONS.md`'s fixed-contract row for `feature-grid` also doesn't list prose as a dependency
(compare `install-row`'s row, which explicitly says "consumes icon-button"). Styled `h3`/`p`
directly with `--ngpt-sys-typescale-title-medium` / `--ngpt-sys-typescale-body-medium` instead.

## Grid gap: `--ngpt-sys-space-800` (32px)

Spec fixes the track formula (`repeat(auto-fit, minmax(240px, 1fr))`) but not a gap value —
its own words are the requirement ("the grid gap alone carries the visual separation," no
cards/borders/tint). Picked `--ngpt-sys-space-800`, the ramp's "section-to-section vertical
rhythm" step, as generous enough to read as separation with borders removed. No spec value to
verify this against; flagging in case design intended a different step.

## No explicit `text-align: left`

Left-alignment is the spec requirement, but block-level `h3`/`p` are left-aligned by default in
this LTR-only app (no RTL support, no global center/justify reset found in `global.css` or any
DS component). Left implicit rather than adding a redundant declaration.

## `track cell.title`, no `id` field

`FeatureCell` is `{ title, description }` per the fixed contract — no `id`. Tracked by `title`
(expected unique across the six authored cells) rather than `$index`, following `page-footer`'s
precedent of tracking a meaningful field over the index when the type has no dedicated id.

## Class name `FeatureGrid`, selector `ngpt-home-feature-grid`

`CONVENTIONS.md`'s Angular-conventions section says the class name matches the file name
(`pill-button.ts` → `PillButton`). File is `feature-grid.ts`, so the class is `FeatureGrid` even
though the fixed-contract selector carries an extra `home-` segment
(`ngpt-home-feature-grid`) to signal it's page-local, not a shared DS component. No other
`FeatureGrid` exists in the app, so no collision.

## `features` input has no default

Fixed contract states `features: input<readonly FeatureCell[]>()` verbatim — no default array,
matching `tab-switcher`'s `tabs` input rather than `page-footer`'s `links: input<...>([])`.
Followed `tab-switcher`'s pattern: an internal `protected readonly cells = computed(() =>
this.features() ?? [])` normalizes to `[]` for the template rather than changing the input's
declared signature.
