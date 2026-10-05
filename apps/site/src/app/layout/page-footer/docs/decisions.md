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

---

# Inversion to attribute-hosted primitives (2026-08-23)

## Old vs. new shape

|                | Before                                                                  | After                                              |
| -------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| Selector(s)    | `ngpt-page-footer` (element)                                            | `footer[ngptPageFooter]` + `a[ngptPageFooterLink]` |
| Inputs         | `links: input<readonly FooterLink[]>([])`                               | none                                               |
| DOM            | `@if (links().length)` built a `<nav>` and `@for`-ed the `<a>` elements | the consumer authors both                          |
| Copyright line | hardcoded text node in the template                                     | projected content                                  |
| Landmark       | `host: { 'attr.role': 'contentinfo' }`                                  | implicit on the native `<footer>`                  |

## Why

ADR-0005 — the old template's root was a `<nav>` plus text inside a non-semantic `<ngpt-page-footer>`
host that needed a compensating `role=` to be a landmark at all. That is ADR-0005's own stated test
for "this is attribute-hosted."

And the array input made this domain break the invariant in `libs/table/CLAUDE.md`:
**"Attribute-only directives — never insert/remove/reorder DOM. Structural logic lives in the
template (consumer's responsibility)."** The `@if`/`@for` over `links()` was exactly that
structural logic, held one level too deep — Home could not add a link with an icon, a
`routerLink`, or a divider without a new input for each.

## `role="contentinfo"` dropped — verified, not assumed

MDN's `<footer>` reference gives the implicit ARIA role as `contentinfo`, degrading to `generic`
only when the element is a descendant of `<article>`, `<aside>`, `<main>`, `<nav>`, `<section>`, or
an element with role `article`/`complementary`/`main`/`navigation`/`region`
(<https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/footer> § Technical summary).
The host is now a real `<footer>`, so the landmark is native and the explicit role is redundant.

Two notes for the consumer, recorded in the spec's a11y front-matter:

- **Placement matters.** Keep the footer out of `<main>`/`<section>`/`<article>`. A component host
  such as `<ngpt-home>` is _not_ sectioning content, so nesting inside one is fine.
- The only known gap is Safari < 13 (WebKit 146930), which did not expose the native landmark to
  VoiceOver. This app already requires `oklch()`, `:has()` and container-free `auto-fit` layouts, so
  that browser is out of scope; `role="contentinfo"` is a permitted addition if that ever changes.

Incidentally, the old binding was broken: `host: { 'attr.role': 'contentinfo' }` is not the host
syntax for an attribute (that is `role:` for a static one, `'[attr.role]'` for a binding), so it
emitted an attribute literally named `attr.role` and the landmark never existed. Deleted rather
than fixed.

## The seam: two primitives, and no `nav[ngptPageFooterLinks]`

The link row's `<nav aria-label="Footer">` is consumer-authored and needs **no** primitive:

- The 16px gap between the row and the copyright line comes from the strip itself, now a centered
  column flex (`display: flex; flex-direction: column; align-items: center; gap`). With only the
  copyright line present there is one child, so the gap is inert — this replaces the old
  `margin-block-end` on the row, which the container can no longer reach.
- The 24px between links comes from each link's own `padding-inline: var(--ngpt-sys-space-300)`
  (12px per side, adjacent links therefore 24px apart — the `--ngpt-sys-space-600` step the old row
  gap used). The leading/trailing 12px is invisible on a centered row, and the padding enlarges the
  hit area. Chosen over a third primitive purely to style one `<nav>`: three attribute components
  for a footer is more ceremony than a two-region layout region earns.

The link _does_ need its own primitive, and could not reuse an existing one: `a[ngptInlineLink]` is
underlined and accent-colored for prose sentences, `a[ngptNavItem]` has a pill hover fill. This
spec's own § "Link row visual treatment" call — inherit the footer's muted type, hover brightens to
`--ngpt-text-secondary`, no underline — matches neither. Its four declarations are unreachable from
the container's stylesheet under emulated encapsulation (projected nodes carry the _consumer's_
encapsulation id, the mechanic ADR-0005 records for `prose`), so they must live on the link.

## Copyright line becomes projected content

The spec's mock is `<footer class="page-footer">Copyright © 2026 NGP Table</footer>` — the string is
the footer's _content_, and under the inversion content is the consumer's. It also puts the copy
where `CONVENTIONS.md` #6 wants it (authored copy in `home.content.ts`, never hardcoded in a
block). The earlier decision to hardcode it ("§ Copyright text hardcoded") is superseded: it was
justified by the component owning the template, which it no longer does.

## Spec wording the inversion invalidated

- Front-matter `a11y: role="contentinfo"` → rewritten as the native-landmark statement plus its
  nesting precondition.
- `## Link row is @if-gated, not a data-* state` (above) is moot — there is no `links()` array and
  no `@if`. The distinction it drew is still correct, it just no longer applies here.
- `## Link row visual treatment` survives unchanged as the _visual_ contract; only where the rules
  live moved (row gap → strip flex gap, link spacing → link padding).
- `## FooterLink shape` survives, but `FooterLink` is no longer an input type. **Kept** — Home's
  Sponsor/Discord/GitHub copy still wants a typed shape in `home.content.ts`, and `external`
  still tells that template whether to emit `target`/`rel`. Its doc comment says so.
