# Sidebar Nav Item — decisions

## `href` input added beyond the fixed contract

`docs/CONVENTIONS.md`'s fixed contract lists only `active` and `nested` for `nav-item`. The build
brief explicitly allowed adding `href` if the spec implies one ("bind `href` if your spec's Build
spec table implies one"). The Build spec table has no href row (not a design token), but the
HTML mock renders every instance as `<a href="#">`, and rule 4 requires a real `<a>` for
navigation — an anchor with no `href` isn't a real hyperlink (not keyboard-focusable, no
`:focus-visible` state, breaks the spec's own Focus state). Added:

```ts
readonly href = input<string>('#');
```

Defaults to `'#'` so the component is a functioning link out of the box; the future sidebar
(out of scope this round) overrides it with a real route path.

## `nested` maps to color treatment, not indentation

The build brief's fixed-contract description speculated `nested` might drive an
`--ngpt-comp-toc-nested-indent`-style token. Checked the spec's actual `tokens:` front-matter
list — no such token exists, and none of the 16 listed tokens are indent/spacing tokens beyond
the item's own padding. The spec's own Variants section resolves this instead:

> Accent treatment — nested feature items (e.g. Sorting)

and the States table only differentiates "Active (accent/nested)" from "Active (neutral)" — never
a default/hover indent difference. So `nested` is implemented as the accent color variant
(`--ngpt-accent-bg` / `--ngpt-accent`), gated on `:host([data-nested][data-active])`, matching the
mock's `.nav-item--accent.is-active` rule exactly. No indentation is applied.

## "Section label styling" (spec's `owns` list) not built

The spec's front-matter lists "Section label styling" under this domain's `owns`, but the build
brief's fixed contract only asks for the nav-link atom (`active`/`nested`, projected label,
anchor). A section label (e.g. an uppercase "GETTING STARTED" heading above a group of items) is
a sibling structural element, not a variant of the link itself, and its container/grouping is
explicitly `does_not_own` here ("Sidebar container + grouping — see layout/Sidebar Navigation.md").
Left unbuilt this round — `--ngpt-sys-typescale-label-small-alt` and
`--ngpt-sys-comp-nav-section-gap` are unused by this component. Flagging for whoever builds the
Sidebar Navigation layout region: those two tokens are already resolved and waiting.

## Negative horizontal margin value

Spec Notes say "Negative 10px horizontal margin so the row full-bleeds inside the 20px sidebar
padding (`--ngpt-sys-space-500`)" but only cites the _sidebar's_ token (space-500 = 20px) for
context, not a token for the 10px margin itself — no dedicated margin token exists in the spec's
token list. 10px equals `--ngpt-sys-space-250`, already used for the item's own horizontal
padding, so reused that token (`margin-inline: calc(var(--ngpt-sys-space-250) * -1)`) rather than
hardcoding `-10px`.

## `:host { display: contents }`

No dedicated wrapper box on the host — the projected `<a class="nav-item">` becomes the effective
flex item inside the (out-of-scope) sidebar's `display: flex; flex-direction: column; gap: 4px`
container, matching the mock where `<a>` is the direct flex child. Also keeps `:host([data-active])`
/`:host([data-nested])` attribute selectors working normally (attribute selectors match regardless
of the host's own `display`).

## Converted to `a[ngptNavItem]` — ADR-0005

|          | Was                                                              | Now                                     |
| -------- | ---------------------------------------------------------------- | --------------------------------------- |
| Selector | `ngpt-nav-item` (element)                                        | `a[ngptNavItem]` (attribute, camelCase) |
| Host     | inert `<ngpt-nav-item>` wrapping an inner `<a class="nav-item">` | the consumer's own `<a>`                |
| Inputs   | `active`, `nested`, `href`                                       | `active`, `nested`                      |

Per [ADR-0005](../../../../../docs/adr/0005-attribute-hosted-components.md). This domain is one of
the ADR's own named examples: it "splits state across two elements — `data-active` on the host and
`aria-current` on the inner `<a>`, one logical state, two DOM nodes." All three attributes
(`data-active`, `data-nested`, `aria-current`) now land on the single anchor. Kept as a
`@Component` (not `@Directive`) so `styleUrl` stays colocated in this domain folder.

### `href` dropped — reverses this file's own earlier decision

The "`href` input added beyond the fixed contract" section above argued for `href = input('#')`
because an anchor with no `href` is not focusable and the spec's Focus state would be unreachable.
That reasoning was correct _given a wrapper_: the component owned the only `<a>` in play, so if it
did not supply an `href` nobody could. Attribute-hosted, the consumer authors the `<a>` and its
`href` directly, so the concern dissolves — and the `'#'` default goes with it. That default was
always a placeholder standing in for a route the sidebar had not been built to supply yet; the
sidebar now supplies a real one, or a `routerLink`, on its own element.

### `active` / `nested` kept

Neither mirrors a native attribute — they are this primitive's own state, per ADR-0005's
"inputs carry only what is genuinely the primitive's own (`variant`, `active`, `state`)". `active`
additionally drives `aria-current="page"`, which the spec's `a11y` front-matter requires.

### Both need `transform: booleanAttribute`

CONVENTIONS.md rule 1 scopes the requirement to "a boolean input mirroring a native attribute",
and strictly neither of these does. Applied anyway, because the failure mode is about the _call
form_, not about nativeness: both are set as bare attributes (`<a ngptNavItem active>`), which
passes the string `''` — falsy — so without the transform `data-active` and `aria-current` would
never be applied and only `[active]="true"` would work. That is precisely the defect that got
`pill-button`'s `disabled` input deleted. Reading the rule narrowly here would ship the bug it
exists to prevent, so the transform is on both.

The alternative — requiring `[active]="true"` at every call site — was rejected: the bare
attribute is the natural authoring form for a boolean on an element the consumer already owns, and
nothing would flag the mistake at build time.

### CSS

`.nav-item` rules moved to `:host` and its state rules from `:host([data-active]) .nav-item` to
`:host([data-active])`. `:host { display: contents }` is gone — it existed only to keep the wrapper
from becoming the sidebar's flex item instead of the anchor; the anchor now _is_ the host, so it is
the flex child directly, which is what the mock's `.sidebar-nav > a` shape always assumed.
`display: block` is retained on `:host` so the row full-bleeds across the column and the
padding/left-border box applies (an `<a>` is inline by default).

The `:host(:focus-visible)` rule is carried over as-is rather than deleted in favor of the global
`:focus-visible` policy. It duplicates the global value, but removing it is a behavior change
outside this conversion's scope — flagged, not acted on.

## No `nav-item.types.ts`

No variant union — `active`/`nested` are plain booleans, `href` is a plain string. Nothing to put
in a types file per `.claude/rules/file-organization.md`.
