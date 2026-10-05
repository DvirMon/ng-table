# Callout — build decisions

## Icon-per-kind mapping

| Kind    | Icon                  | Source                                                                        |
| ------- | --------------------- | ----------------------------------------------------------------------------- |
| note    | `lucideInfo`          | spec.md Variants table + Iconography.md placeholder mapping (ⓘ)               |
| tip     | `lucideLightbulb`     | spec.md Variants table + Iconography.md (inline stroked bulb SVG placeholder) |
| warning | `lucideTriangleAlert` | spec.md Variants table + Iconography.md (⚠)                                  |

No deviation — all three match both `spec.md`'s Variants table and `Iconography.md`'s callout rows exactly.
Registered locally via `viewProviders: [provideIcons({ lucideInfo, lucideLightbulb, lucideTriangleAlert })]`
per ADR-0004 (no `app.config.ts` touch).

## Spec-vs-fixed-contract call: added an optional title input

> Renamed `title` → `heading` in the ADR-0005 conversion below; the rationale for the input existing at
> all is unchanged.

The fixed contract in `CONVENTIONS.md` only names `kind` (tint + icon) and "projected body content
(ng-content)." `spec.md`'s Build spec table separately calls out an optional, per-variant-colored Title
("Inter 13.5px / 600, variant-colored, margin-bottom 4px"). Angular's default view encapsulation does not
let `callout.css` style elements that arrive through `<ng-content>` — those nodes keep the _consumer's_
template scope, not `callout`'s — so a title colored to match the active `data-kind` can't be reliably
achieved by asking consumers to hand-color their own projected markup.

Added `title = input<string>()` (optional, undefined by default) rendered and colored by the component
itself; the single default `<ng-content />` still carries the body, matching the fixed contract's
"projected body content" line. This is additive, not a replacement of the contract.

## Accessibility

- `role="note"` applied as a static host attribute on every kind, not conditionally on `warning`. Read the
  spec's a11y line ("Warning callouts get role=\"note\"") as clarifying that even the warning variant uses
  the calm advisory role rather than `role="alert"` — not as scoping the role to warning alone — so all
  three kinds get the same role for consistency.
- The icon (`ng-icon`) carries a static `aria-hidden="true"`; it's decorative in every kind, so the
  attribute isn't bound to `kind()`.
- The spec also expects "the variant is named in the visible title" for warnings — since `title` is a
  plain optional string input (named `heading` — see below), that naming is left to the consumer's copy (e.g. "Breaking in v2" already
  reads as urgent without repeating the word); the component doesn't inject variant-name text automatically.

## Token deviations from the spec's literal mock

- Grid template columns: mock hardcodes `20px 1fr`. `--ngpt-sys-space-500` resolves to exactly `20px`, so
  `grid-template-columns: var(--ngpt-sys-space-500) 1fr` is used instead of the literal, per the
  "never hardcode a value that has a token" rule — this token isn't listed in the spec's front-matter
  `tokens:` array, but it's an exact match found in `src/styles/tokens/spacing.css`.
- Icon size: `size="var(--ngpt-sys-icon-size-md)"` (token) instead of the mock's literal `size="16px"`, plus
  `color="currentColor"` per `Iconography.md`'s note that icon color always inherits — tint comes from
  `:host([data-kind]) .callout-icon { color: ... }`, never a hardcoded fill.
- Title font: `font: var(--ngpt-sys-typescale-label-large)` (400 13.5px/1.4) with `font-weight: 600`
  layered on top — no token in `typography.css` combines 13.5px with 600 weight
  (`label-large-strong` is 600 but 13px, not 13.5px), so the weight override stays a literal per the mock.
- Icon's 1px optical offset (`margin-top: 1px`) has no matching token at that granularity; kept literal,
  matching the mock.

## Structural / API notes

- `:host` is the styling root (grid, padding, border, background) — no wrapper `.callout` div, so
  `data-kind` lives directly on the host element per `CONVENTIONS.md` §2/§3 (variant + state as `data-*`
  host attributes, not modifier classes like the mock's `.callout--warning`).
- Physical `margin`/`padding` shorthands (not logical `margin-block`/`padding-inline`) were used, matching
  the only built sibling component (`pill-button.css`) — this app states no RTL requirement anywhere in
  `CONTEXT.md`/`CONVENTIONS.md`, so consistency with the existing precedent was weighted over defaulting to
  logical properties.
- Body content's internal spacing (e.g. the mock's `.callout p { margin: 0 }` reset) is intentionally not
  reproduced in `callout.css` — plain descendant selectors in a component's stylesheet don't match nodes
  delivered through `<ng-content>` under Angular's default encapsulation, so that reset would silently no-op
  from inside this component. Left to the projecting page/prose styles.

