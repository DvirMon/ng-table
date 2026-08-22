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

---

# Conversion to `button[ngptIconButton]` (ADR-0005)

Everything above describes the pre-conversion `ngpt-icon-button` element wrapper. This section
records the conversion and supersedes the parts of it that conflict.

## Selector and shape

`ngpt-icon-button` → `button[ngptIconButton]`. The template is now `<ng-content />` in
`icon-button.html` (separate file — CONVENTIONS forbids inline templates even for a one-liner),
and every `.icon-button` rule moved verbatim onto `:host` / `:host(:pseudo)`. No wrapper element
ships; the host *is* the button, so consumers bind the native `(click)` and `pressed:
output<void>()` is gone.

`type="button"` is applied as a constructor default exactly as `pill-button` does — imperative,
guarded on `hasAttribute('type')`, so a consumer's explicit `type="submit"` still wins where a
host *binding* would have clobbered it. Unlike `pill-button` there is no `tagName` check, because
the selector admits only `<button>`.

## `icon` and the 13-icon registry are gone

`icon: input<string>()` existed only because a component could inject a glyph a directive could
not. With the glyph projected, the consumer authors `<ng-icon>` and registers it locally. That
deletes the whole `provideIcons({ …13 icons… })` block and the "Local icon registration
(ADR-0004)" note above along with it — the flag it raised ("if a later spec introduces a glyph
outside this table, its call sites render nothing") is resolved by construction: each call site
now registers exactly what it renders.

The glyph size / `aria-hidden` / `color="currentColor"` recipe moves to each call site. The
`color="currentColor"` part is load-bearing — the state coloring below only reaches the glyph
because of it.

## `label` **dropped** — not kept

The conversion brief said to keep `label` (setting `aria-label` + `title`). It is dropped
instead, for a reason that only surfaced once both halves were written:

1. **It is native capability.** `aria-label` and `title` are attributes the consumer can now set
   directly on the element, because there is no longer a wrapper hiding it. That is precisely the
   case ADR-0005 says never to re-declare as an input, and the same call the ADR made for
   `disabled`/`href`/`type`. `label` existed only to bridge the wrapper.
2. **Keeping it is a real collision, not a style preference.** `[ngptCopyConfirm]` binds
   `[attr.aria-label]` per state on the *same host*. Two directives binding the same attribute
   both write it every change-detection pass; which one lands is decided by Angular's
   directive-execution order, which is not part of the public contract. Worse, with `label` unset
   `icon-button` would write `null` — *removing* the attribute the directive just set. The brief
   asked for both "`label` sets `aria-label` on the host" and "per-state `aria-label` on the
   host"; those cannot both be true of one element.

Consequence for call sites: `label="Close"` becomes `aria-label="Close"`, and copy buttons drop
it entirely in favor of `[ngptCopyConfirm]`'s `idleLabel`/`copiedLabel`/`failedLabel`.

`title` is likewise native; `[ngptCopyConfirm]` sets it per state where it applies.

## `state` / `displayIcon` / `accessibleLabel` / `confirmationMessage` / live region — moved

All five moved to `[ngptCopyConfirm]`. `IconButtonState` was deleted from `icon-button.types.ts`
and is now `CopyConfirmState` in `copy-confirm/copy-confirm.types.ts`. `icon-button.types.ts`
keeps only `IconButtonSize`.

The visually-hidden `<span aria-live="polite">` and its `.visually-hidden` CSS are deleted; a
directive has no template, so the announcement is re-solved in
`copy-confirm/copy-confirm.announcer.ts` — see that domain's `docs/decisions.md`.

**Known breakage, deliberate:** `code-block.ts` and `install-row.ts` still import
`IconButtonState` and bind `icon`/`state`/`(pressed)`. Those are out of this pass's write scope; a
separate sequential pass converts them.

## What stayed: `data-copy-state` coloring

`:host([data-copy-state='copied'])` and `:host([data-copy-state='failed'])` stay in
`icon-button.css` even though this component no longer sets the attribute. The attribute is the
declared contract between the two (ADR-0005: "Host `[attr.data-copy-state]` so CSS can react"),
`:host([attr])` matches regardless of who wrote the attribute, and the spec front-matter's `owns`
still claims "icon color per state". A directive carries no stylesheet, so this is the only place
the coloring can live without moving a domain's CSS out of its domain — the exact split ADR-0005
rejected for `libs/shared/design-system`.

Consequence: `[ngptCopyConfirm]` on a host *other* than `ngptIconButton` gets the behavior but no
confirmed/failed color. Acceptable — coloring is chrome, and that host owns its own chrome.

## `:host(:disabled)` added

The source spec's States table has always listed `Disabled | disabled prop | Opacity 0.5`, and the
pre-conversion decisions above record it as skipped because the fixed contract named no `disabled`
input. With the host as the real button the input was never the point — `:host(:disabled)` reacts
to the native attribute for free, matching `pill-button`. Added; costs one rule, closes a
long-standing spec gap.

## `padding: 0` added to `:host`

New. A `<button>` carries UA padding (`1px 6px`); the old inner `.icon-button` inherited the same
and got away with it because the fixed `width`/`height` plus `box-sizing: border-box` (global
`reset.css`) already pinned the box and flex centering absorbed the rest. Zeroing it makes the
30×30 box deterministic rather than incidentally correct. No visual change.
