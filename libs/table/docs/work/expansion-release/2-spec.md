# expansion-release — spec

Source: [#200](https://github.com/DvirMon/ng-table/issues/200) ·
decisions: [`1-decisions.md`](1-decisions.md) · capability log:
[`decisions/expansion.md`](../../decisions/expansion.md) (E39, E40, E59, E60)

## Problem Statement

A developer who keeps a detail panel mounted after it closes — the
per-row keep-mounted opt-in, gated on
`expansion().has(id) || (keepMounted(row) && everExpanded().has(id))`
(E40) — has no way to free that panel later.

`everExpanded` only grows. Every id ever opened stays in it for the
table's whole life, and removing a row from the data deliberately does
not prune it (ADR-0006 exemption). A panel holding heavy content — a
chart, an editor, a fetched sub-table — stays in the DOM forever once
it has been opened once. The only way out today is rebuilding the
table.

## Solution

A new method on the panel slice: `table.expansion.release(ids?)`.

- It removes **closed** ids from `everExpanded`. The consumer's own
  gate then drops the panel, so a kept panel unmounts.
- An id that is **open** right now is skipped. An open panel never
  disappears under the person using it.
- With no ids, it frees every closed panel at once. The consumer does
  not need to collapse everything first.
- Nothing opens or closes, so `changed` does not fire.

## User Stories

1. As a developer keeping detail panels mounted, I want to free a
   closed panel's markup on demand, so that heavy panel content does
   not stay in the DOM forever.
2. As a developer, I want `release()` with no arguments to free every
   closed panel, so that a "free kept panels" action is one call.
3. As a developer, I want `release([id])` to free just that row's
   kept panel, so that I can unmount one panel without touching the
   others.
4. As a developer, I want `release()` to skip ids that are currently
   open, so that I can never unmount a panel the person is reading.
5. As a developer, I want "free everything closed" to work without
   calling `collapse()` first, so that releasing never closes the
   panels that are still open.
6. As a developer, I want `release()` to leave the open set untouched,
   so that `expansion()` reads the same before and after the call.
7. As a developer listening to `table.expansion.changed`, I want
   `release()` to emit nothing, so that my listener only hears about
   panels opening and closing.
8. As a developer, I want `release([])` to do nothing, so that an
   empty selection never frees every panel by accident — only an
   omitted argument means "all", the same as `collapse()`.
9. As a developer, I want ids that are unknown or already released to
   be ignored without an error, so that I can call `release()` from
   stale lists safely.
10. As a developer gating templates and `computed()`s on
    `everExpanded()`, I want a call that removes nothing to leave the
    signal unchanged, so that nothing downstream re-runs for no reason.
11. As a developer, I want a released row that is opened again to
    re-enter `everExpanded`, so that keep-mounted works again for it
    after the next close.
12. As a developer restoring state through `set()`, I want restored
    open ids to re-enter `everExpanded` as they do today, so that a
    release followed by a restore needs no special handling.
13. As a developer, I want removing a row from the data to keep not
    pruning `everExpanded`, so that `release()` stays the one explicit
    way to shrink it and nothing else changes behind my back.
14. As a developer, I want `release()` reachable on `table.expansion`
    like every other expansion verb, so that I find it next to
    `collapse()` and `set()`.
15. As a developer animating panels out, I want a release during a
    panel's leave animation to simply let my gate drop it, so that I
    need no extra coordination with the library.
16. As a developer reading the expansion docs, I want the feature
    spec to describe `release()` as shipped, with the open-id skip,
    so that the docs match the code.
17. As a maintainer, I want ADR-0006 to record that `everExpanded`
    has exactly one explicit remover, so that the "additive ledger"
    wording does not mislead the next reader.

## Implementation Decisions

- **Module modified: the `withExpansion()` panel feature only.** The
  shared expansion store (`createExpansionStore()`) is unchanged —
  `everExpanded` is panel-only (E7) and is owned by the feature, so
  `release()` is a feature-level write to that feature-owned signal.
- **Signature:** `release(ids?: readonly RowId[]): void`, a new
  member of `ExpansionSlice`. No options parameter —
  `ExpansionWriteOptions` governs emission, and `release()` never
  emits (D2).
- **Semantics (D1):** the candidates are `ids`, or every id in
  `everExpanded` when `ids` is omitted. A candidate is removed only if
  it is not in the open set. This keeps `open ⊆ everExpanded` true at
  all times, so any `everExpanded().has(id)` gate (the fetch recipe
  from OQ-exp-5, the panel directive) never unmounts an open panel.
  Amends E39: "never touches the open set" stays true; "removes ids"
  now means closed ids only (E59).
- **Edge defaults (D2):**
  - `release([])` is a no-op. Only an omitted argument means "all
    closed" — the same rule `collapse()` follows.
  - Unknown or already-released ids are ignored. No throw: a stale id
    list is ordinary runtime data, not a wiring error (ADR-0014).
  - A call that removes nothing leaves the `everExpanded` `Set`
    reference unchanged — no signal write.
  - A call that removes something writes a new `Set`, the same
    copy-on-write shape the `onExpanded` accumulator uses.
- **No emission.** `changed` does not fire, regardless of what was
  removed — nothing opened or closed.
- **Interactions that need no new mechanism (D5):**
  - Re-opening a released id re-adds it through the existing
    `onExpanded` hook.
  - `set()` restore re-adds restored-open ids the same way.
  - Row removal still does not prune `everExpanded`; the ADR-0006
    exemption stands, with `release()` as its one explicit remover.
  - A release during a panel's `animate.leave` just lets the gate drop
    it — consumer markup.
- **Public surface:** no `index.ts` change (D2). No slice type is
  exported today; `release()` is reachable through
  `ExpansionMembers['expansion']`. Exporting slice types is
  library-wide work, not #200's.
- **No tree counterpart.** `withTree()` has no `everExpanded` (E7).
- **Docs edited with the code:**
  - The expansion feature spec (state layer): `release()` moves from
    "specced, not shipped" to shipped; its description changes from
    "omitted ids clears it" to the D1 rule (closed ids only, open ids
    skipped); the "Pending (#200)" note goes; `code:` frontmatter
    stays `shipped`.
  - ADR-0006: amend the `everExpanded` exemption — "an additive ledger
    by design" now has one explicit, consumer-called remover that
    skips open ids. Row removal still never prunes it.
  - Capability log: E39's status becomes shipped (#200) at ship time.
    E59/E60 already record this ticket's decisions.
  - Any other doc that still describes `release()` as clearing
    everything, or as pending, is corrected in the same change.
- **#190 ordering (D4, E60):** #190's story 2.3 is written with a
  "free kept panels" `release()` button from the start. #190 depends
  on #200. This ticket adds no story.

## Testing Decisions

- **One seam: the existing `withExpansion()` spec**, driving
  `table.expansion` through `createTable(…, withExpansion())`. No new
  seam. The shared store keeps no spec of its own. No directive test —
  unmounting is the consumer's gate, not library behavior.
- **What a good test asserts:** only what a consumer can observe —
  `everExpanded()`, `expansion()`, emissions on `changed`, and the
  `everExpanded()` reference identity for a call that removes nothing.
  Never the closure internals.
- **Cases:**
  - `release([id])` on a closed id removes it from `everExpanded`.
  - `release([id])` on an open id leaves it in `everExpanded`.
  - `release()` with mixed open and closed ids removes only the
    closed ones; the open set is unchanged.
  - `release()` and `release([id])` emit nothing on `changed`.
  - `release([])` leaves `everExpanded` as the same reference.
  - Unknown and already-released ids: no throw, same reference.
  - A released id that is opened again is back in `everExpanded`.
  - A type-level assertion that `ExpansionSlice` carries
    `release(ids?: readonly RowId[]): void`, beside the spec's
    existing `expectTypeOf` checks.
- **Prior art:** the existing `everExpanded` cases in the
  `withExpansion()` spec (accumulates on open, survives collapse,
  seeded by `initial`), and its `changed` emission cases.

## Out of Scope

- The "free kept panels" button in #190's story 2.3 — #190 owns it.
- Pruning `everExpanded` on row removal — the ADR-0006 exemption
  stands.
- An options parameter on `release()`.
- Exporting `ExpansionSlice` or any other slice type from `index.ts`.
- A tree counterpart.
- Any directive change — `ngpTablePanel` and the panel toggle are
  untouched.
- Closing open panels as part of a release.

## Further Notes

- Difficulty: low. One method on an existing slice, a few lines over
  a feature-owned signal, no new types, behavior fully settled (D1-D5).
  The one trap is D1 — skipping open ids, including on the no-arg path.
- Rationale for every decision above: [`1-decisions.md`](1-decisions.md).