## Converted to `aside[ngptCallout]` — ADR-0005

|              | Before                                    | After                                            |
| ------------ | ----------------------------------------- | ------------------------------------------------ |
| Selector     | `ngpt-callout` (element)                  | `aside[ngptCallout]` (attribute, camelCase)      |
| Host element | `<ngpt-callout>` custom element           | the consumer's own `<aside>`                     |
| Call site    | `<ngpt-callout kind="warning" title="…">` | `<aside ngptCallout kind="warning" heading="…">` |

This component was ADR-0005's own worked example of the tell: a static `role="note"` on a custom element
is the host compensating for having no native semantics, and `<aside>` — "content only indirectly related
to the main content, frequently presented as … call-out boxes" — is exactly the element being simulated.

Unlike `code-chip`/`pill-button`, the conversion is host-only. Callout composes real structure of its own
(icon column + `.callout-content` column, with the heading rendered and tinted by the component), so it
keeps its template, its `imports: [NgIcon]`, and its local `provideIcons` registration — the icon is chosen
by `kind`, so this domain owns it, not the consumer (ADR-0004). It stays a `@Component` with
`templateUrl` + `styleUrl`; no inline templates in this repo. `callout.css` is unchanged apart from a
comment: every rule was already written against `:host` / `:host([data-kind='…'])`, which now match the
`<aside>` directly.

### `role="note"` kept, not dropped

Dropping it was checked rather than assumed, because `<aside>` does **not** convey `note`:

- `<aside>`'s implicit ARIA role is `complementary` ([MDN, Technical summary]) — a landmark, announced in
  the landmark list and navigable by landmark shortcuts.
- Per HTML-AAM, a nested `<aside>` — descendant of `article`/`aside`/`nav`/`section` with no accessible
  name — maps to `generic` instead. Callouts live inside docs prose (`article[ngptProse]`), so this is the
  case that actually applies: bare, they would expose **no** role at all.
- `note` is neither of those. It means "ancillary parenthetic content", carries no landmark semantics, and
  is what this spec's `a11y` front-matter requires verbatim.

Both candidate outcomes were therefore wrong to leave implicit: `complementary` would flood the landmark
list with one entry per admonition in a long docs page, and `generic` would drop the advisory semantics the
spec asked for. `role="note"` stays as an explicit static host attribute — it is on `<aside>`'s
**permitted ARIA roles** list, so this is a sanctioned override, not a role clobbering a stronger native
one. The earlier reading stands unchanged: applied to all three kinds, not only `warning` (the spec's
a11y line scopes the _calm_ role choice to warnings — i.e. `note` rather than `alert` — it does not scope
the role to warnings alone).

### `title` input renamed to `heading`

`title` is a global HTML attribute. On the old custom-element host that was harmless; on an `<aside>` it
collides three ways:

1. **Double-write.** Angular feeds a static attribute to a directive input of the same name, so
   `<aside ngptCallout title="Breaking in v2">` would set the input _and_ leave `title` in the DOM — the
   consumer gets a native hover tooltip nobody asked for, duplicating text already visible in the block.
2. **Accessible name.** `title` supplies an accessible name, so it would rename the `note` — and, absent
   the explicit `role`, would have flipped the nested `<aside>` from `generic` back to `complementary`,
   i.e. an API input silently changing the element's role.
3. **The escape hatch closes.** With the input holding the name, a consumer wanting a genuine tooltip has
   no way to set one, and `[title]="x"` binds the input instead of the DOM property.

Renamed to `heading` rather than papered over with an alias. It is the more accurate name for what the
field is (a visible label line, not a tooltip), it leaves `title` free for its native meaning, and it
sidesteps the ADR-0005 rule against shadowing native attributes instead of arguing an exception to it.
`label` was rejected for consistency reasons: in this app (`icon-button`, `dropdown-pill`) `label` already
means _accessible_ label, which this is not. The rendered element keeps its `.callout-title` class — that
is internal styling vocabulary matching the spec's `.callout__title`, not part of the public API.

No call site changed: `callout` has none today.
