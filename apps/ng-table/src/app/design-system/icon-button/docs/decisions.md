# icon-button — decisions

## Glyph mapping

- Idle/default glyph is whatever the caller passes via `icon: input<string>()` — icon-button
  owns the control chrome, not the glyph choice (spec `does_not_own`).
- Confirmation states are hardcoded per the spec's "Confirmation variant" table, not driven by
  `icon()`:
  - `state="copied"` → `lucideCheck` (maps spec's `✓` placeholder, `Iconography.md` row).
  - `state="failed"` → `lucideTriangleAlert` (maps spec's `⚠` placeholder).
- `state="idle"` (default) falls through to `icon()` unchanged.

## Local icon registration (ADR-0004)

`icon()` is caller-supplied and icon-button is consumed by many other domains (code-block copy
button, install-row copy button, toolbar run buttons, pagination arrows, drawer close, mobile
menu trigger, etc. per `docs/CONVENTIONS.md`'s fixed-contract table). Because registration is
local-only (`viewProviders`, never `app.config.ts`) and the `<ng-icon>` lives in *this*
component's own view, every icon name any caller might ever pass through `icon()` must be
registered here — icon-button can't know at compile time which glyph a given instance will
render. I registered the full Lucide inventory listed in `Iconography.md`'s mapping table
(`lucideChevronDown`, `lucideArrowUp`, `lucideCopy`, `lucideZap`, `lucideArrowLeft`,
`lucideArrowRight`, `lucideMenu`, `lucideX`, `lucideSearch`, `lucideCheck`, `lucideInfo`,
`lucideTriangleAlert`, `lucideLightbulb`) rather than guessing a subset. Flag for downstream
agents: if a later spec introduces a glyph outside this table, its icon-button call sites will
render nothing until this list is extended.

## Size variant vs. token gap

Fixed contract requires `size: input<24|30|32>(30)`, but the token set only defines
`--ngpt-comp-icon-btn-size: 30px` (no 24/32 equivalents in `sizing.css`). Default (30) uses the
token; 24 and 32 are literal `px` values gated behind a `data-size` host attribute
(`:host([data-size='24'])` / `:host([data-size='32'])` override a local `--_ngpt-icon-btn-size`
custom property that `.icon-button` reads). This is a deviation from "never hardcode a
`--ngpt-*`'d value" that I couldn't avoid — the token simply doesn't exist for the two
non-default sizes. Flagging per the rule 10 instruction rather than silently improvising past it.

`data-size` isn't in the fixed contract's host-attribute list (only `data-copy-state` is
called out) — added it because rule #2/#3 both push variants/state through `data-*` attributes
rather than inline styles or classes, and size is otherwise unreachable from outside the
component's view encapsulation.

## Icon size (glyph, not button box)

The Build spec table lists icon glyph size as `13px` with no token in its own column, but
`Iconography.md`'s size scale defines `--ngpt-sys-icon-size-sm: 13px` for exactly this case
("Icon buttons, toolbar glyphs"). Used the token instead of the literal per the
never-hardcode-a-tokened-value rule. The glyph size is constant across all three button sizes
(24/30/32) — the spec doesn't define a per-size icon scale, only a per-size button box.

## Confirmation live region

`a11y` front-matter requires `aria-live="polite"` announcements for both copy outcomes, but a
static `aria-label` swap alone isn't reliably announced by all screen readers. Added a
visually-hidden `<span aria-live="polite">` inside the button holding the same "Copied" /
"Copy failed, select manually" text as `aria-label` (empty in idle state). `accessibleLabel()`
and the live-region text share one `confirmationMessage()` computed so the two can't drift.

Known limitation not addressed (out of scope for this pass): if a caller drives `state` from
`'copied'` back to `'copied'` again without an intermediate `'idle'` tick, some screen readers
won't re-announce an unchanged live-region string. Not a spec requirement; noting for whoever
wires the clipboard timer (install-row, code-block).

## Scope deltas from the source spec (not in the fixed contract)

- **No `disabled` input.** The spec's States table lists `Disabled | disabled prop | Opacity
  0.5`, but the task's fixed contract only lists `icon`, `label`, `size`, `state`, `pressed`.
  Implemented nothing for it (no dead `:disabled` CSS, no unused input) rather than
  improvising an input the contract doesn't name. Flagging so a later pass can add it
  deliberately if a consumer needs it.
- **No internal hold-duration timer.** `--ngpt-comp-icon-btn-confirm-hold` (1400ms) and the
  "re-click restarts rather than queues" behavior are the caller's responsibility per the task
  brief ("this component does not do clipboard work itself, just renders + emits") — icon-button
  only renders whatever `state()` it's given. Token is unused inside this component; it belongs
  to whichever consumer (install-row, code-block) owns the `setTimeout`.
- **Focus ring not restyled locally.** The spec's mock CSS repeats `box-shadow: 0 0 0 2px
  var(--ngpt-focus-ring)` under `:focus-visible`, but `src/styles/global.css` already applies
  that exact rule globally. Only added the state-specific part (`color:
  var(--ngpt-text-primary)`) locally, per CONVENTIONS rule #4 ("don't restyle focus locally
  unless your spec says an element needs a different treatment") — the ring itself needs no
  different treatment here.
