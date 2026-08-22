# code-chip — decisions

## Host is `display: contents`, inner `<code>` carries the visual box

Fixed contract pins the selector to `ngpt-code-chip`, so the host tag can't itself be `<code>`.
Template wraps projected content in an inner `<code class="code-chip">` and the host sets
`display: contents` so the host element contributes no box of its own — the rendered inline box
matches the spec's single-element mock (`<code class="code-chip">…</code>`) exactly, with no
extra wrapping box in the flow.

## "Inside a link (inherits accent)" state — CSS only, no input/host binding

The front-matter lists two states: `default` and `inside a link (inherits accent)`. Implemented
as a pure cascade rule, no component state needed:

```css
:host-context(a) .code-chip {
  color: inherit;
}
```

`ngpt-inline-link` renders a real `<a>` (per CONVENTIONS.md rule 4, "real interactive elements").
When `ngpt-code-chip` is projected inside one, `:host-context(a)` overrides the default
`--ngpt-text-secondary` color to `inherit`, picking up the link's accent color. No JS/inputs
required — matches "projected code text only" from the fixed contract.

## Spec wins over frame mock's hardcoded values

The spec's HTML/CSS mock hardcodes `padding: 2px 6px` and `border-radius: 4px` as literals, but
the Build spec table maps those same values to `--ngpt-sys-space-050`, `--ngpt-sys-space-150`,
and `--ngpt-sys-shape-corner-extra-small`. Per CONVENTIONS.md ("never hardcode a value that has a
`--ngpt-*` token"), the token vars are used instead of the mock's literals — verified all five
tokens (`--ngpt-sys-typescale-code`, `--ngpt-sys-space-050`, `--ngpt-sys-space-150`,
`--ngpt-sys-shape-corner-extra-small`, `--ngpt-bg-code-chip`, `--ngpt-text-secondary`) exist in
`src/styles/tokens/{typography,spacing,shape,color}.css` before wiring them in.

## No deviations from the fixed contract

`ngpt-code-chip`, projected code text only, no inputs, no icons, no a11y attributes (spec's
`a11y: []`). Nothing else to report.
