# Decisions — select-trigger

Build-time judgment calls not spelled out verbatim in `docs/spec.md` or the fixed contract in
`apps/ng-table/docs/CONVENTIONS.md`.

## Final public API

```ts
@Component({ selector: 'ngpt-select-trigger', ... })
export class SelectTrigger {
  readonly options = input<readonly DropdownMenuItem[]>([]);
  readonly value = input<string>();               // current selection id, undefined = placeholder
  readonly placeholder = input<string>('Select an option');

  readonly valueChange = output<string>();
}
```

No `select-trigger.types.ts` — the only shape this component deals in is `DropdownMenuItem`,
imported from dropdown-menu; there's no local union/variant to name (the fixed contract lists no
`variant` for this component, and the spec's Build spec table doesn't add one either).

`options` defaults to `[]` rather than being left required, deviating from the task brief's
"likely" guess — matches dropdown-menu's own `items = input<readonly DropdownMenuItem[]>([])`
exactly, and avoids an undefined check before every `.map`/`.find` over it.

`select-trigger.utils.ts` holds `withSelection(options, value)`, a pure `.map` that stamps
`selected: option.id === value` onto each option before it reaches `ngpt-dropdown-menu` — pulled
out per `.claude/rules/file-organization.md`'s "extract inline object-construction in a `.map`"
rule rather than left as an inline computed callback.

## Accepted deviation: `role="combobox"` over a floating `role="menu"`, not `"listbox"`

`docs/spec.md`'s own a11y front-matter asks for `role="combobox"` + `aria-expanded` +
`aria-controls` on the trigger — that's what's built, unchanged. What it implies about the
*popup*, though, doesn't hold: a spec-faithful combobox pairs with `aria-haspopup="listbox"` and a
`role="listbox"`/`"option"` popup, but `dropdown-menu` (the only option-list component that
exists) ships `role="menu"` with `menuitem`/`menuitemradio` rows — its own `docs/decisions.md`
flags this exact mismatch as unresolved and hands the call to this component.

Per this build's brief: don't reach into dropdown-menu's template to relabel roles (out of scope,
touches a file outside this folder) or add a role-variant input to it (that decision belongs to
dropdown-menu's own maintainers, not a downstream consumer). So the trigger button uses
`aria-haspopup="menu"` — matching what's actually behind it — instead of `"listbox"`. The single
option that carries `selected: true` (the current value, wired via `withSelection`) renders as
`menuitemradio` + `aria-checked="true"` + accent check, which is the ARIA APG's own pattern for a
menu of mutually-exclusive choices and is functionally equivalent to a select for sighted and most
AT users, even though the role name isn't literally "listbox". Recorded here as the accepted gap
between ideal listbox semantics and dropdown-menu's real shipped shape — not silently patched over.

`aria-controls` always points at the menu's id (a per-instance counter, `ngpt-select-trigger-menu-N`,
set via `[id]` on `ngpt-dropdown-menu`'s host) regardless of open state, since dropdown-menu's host
is always present in the DOM (visibility is opacity/pointer-events, not `@if`) — nothing to gate.

## Outside-click race: `stopPropagation` on the trigger

dropdown-menu's `(document:click)` listener closes it whenever the click target isn't inside its
own host — and it has no reference to whatever element opens it, so it can't exclude the trigger
button by itself (its own `docs/decisions.md` calls this out and hands the fix to the consumer).
Without a fix: clicking the trigger to open flips `open` to `true` in the same tick that the same
click event, still bubbling, reaches `document`; dropdown-menu sees a click outside its own host
(the trigger button lives in a sibling position, not inside dropdown-menu's `:host`) and emits
`closed` right back, net effect a no-op toggle.

Fixed with `event.stopPropagation()` inside `onTriggerClick` before flipping `open` — the click
never reaches the document listener at all. This is the same fix dropdown-pill's agent applies in
parallel per the task brief; `event.target` filtering was the other option offered but
`stopPropagation` needs no reference-equality check against the trigger element and reads as the
more direct fix for a same-tick race on the same event.

## Closing returns focus to the trigger

dropdown-menu's `closed` output fires on every close path (commit, Escape, Tab, outside-click) and
its own decisions.md is explicit that returning focus to the trigger is "the caller's job" since
the component has no reference to what opened it. `onClosed()` here does both: collapses `open`
back to `false` and calls `.focus()` on the trigger button (via a `viewChild` template ref),
uniformly for every close path, matching the spec's Keyboard table ("Enter: ... closes, returns
focus to trigger").

## `data-open` / `data-filled` instead of the mock's `.is-active` class

The HTML/CSS mock in `docs/spec.md` keys the active-state styling off `.is-active` and
`[aria-expanded="true"]`. CONVENTIONS.md #3 ("state as `data-*` attributes — never state classes")
overrides that: `[attr.data-open]` on the host drives the active border/ring/text treatment,
`[attr.data-filled]` drives the "has a value, not currently open/focused" text-color state that
the spec's own front-matter states list (`empty/placeholder` vs `filled`) calls out but the Build
spec table doesn't hand a distinct token for — it reuses `--ngpt-text-secondary`, the same tier
the mock already applies to the active state, rather than leaving filled-but-closed text at the
placeholder's muted color. `aria-expanded` stays on the button for a11y only, not as a style hook.
`:focus-visible` is left as native browser state (composed alongside `[data-open]` in the same CSS
rule) rather than mirrored into a data attribute, since it isn't state this component tracks.

## Un-tokened values kept literal

`docs/spec.md`'s Build spec table lists two values with no token (`—`): chevron size (12px) and,
implicitly, font-size (14px, no typescale token in this app matches that value exactly — closest
is `label-large-sm` at 13px or `body-medium` at 14.5px, neither literally 14px). Both are
hardcoded per CONVENTIONS.md's rule, which only forbids hardcoding a value *that has* a
`--ngpt-*` token — gap (10px) does have an exact match (`--ngpt-sys-space-250`) and uses it instead
of a literal, even though the spec's own front-matter token list didn't enumerate it.

## Width: left flexible, not hardcoded to 280px

The Build spec table's own note is explicit — "280px in examples; flexible in real usage." No
width is set on `:host`; `.select-trigger` is `width: 100%` of whatever `:host` (`inline-flex`, no
intrinsic width) is asked to be by its container. A demo page wanting the 280px example look sets
that width on its own wrapper, not inside this component.

## Icon

`lucideChevronDown`, registered via local `viewProviders: [provideIcons({ lucideChevronDown })]`
per ADR-0004 — matches `src/styles/docs/Iconography.md`'s `▾ → lucideChevronDown` mapping and the
one already used by dropdown-pill's own spec-level chevron glyph.

## Positioning the floating dropdown-menu

dropdown-menu's own `:host` sets `position: absolute` and a `margin-top` but no `top`/`left` —
its own file comment states placement is the caller's job. This component's stylesheet targets
`ngpt-dropdown-menu` (the child component's host tag, styleable from the parent's own stylesheet
under Angular's emulated encapsulation) and sets `top: 100%; inset-inline-start: 0;` so the panel
opens flush under the trigger's left edge, composing with — not overriding — dropdown-menu's own
`position: absolute` and `margin-top`.
