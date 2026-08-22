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

---

# Inversion to an attribute-hosted container (2026-08-23)

## Old vs. new shape

| | Before | After |
|---|---|---|
| Selector | `ngpt-home-feature-grid` (element) | `div[ngptHomeFeatureGrid]` |
| Inputs | `features: input<readonly FeatureCell[]>()` (+ a `cells` computed normalizing `undefined` → `[]`) | none |
| DOM | `@for` built six `<article><h3><p>` cells from the array | the consumer authors each cell |
| Class body | input + computed | empty |

## Why

ADR-0005 — the host was a non-semantic `<ngpt-home-feature-grid>` element that existed only to
carry `display: grid`, which is precisely a case of styling something that should be the
consumer's own element.

The stronger reason is the invariant in `libs/shared/table/CLAUDE.md`: **"Attribute-only directives
— never insert/remove/reorder DOM. Structural logic lives in the template (consumer's
responsibility)."** A `@for` over an input array is DOM insertion, and it made the cell shape
closed: a cell could never gain a `<code>` in its description, a link, or a differing heading level
without widening `FeatureCell` and the template together.

## One primitive, not two — no cell component

Weighed a `div[ngptHomeFeatureGrid]` + `article[ngptHomeFeatureCell]` pair against the container
alone. **Container alone wins:** a cell has no box of its own — the spec is explicit that there are
no cards, borders, tint or icons, and the grid gap alone carries the separation — so a cell
primitive would have zero declarations that aren't already about its `<h3>`/`<p>`. And it would not
even solve those: a cell component cannot reach its own projected `<h3>` either, so the pair shape
buys nothing. If a cell ever gains a box, `article[ngptHomeFeatureCell]` is the seam to add.

## Reaching the cells' typography: `:host ::ng-deep`, scoped

The `<h3>`/`<p>` rules are the whole reason this needs thought. Under emulated encapsulation
projected nodes carry the *consumer's* encapsulation id, so a plain `:host h3` compiles to
`[_nghost-x] h3[_ngcontent-x]` and never matches — ADR-0005 records the same mechanic as the reason
`prose` needs `ViewEncapsulation.None`. There is no `::slotted` without shadow DOM. Three options:

| Option | Verdict |
|---|---|
| `ViewEncapsulation.None` (the `prose` route) | Rejected — `CONVENTIONS.md` #8 reserves it for `prose` explicitly ("No other component needs this"), and it would need a host *class* for scoping since None emits no `_nghost` attribute |
| A primitive per element (`h3[…Title]`, `p[…Text]`, plus the cell) | Rejected — three or four attribute components so that a page-local block can set two fonts is more ceremony than it earns, and it forces every cell's author to remember four attributes |
| `:host ::ng-deep h3` / `p` | **Chosen** |

`:host ::ng-deep` compiles to `[_nghost-x] h3`, so the rules stay scoped to this grid's own
instances — never bare `::ng-deep`, never global. This is the css-styling skill's sanctioned
app-level escape hatch; the "no `::ng-deep` — ever" form of that rule is stated for DS components,
and this block is page-local (`pages/home/`), the same carve-out
`hero-band/docs/decisions.md` § "Hero-only pill-button size step uses `:host ::ng-deep`" took. The
values are unchanged from the pre-inversion `h3`/`p` rules — same tokens, same margins.

## Spec wording the inversion invalidated

`feature-grid` has no `docs/spec.md`; its spec is `pages/home/docs/spec.md` § "Feature grid", which
is **outside this domain folder** and was not edited. Two lines there are now stale and need the
Home-composition pass to reconcile them:

- `CONVENTIONS.md`'s fixed-contract row still reads
  `feature-grid | ngpt-home-feature-grid | features: input<readonly FeatureCell[]>() (6 cells)`.
  Superseded by ADR-0005, which supersedes that table wholesale.
- The spec's "Six cells; if a seventh is ever needed, cut one instead" is now unenforceable in code
  — the consumer authors the cells, so the count is an authoring rule, not a type constraint. It
  was never enforced by the old `readonly FeatureCell[]` either.

Nothing else in that section changes: the track formula, the gap-carries-separation rule, the
no-cards/borders/tint/icons rule and the prose-scale typography are all still implemented here.

## `FeatureCell` kept

No longer an input type. Kept as the typed shape for the six authored cells in
`home.content.ts` (`CONVENTIONS.md` #5 — page-local blocks never hardcode copy), which the Home
template then `@for`s over into authored `<article>` markup. Deleting it would only push the same
shape into an inline literal.

## Revised: `ViewEncapsulation.None` + host class, not `:host ::ng-deep`

The first pass of this conversion styled the projected cells with `:host ::ng-deep h3`. That
scopes correctly — it compiles to `[_nghost-x] h3`, never global — but `::ng-deep` is deprecated
in Angular, and there is no reason to introduce deprecated API into a codebase written this month.

Switched to `ViewEncapsulation.None` with every rule scoped under a `.ngpt-home-feature-grid` host
class. This is not a new exception: it is the identical mechanism `prose` already uses, for the
identical reason — projected nodes carry the *declaring* component's encapsulation id, so no
encapsulated selector from this component can ever reach them. CONVENTIONS.md #8 has been widened
from "prose is the one exception" to "styling projected content requires it; scope every rule under
a host class", which is what both components actually do.

The alternative considered and still rejected: a primitive per element (`h3` + `p` + cell). Three
components to style two text elements is more ceremony than a page-local block earns, and it would
force the consumer to annotate markup that reads perfectly well as plain HTML.
