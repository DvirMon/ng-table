# ADR-0005: DS primitives are attribute-hosted, never element wrappers

## Status

Accepted — 2026-08-22. Supersedes the element-selector contracts in `docs/CONVENTIONS.md` § Fixed
component contracts.

## Context

Waves 1–2 shipped every DS primitive as an element-selector component (`<ngpt-pill-button>`,
`<ngpt-inline-link>`, `<ngpt-nav-item>`, `<ngpt-code-chip>`, …) whose template's root is a native
element the component exists to style. That shape:

- **Duplicates the semantics it wraps.** `pill-button` re-declares `disabled` as an `input()`
  shadowing the native attribute; `inline-link` re-declares `href`/`external`; `nav-item`
  re-declares `href`. Native behavior has to be re-plumbed input by input, and anything not
  re-plumbed is simply unavailable.
- **Splits state across two elements.** `nav-item` puts `data-active` on the host and
  `aria-current` on the inner `<a>` — one logical state, two DOM nodes.
- **Makes event binding accidental.** Consumers bind `(click)` on `<ngpt-pill-button>`
  ([hero-band.html](../../src/app/pages/home/hero-band/hero-band.html)) and rely on the inner
  `<button>`'s click bubbling through the wrapper. Nothing declares that contract.
- **Forecloses the element.** A `pill-button` can never be an `<a>`, so Home's hero CTAs — which
  navigate — cannot be links.
- **Emits a non-semantic host**, often patched with a compensating `role=` (`ngpt-callout` carries
  `role="note"` where `<aside>` would do).

It also diverges from the repo's own idiom. `libs/shared/design-system` places its primitives on the
consumer's element (`button[acmeDropdown]`, `input[acmeAutocompleteInput]`,
`li[acmeDropdownOption]`) and `libs/shared/table` does the same (`table[ngpTable]`,
`td[ngpTableCell]`) under a locked invariant: attribute-only, never insert or reorder DOM.

`@ng-icons` is not the cause. `NgIcon` renders an `<svg>` — it _is_ content, with no native element
to sit on — so it is a legitimate component. It was an enabler: modelling the glyph as
`icon: input<string>()` made a component look necessary, because a directive cannot inject that
child. Consumers author the `<ng-icon>` instead (see Consequences).

## Decision

A DS primitive whose job is to style or add behavior to an existing native element is declared with
an **attribute selector naming the elements it is valid on**, and hosts on the consumer's element:

```ts
@Component({
  selector: 'button[ngptPillButton], a[ngptPillButton]',
  template: '<ng-content />',
  styleUrl: './pill-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-variant]': 'variant()' },
})
export class PillButton {
  readonly variant = input<PillButtonVariant>('default');
}
```

`@Component` with an attribute selector — not `@Directive` — so `styleUrl` and `:host()` stay
colocated in the domain folder under emulated encapsulation, preserving docs-by-responsibility.
`libs/shared/design-system`'s pure-`@Directive` + `dropdown.global.scss` split was considered and
rejected on that ground: it moves a domain's CSS out of the domain.

An element-selector component (`ngpt-*`) remains correct for a domain that composes real structure
of its own and shadows no native element: `code-block`, `preview-window`, `search-overlay`,
`navbar`, `hero-band`, `install-row`.

**Test for which applies:** if the template's root is a semantic native element, or the host carries
a `role=`/`aria-*` compensating for being a custom element, it is attribute-hosted.

Native capability is never re-declared as an input. `disabled`, `href`, `target`, `rel`, `type` are
set by the consumer on the element. Inputs carry only what is genuinely the primitive's own
(`variant`, `active`, `state`).

## Consequences

- **One component per element.** Angular permits only a single component per host, so
  `<button ngptPillButton ngptIconButton>` is invalid. Where two primitives must stack, at most one
  may be a component and the rest are `@Directive` — directives compose with a component freely.
  This is why `dropdown-pill` becomes a behavior-only `@Directive` sitting beside `ngptPillButton`
  on the same `<button>`, rather than a component wrapping one.
- **An attribute-hosted component cannot co-host with an `ng-primitives` component** for the same
  reason. Behavior imported from `ng-primitives` must arrive through `hostDirectives`, or the
  primitive must itself be a `@Directive`. Not exercised this round — the app currently uses no
  `ng-primitives` despite it being a repo dependency; that gap is tracked separately.
