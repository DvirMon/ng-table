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
padding (`--ngpt-sys-space-500`)" but only cites the *sidebar's* token (space-500 = 20px) for
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

## No `nav-item.types.ts`

No variant union — `active`/`nested` are plain booleans, `href` is a plain string. Nothing to put
in a types file per `.claude/rules/file-organization.md`.
