# Decisions — dropdown-menu

Build-time judgment calls not spelled out verbatim in `docs/spec.md` or the fixed contract in
`apps/site/docs/CONVENTIONS.md`. Read this before wiring `dropdown-pill` or `select-trigger`
against the real component — it's the exact shipped API, not the guessed one from the contract.

## Final public API

```ts
@Component({ selector: 'ngpt-dropdown-menu', ... })
export class DropdownMenu {
  readonly items = input<readonly DropdownMenuItem[]>([]);
  readonly open = input<boolean>(false);

  readonly select = output<string>();   // emits the committed item's id
  readonly closed = output<void>();     // fires on every close path (see "select vs closed" below)
}
```

```ts
export interface DropdownMenuItem {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly selected?: boolean; // current value — accent text + check, role="menuitemradio"
  readonly group?: string;     // clusters consecutive items under a label + divider
}
```

Host: `role="menu"`, `[attr.data-open]` (presence-based, see below). No wrapper `<div>` inside the
template — `:host` *is* the floating panel (all Build-spec-table CSS lives directly on `:host`),
so the caller positions/sizes it exactly like any other absolutely-positioned box.

## `items` beyond the guessed `{ id, label, disabled? }`

Added `selected?: boolean` and `group?: string`. The spec's Composition list ("Optional group
label", option rows with "optional trailing check") and Build-spec-table rows ("Group label",
"Divider between groups", "Option text (selected)") aren't representable without them. No separate
divider/group-label entry type was added to the array — a divider + label render automatically
whenever `group` changes between consecutive items (divider only after the first item; label only
when the new group has a name). This keeps `items` a flat, single-shape array instead of a
discriminated union the fixed contract didn't ask for.

One asymmetry: a divider renders when entering a *new* named group, but not when leaving a named
group back into an ungrouped run of items. The spec's mock only shows one group, so there's no
worked example of that transition — documenting it here rather than inventing an unspec'd rule.

## Role model: `menu`/`menuitem(radio)`, not `listbox`/`option`

`spec.md`'s own a11y front-matter lists `role="menu" / "listbox"` as alternatives — the Keyboard
and ARIA section explains why: Select Trigger wants `aria-haspopup="listbox"` + `role="option"` +
`aria-selected`, Dropdown Pill wants `aria-haspopup="menu"` + `role="menuitem"`. The task brief's
own Rules section is explicit though ("`role=\"menu\"`/`role=\"menuitem\"` per spec"), and this
component ships to *both* consumers with one shape, so it commits to the menu model:

- Host: `role="menu"` (static).
- Option with `selected` defined (single-choice list, e.g. the "Framework" example in the mock):
  `role="menuitemradio"` + `aria-checked`. This is the ARIA APG's own pattern for a menu button
  whose items are mutually-exclusive choices with a checkmark — matches the mock exactly.
  `role="option"`/`aria-selected` would be invalid inside `role="menu"`.
- Option with `selected` omitted (plain command, e.g. a Dropdown Pill action): `role="menuitem"`.

**Flag for Select Trigger's agent (Wave 2):** if Select truly needs listbox semantics
(`role="listbox"`/`"option"`) rather than a checked-menuitem, that's a real deviation from what
shipped here — either Select Trigger's own wrapper re-labels roles via a query, or this component
gains a role-variant input later. Not resolved in this round; the fixed contract for dropdown-menu
didn't include such an input, so nothing was speculatively added.

## `select` vs `closed` — which fires when

Every close path emits `closed`; a *commit* also emits `select` first:

| Trigger | `select` | `closed` |
|---|---|---|
| Click / Enter / Space on an enabled option | id | yes |
| Escape | no | yes |
| Tab (native tab continues — no `preventDefault`) | no | yes |
| Outside click | no | yes |

This is the literal reading of the spec's Keyboard table ("Enter: commits the focused option,
**closes**, returns focus to trigger"; "Esc: closes without committing"). The component can't
return focus to the trigger itself — it has no reference to it (`does_not_own`: "what opens it") —
so `closed` is the caller's cue to both hide the menu and move focus back, for every path alike.

## Outside-click integration note

`(document:click)` closes the menu when the click target isn't inside the host. This component has
no reference to whatever trigger element opens it, so it can't exclude that trigger from the
"outside" check. If a Wave 2 trigger toggles `open` on its own `click` handler, watch for the same
click being seen by both handlers in one tick (open flips true, then this listener immediately
treats that same click as "outside" and closes it again). Common fixes — `stopPropagation` on the
trigger's click handler, or checking `event.target` against the trigger's own element — are the
consuming component's job, not this one's.

## `data-open` and option `data-*` state: presence-based, not stringified booleans

