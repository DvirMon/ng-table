# Decisions — dropdown-pill

Build-time judgment calls not spelled out verbatim in `docs/spec.md` or the fixed contract in
`apps/site/docs/CONVENTIONS.md`.

## Final public API

```ts
@Component({ selector: 'ngpt-dropdown-pill', ... })
export class DropdownPill {
  readonly items = input<readonly DropdownMenuItem[]>([]);
  readonly label = input<string>('');

  readonly select = output<string>();   // forwards the committed item's id, then closes
}
```

`DropdownMenuItem` is imported directly from `../dropdown-menu/dropdown-menu.types` (no barrel,
ADR-0002) — no new type was needed, so there's no `dropdown-pill.types.ts` file.

Host: `[attr.data-open]` (presence-based, mirrors dropdown-menu's own pattern). No `disabled`
input — the spec's States table has no disabled row and the fixed contract doesn't ask for one;
not fabricated.

## `label` is static, not the selected item's text

The task brief allowed either "a static label" or "reflects the selection." Went static, for two
reasons:

1. **`select-trigger` already owns that job.** Its own `docs/spec.md` front-matter is a combobox
   contract — `states: ["empty/placeholder", "filled", ...]`, `a11y: role="combobox" aria-expanded
aria-controls"`, `tokens: [..., --ngpt-comp-select-placeholder]`. Dropdown Pill's front-matter has
   none of that — no placeholder/filled states, no placeholder token, `a11y:
["aria-haspopup=\"menu\" + aria-expanded"]` (menu, not combobox). Two components with the same
   "shows the current value" behavior would duplicate select-trigger's actual contract.
2. **The role model backs this up.** dropdown-menu's own `docs/decisions.md` frames Dropdown Pill as
   wanting `aria-haspopup="menu"` + `role="menuitem"` — a command menu ("Actions ▾"), not a
   value-picker. The spec's own mock ("Example CSS ▾") reads as a fixed example, not a demonstrated
   selection round-trip.

`items` can still carry `selected: true` on a row (dropdown-menu renders the check + accent text
for it), but that only affects the menu's own contents — it does not feed back into the trigger's
label.

## Composing pill-button: which spec tokens survive, which don't

`ngpt-pill-button`'s default variant and this spec's Build spec table agree on most properties out
of the box (padding, border-radius, hover border/background) but disagree on two, and the
composition can't reach a third:

| Property           | pill-button default                                    | This spec wants                                    | Resolution                     |
| ------------------ | ------------------------------------------------------ | -------------------------------------------------- | ------------------------------ |
| Border (default)   | `--ngpt-comp-pill-border-default` (0.32)               | `--ngpt-comp-control-border-default` (0.30)        | **Overridden** — see below     |
| Text (default)     | `--ngpt-text-tertiary` (0.62 lightness)                | `--ngpt-comp-dropdown-text` (0.75 lightness)       | **Overridden** — see below     |
| Font               | `--ngpt-sys-typescale-label-large-medium` (weight 500) | `--ngpt-sys-typescale-label-large-sm` (weight 400) | **Not overridden** — see below |
| Border (hover)     | `--ngpt-comp-pill-border-hover`                        | `--ngpt-comp-pill-border-hover`                    | Already matches                |
| Background (hover) | `--ngpt-bg-hover`                                      | `--ngpt-bg-hover`                                  | Already matches                |
| Padding            | `--ngpt-sys-space-150 --ngpt-sys-space-300`            | same                                               | Already matches                |
| Focus box-shadow   | `--ngpt-focus-ring`                                    | `--ngpt-focus-ring`                                | Already matches                |

Border/text overrides, in `dropdown-pill.css`:

```css
ngpt-pill-button {
  --ngpt-comp-pill-border-default: var(--ngpt-comp-control-border-default);
  --ngpt-text-tertiary: var(--ngpt-comp-dropdown-text);
}
```

This works because CSS custom properties inherit through the DOM regardless of Angular's emulated
view encapsulation (encapsulation only scopes _rule matching_, not _property inheritance_) — and
because pill-button's own `.pill-button` rule reads those two tokens directly rather than hardcoding
a color, they're re-pointable from outside. The rule is scoped to the single `ngpt-pill-button`
instance inside this component's own template (Angular attaches this component's content attribute
to that tag), so it does not leak into other pill-button call-sites (navbar, hero-band, etc). This
redirects one `--ngpt-comp-*`/`--ngpt-text-*` token to another — never a raw color literal, so it
doesn't violate CONVENTIONS.md's "never hardcode a `--ngpt-*` value" rule.

