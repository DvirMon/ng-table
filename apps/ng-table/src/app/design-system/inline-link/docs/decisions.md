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

The spec's HTML/CSS mock hardcodes `text-decoration-color: oklch(0.68 0.22 328 / 0.4)`, which is
`--ngpt-accent`'s own value with alpha appended — hardcoding it would duplicate the token per
`docs/CONVENTIONS.md`'s "never hardcode a value that has a `--ngpt-*` token" rule. Used
`color-mix(in oklch, var(--ngpt-accent) 40%, transparent)` instead so the 40%-alpha underline
stays derived from the token.

## Focus ring: no local override

Spec's focus value (`0 0 0 2px oklch(0.68 0.22 328 / 0.6)`) matches `--ngpt-focus-ring` and the
global `:focus-visible` policy in `src/styles/global.css` exactly (`box-shadow: 0 0 0 2px
var(--ngpt-focus-ring)`), which already applies to the rendered `<a>` unscoped by Angular's
emulated encapsulation. No local `:focus-visible` rule was added, per convention #4.

## `:host { display: contents }`

Spec: "Margin: none — inline within text flow." The component wraps a real `<a>` inside a custom
element host; `display: contents` keeps `ngpt-inline-link` from introducing its own box so the
anchor participates directly in the surrounding prose flow.

## Icon mapping

None — this component has no icon.

## Converted to `a[ngptInlineLink]` — ADR-0005

| | Was | Now |
|---|---|---|
| Selector | `ngpt-inline-link` (element) | `a[ngptInlineLink]` (attribute, camelCase) |
| Host | inert `<ngpt-inline-link>` wrapping an inner `<a class="inline-link">` | the consumer's own `<a>` |
| Inputs | `href`, `external` | `external` only |

Per [ADR-0005](../../../../../docs/adr/0005-attribute-hosted-components.md): the template's root was
a semantic native element the component exists only to style, which is the stated test for
attribute-hosted. Kept as a `@Component` (not `@Directive`) so `styleUrl` stays colocated in this
domain folder, per the ADR's explicit rejection of the `dropdown.global.scss` split.

### `href` dropped

Pure native capability. The consumer sets `href` on the element it already owns, which also
restores everything the wrapper foreclosed — `download`, `ping`, `hreflang`, a router directive,
`(click)` — none of which the wrapper re-plumbed and therefore none of which were reachable.

### `external` kept (option (a))

Deliberate, against the alternative of dropping it and making the consumer author `target`/`rel`
plus the hidden text by hand. Three reasons, in order of weight:

1. **It is not native capability.** `target` and `rel` are, but `external` is a single flag that
   *composes* them with content this primitive owns. ADR-0005's rule bans re-declaring a native
   attribute as an input; it does not ban a primitive-owned flag that happens to set some.
2. **The visually-hidden `" (opens in new tab)"` span is real content the primitive projects** —
   it lives in this component's template and its CSS lives in this component's stylesheet. There
   is no way to hand that to the consumer without handing them the markup and the
   `.visually-hidden` rule too, which is exactly the duplication a DS primitive exists to prevent.
   This is the deciding reason: without the span there would be nothing left to keep, and dropping
   the input would be right.
3. **`rel` is a security footgun.** `target="_blank"` without `rel="noopener"` hands the opened
   page a live `window.opener`. Requiring every call site to remember the pair means one that
   forgets is a real vulnerability, not a style nit.

`spec.md`'s `a11y` front-matter still says nothing about external links (noted above under "External-link
a11y affordance"), so this rests on the WCAG 3.2.5 context-change argument already recorded there
plus the ownership argument above — the spec does not contradict it.

### `external` needs `transform: booleanAttribute`

Yes. Its natural call form is the bare attribute `<a ngptInlineLink external>`, which passes the
string `''` — falsy. Without the transform the `[attr.target]` host binding would evaluate to
`null` and the link would silently open in the same tab with no `rel` and no hidden text, i.e. the
exact defect that got `pill-button`'s `disabled` deleted. `pill-button` fixed its instance by
dropping the input, since `disabled` was native; here the input is genuinely the primitive's own,
so the transform is the correct fix rather than a patch.

### `target`/`rel` host bindings preserve a consumer's authored values

A host binding that evaluates to `null` *removes* the attribute, so a naive
`external() ? '_blank' : null` would strip a `target` the consumer set themselves on their own
element — the wrapper-era binding could not do this because the consumer had no element to author
on. The constructor captures the authored `target`/`rel` once and the bindings fall back to them
when `external` is false. Same shape as `pill-button`'s constructor `type="button"` default: set a
default the consumer can still override, rather than clobbering them from a host binding.

`external` still wins over an authored `target`/`rel` when set — that is the point of the flag.

### Template ordering

`<ng-content />` first, then the conditional span. The span joins the anchor's accessible name, so
it must be announced *after* the label ("GitHub, opens in new tab"), not before it.

### CSS

`.inline-link` rules moved to `:host` / `:host(:hover)`. `:host { display: contents }` is gone —
it only ever existed to stop the wrapper element introducing a box in the prose flow, and no
wrapper ships now. No `display` is declared at all: the host is an `<a>`, already inline.
`.visually-hidden` is unchanged and still a template-internal class.