`[attr.data-open]="open() || null"` — the attribute is either absent or `""`, never the literal
string `"false"`. Same pattern for `data-selected` / `data-disabled` / `data-focused` on each
option. CSS keys off presence (`:host([data-open])`, `.menu-option[data-focused]`), matching how a
native boolean HTML attribute works. `aria-checked` / `aria-disabled` are the opposite —
Angular's `[attr.x]` binding needs the literal `"true"`/`"false"` string for those (or `null` to
omit `aria-checked` entirely on plain `menuitem` rows), since ARIA requires the value, not just
presence.

## Focus-visible: suppressed locally on `.menu-option`

CONVENTIONS.md #5 says don't restyle focus locally unless the spec calls for different treatment.
The States table is explicit that "Option focused" ("Keyboard arrow lands on it") uses "Same fill
as hover" — no separate ring is described. Left as-is, the global `:focus-visible` policy would
stack its box-shadow ring on top of that fill. `.menu-option:focus-visible { outline: none;
box-shadow: none; }` keeps only the spec'd fill (via `[data-focused]`, driven by the roving
`highlightedId` signal) as the focus indicator.

## Roving tabindex, not `aria-activedescendant`

DOM focus actually moves between option elements (`tabindex="0"` on the highlighted one, `-1`
on the rest, moved with real `.focus()` calls) rather than staying on the host with
`aria-activedescendant` pointing at the active id. Both are valid ARIA menu patterns; roving
tabindex was picked because it needs no extra `id` plumbing per item and keeps the host's own
`(keydown)` listener working purely through normal event bubbling from whichever option has focus.

Disabled options are skipped by the roving system entirely (never receive `tabindex="0"`, never
targeted by Arrow/Home/End/typeahead) — they stay in the DOM and render `aria-disabled="true"` so
they're still visible to a screen reader's browse-mode cursor, matching the spec's "stay in the
tab-around order but are skipped by arrows" note (read as *linear/AT* order, not literal Tab-key
stops — this widget never uses native Tab to move between its own items; Tab always closes it per
the Keyboard table).

## Icon

`lucideCheck`, registered via local `viewProviders: [provideIcons({ lucideCheck })]` per ADR-0004
— matches `src/styles/docs/Iconography.md`'s `✓ → lucideCheck` mapping and the spec's own mock.

## Wired onto `ng-primitives/menu` (post-shipped revision)

Replaced the hand-rolled roving-tabindex/typeahead/outside-click/Escape/Tab machinery with
`ng-primitives/menu`: `hostDirectives: [NgpMenu]` on this component's host, `ngpMenuItem` /
`ngpMenuItemRadio` (inside one host-wide `ngpMenuItemRadioGroup`) on each option button. This is a
breaking API change from the "Final public API" section above:

- `open` input and `closed` output are **gone**. This component is no longer self-positioning or
  self-opening — the caller renders it inside an `<ng-template>` bound to a real
  `[ngpMenuTrigger]`/`[ngpSubmenuTrigger]`-style directive (see `dropdown-pill` and
  `select-trigger`, wired in the same pass), which owns showing/hiding, positioning, the portal,
  focus trap/return, outside-click, and Escape/Tab. Trigger owns "what opens it" even more
  literally now than the original `does_not_own` already said.
- `select` still emits the committed item's id — either from `onOptionClick` (plain command items)
  or from `ngpMenuItemRadioGroupValueChange` (radio items). There's no separate `closed` — the
  primitive handles closing on selection (`closeOnSelect`, default `true`), Escape, and outside
  click without this component's involvement.
- Role model is now enforced by the primitive rather than manually bound: `ngpMenuItem` sets
  `role="menuitem"`, `ngpMenuItemRadio` sets `role="menuitemradio"` + `aria-checked` from its
  membership in the `ngpMenuItemRadioGroup`. The `role: 'menu'` / `[attr.role]` / `[attr.aria-*]`
  bindings this file used to own by hand are removed.
- `data-open` (host) is gone — this element only exists in the DOM while the trigger has it open
  (portaled content), so there's no "closed but present" state to key CSS off of. `data-enter` /
  `data-exit` (set by the primitive while animating) replace the old opacity/transform transition
  driven by `[data-open]`.
- Per-option `data-focused` → `data-focus-visible`, `data-selected` → `data-checked` — these now
  come from the primitive's own interaction/radio state instead of a hand-tracked
  `highlightedId` signal; `data-disabled` keeps its name (primitive uses the same convention).
- Grouping (`group` label + divider) is **not** an `ng-primitives/menu` concept — that logic is
  unchanged, still computed per-item in the template from `group` transitions.

`CONVENTIONS.md`'s fixed-contract row for `dropdown-menu` still lists the pre-wire `open`/`closed`
shape; update it alongside `dropdown-pill`/`select-trigger` once those are rewired to match, since
right now nothing in the repo constructs the `<ng-template>` this component expects to live in.

## Reduced motion

`@media (prefers-reduced-motion: reduce)` in `dropdown-menu.css` zeroes the `translateY` transform
on both the closed and open (`[data-open]`) states, per CONVENTIONS.md #9 — the global stylesheet
only collapses transition *durations*, so without this the panel would still slide (just faster)
instead of only fading.
