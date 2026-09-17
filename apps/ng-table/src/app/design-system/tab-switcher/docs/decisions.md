# tab-switcher — decisions

## Wired onto `ng-primitives/tabs`

Rewired from a hand-rolled roving-tabindex implementation onto `NgpTabset` + `NgpTabList`
(component `hostDirectives`, since `:host` is the track — no wrapper element) and `NgpTabButton`
per item. `hostDirectives` input/output remapping (`ngpTabsetValue: selected`,
`ngpTabsetValueChange: selectedChange`) keeps the component's public contract
(`selected`/`selectedChange`) unchanged for consumers — no call sites existed yet, so this was a
zero-risk rewire. Arrow-key roving focus, `role="tab"`/`role="tablist"`, `aria-selected`, and
`data-active` all now come from the primitive instead of hand-rolled `viewChildren` + keydown
logic.

## Manual activation, not selection-follows-focus

The spec's `a11y` front-matter only says "arrow keys move between tabs, aria-selected on the
active one" — it doesn't say whether arrowing onto a tab activates it immediately. The States
table resolves this implicitly: it lists **"Inactive tab (focus) — Keyboard focus — 2px accent
ring"** as its own reachable row, distinct from "Active tab — selected — Filled bg". If
selection followed focus, a tab could never be simultaneously focused *and* inactive via
keyboard, so that row would be unreachable. Read literally, the spec requires focus and
selection to be decouplable — i.e. the ARIA APG **manual activation** pattern.

Implemented via `provideTabsConfig({ activateOnFocus: false })` (component-scoped provider, not
global — this control's manual-activation requirement shouldn't leak to any future tabs
component elsewhere in the app). With `activateOnFocus: false`, `NgpTabButton` only selects on
its native `click` listener — moving roving focus with arrow keys does not select. Enter/Space
activation on the focused tab needs no extra keydown handling: it's a real `<button>`, so the
browser's own Enter/Space-triggers-click semantics fire the same `click` listener. This
reproduces the previous hand-rolled behavior (arrow keys move focus only; click/Enter/Space
activates) without any local keydown code.

## `TabItem` shape: `{ id, label }` only

Spec's Composition/Build-spec sections show plain text tabs only ("Preview" / "Source") — no
icon or count glyph anywhere in the mock or Build spec table. Kept the type minimal rather than
speculatively adding optional `icon`/`count` fields with no spec basis.

## `data-active` attribute, not the mock's `.is-active` class

The spec's HTML/CSS mock uses a `.is-active` class, but `docs/CONVENTIONS.md` rule 3 is
repo-wide and explicit: "State as `data-*` attributes — never state classes." Followed the app
convention over the component spec's literal mock markup: `[attr.data-active]="isSelected(tab)
? '' : null"`, selected in CSS via `.tab-item[data-active]`.

## No wrapper `<div>` — `:host` is the track

Mock wraps `role="tablist"` on an inner `<div class="tab-switcher">`. Followed this app's
established `:host`-as-styling-root pattern (see `category-badge`) instead: `:host` carries
`display: inline-flex` + the track background/radius/padding, and `role="tablist"` is a static
host attribute (`host: { role: 'tablist' }`) rather than template markup. Avoids a redundant
element purely for styling/ARIA purposes.

## No local `:focus-visible` override

The spec's mock CSS repeats a `:focus-visible { box-shadow: 0 0 0 2px var(--ngpt-focus-ring); }`
rule, but it is byte-for-byte the same treatment `src/styles/global.css` already applies
globally (same token, same 2px box-shadow, `outline: none`). Per CONVENTIONS.md rule 4 ("Focus
ring comes from the global `:focus-visible` policy... don't restyle focus locally unless your
spec says a different treatment"), no local rule was added — this component's focus ring is
inherited from the global policy, not duplicated.

## Roving-tabindex fallback when nothing is selected yet

`selected` is an optional input (remapped onto `NgpTabset`'s `value`, itself optional). If it's
`undefined`, or set to an id not present in `tabs()`, `NgpTabset`'s own `selectedTab` computed
falls back to the first non-disabled registered tab — the same fallback the hand-rolled
`focusableId` computed used to provide locally, now handled by the primitive.

## No icon mapping needed

Spec has no glyph placeholder (plain text tab labels only) — CONVENTIONS.md rule 7's
Lucide-mapping step doesn't apply to this component.
