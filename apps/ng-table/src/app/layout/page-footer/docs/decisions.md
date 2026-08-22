# page-footer — decisions

## `FooterLink` shape
```ts
export interface FooterLink {
  readonly label: string;
  readonly href: string;
  readonly external?: boolean;
}
```
Matches the fixed contract's example shape exactly (`{ label, href, external? }`). `external`
drives `target="_blank"` + `rel="noopener noreferrer"` on that link only — no other component in
this app's `docs/CONVENTIONS.md` uses that pattern, so it wasn't reused from elsewhere.

## `role="contentinfo"` on the host, not a literal `<footer>` tag
The component selector (`ngpt-page-footer`) is the host element, so it can never literally be a
`<footer>` node. `role="contentinfo"` is the same ARIA landmark a native `<footer>` (as a direct
child of `<body>`) exposes implicitly, so `host: { 'attr.role': 'contentinfo' }` reproduces the
a11y front-matter requirement without a wrapper element — same "host is the styling/semantic
root, no wrapper div" approach as `category-badge`. Used the `attr.` prefix (not a bare `role`
key) so the attribute is always written to the DOM rather than relying on `role` being reflected
as an IDL property on the custom element.

## Link row is `@if`-gated, not a `data-*` state
Contract rule 3 ("state as `data-*` attributes") covers CSS-only state toggles on an otherwise
fixed DOM shape (`data-open`, `data-copy-state`). An empty vs. non-empty `links()` array changes
what's actually in the DOM (docs pages never ship the `<nav>` at all), so this is conditional
rendering (`@if`), not a state attribute.

## Link row visual treatment — not in either spec, so this is a call
Neither `page-footer/docs/spec.md` (states: `default` only, no link-row mock) nor
`pages/home/docs/spec.md` (`links row (Sponsor / Discord / GitHub) above the copyright line` —
no color/spacing/typography given) specify the link row's build spec. Chose:
- Links inherit the footer's own type (`--ngpt-sys-typescale-label-large-sm`, `--ngpt-text-tertiary`)
  by not re-declaring `font`/default `color` — same "copyright-line contrast is not a hierarchy
  problem" reasoning the footer spec already gives for the copyright text itself.
- Hover brightens to `--ngpt-text-secondary`, no underline — mirrors `nav-item`'s hover treatment
  (color-only shift, no decoration) rather than `inline-link`'s underlined-at-rest treatment,
  because these links sit alone on their own row (not embedded in a prose sentence), so
  `inline-link`'s "color alone can't distinguish a link from body text" a11y concern doesn't apply
  here the same way.
- Row gap `--ngpt-sys-space-600` (24px), gap above copyright `--ngpt-sys-space-400` (16px) — both
  existing spacing-scale tokens, no new token introduced.
- No focus-visible override — global `::focus-visible` ring (`src/styles/global.css`) already
  covers real `<a>` elements; contract rule 4 says not to restyle focus locally unless the spec
  calls for different treatment, and neither spec does.

If Home's actual build later specifies exact values here, this block should be updated to match
rather than treated as load-bearing.

## Copyright text hardcoded
`page-footer/docs/spec.md`'s own HTML mock hardcodes `Copyright © 2026 NGP Table` directly inside
`<footer>`, and the fixed contract only names a `links` input — no `copyrightText`/similar. Kept
it as a literal text node (no wrapping `<p>`) to match the mock's flat structure exactly, so the
empty-`links()` case renders byte-identical markup content to the spec.

## `border-top` → `border-block-start`
Spec's mock uses the physical property; translated to the logical equivalent per this repo's CSS
convention (same call `category-badge/docs/decisions.md` made for `margin-bottom` →
`margin-block-end`). Vertical-only property, so no visual difference in this LTR-only app — kept
for consistency with the rest of the DS.

## No `.types.ts` deviation
Unlike `category-badge` (which skipped `.types.ts` — no variant union), `page-footer` needed one
for `FooterLink`, so `page-footer.types.ts` was created per the fixed deliverable list.
