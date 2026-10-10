# expansion-release — decisions

Grilling of [#200](https://github.com/DvirMon/ng-table/issues/200), `table.expansion.release(ids?)`.
Starting point: E39 (capability log `libs/table/docs/decisions/expansion.md`).

Single node — no sub-feature decomposition needed.

## Decisions

- **D1** (2026-10-10) — `release()` skips ids that are currently open: only closed ids leave `everExpanded`, so `open ⊆ everExpanded` always holds and the `everExpanded().has(id)` gates (OQ-exp-5 fetch recipe, panel directive spec) never unmount an open panel. No-arg `release()` frees every closed panel — collapse-all first is no longer required. Amends E39 ("never touches the open set" stays true; "removes ids" now means closed ids only).
- **D2** (2026-10-10) — Edge defaults: `release([])` is a no-op (only omitted `ids` means "all closed", same as `collapse()`); unknown or already-released ids are ignored, no throw; a call that removes nothing leaves the `everExpanded` `Set` unchanged (no signal write); no options parameter (`ExpansionWriteOptions` governs emission, `release()` never emits); no `index.ts` change — no slice type is exported, `release()` is reachable via `ExpansionMembers['expansion']`, and exporting slices is library-wide, not #200's; no tree counterpart (`withTree()` has no `everExpanded`, E7).
- **D3** (2026-10-10, superseded by D4) — #200 also adds the "free kept panels" button to #190's story 2.3, so `release()` ships with its first on-screen use rather than "shipped, never shown".
- **D4** (2026-10-10) — Supersedes D3. Story 2.3 does not exist yet (#190 open, `needs:grill`), so the dependency flips: #200 ships the state layer + docs only, and #190's story 2.3 is written with the "free kept panels" `release()` button from the start — #190 depends on #200.
- **D5** (2026-10-10) — Failure modes checked and closed: open id (D1), stale/unknown ids and `release([])` (D2), restore via `set()` after a release (re-adds through `onExpanded`, nothing to decide), release during a panel's `animate.leave` (the gate just drops it — consumer markup). `isComplex: false` — one method on an existing slice, no new types.