- **`prose` still needs `ViewEncapsulation.None`.** Moving to `article[ngptProse]` fixes the
  non-semantic host, but emulated encapsulation still cannot reach projected content — projected
  nodes carry the _declaring_ component's encapsulation id, so `:host h2` would never match.
  CONVENTIONS.md #9 survives; only its host element changes.
- Consumers author their own `<ng-icon>` children, so `icon-button` loses `icon: input<string>()`
  and its 13-icon `provideIcons` registry, and loses `pressed: output<void>()` — consumers bind the
  native `(click)`.
- Call sites change from `<ngpt-x>…</ngpt-x>` to `<button ngptX>…</button>`. Eleven exist today;
  this is the cheapest point to convert.

## Corollary: opt-in behavior is a consumer-placed directive, never `hostDirectives`

`icon-button` currently owns both the button's styling _and_ the copy-confirmation state machine —
clipboard write, the 1400ms hold, per-state `aria-label`, the live region. That machine is already
duplicated verbatim in `code-block` and `install-row` (two `1400` literals, two `revertTimer`
fields, two `clearRevertTimeout()` methods), while every non-copying icon button — navbar menu
toggle, overlay close, pagination arrows — carries `state` and a live region it never uses.

It splits out as `[ngptCopyConfirm]`, a plain `@Directive` the **consumer places** beside the
component on the same element:

```html
<button ngptIconButton ngptCopyConfirm [text]="command()" failedLabel="…">…</button>
```

Legal because Angular forbids only _component + component_ on one host; a component plus any number
of directives composes freely. `icon-button` does not need demoting to a `@Directive` for this.

**Not `hostDirectives`.** Host-composing it into `icon-button` is statically resolved, so it would
apply to every icon button in the app, defeat tree-shaking, and force `icon-button` to re-declare
`text`/`idleLabel`/`failedLabel` in its own metadata — leaking copy concerns into the generic
button's API. This is the rule `libs/shared/table/CLAUDE.md` already states: `hostDirectives` is for
_unconditional_ behavior; opt-in behavior gets its own public directive the consumer places.
Consumer-placed is also the more reusable of the two — it can sit on a `<button ngptPillButton>`, a
bare `<button>`, or an `<a>`, whereas host-composed it is reachable only through `icon-button`.

Because the consumer now authors the glyph, the directive cannot swap it; the consumer branches on
`copy.state()` in its own template. The hold moves to a CSS animation on the confirm state with
`(animationend)` returning to idle, so `--ngpt-comp-icon-btn-confirm-hold` becomes the single source
for the duration and both hardcoded `1400` literals are deleted. Under
`prefers-reduced-motion: reduce` the animation must be given a zero duration rather than
`animation: none`, or `animationend` never fires and the button sticks in the confirmed state.

`failedLabel` becomes an input, which fixes a live bug: `install-row` passes its own spec'd failure
copy today and `icon-button` silently overrides it with a hardcoded string.

## Sequencing against the in-flight `ng-primitives` refactor

A separate refactor is landing `ng-primitives` directives into some of these same components. The
conversion is therefore split rather than deferred:

**Converted now.** Tier 1 is a _prerequisite_ for that work, not a conflict: every `ng-primitives`
directive needs a native host (`NgpButton` is `[ngpButton]` on a `<button>`; `NgpSelect` sits on the
consumer's `<button>`), and today's element wrappers provide none. Converting first creates the
hosts. Alongside it, the three array-driven domains with no primitive equivalent — `pagination`,
`page-footer`, `feature-grid` — move to consumer-authored markup.

**Held until the `ng-primitives` pass lands**, because each maps 1:1 onto a primitive that would
replace hand-written behavior:

| Domain           | Primitive                                       |
| ---------------- | ----------------------------------------------- |
| `tab-switcher`   | `NgpTabset` — roving tabindex, keyboard         |
| `dropdown-menu`  | `NgpMenu` — keyboard, typeahead, outside-click  |
| `select-trigger` | `NgpSelect` — the `acme-dropdown` shape exactly |
| `dropdown-pill`  | `NgpMenu` trigger                               |
| `search-overlay` | `NgpDialog` — focus trap, scrim, Esc            |

Hand-rolling roving tabindex and menu keyboard handling into content-queried child directives now,
only to delete it when `NgpTabset`/`NgpMenu` arrive, is waste. These convert on top of the
primitives, in that round.
