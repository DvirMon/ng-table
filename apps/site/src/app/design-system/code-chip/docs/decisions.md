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

## Converted to `code[ngptCodeChip]` — ADR-0005

`ngpt-code-chip` → `code[ngptCodeChip]`. This was the textbook case ADR-0005 names: the template's
root was a semantic native element the component existed only to style, so the custom element
bought nothing and cost an extra node in the inline flow. The consumer now writes
`<code ngptCodeChip>…</code>` and the component hosts on that `<code>` directly.

Consequences:

- **Template is `<ng-content />`.** The inner `<code class="code-chip">` is gone.
- **`.code-chip` rules moved onto `:host`.** Same declarations, same tokens, no visual change.
- **`:host { display: contents }` deleted.** It only existed to stop the custom element from
  contributing a second box around the inner `<code>`. With the host _being_ the `<code>`, the
  element's own `inline` default is exactly what the spec's "inline within text flow" asks for, so
  no `display` is declared at all now.
- **`:host-context(a) .code-chip` → `:host-context(a)`.** The inside-a-link state still resolves
  through the cascade with no input or host binding; only the descendant part of the selector was
  dropped, since there is no descendant left.

### Spec wording the conversion invalidated

The **HTML/CSS mock** section still shows `<code class="code-chip">` with a `.code-chip` rule block.
That form no longer ships — the class is now the `ngptCodeChip` attribute and the rules sit on
`:host`. The mock was left in place (it is the distributed design-handoff text) with a note above it
recording the mapping, and a new **API** section states what actually ships. The rendered DOM is
byte-for-byte the mock's single `<code>` box, so nothing in the Build spec table changed.

The old decision **"Host is `display: contents`, inner `<code>` carries the visual box"** above is
superseded in full; it is kept for history. Its premise — "fixed contract pins the selector to
`ngpt-code-chip`, so the host tag can't itself be `<code>`" — is the exact constraint ADR-0005
removed, and CONVENTIONS.md § "Fixed component contracts" still lists the stale `ngpt-code-chip`
row. That table is outside this domain and was not edited.
