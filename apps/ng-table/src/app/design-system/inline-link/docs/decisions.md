# inline-link — decisions

## External-link a11y affordance (spec gap)

`spec.md`'s `a11y` front-matter only covers the color-vs-underline WCAG 1.4.1 requirement; it
never addresses `external` at all, and no glyph for "external link" exists in
`src/styles/docs/Iconography.md`'s placeholder → icon mapping table. The fixed contract
(`docs/CONVENTIONS.md`) still requires `external: input<boolean>(false)`, and a link that opens
a new tab without warning is a known a11y gap (WCAG 3.2.5 context-change expectation), so:

- `target="_blank"` + `rel="noopener noreferrer"` are added via `[attr.target]` / `[attr.rel]`
  (bound to `null` when `external()` is false, so the attributes are absent rather than empty).
- A visually-hidden `" (opens in new tab)"` span is appended after the projected label when
  `external()` is true, so it joins the anchor's accessible name for screen-reader users. No
  visual icon was added — none is specified in the Build spec table or the icon mapping, and
  inventing one would be a visual design call outside this agent's contract.

## Underline alpha via `color-mix()`, not the mock's literal oklch string

The spec's HTML/CSS mock hardcodes `text-decoration-color: oklch(0.62 0.19 52 / 0.4)`, which is
`--ngpt-accent`'s own value with alpha appended — hardcoding it would duplicate the token per
`docs/CONVENTIONS.md`'s "never hardcode a value that has a `--ngpt-*` token" rule. Used
`color-mix(in oklch, var(--ngpt-accent) 40%, transparent)` instead so the 40%-alpha underline
stays derived from the token.

## Focus ring: no local override

Spec's focus value (`0 0 0 2px oklch(0.62 0.19 52 / 0.6)`) matches `--ngpt-focus-ring` and the
global `:focus-visible` policy in `src/styles/global.css` exactly (`box-shadow: 0 0 0 2px
var(--ngpt-focus-ring)`), which already applies to the rendered `<a>` unscoped by Angular's
emulated encapsulation. No local `:focus-visible` rule was added, per convention #4.

## `:host { display: contents }`

Spec: "Margin: none — inline within text flow." The component wraps a real `<a>` inside a custom
element host; `display: contents` keeps `ngpt-inline-link` from introducing its own box so the
anchor participates directly in the surrounding prose flow.

## Icon mapping

None — this component has no icon.
