# Decisions — dropdown-menu

Build-time judgment calls not spelled out verbatim in `docs/spec.md` or the fixed contract in
`apps/ng-table/docs/CONVENTIONS.md`. Read this before wiring `dropdown-pill` or `select-trigger`
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

CONVENTIONS.md #4 says don't restyle focus locally unless the spec calls for different treatment.
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

## Reduced motion

`@media (prefers-reduced-motion: reduce)` in `dropdown-menu.css` zeroes the `translateY` transform
on both the closed and open (`[data-open]`) states, per CONVENTIONS.md #9 — the global stylesheet
only collapses transition *durations*, so without this the panel would still slide (just faster)
instead of only fading.
