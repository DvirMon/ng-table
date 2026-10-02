# Spec — shared collapsible core (#209)

Source: [#209](https://github.com/DvirMon/ng-table/issues/209).
Decisions: [`1-decisions.md`](1-decisions.md) (D0–D11).
Architecture: [`3-architecture.md`](3-architecture.md).

## Problem Statement

The tree toggle (`ngpTableTreeToggle`) and the coming detail-panel
toggle (`ngpTablePanelToggle`, #212) do the same job: a button that
opens and closes something tied to a row. Each would carry its own
copy of the same trigger behavior — click-to-toggle, `aria-expanded`,
`data-expanded` — and the copies would drift.

The shipped tree toggle also has three gaps against ADR-0029:

- It leaves the button's `type` to the consumer. A toggle inside a
  `<form>` (row editing with Signal Forms) submits the form on every
  click unless the consumer remembered `type="button"`.
- It warns in dev mode when the button has no accessible name.
  ADR-0029 category 3 (amended 2026-10-01) makes names fully
  consumer-owned: the library writes no text and polices nothing.
- It omits `aria-expanded` on a leaf row — a per-feature branch that
  would have to live in any shared core.

## Solution

One internal trigger core, shared by every row toggle. It owns only
behavior identical across features: the button type, the click, and
the open-state attributes. Each feature's toggle directive keeps its
public name and selector, supplies its own open state and toggle
action, and owns everything that differs per feature (disabled
handling, dev wiring checks, panel relations).

Consumers see no new API. The tree toggle stops needing a manual
`type="button"`, stops warning about names, and shows
`aria-expanded="false"` on leaf rows (hidden from assistive tech, as
before).

## User Stories

1. As a consumer, I want a tree toggle inside a `<form>` not to
   submit the form, so that expanding a row never triggers a save.
2. As a consumer, I want the toggle to be `type="button"` even when I
   forget to write it, so that I cannot ship the form-submit bug.
3. As a consumer, I want the toggle to stay `type="button"` even if I
   wrote another `type`, so that no markup makes a toggle submit.
4. As a consumer, I want to name the toggle with `aria-label`,
   `aria-labelledby` or visible text, so that the words are mine and
   translatable.
5. As a consumer, I want no console warning about toggle names, so
   that the library does not police product text (ADR-0029 cat. 3).
6. As a consumer, I want clicking a tree toggle to open and close its
   row's children, exactly as today.
7. As a consumer, I want `aria-expanded` and `data-expanded` on the
   toggle to follow the row's open state, exactly as today.
8. As a consumer, I want a leaf row's toggle to stay disabled,
   `aria-hidden` and `data-disabled`, so that alignment and focus
   behave as today.
9. As a screen-reader user, I want leaf toggles unreachable, so that
   a disabled button with no meaning is never announced.
10. As a consumer, I want the toggle click to still bubble to the row
    without `preventDefault()`, so that my own whole-row `(click)`
    recipe keeps working (TR36, TR44).
11. As a consumer, I want a clear dev-mode error when the toggle is
    used without `withTree()`, exactly as today.
12. As a consumer of group headers, I want the tree toggle to keep
    collapsing groups under `withGrouping() + withTree()`.
13. As a library maintainer, I want click, type and open-state
    bindings written once, so that the tree and panel toggles cannot
    drift.
14. As a library maintainer, I want the core to know nothing about
    `table.tree` or `table.expansion`, so that no feature reads
    another's state (E37).
15. As a library maintainer, I want the core's contract to hold only
    members both features use, so that it never grows feature flags
    (D1).
16. As a library maintainer, I want the core kept out of the public
    barrel, so that it is not API surface.
17. As the #212 implementer, I want a ready core to build
    `ngpTablePanelToggle` on, so that the panel toggle only adds its
    own relations (`aria-controls`, registry).

## Implementation Decisions

- **One internal core, shared logic only (D1).** Anything that
  branches per feature stays in the feature directive, even when
  that duplicates it.
- **Core contract (D2, D4).** Two members supplied by each feature:
  an open-state signal and a toggle action. The core binds from them
  and reaches no store.
- **Core bindings (D2, D7, D11).** `type` is always `"button"`,
  written as a dynamic binding so it overrides a consumer's static
  `type`; click calls the feature's toggle; `aria-expanded` is
  `"true"`/`"false"` from the open state; `data-expanded` is presence
  only (ADR-0026 rule 1).
- **Mechanism (D10).** A selectorless abstract directive base, one
  level deep, which each feature toggle extends — the Angular CDK
  pattern (`CdkMenuTriggerBase`). Chosen over `hostDirectives`
  (needs a public or `ɵ`-prefixed export under ng-packagr) and over
  function helpers (would write the DOM from an effect). Evidence:
  `discovery-core-composition.md`, `discovery-shared-directive-prior-art.md`.
- **Not exported** from the library's single barrel.
- **Tree toggle retrofit.** Extends the core; keeps its selector,
  row/table injection, disabled branch (`disabled`, `aria-hidden`,
  `data-disabled`) and the `withTree()` dev throw (TR40, D9). Its own
  `aria-expanded` omission on leaves goes (TR48). Its nameless-button
  warning goes (TR47, D8).
- **No attribute bound by two writers (TR37).** The feature directive
  binds none of the core's four attributes.
- **Panel toggle is #212's.** It extends the same core; its relations
  (registry, `aria-controls`) are panel-only.

## Testing Decisions

- **One seam: the tree toggle's existing directive spec.** It renders
  a real table host and asserts DOM — the highest seam, already in
  place. No separate spec for the internal core; its whole contract
  is observable through the toggle.
- **Add:** the rendered toggle has `type="button"` with no `type` in
  the template, and with `type="submit"` in the template.
- **Change:** the leaf case asserts `aria-expanded="false"` instead
  of absent; `disabled`, `aria-hidden`, `data-disabled` unchanged.
- **Delete:** the nameless-button warning cases (warns once, no
  re-warn, does-not-warn variants, leaf skip).
- **Keep unchanged:** open/close on click, group header collapse,
  click bubbles without `preventDefault`, the `withTree()` dev throw.
- Tests assert rendered attributes and rendered rows only, never the
  core's members.
- The panel toggle's tests are #212's, through the same core.

## Out of Scope

- `ngpTablePanelToggle` and panel content (#212, #199).
- Whole-row click on the row directive (D5; TR36/TR44 stand).
- `hidden="until-found"` / `beforematch` for kept-mounted panels
  (D0; `inert` per #199).
- Any library-written label text (D8, ADR-0029 cat. 3).
- Keyboard navigation between rows (#201).
- Switching the library build to ng-packagr.

## Further Notes

- **Sequencing (D6).** #199's planning PR merges first (ADR-0029's
  amendment reaches `main`); #209 ships before #212.
- Tree docs (`3-ui/directives/tree.md`) and tree stories update with
  the retrofit: no `type="button"` needed, no name warning, leaf
  `aria-expanded="false"`.
