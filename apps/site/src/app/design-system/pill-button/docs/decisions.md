# Decisions — pill-button

Build-time judgment calls not spelled out verbatim in `docs/spec.md` or the fixed contract in
`apps/site/docs/CONVENTIONS.md`.

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

## Selector changed to `button[ngptPillButton]` (post-shipped revision)

Was `ngpt-pill-button` (custom element wrapping its own inner `<button>` via `<ng-content>`).
`dropdown-pill`'s rewire onto `ng-primitives/menu` needed `[ngpMenuTrigger]` to land its
ARIA/focus wiring on the real focusable button, not an inert wrapper tag — the wrapper shape was
flagged as a real gap in this component's own `docs/decisions.md` (§ "No ARIA/focus passthrough
on pill-button") before this fix. Changed the selector to an attribute selector on `button`
(`button[ngptPillButton]`), matching the convention `ng-primitives`' own reusable-component
examples use (e.g. `button[app-menu-item]`) — this component's host **is** the button now, no
inner wrapper. `<ng-content>` still projects the label directly onto that host.

Consequence for every call site: `<ngpt-pill-button>Label</ngpt-pill-button>` becomes
`<button ngptPillButton>Label</button>` (camelCase attribute selector, per ADR-0005 — see
`apps/site/docs/CONVENTIONS.md` § "Selector prefix `ngpt`"). Updated the three existing call
sites (`navbar`, `hero-band`, `dropdown-pill`). `variant`/`disabled` inputs, `data-variant` host
attribute, and all CSS (moved from a `.pill-button` inner-element rule to `:host`/`:host(:pseudo)`
directly) are unchanged in behavior. `apps/site/eslint.config.mjs`'s
`@angular-eslint/component-selector` rule gained a second config entry (`type: 'attribute'`,
`style: 'camelCase'`) alongside the existing element/kebab-case one to allow this.

## Untokenized on-band values

The on-band variant table in the spec gives literal oklch values for hover backgrounds
(`oklch(0.95 0.01 328)` primary, `oklch(0.24 0.03 328)` secondary) and the primary variant's text
color (`oklch(0.2 0.03 328)`), but — unlike every other row — does **not** pair them with a
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

## `disabled` dropped; `<a>` added as a host — ADR-0005

`disabled` was an `input<boolean>(false)` bound to `'[disabled]': 'disabled() || null'`. That is
broken for the natural call form: `<button ngptPillButton disabled>` passes the _string_ `''` from
the attribute, which is falsy, so the host binding evaluated to `null` and **removed** the
attribute — silently enabling the button. Only `[disabled]="true"` worked.

Rather than patch it with `transform: booleanAttribute`, the input is gone. ADR-0005's rule is that
native capability is never re-declared as an input; the consumer sets the native attribute and
`:host(:disabled)` in the stylesheet already reacts to it. Nothing bound the input, so no call site
changed.

The selector gained `a[ngptPillButton]`. Home's hero CTAs navigate, so they must be links, not
buttons with click handlers — the element-wrapper shape made that impossible, which is one of the
reasons ADR-0005 exists. `text-decoration: none` was added to `:host` for the anchor case.

`type="button"` moved from a static host attribute to a constructor default, because a static host
attribute would also land on `<a>`, where `type` means something else entirely. Set imperatively
only when the host is a `<button>` and the consumer has not specified one, so an explicit
`type="submit"` still wins — which a host _binding_ would have clobbered.
