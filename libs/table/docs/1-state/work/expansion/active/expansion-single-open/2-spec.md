# Spec — `withExpansion({ multi })` single-open mode (#210)

Source: [#210](https://github.com/DvirMon/ng-table/issues/210). Decisions: [`1-decisions.md`](1-decisions.md) (D1–D4). Capability log: E54, E59–E61 in [`decisions/expansion.md`](../../../../../decisions/expansion.md).

## Problem Statement

A consumer building a side panel or an accordion wants one detail panel open at a time. Today `withExpansion()` is multi-open only. The documented workaround (OQ-exp-1) was to call `set(isOpen ? [] : [id])` instead of `toggle(id)`. That no longer works: the panel toggle directive handles the click and calls `toggle(id)` first, so the recipe becomes a second write after the directive's own write. The consumer sees two `changed` emissions and a flicker, and cannot stop the first write.

## Solution

`withExpansion` takes a `multi` setting. In single mode every write leaves at most one row open, with no caller needing to know the mode. The setting can be a plain boolean or an accessor, and it reacts live. The default stays multi-open, so existing consumers see no change.

## User Stories

1. As a table consumer, I want to configure `withExpansion({ multi: false })`, so that opening a row's panel closes the previously open one.
2. As a table consumer, I want `multi` to default to `true`, so that existing tables keep today's multi-open behavior with no change.
3. As a table consumer, I want to pass `multi` as an accessor such as `() => isWide()`, so that a responsive layout can switch between side-by-side panels and a single panel.
4. As a table consumer, I want a live switch to single mode with several rows open to close all of them, so that the open set is immediately valid and no arbitrary survivor is picked.
5. As a table consumer, I want a live switch with zero or one row open to change nothing and emit nothing, so that resizing a window does not fire spurious events.
6. As a table consumer, I want `toggle(id)` on a closed row in single mode to open it and close the previously open row, so that a panel toggle needs no extra code.
7. As a table consumer, I want `toggle(id)` on the open row to close it and leave none open, so that clicking an open panel's toggle closes it.
8. As a table consumer, I want `expand([a, b, c])` in single mode to keep only the last id, so that bulk calls cannot break the one-open rule.
9. As a table consumer, I want `expand()` with no ids in single mode to keep only the last row of `rows()`, so that "expand all" is still safe in single mode.
10. As a table consumer, I want `set([a, b, c])` in single mode to keep only the last id, so that restoring a saved open set cannot break the rule.
11. As a table consumer, I want `collapse` and `collapse(ids)` to behave as before in single mode, so that closing is never surprising.
12. As a table consumer, I want one `changed` emission per write carrying both the opened and the closed row, so that my listener updates once, not twice.
13. As a table consumer, I want `initial` with several ids in single mode to keep the last, so that a saved multi-open state restores into a valid single-open state.
14. As a table consumer, I want `everExpanded` seeded from the trimmed `initial`, so that a kept-mounted panel does not mount for a row that was never open.
15. As a table consumer, I want construction-time trimming to emit nothing on `changed`, so that `initial` keeps its existing "silent seed" rule.
16. As a table consumer, I want a displaced or flip-closed row to stay in `everExpanded`, so that a kept-mounted panel keeps its DOM.
17. As a table consumer, I want `emitEvent: false` to still apply the single-open trim, so that suppressing events never leaves two rows open.
18. As a table consumer, I want a throwing `multi` accessor to degrade to multi-open and be reported with `console.error`, so that one bad callback does not break a write or hide rows.
19. As a table consumer, I want that report once per evaluation, in production too, so that I can find a failure I cannot reproduce locally.
20. As a table consumer, I want removing rows from the data to keep pruning the open set as before, so that single mode adds no new data-removal behavior.
21. As a table consumer, I want the panel toggle directive to need no mode knowledge, so that the same directive works in single and multi mode.
22. As a library maintainer, I want the tree feature to be unaffected, so that single-open stays a panel-only setting.
23. As a docs reader, I want the expansion contract to document `multi`, so that I find the setting where I look up `initial`.

## Implementation Decisions

- **Config member.** `WithExpansionConfig` gains `multi?: boolean | (() => boolean)`, default `true`. No new public type beyond this member. The name is `multi` (as in `withSorting`), not `multiple` (as in `withRowEdit`); renaming either is out of scope.
- **One write funnel.** The expansion store has a single writer for the open set; every verb (`toggle`, `expand`, `collapse`, `set`, `initial`) goes through it. The single-open trim lives in that funnel, so no verb needs mode knowledge. The tree builds its own store without this option and is unaffected.
- **"Last" definition.** "Last" is the last id in the order of the resulting write: `set([a, b, c])` keeps `c`; `expand()` with no ids keeps the last row of `rows()`; `toggle(id)` of the open row closes it and leaves none. This is the same rule as `withRowEdit`'s `closeAllButLast`.
- **Trim runs before the diff.** The funnel computes the trimmed set first and then the added/removed difference. One write is therefore one `changed` emission carrying opened and closed ids together, never two.
- **`emitEvent: false`.** The trim is state, not an event, so it still applies when events are suppressed.
- **Live flip.** The feature reacts to `multi` becoming false. If more than one row is open it closes all of them (no survivor — a mode flip is nobody's request for a specific row), emitting `changed` once with `{ added: [], removed: [all open] }`. With one or zero rows open it does nothing and emits nothing. `changed` reports a change of the open set, not the setting.
- **Accessor reactivity.** An accessor is evaluated reactively, so a signal-backed accessor re-runs the flip check when it changes. A plain boolean is fixed.
- **Throwing accessor (D2).** A throwing `multi` accessor is a runtime error that depends on consumer data. It degrades to `true` (multi-open, which hides nothing) and is reported through `console.error` in production too, once per evaluation, per ADR-0014. It never propagates out of a write or kills the flip reaction. `withRowEdit`'s propagating `multiple` is unguarded by omission and is not precedent.
- **`initial` (D3).** In single mode, `initial` with several ids keeps the last. `everExpanded` is seeded from the trimmed open set, not the raw list. Trimming at construction emits nothing.
- **`everExpanded`.** Stays additive and is untouched by a displaced or flipped-closed row. Its existing hook (ids newly added by a write) is unchanged.
- **Pruning.** `onRowsRemoved` pruning only shrinks the set and is unaffected.
- **Docs owed with the change.** The expansion contract gains the `multi` member and its rules. OQ-exp-1 in the product doc is marked reversed (E54) and the recipe is removed. The capability log rows E54, E59–E61 already exist.

## Testing Decisions

- **One seam.** The existing `withExpansion` feature spec, driven through `createTable(data, config, withExpansion({...}))` and the public `expansion` slice. No new seam and no spec on the store directly (the store has none by design; it is exercised through the feature spec).
- **What a good test asserts.** Only observable behavior: the open set read from `expansion()`, the `changed` emissions collected from a subscriber, `everExpanded()`, and `console.error` calls. Never the internal funnel or how the trim is computed.
- **Cases.** Default stays multi-open. Single mode: `toggle` displacing, `toggle` closing the open row, `expand(ids)`, `expand()` with no ids, `set(ids)`, `collapse` unchanged. One `changed` emission carrying opened + closed for a displacing write. `emitEvent: false` still trims and emits nothing. `initial` with several ids: last kept, `everExpanded` seeded from the trimmed set, no emission. Live flip with several rows open: all closed, one emission. Live flip with one or zero open: no emission. Accessor driven by a signal flips live. Throwing accessor: write succeeds in multi-open, `console.error` called once per evaluation, no throw out of `toggle`/`set`. Data removal pruning unchanged. Displaced row stays in `everExpanded`.
- **Prior art.** The existing `with-expansion.spec.ts` write-verb and `changed` cases, and the `multiple` cases in the row-edit feature spec for the live-flip shape.
- **Types.** No new type surface beyond one optional config member; the existing composed-members type test is sufficient.

## Out of Scope

- The panel toggle directive and any directive change (#199's toggle just calls `toggle(id)`).
- Renaming `withRowEdit`'s `multiple` or `withSorting`'s `multi` to one name.
- Stories showing single-open.
- A `multi` option on the tree feature.
- Any change to the library-wide runtime-error policy (ADR-0014); this spec only applies it.

## Further Notes

- Difficulty is low: one feature file plus one option on the existing store write funnel, with every edit enumerated above. The one trap is ordering — the trim must run before the added/removed diff is computed, or a displacing write emits twice or `onExpanded` seeds `everExpanded` with a row that was never kept.
