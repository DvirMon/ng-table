# category-badge — decisions

## No `.types.ts` file

Spec defines a single `default` state only, no variant union. Per the fixed contract
(`ngpt-category-badge`: "projected text only") and the "skip if no variant" rule in the task
contract, `category-badge.types.ts` was not created.

## No wrapper element

`:host` is the styling root (DS component rule — never wrap in a `<div>` purely for styling).
Template is `<ng-content />` directly against the host; all typography/color/spacing rules
(`font`, `text-transform`, `letter-spacing`, `color`, `margin-block-end`) live on `:host`.

## `margin-block-end` instead of `margin-bottom`

Spec's mock uses `margin: 0 0 6px` (physical). Translated to the logical-property equivalent
per repo CSS conventions; block-direction margin is unaffected by inline (RTL) direction but
logical properties are used consistently regardless.

## No ARIA / semantic role added

a11y front-matter: "Purely visual; do not use as the accessible heading." Read as a constraint
on _consumers_ (don't substitute this for an `<h1>`/heading), not a requirement for this
component to add ARIA suppression itself. No `role="presentation"` or `aria-hidden` was added —
the projected text is real content (e.g. "PRIMITIVES") that should remain in the accessibility
tree, just not exposed as a heading.

## No icon/glyph mapping needed

Spec has no glyph placeholder — component is plain text only, so
`src/styles/docs/Iconography.md`'s glyph-mapping step (contract rule #8) doesn't apply here.

## Converted to `span[ngptCategoryBadge]` — ADR-0005

`ngpt-category-badge` → `span[ngptCategoryBadge]`. Unlike `code-chip` this was never a wrapper — the
template was already `<ng-content />` against `:host`, so no DOM node is removed. It converts under
the _other_ half of ADR-0005's test: the host was a non-semantic custom element existing purely to
style a text run. A `<span>` does that job with a real element, and the consumer owns it.

Template (`<ng-content />`) and every CSS declaration are unchanged. Only the selector and the host
element differ.

### Judgment: selector kept narrow, not widened

The brief allowed widening (e.g. `p[ngptCategoryBadge]`) _if the spec supported it_. It does not, so
the selector is `span[ngptCategoryBadge]` alone:

- The spec describes exactly one placement — "sits above an H1" — and one composition, "single
  uppercase text run". It never describes the eyebrow sitting on another element.
- The a11y front-matter, "Purely visual; do not use as the accessible heading", argues _against_
  widening onto elements that carry meaning. `<p>` would assert the eyebrow is a paragraph of prose,
  which is the kind of accidental semantics this rule is guarding against. `<span>` asserts nothing,
  which is the point.
- The mock's `<div>` is likewise non-semantic, so `<span>` is a faithful substitution, not a
  reinterpretation.

Widening is cheap to do later if a real second host appears; guessing at one now would bake unspec'd
semantics into the contract.

### `display: block` retained, and now load-bearing

`:host { display: block; }` was already present (a custom element defaults to `inline`, and the
spec's block-level `<div>` mock plus its bottom margin needed block). It stays, and matters more
now: `<span>` is inline by default, so without it the eyebrow would sit on the H1's line and
`margin-block-end` would not apply. A comment in the CSS records why.

### Spec wording the conversion invalidated

The **HTML/CSS mock**'s `<div class="eyebrow">` no longer describes what ships — the class is now the
`ngptCategoryBadge` attribute and the host is a `<span>`. The mock is left in place (distributed
handoff text) with a note recording the mapping, and a new **API** section states the shipped
selector. No Build spec value changed.

The "No wrapper element" decision above still holds and is in fact strengthened: `:host` was already
the styling root, which is why this conversion was selector-only. CONVENTIONS.md § "Fixed component
contracts" still lists the stale `ngpt-category-badge` row; that table is outside this domain and
was not edited.

## Letter-spacing / text-transform not tokenized

Per `typography.css`'s own usage comment (line 21–24: "letter-spacing and text-transform are
not part of the font shorthand, so the roles that need them set them alongside the token"),
`0.08em` and `uppercase` are hand-authored to match the existing `.eyebrow` usage example in
that file, not restated as new tokens — `tokens` front-matter for this component lists only
the three custom-property tokens, confirming these two are meant to stay literal.