Font weight was **not** overridden the same way. Doing so would mean redefining
`--ngpt-sys-typescale-label-large-medium` — a foundational `--sys-*` token, not the
component-scoped `--comp-*` tokens above — locally on this one instance, which is a more invasive
reach than redirecting a component token. The two typescale tokens are otherwise identical (13px/1.4
Inter, differ only 400 vs 500 weight); left as pill-button's own choice. Flagging here per
CONVENTIONS.md #10 rather than silently improvising further.

## Open/focus treatment (front-matter `states: [..., "open"]`)

Real DOM focus moves off the trigger button and onto whichever `.menu-option` element
dropdown-menu's roving-tabindex highlights the moment the menu opens (`dropdown-menu.ts`'s own
`focusInitialOption()` effect) — so `:focus-visible` on the trigger alone goes dark the instant the
menu is open, even though the pill should still read as "active." `data-open` on this component's
own host covers that gap:

```css
:host(:focus-within) ngpt-pill-button,
:host([data-open]) ngpt-pill-button {
  --ngpt-comp-pill-border-default: var(--ngpt-accent);
  --ngpt-text-tertiary: var(--ngpt-text-primary);
}
```

Both conditions share one rule because they're visually identical per the spec's own Focus row
("text + chevron go white", accent border) and there's no separate value given for "open" beyond
being listed as its own state.

## Outside-click race — resolved with `stopPropagation()`

dropdown-menu's `docs/decisions.md` flags the exact race this component hits: its own
`(document:click)` listener has no way to exclude whatever trigger opened it, so a trigger's `click`
handler toggling `open` risks that same click bubbling to `document` and being read as "outside" in
the same tick, closing the menu it just opened.

`onTriggerClick` calls `event.stopPropagation()` before flipping `open`. Since dropdown-menu's
listener is bound at the document level via normal bubble-phase `addEventListener`, halting
propagation at the trigger button means that click event never reaches `document` at all — not just
a target check, the event genuinely never gets there. dropdown-menu's own suggested alternative
(checking `event.target` against the trigger) was not needed on top of this.

## No ARIA/focus passthrough on pill-button — handled imperatively

`ngpt-pill-button` exposes only `variant`/`disabled` inputs and projects content into its own
internal `<button>` via `<ng-content>`. Static or bound attributes placed on the `<ngpt-pill-button>`
tag in this component's template land on that _outer custom element_, not the inner `<button>` a
screen reader actually focuses — Angular does not forward host-level attributes into a component's
own template. Two consequences, both resolved by reaching into the real button via `viewChild`
reading `ElementRef` off a `#trigger` template variable, then `.querySelector('button')` (safe only
because pill-button's DOM shape — "renders `<button>`" — is a fixed, documented contract, not
guessed):

- **`aria-haspopup="menu"` / `aria-expanded`**: set via `effect()` directly on the queried button
  element (`setAttribute`), synced to the `open` signal.
- **Focus return**: dropdown-menu's own `docs/decisions.md` states `closed` is the caller's cue to
  both hide the menu and move focus back, "for every path alike." `close()` calls
  `.focus()` on the same queried button after every close path (`select` or `closed`).

This is a real gap in pill-button's public API for any component using it as a popup trigger —
worth pill-button gaining an explicit focus/ARIA passthrough mechanism if a third consumer needs the
same thing, but not resolved here per the same "don't touch pill-button's files" constraint that
applies to this build.

## Wired onto `ng-primitives/menu` (post-shipped revision)

