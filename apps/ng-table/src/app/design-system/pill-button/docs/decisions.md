# Decisions — pill-button

Build-time judgment calls not spelled out verbatim in `docs/spec.md` or the fixed contract in
`apps/ng-table/docs/CONVENTIONS.md`.

## Additions beyond the fixed contract

- **`disabled = input<boolean>(false)`.** The fixed contract only lists `variant`, projected
  label, and `<button>` rendering — it doesn't mention a `disabled` input. But the spec's own
  "States" table documents a Disabled state (`disabled` prop → opacity 0.5, no pointer events)
  and the HTML/CSS mock includes a `.pill-button:disabled` rule. Added an optional, default-false
  `disabled` input bound to the inner `<button>`'s native `disabled` attribute so `:disabled`
  styling actually has something to key off — purely additive, doesn't change the fixed shape.
- **`type="button"`** on the inner `<button>`, not in the mock. Prevents accidental form
  submission if a consumer ever nests this inside a `<form>` (e.g. a future search/filter bar).
  No spec conflict — the mock's plain `<button>` defaults to `type="submit"` only because it was
  a standalone reference snippet, not because submit behavior was intended.
- **`:host { display: inline-flex; }`.** Not in the mock (which only styled `.pill-button`
  directly). Needed so the custom element itself (not just the inner button) hugs content and
  behaves as a flex item when placed in the navbar's flex group or the hero's button row —
  otherwise the host defaults to browser's generic `inline` for unknown elements, which is close
  but less predictable across the two host consumers.

## Untokenized on-band values

The on-band variant table in the spec gives literal oklch values for hover backgrounds
(`oklch(0.95 0.01 52)` primary, `oklch(0.24 0.03 52)` secondary) and the primary variant's text
color (`oklch(0.2 0.03 52)`), but — unlike every other row — does **not** pair them with a
`--ngpt-*` token name, and the front-matter `tokens` list confirms it: it includes
`--ngpt-onband-fill` / `--ngpt-onband-fill-inverse` but nothing for on-band hover or on-band
primary text. `src/styles/tokens/color.css` has no matching custom property either. Per
CONVENTIONS.md's hardcoding rule ("never hardcode a value that has a token" — not "never hardcode
any value"), these are hardcoded oklch literals in `pill-button.css` since no token exists to
reference. Secondary on-band text reuses `--ngpt-text-primary` (white) since that token already
matches the required value exactly.

## No distinct active/pressed treatment

Front-matter `states` lists `active/pressed`, but neither the Build spec table nor the CSS mock
gives it distinct values (no `:active` rule in the mock). Implemented with no `:active` override
— pressed state falls through to whatever hover/focus-visible state is already active, matching
the mock as given rather than inventing an unspecified press style.

## Icons

Not applicable — pill-button is text-only per spec Composition ("Text label, no icon"), so no
`viewProviders`/`provideIcons` registration was added.

## Hero size override — explicitly out of scope

Per the task brief, the "Hero size override" (14.5px/600, 11px 20px padding) called out in the
spec is a page-local CSS override the Home hero consumer applies via a host class or CSS custom
property scoped to the hero — not built into this component.
