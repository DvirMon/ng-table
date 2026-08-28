---
title: Decisions — Optimistic CRUD (delete rollback)
type: decisions
status: implemented 2026-08-27
date: 2026-08-27
---

# Decisions — Optimistic CRUD

Episodic work folder closing G5's delete half — a failed delete previously lost the row with no
recovery. Continues the numbering of
[`work/with-optimistic/2-decisions.md`](../with-optimistic/2-decisions.md) (D-numbers and
O-numbers are global across the `with-row-editing`/`with-optimistic`/`with-mutations` folders).
Last allocated before this file: **D44**.

> **Implemented and closed.** The design brief this folder started from (`1-handoff.md`) was
> deleted once the work landed — every decision it proposed is recorded below, at what actually
> shipped rather than what was proposed. The remaining downstream doc and story updates are listed
> at the end of this file.

**This file is the reasoning, not the contract.** The shipped surface is specced in
[`features/row-editing.md`](../../features/row-editing.md); the gap register is
[`with-row-editing/5-gaps.md`](../with-row-editing/5-gaps.md).

## What started this

The product pass over row editing
([`docs/0-product/row-editing.md`](../../../0-product/row-editing.md)) found the worst failure
mode in the table: a failed delete loses the row, permanently, with no recovery anywhere in the
stack. G5 / [#54](https://github.com/DvirMon/acme/issues/54) deferred this on the grounds that a
restore point holds a *value*, never an index, so `revertEdit` cannot re-insert. That premise
turned out to be narrower than it looked — closing delete specifically needed only a position on
the snapshot, not the full inverse-operation representation O22 originally called for.

## D45 — the restore point carries its position (2026-08-27)

**Decision:** `RowSnapshot<TRow>` becomes `RowRestorePoint<TRow> { row: TRow; at: number;
detached: boolean }`.

- `at` — index in `data` at capture time. Read **only** when the row is missing at revert; a row
  still present is replaced in place, since a sort or another write may have moved it since
  capture.
- `detached` — true when the restore point was captured by a verb that then removed the row, so
  ADR-0006's reconciliation must not prune it as an orphan.

**This is the half of O22 the original decision log called unrepresentable.** It is
representable; what O22 actually rejected was a *general* inverse-operation model covering
arbitrary operations. A position on the snapshot covers delete specifically without one. Move
(`moveRow`) is still uncovered — see "Carried forward" below.

**Consequence for ADR-0006:** the pruning predicate changes from `(value) => value === ABSENT` to
`(value) => value.detached`.

## D46 — `revertEdit` restores only; `ABSENT` is removed (2026-08-27, breaking)

**Decision:** `revertEdit` drops its `ABSENT`-removal branch, replacing it with "replace in place
if present, re-insert at `at` if absent" — restore-vs-reinsert is one intent ("go back to the
restore point") over two states of the world, not two responsibilities. Removal becomes its own
verb, `discardEdit(id)`: no-ops if no restore point is held (OQ-C, resolved below), otherwise
drops the restore point and removes the row. It replaces the `removeRow` + `endEdit` +
`releaseEdit` three-call sequence the docs previously prescribed.

**`ABSENT` is deleted, straight removal (OQ-B, resolved below).** Its only reader was
`revertEdit`'s removal branch. Post-`{ insert }` (D42) it could only arise from `beginEdit` on an
id not in `data` (misuse — `{ insert }` is the supported path) or `captureEdit` re-reading a
since-removed row. Both become *capture no snapshot* — `state.snapshots` is left untouched rather
than written with a sentinel.

**This partially reverses D28.** D28 derived add-cancel from edit-cancel through `ABSENT` so one
verb covered both; that property is gone, and a Cancel handler now branches on whether the row was
new (composed by the call site, not the library). Acceptable because D36/D42 already walked most
of it back (an inserted row's snapshot is the row itself, not `ABSENT`, so `revertEdit` already
*resets* rather than removes an added row), and "was this row here before I clicked?" is a fact
the call site knows for free.

**`ABSENT`, `RowSnapshot`, `SnapshotMap` were public exports.** Removing `ABSENT` is a breaking
change to the public surface.

## D47 — capture-composing verbs: `removeEdit`, `patchEdit` (2026-08-27)

**Decision:** two new `withOptimistic` verbs, so rollback around a write with no natural capture
trigger is never two calls:

```ts
removeEdit<TRow>(id: RowId): EditingUpdater<TRow>;
patchEdit<TRow>(id: RowId, partial: Partial<TRow>, options?: PatchEditOptions): EditingUpdater<TRow>;
```

**The requirement that drove this:** a consumer must not have to remember a separate
`captureEdit`. The writes most likely to need rollback — a row action, a delete, a background
patch — are exactly the ones with no natural capture trigger (a form-driven edit has focus, or
`beginEdit`; an updater call has none). Leaving capture manual means the cases that most need a
restore point are the ones most likely to silently lack one.

**`removeEdit`:** captures a restore point if none is held, then removes the row and closes it —
one call, no prior `beginEdit`/`captureEdit`. `revertEdit(id)` alone undoes it.

**Correctness detail found during implementation, not in the original brief:** when a restore
point is *already* held (the row was open, or previously captured) at the moment `removeEdit`
fires, that existing snapshot's `detached` flag is `false` — it was captured while the row was
still present. `removeEdit` must flip it to `true` (keeping the original `row`/`at`), not leave it
alone: otherwise D45's pruning exemption doesn't apply to it, and the very next ADR-0006
reconciliation prunes the snapshot the delete was supposed to protect — silently discarding the
rollback D47 exists to guarantee. Implemented as `{ ...held, detached: true }`.

**`patchEdit`:** captures per `{ capture: 'if-absent' | 'always' }` (default `'if-absent'`), then
patches the row in place — for a write no form made.

**Why not a flag on `removeRow`/`patchRow`.** Structural, not policy: a `RowUpdater` (`(rows,
{ trackBy }) => TRow[]`) has no handle on editing state, so a `{ capture: true }` flag would have
nothing to act on; an `EditingUpdater` has `writeData` and can touch both. `beginEdit(id,
{ insert })` is the existing precedent — D42 landed it for the same reason on the add side.

## D48 — O(1) id lookups via `indexById` (2026-08-27, independent)

**Decision:** widen `RowUpdaterContext` and `EditingUpdaterContext` with
`indexById: ReadonlyMap<RowId, number>` (the engine already computed this for ADR-0006, at
`core.indexById`, but neither context carried it). Add `resolveIndex(rows, id, { trackBy,
indexById })`: an O(1) hit via the map, guarded by one `trackBy` call, falling back to a linear
`findIndex` scan when the map entry is stale (returns `-1` if genuinely absent — "always
correct"). `removeRow`, `patchRow`, `removeEdit`, `patchEdit`, `revertEdit`, `beginEdit`,
`captureEdit`, and `findRow` all resolve through it.

**Honest about the gain:** complexity stays O(n) — the array is still rebuilt immutably per
write. What disappears is **N `trackBy` invocations per write, down to one** (the guard call).
`trackBy` is a user function call per row, so it dominates a patch on a large table; that's the
only avoidable part.

**A consumer-supplied `at` was considered and rejected.** `RenderRow.sourceIndex` makes it
tempting, but a consumer index is captured at render time; the guard cannot catch a stale one that
now points at a *different* existing row — the table would delete the wrong row silently. The
internal `indexById` is derived from the same `data()` the updater writes, so it is correct by
construction.

**The stale-map case is real, not theoretical — `beginEdit`'s `{ insert }` branch hits it.** After
`writeData(addRow(...))` inserts a row, `indexById` (read before the write) is stale for the rest
of that same updater call. `resolveIndex`'s linear-scan fallback is what makes resolving the
inserted row's real index correct anyway — this is the case the fallback exists for, not an edge
case bolted on afterward.

## Open questions resolved (2026-08-27)

- **OQ-A — does a reinserted row come back open or closed?** **Closed.** The user's last action
  was Delete, not Edit; nothing in a gated flow deletes from inside an open row today.
  `revertEdit`'s existing unconditional `open: withoutOpen(...)` already produces this with no
  extra code.
- **OQ-B — `ABSENT` removal: major bump or deprecation window?** **Straight removal**, per D46 —
  no consumer outside this repo had adopted the library.
- **OQ-C — does `discardEdit` fall back to a plain remove when no restore point is held?** **No —
  stays a no-op**, matching the house rule that every updater no-ops on a miss. Plain `removeRow`
  covers the no-restore-point delete case.
- **OQ-D — does `patchEdit` capture on every call, or capture-if-absent?** **Capture-if-absent by
  default** (matches D31.1 — oldest restore point wins), with `{ capture: 'always' }` available
  for a consumer that wants each call to move the restore point forward, the way `captureEdit`
  does.

## D48 — `restored` signal dropped, scroll/flash stays consumer-space

Product OQ-2 asked for a table-owned `Signal<ReadonlySet<RowId>>` naming rows that just
reappeared via `revertEdit`'s reinsert branch, for a future generic scroll/flash directive.

**Dropped.** Grilled 2026-08-27: the fact only the state layer can produce (reinsert vs.
replace-in-place, vs. an ordinary externally-added row) is real and not derivable by a consumer
today — `revertEdit` clears the snapshot in the same call that reinserts, so by the time any
public signal is readable the distinguishing fact is already gone, and a custom
`createTableFeature()` has no visibility into it either (`snapshots`/`open`/`detached` are
internal to `editing-state.ts`, never exported). So the signal was buildable and would have been
consumer-unbuildable on its own — but the consumer decided the value isn't worth the API surface:
scroll/flash is deferred to the consumer's own `error:` callback (which already has `id`), guarded
with `afterNextRender`/an effect for the one real wrinkle — `revertEdit`'s `writeData` is
synchronous but Angular's DOM update is not, so a same-tick DOM lookup can race the reinsert.

No code changes from this decision. `RowRestorePoint`/`revertEdit`'s reinsert branch (D45–D47)
are unaffected — only the *observability* of "this specific write was a reinsert" was declined as
new public API.

## Carried forward — not closed by this effort

**Move.** A `RowRestorePoint` fixes a row's position *at capture time*; nothing here adds a verb
that reorders rows or represents undoing a reorder. That still needs the inverse-operation
representation O22 originally called for. G5 narrows from "delete and move" to "move only."

**Bulk/batch arity** (D32) and the undo *affordance* (§3.2 of the product doc — where Undo lives,
keyboard binding, the sorted-case scroll-and-flash) are explicitly out of scope: the state layer's
job was making undo *possible*, which `pending()` plus `removeEdit`/`revertEdit` now do.

## Downstream doc updates this effort owes

| Doc | Change |
|---|---|
| `features/row-editing.md` | v2.1 — new/changed verb tables, `RowRestorePoint` type box, delete-rollback flow, `ABSENT` removal noted as breaking |
| `work/with-row-editing/5-gaps.md` | G5 narrowed to move-only; O22 delete half closed |
| ~~`docs/0-product/row-editing.md`~~ | **Do not edit — owned by the product pass, already updated there 2026-08-27.** §3.1/§3.2, D-2 and OQ-5 already reflect delete rollback being unblocked. Editing it from this effort would clobber the OQ-1…OQ-7 resolutions recorded in the same file. |

### Added 2026-08-27 by the product pass — two corrections in `features/row-editing.md`

Both are in that file, neither is caused by this effort, and both currently mislead a reader. Landed
here rather than done directly because this effort is the one holding that file open.

**1. §9's "one-tick saving flicker" is not real.** It claims a local-only save (`endEdit` +
`releaseEdit`) shows a `pending` flash on a table with no server. Both writes are synchronous in one
block, so signals never render the intermediate state and no frame shows it. Only reachable if
something `await`s between the two calls, which a local save has no reason to do. Correct the
sentence or drop the bullet — as written it invites consumers to build a spinner-delay threshold
against a problem they do not have.

**2. §5's "known sharp edge, left to the consumer" understates what the library offers.** It says a
rejected save firing `revertEdit` on a row the user has re-entered cannot be resolved by the
library. True as to *policy*, but the consumer can guard it with state already exposed:

```ts
onFocus(id) {
  if (!this.table.pending().has(id)) {          // an in-flight save still holds the restore point
    this.table.editing.update(captureEdit(id));
  }
}
```

`pending()` is exactly "holds a restore point and is not open," which on a live table is the
in-flight set. Gated mode never had the problem — re-opening goes through `beginEdit`, which is
capture-if-absent. Add the guard to §5's live-optimistic snippet, and note that `captureEdit`'s
always-overwrite semantics (D40) are why the guard is needed.

## Story updates this effort owes

| Story | Change |
|---|---|
| `gated-edit/` | `discardEdit()` handler collapses from 3 calls to the single new `discardEdit(id)` verb |
| `live-optimistic/` | new Delete affordance — `removeEdit`/`releaseEdit`/`revertEdit` against a simulated DELETE request, the first story to demonstrate delete rollback |
| `live-optimistic/` | **also** — `onEnterRow` currently calls `captureEdit` unguarded, so the story ships the hazard described in correction 2 above. Add the `pending()` guard; it is one `if`, and this story is the reference consumers copy. |
