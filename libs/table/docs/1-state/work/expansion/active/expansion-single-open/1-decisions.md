# Decisions — expansion-single-open (#210)

Grilled 2026-10-10. Source: [#210](https://github.com/DvirMon/ng-table/issues/210).
Upstream: E54 in [`decisions/expansion.md`](../../../../../decisions/expansion.md); `withRowEdit`'s `multiple` rule.

## Dependency ranking

One node (`multi` on `withExpansion`). No graph needed.

## Decisions

- 2026-10-10 — **D1** A live flip of `multi` to false closes every open row only when more than one is open, and emits `changed` once (`{ added: [], removed: [...all open] }`) only when the open set actually changed. With one or zero rows open the flip emits nothing. `changed` reports a change of the open set, not a user expand action; the setting itself is not an event.
- 2026-10-10 — **D2** A throwing `multi` accessor is a runtime error (it depends on consumer data), so it degrades to `true` (multi-open, the default; hides nothing) and is reported in production too, once per evaluation, via `console.error` per [ADR-0014](../../../../../adr/0014-runtime-error-policy.md). It never propagates out of `toggle()`/`set()` or kills the flip reaction. `withRowEdit`'s `multiple` propagates; that is unguarded by omission, not precedent.
- 2026-10-10 — **D3** In single mode, `initial` with several ids keeps the last and seeds `everExpanded` from that trimmed open set, not from the raw `initial`. A kept-mounted panel mounts only for rows that were ever open; a trimmed seed id never was. Trimming at construction emits nothing on `changed` (unchanged `initial` rule).
- 2026-10-10 — **D4** Derived from the issue and E17/E18/E54, not separately asked: (a) "last" means last in the id order of the resulting write (`set([a,b,c])` keeps `c`; `expand()` with no ids keeps the last row of `rows()`; `toggle(id)` of the open row closes it, leaving none). (b) The trim lives in the shared expansion store's single write funnel, so `toggle`/`expand`/`collapse`/`set`/`initial` need no mode knowledge; the tree builds its own store and has no `multi`. (c) A single trimmed write is one `changed` emission carrying the whole difference (opened + closed), never two. (d) `everExpanded` is additive and is not touched by a displaced or flipped-closed row. (e) The doc updates the change owes (the contract in `1-state/features/expansion.md`, OQ-exp-1 in `0-product/expansion.md`) ship with the implementation; stories showing single-open are out of scope.
- 2026-10-10 — **Failure modes covered:** throwing accessor (D2), live flip with several rows open (D1), `initial` with several ids (D3), bulk `expand()` and `set()` in single mode (D4a), `emitEvent: false` still trims (the trim is state, not an event), `onRowsRemoved` pruning only shrinks and is unaffected.
- 2026-10-10 — **isComplex: false.** One feature file plus one hook on the existing store write funnel; no new public type beyond the `multi` config member.