Rewired this component and `dropdown-menu` onto `ng-primitives/menu` in the same pass. Everything
above this section describes the pre-wire implementation and is superseded where noted below —
kept for the historical record of _why_ each original call was made, since most of the reasoning
(icon choice, label semantics, gap token) still holds.

- **Selector changed:** `ngpt-dropdown-pill` → `button[ngptDropdownPill]` (attribute-hosted,
  camelCase per ADR-0005). This component's host is now the real trigger `<button>` itself;
  `hostDirectives: [NgpMenuTrigger]` lands `aria-haspopup`/`aria-expanded`/`aria-controls`
  directly on it. No more nested `<ngpt-pill-button>` — its default-variant CSS is inlined onto
  this component's own `:host` instead (pill-button itself also moved to a
  `button[ngptPillButton]` attribute selector for
  the same reason; see its own `docs/decisions.md`). The resolved token overrides from
  "Composing pill-button" above (`--ngpt-comp-control-border-default`, `--ngpt-comp-dropdown-text`,
  font left at pill-button's own medium weight) are preserved as literal property values in the
  new `:host` rule instead of CSS-custom-property redirection, since there's no longer a separate
  component instance to redirect variables into.
- **"No ARIA/focus passthrough on pill-button — handled imperatively" section is obsolete.** The
  `viewChild` + `querySelector('button')` + manual `effect()` `setAttribute` hack, and the
  `close()`/`.focus()` focus-return call, are all removed. `NgpMenuTrigger` owns ARIA sync,
  showing/hiding, and returning focus to the trigger on every close path (selection, Escape,
  outside click) — see the "Focus Management" line in the `menu` primitive's own accessibility
  list.
- **"Outside-click race — resolved with `stopPropagation()`" section is obsolete.** There's no
  more manual `onTriggerClick`/`open` signal/`(document:click)` race to resolve — the primitive
  handles opening (default `click` trigger) and outside dismissal internally, so `stopPropagation`
  was removed along with the click handler.
- **"Menu positioning" section is obsolete.** No more `:host { position: relative }` anchor +
  `ngpt-dropdown-menu { top: 100%; left: 0 }` — floating-ui (via the primitive's default
  `placement: 'bottom-start'`, `offset: 4`) positions the portaled panel now. Visually close to
  the old fixed offset; not pixel-verified against the original mock.
- **`data-open`** is still exposed on the host, but now reads `injectMenuTriggerState().open()`
  (the primitive's own trigger state signal) via a `computed()`, rather than a locally-owned
  `signal<boolean>` flipped by a click handler.
- **`select` output is unchanged** — still forwards the committed item's id; closing itself is no
  longer this component's job (see above).

## Icon: `▾` → `lucideChevronDown`

Per `src/styles/docs/Iconography.md`'s mapping table ("▾ (dropdown chevron) → lucideChevronDown"),
registered locally via `viewProviders: [provideIcons({ lucideChevronDown })]` (ADR-0004). Size:
Iconography.md's size table names `--ngpt-sys-icon-size-md` (16px) explicitly for "dropdown
chevrons" — used that over the spec's own unathenticated "10px" note (Composition section, no
token given), per CONVENTIONS.md's "never hardcode a value that has a `--ngpt-*` token" rule; 10px
has no token, 16px via `--ngpt-sys-icon-size-md` does and is the Iconography doc's own
purpose-matched choice.

## Menu positioning

`dropdown-menu.css`'s own `:host` sets `position: absolute` but no offsets, deferring
positioning to the caller by design. This component's `:host { position: relative }` anchors it;
`ngpt-dropdown-menu { top: 100%; left: 0; }` in `dropdown-pill.css` places the panel directly under,
left-aligned with, the trigger.

## Gap token

The mock's `gap: 6px` between label and chevron has no dedicated token of its own, but
`--ngpt-sys-space-150` already resolves to 6px (same token the Build spec table maps to this
pill's own vertical padding) — reused rather than introducing a new custom property or a raw
literal.
