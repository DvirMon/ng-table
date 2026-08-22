# install-row — decisions

## Final API

`ngpt-home-install-row` (page-local, `pages/home/install-row/`, class `InstallRow`):

- `command = input<string>()` — the install line, supplied by Wave 3's home-composition task.
  No default; if unset, `onCopyPressed()` is a no-op (nothing to write to the clipboard, no
  state change) rather than throwing on `undefined`.
- No `output`s and no other inputs. No `install-row.types.ts` — the only state shape needed is
  `IconButtonState`, imported directly from `../../../design-system/icon-button/icon-button.types`
  rather than redeclared, since it's the exact same three-value set and redeclaring it would let
  the two drift.

Template renders two children directly under `:host` (no wrapper `<div>` — `:host` itself is the
flex row, same pattern as `layout/page-footer/page-footer.css`):

- `<pre class="command">` — the `$`-prefixed command, `flex:1`, `min-width:0`, `overflow-x:auto`
  so it scrolls instead of pushing the button out. The `$ ` prompt is a separate `aria-hidden`
  span (`--ngpt-text-muted`) so a screen reader reads only the command text, not "$ ng add ...".
- `<ngpt-icon-button>` — `icon="lucideCopy"`, `[size]="30"`, `[state]="copyState()"`,
  `[label]="copyLabel()"`, `(pressed)="onCopyPressed()"`.

## State / icon swap — resolved against icon-button's real behavior

Read `design-system/icon-button/icon-button.ts` and its `docs/decisions.md` before wiring
anything. Confirmed: icon-button **already swaps the glyph internally** based on `state()` —
`displayIcon()` hardcodes `state==='copied' → lucideCheck` and `state==='failed' →
lucideTriangleAlert`, falling through to the caller's `icon()` only for `'idle'`. So install-row
passes a single base `icon="lucideCopy"` and never touches the glyph itself — no duplicate
icon-swap logic was written here.

Colors per state (`--ngpt-text-secondary` / `--ngpt-status-success` / `--ngpt-status-error`) are
also already handled inside `icon-button.css` via `:host([data-copy-state=...])`. install-row
only drives the `state` input; it does not set any color itself.

icon-button explicitly does **not** do clipboard work or own a hold timer (its own
`docs/decisions.md` calls this out as the caller's job). So install-row owns:

1. `onCopyPressed()` — `await navigator.clipboard.writeText(command())`, `copyState.set('copied')`
   on success, `copyState.set('failed')` on rejection (try/catch, since the Clipboard API can
   exist and still reject — e.g. permissions, non-secure context).
2. A `setTimeout` back to `'idle'` after `CONFIRM_HOLD_MS` (1400), cleared and re-armed on every
   call (`clearRevertTimer()` inside `settle()`) so a re-click before the hold elapses restarts
   the hold rather than queuing a stale revert. Cleaned up via `DestroyRef.onDestroy`.
3. Per-state `label` (`copyLabel` computed) passed straight through to icon-button's `label`
   input, which icon-button uses for both `aria-label` and `title`, and folds into its own
   `aria-live="polite"` region while non-idle. install-row does not add a second live region —
   icon-button already owns the announcement (`icon-button/docs/decisions.md` § Confirmation live
   region).

## Flag: icon-button's own confirmation text wins over `label()` for non-idle states

Re-reading `icon-button.ts` closely: `accessibleLabel = computed(() => this.confirmationMessage()
|| this.label())`, and `confirmationMessage()` returns a **non-empty, hardcoded** string for both
`'copied'` (`'Copied'`) and `'failed'` (`'Copy failed, select manually'`) — empty only for
`'idle'`. Because of `||`, whatever install-row passes via `label()` is only actually rendered as
`aria-label`/`title` while `state === 'idle'`; for `'copied'`/`'failed'` icon-button always uses
its own internal text, regardless of what the caller supplies.

Net effect: `copyLabel()` here still switches on all three states (as asked — "pass these through
icon-button's label input, changing with your copyState"), and its `'idle'` value ("Copy install
command") does reach the DOM. But its `'copied'`/`'failed'` values never do — icon-button
substitutes its own. This also means the exact failed-state copy the page spec asks for ("Copy
failed **— select the command manually**") is not what actually renders; icon-button's hardcoded
text is "Copy failed, select manually" (no "the command"). This is a pre-existing icon-button
behavior, not something install-row introduces, and out of scope to fix here since the brief says
not to touch icon-button's files. Flagging per rule #10 rather than silently shipping a `label()`
wire that looks functional but is partly inert.

## `--ngpt-comp-icon-btn-confirm-hold` — literal, not read from CSS

`sizing.css` defines `--ngpt-comp-icon-btn-confirm-hold: 1400ms`, confirmed present. The
`setTimeout` duration is a TS number, not a CSS value, and this repo has no precedent for reading
a custom property into JS at runtime for a timing value (checked; no `getComputedStyle` usage
anywhere in `apps/ng-table` or `apps/issa-landing` does this for a duration). Declared a local
`CONFIRM_HOLD_MS = 1400` constant with a comment pointing at the token instead, rather than
inventing a `getComputedStyle` read with no precedent. This is the same category of unavoidable
token-boundary gap `icon-button/docs/decisions.md` flags for its 24/32 sizes — reporting rather
than silently improvising past rule #2 ("never hardcode a `--ngpt-*`'d value"), since that rule
is about CSS literals and there is no CSS-reachable form of a `setTimeout` argument.

## Spec-vs-frame

`docs/design-handoff/frames/Home Page.dc.html`'s install-row mock confirmed the values the
written spec left implicit: row `gap: 12px` → `--ngpt-sys-space-300`, padding
`14px 14px 14px 18px` → `--ngpt-sys-space-350` / `--ngpt-sys-space-450`, `border-radius: 10px` →
`--ngpt-sys-shape-corner-small-alt`, command text color `--ngpt-text-secondary`, `$` prompt color
`--ngpt-text-muted`. All copy in the frame (`ng add ngp-table`, `data-content="MOCK"`) was
ignored — `command()` is the only source of the actual string, supplied by the caller.

## Deviations from the fixed contract

None in install-row's own API — `command: input<string>()` only, consumes icon-button's
confirmation variant exactly as specified, no extra inputs/outputs added. The one open item is
the icon-button behavior flagged above (its hardcoded copied/failed text overriding `label()`),
which is a icon-button-side gap, not an install-row deviation.
