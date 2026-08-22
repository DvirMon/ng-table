# Callout — build decisions

## Icon-per-kind mapping

| Kind | Icon | Source |
|---|---|---|
| note | `lucideInfo` | spec.md Variants table + Iconography.md placeholder mapping (ⓘ) |
| tip | `lucideLightbulb` | spec.md Variants table + Iconography.md (inline stroked bulb SVG placeholder) |
| warning | `lucideTriangleAlert` | spec.md Variants table + Iconography.md (⚠) |

No deviation — all three match both `spec.md`'s Variants table and `Iconography.md`'s callout rows exactly.
Registered locally via `viewProviders: [provideIcons({ lucideInfo, lucideLightbulb, lucideTriangleAlert })]`
per ADR-0004 (no `app.config.ts` touch).

## Spec-vs-fixed-contract call: added an optional `title` input

The fixed contract in `CONVENTIONS.md` only names `kind` (tint + icon) and "projected body content
(ng-content)." `spec.md`'s Build spec table separately calls out an optional, per-variant-colored Title
("Inter 13.5px / 600, variant-colored, margin-bottom 4px"). Angular's default view encapsulation does not
let `callout.css` style elements that arrive through `<ng-content>` — those nodes keep the *consumer's*
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
  plain optional string input, that naming is left to the consumer's copy (e.g. "Breaking in v2" already
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
