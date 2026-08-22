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
on *consumers* (don't substitute this for an `<h1>`/heading), not a requirement for this
component to add ARIA suppression itself. No `role="presentation"` or `aria-hidden` was added —
the projected text is real content (e.g. "PRIMITIVES") that should remain in the accessibility
tree, just not exposed as a heading.

## No icon/glyph mapping needed
Spec has no glyph placeholder — component is plain text only, so
`src/styles/docs/Iconography.md`'s glyph-mapping step (contract rule #7) doesn't apply here.

## Letter-spacing / text-transform not tokenized
Per `typography.css`'s own usage comment (line 21–24: "letter-spacing and text-transform are
not part of the font shorthand, so the roles that need them set them alongside the token"),
`0.08em` and `uppercase` are hand-authored to match the existing `.eyebrow` usage example in
that file, not restated as new tokens — `tokens` front-matter for this component lists only
the three custom-property tokens, confirming these two are meant to stay literal.
