---
title: Spec — detail panel a11y directives (#199)
ticket: "#199"
capability: expansion
date: 2026-10-01
decisions: 1-decisions.md (D1–D14), decisions/expansion.md (E44–E56)
---

# Spec — detail panel a11y directives

## Problem Statement

A developer showing a **detail panel** under a row (`withExpansion()`) gets
the open set from the store and nothing else. They hand-write the button's
`aria-expanded`, the link from button to panel, keeping a closing panel out
of the Tab order, sending focus back when the panel closes from inside, and
Esc. Most get it wrong — the loudest complaint in every peer library
(Angular Material's keyboard-only failure open since 2019, MUI's VoiceOver
not entering the panel, MUI's Tab order skipping it).

The existing UI spec for expansion is two generations stale. Built as
written it disables every toggle, puts `aria-expanded` on the row (invalid
in a `role="table"`), and calls a store method that doesn't exist.

ADR-0029 makes accessibility the directives' job by default. The panel is
its first application (E41).

## Solution

Two directives. The consumer keeps writing native markup and its own
`@if`; the directives add the accessibility.

- **`ngpTablePanelToggle`**, on the consumer's `<button>` inside a row:
  clicking it opens or closes that row's panel. It reflects the open state
  (`aria-expanded`, `data-expanded`) and points at the panel
  (`aria-controls`) while the panel is in the page. Enter and Space come
  from the native button.
- **`ngpTablePanel`**, on the element holding the panel content, given the
  row's id: owns the panel's `id`, keeps a closed or closing panel out of
  the Tab order and the accessibility tree (`inert`), closes on Esc,
  offers a `close()` for an in-panel ×, and returns focus to the toggle
  when it closes with focus inside.

Mount and unmount stay the consumer's: by default the panel is unmounted
on close (E40); keeping it mounted is a per-row opt-in. Both directives
work either way. No CSS ships; the slide is a documented recipe. Button
names are the consumer's own words.

## User Stories

1. As a developer, I want to add one attribute to my row's button to make it open and close that row's detail panel, so that I don't write a click handler.
2. As a developer, I want the button to carry `aria-expanded` that follows the panel's open state, so that screen-reader users hear whether the detail is shown.
3. As a developer, I want the button to point at the panel with `aria-controls` while the panel is in the page, so that assistive technology can relate the two.
4. As a developer, I want `aria-controls` absent while the panel isn't in the page, so that it never points at a missing id.
5. As a developer, I want the panel's `id` generated for me, so that I don't invent and match ids by hand.
6. As a developer, I want the same row to get the same panel id every time it opens, including after server rendering and hydration, so that references stay valid.
7. As a developer, I want to pass the panel just the row's id, so that I can use it wherever I have an id.
8. As a developer, I want Enter and Space to work because the toggle is a real button, so that I don't wire keyboard handlers.
9. As a keyboard user, I want opening a panel to leave focus on the button, so that I don't lose my place.
10. As a keyboard user, I want the next Tab after opening to land inside the panel, so that I reach its content naturally.
11. As a keyboard user, I want a closing panel's content unreachable by Tab even while it animates out, so that focus never lands in something disappearing.
12. As a screen-reader user, I want a closing or closed panel removed from the accessibility tree, so that I don't hear hidden content.
13. As a keyboard user, I want Esc inside an open panel to close it, so that I can dismiss it without hunting for the button.
14. As a keyboard user, I want focus back on the row's button after Esc or the panel's own close button, so that I continue from where I opened it.
15. As a Safari user who clicked the panel's × with the mouse, I want focus to go to the row's button, so that keyboard use continues from a sensible place even though Safari didn't focus the ×.
16. As a developer, I want a `close()` on the panel I can call from my own × button, so that closing from inside returns focus correctly.
17. As a developer, I want Esc ignored when a widget inside the panel already handled it (a select, a combobox), so that one Esc doesn't close two things.
18. As a developer, I want a closed panel kept in the page (opt-in) to stay `inert`, so that its inner state survives without leaking into the Tab order.
19. As a developer, I want a toolbar "collapse all" not to pull focus to some row's button, so that bulk actions don't move the user.
20. As a developer, I want a clear error in development when I use either directive on a table without `withExpansion()`, so that I find the wiring mistake at once.
21. As a developer, I want a clear error when two panels claim the same row, so that a template mistake doesn't silently break `aria-controls`.
22. As a developer, I want no library text on my buttons, so that every name is in my product's words and language.
23. As a developer, I want no warning about button names, so that the library doesn't police my product's wording.
24. As a developer, I want single-open behavior to come from the table's configuration, not from the button, so that the API, Esc and keyboard stepping all follow it too (#210).
25. As a developer, I want no stylesheet shipped, so that the panel looks like my product; a documented slide recipe covers motion.
26. As a developer, I want `data-expanded` on the button, so that I can style the chevron from state.
27. As a developer, I want the directives to work whether my panel unmounts on close or stays mounted, so that I can choose per row.
28. As a developer reading the docs, I want the UI spec to describe these two directives only, so that I don't build from stale claims.

## Implementation Decisions

- **Two public directives**, exported from the library barrel:
  `ngpTablePanelToggle` (selector on `button`) and `ngpTablePanel`
  (attribute taking a `RowId`) (D2, D3, E45, E46).
- **Toggle's trigger behavior comes from #209's shared collapsible core**
  (`isOpen` + `toggle` contract; binds `aria-expanded`, `data-expanded`,
  `(click)`, `type="button"`). The panel toggle supplies
  `isOpen = expansion().has(rowId)` and `toggle = expansion.toggle(rowId)`,
  and adds `aria-controls` itself. The row id comes from the enclosing
  row directive through DI (D10, D14, E53). The toggle's build waits for
  #209's core; the panel side (registry, id, `inert`, Esc, `close()`) does
  not (#209 D6).
- **Registry**, internal, provided by the table host directive, keyed by
  `RowId`: a panel registers on mount and unregisters on destroy; the
  toggle registers its element. It answers "panel id for this row, or
  none" and "toggle element for this row" (D1, E44).
- **Panel id** = a per-table prefix + the escaped `RowId` — stable across
  remounts and hydration (D13, E56).
- **`inert`**: a host binding to "not open" covers a mounted panel. For
  the unmount path, the panel writes `inert` on its host through the
  renderer in its destroy hook, because the framework destroys the
  panel's view before its bindings refresh and runs destroy hooks while
  the element is still in the page during the leave animation (verified
  against Angular 22.1.2 source; E47, D4). `until-found` is not used
  (D7, #209).
- **Focus return** runs only from owned close paths — `close()` and the
  destroy hook — never from a reactive effect (D8, E51):
  - `close()` (exported via `exportAs: 'ngpTablePanel'`): collapse this
    row, then focus the toggle if focus is in the panel, on `<body>`, or
    nowhere.
  - destroy hook: focus the toggle only if focus is strictly inside the
    panel; then write `inert`.
  - Only a connected toggle is focused; when the row itself is gone
    (deleted, filtered out), focus is core row navigation's job (#201,
    D5, E48).
  - Not covered: something other than the panel closing a kept-mounted
    panel while focus is inside (same limit as CDK Menu).
- **Esc**: a keydown listener on the panel host calls `close()` unless
  the event's default was already prevented. An inner widget handling
  Esc first opts out; a consumer listener on the same host element runs
  after the directive and cannot (D6, E49). After `close()` the panel
  calls `event.preventDefault()` to mark Esc handled (E58).
- **Click and single-open**: the toggle always calls `toggle(id)`.
  Single-open is a state setting, `withExpansion({ multi })`, specced in
  #210 (D10, E54).
- **Accessible names are consumer-owned**: no label input, no default
  text, no warning (D11, E55, ADR-0029 #3 as amended).
- **Errors** (D9, E52): both directives throw when the table lacks
  `withExpansion()` — the check lives in each feature's directive, not the
  shared core (#209 D9); a second panel registering for an already
  registered `RowId` throws, naming the id. Both are dev-gated per
  ADR-0014's construction-check rule. No error for a toggle whose panel
  isn't mounted (that is "closed").
- **Docs**: `3-ui/directives/expansion.md` is rewritten in place per D12;
  the product doc's §6.2 U2–U4 rows point at the new spec.

## Testing Decisions

- One seam: a TestBed host component rendering a real table with
  `withExpansion()` and both directives, as the tree toggle's spec does.
  Assertions are on DOM attributes, focus and the store's open set — never
  on the registry or private members.
- Host variants: default (unmount via `@if`, with `animate.leave`);
  kept-mounted (gate on "ever expanded"); wiring-error hosts (no
  `withExpansion()`; two panels for one row).
- Behaviors pinned: click toggles; `aria-expanded`/`data-expanded`
  follow state; `aria-controls` equals the panel's id only while mounted;
  id stable across close/reopen; Esc closes and returns focus;
  Esc with default prevented is ignored; `close()` returns focus,
  including from `<body>`; destroy with focus outside the panel doesn't
  move focus; a kept-mounted closed panel is `inert`; **a leaving panel
  carries `inert` immediately after the closing change detection** (pins
  the source-verified ordering); missing feature throws; duplicate panel
  throws.
- Not tested: the registry directly, the animation itself, browser focus
  fix-up after `inert` (browser behavior, not ours).
- Prior art: the tree toggle directive spec (host components over a real
  `createTable()`), the row-animation directive spec for `animate.leave`
  hosts.

## Out of Scope

- The shared collapsible core itself (#209).
- `withExpansion({ multi })` (#210).
- Focus when a row disappears with focus inside it (#201).
- `hidden="until-found"` / find-in-page for kept-mounted panels (#209).
- Removing the tree toggle's nameless warning (#209).
- A panel placed outside the table host element (e.g. a page-level side
  drawer): the registry is provided by the table host, so such a panel
  cannot reach it. v1 supports panels inside the table host. See
  Further Notes.
- Any shipped CSS; expand-all/collapse-all directives (recipes).
- ADR-0029 #8's default English announcement text.

## Further Notes

- **D3's side-panel rationale is narrower than recorded.** D3 chose a
  `RowId` input partly so story 1.6's side panel could use `ngpTablePanel`.
  A side drawer rendered outside the `<table ngpTable>` element has no
  table host ancestor, so it can reach neither the registry nor the store
  through DI. The `RowId` input still stands (it's what an inline panel
  needs too); supporting an outside panel needs a way to name the table
  and is left open.
- **Duplicate-panel check vs ADR-0014.** The check fires when a row opens,
  not on first render. ADR-0014 dev-gates construction checks and
  records "no carve-out for checks whose ids can arrive at runtime" as an
  accepted risk; this check follows it.
- Build order (D14, refined by #209 D6): this planning PR merges first
  (ADR-0029's amendment must be on `main`); #209 then ships the core; the
  panel-toggle slice builds on it. The panel-content slice is independent
  of #209.
