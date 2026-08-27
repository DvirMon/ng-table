---
title: Handoff — Optimistic CRUD (delete rollback, single-responsibility revert, O(1) lookups)
type: plan
status: open — design agreed in discussion 2026-08-27, not implemented, open questions remain
date: 2026-08-27
parent: ../../features/row-editing.md
---

# Handoff — optimistic CRUD

Self-contained brief for an agent picking this up cold. Everything needed is here or linked; no
prior conversation required.

## Why this exists

The product pass over row editing
([`docs/0-product/row-editing.md`](../../../0-product/row-editing.md)) found that **a failed delete
loses the row**, with no recovery anywhere in the stack. That is the worst failure mode in the
table. The state layer's own register says so too — G5 /
[#54](https://github.com/DvirMon/acme/issues/54) — and defers it as O22, on the grounds that a
restore point holds a *value*, never an index, so `revertEdit` cannot re-insert.

The discussion below established that closing it is smaller than O22 assumed, and settled four
coupled changes. **They are coupled: doing 3 without 4 produces a feature that silently no-ops.**

Read first: [`features/row-editing.md`](../../features/row-editing.md) §2–§5,
[`with-optimistic/2-decisions.md`](../with-optimistic/2-decisions.md) (D37–D44),
[`with-row-editing/2-decisions.md`](../with-row-editing/2-decisions.md) D28/D36/D42.

---

## Change 1 — the restore point carries its position

`api/features/editing-state.ts`

```ts
export interface RowRestorePoint<TRow> {
  readonly row: TRow;
  /** Index in `data` at capture time. Read **only** when the row is missing at revert — a row
   * still present is replaced in place, since a sort or another write may have moved it. */
  readonly at: number;
  /** Captured by a verb that then removed the row, so ADR-0006 pruning must not drop it. */
  readonly detached: boolean;
}

export type RowSnapshot<TRow> = RowRestorePoint<TRow>;   // ABSENT gone — see Change 2
```

This is the half of **O22** the decision log called unrepresentable. It is representable; what O22
actually rejected was a *general* inverse-operation model. A position on the snapshot covers delete
without one. Move (`moveRow`) is still uncovered and stays out of scope here.

Every construction site becomes `{ row, at, detached }`: `beginEdit` (both branches),
`captureEdit`, and `revertEdit`'s `row?` override — the override supplies the **value only** and
must keep the held snapshot's `at`.

## Change 2 — `revertEdit` restores, and nothing else

`api/optimistic-mutations.ts`

`revertEdit` currently does three things chosen by a branch on `ABSENT`: replace in place, or
remove the row. Removal moves out to its own verb.

```ts
export function revertEdit<TRow>(id: RowId, row?: TRow): EditingUpdater<TRow> {
  return (state, { data, trackBy, writeData }) => {
    const snapshot = state.snapshots.get(id);
    if (snapshot === undefined) return state;

    const value = row ?? snapshot.row;
    writeData(
      findRow(data, trackBy, id) !== undefined
        ? data.map((r) => (trackBy(r) === id ? value : r))          // still there — replace
        : addRow(value, { at: snapshot.at })(data, { trackBy }),    // gone — put it back
    );

    return {
      snapshots: withoutSnapshot(state.snapshots, id),
      open: withoutOpen(state.open, id),
    };
  };
}

/** Drops the restore point and removes the row — the discard path. Counterpart to `revertEdit`,
 * not a mode of it. Replaces the three-call `removeRow` + `endEdit` + `releaseEdit` sequence the
 * docs currently prescribe. */
export function discardEdit<TRow>(id: RowId): EditingUpdater<TRow> {
  return (state, { data, trackBy, writeData }) => {
    if (!state.snapshots.has(id)) return state;
    writeData(data.filter((r) => trackBy(r) !== id));
    return {
      snapshots: withoutSnapshot(state.snapshots, id),
      open: withoutOpen(state.open, id),
    };
  };
}
```

Replace-vs-reinsert is **not** two responsibilities — it is one intent ("restore this row") over
two states of the world. Removal is the different intent.

### `ABSENT` is deleted

Its only reader was `revertEdit`'s removal branch. Post-D42 it can only arise from `beginEdit` on
an id not in `data` (misuse — `{ insert }` is the supported path) or `captureEdit` re-reading a
since-removed row (where capturing nothing is more honest than capturing a tombstone). Both become
*capture no snapshot*.

**This partially reverses D28.** D28 derived add-cancel from edit-cancel through `ABSENT` so one
verb covered both; that property is gone and a Cancel handler now branches on whether the row was
new. Two reasons it is acceptable, and the reviewer should check both: D36/D42 already walked most
of it back (an inserted row's snapshot is the row itself, not `ABSENT`, so `revertEdit` already
*resets* rather than removes), and "was this row here before I clicked?" is a fact the call site
knows for free — it just called `beginEdit({ insert })`.

**`ABSENT` and `SnapshotMap`/`RowSnapshot` are public exports** (`index.ts:19–26`). Removing
`ABSENT` is a breaking change to the public surface. Decide whether this ships as a major or with a
deprecation window — see OQ-B.

## Change 3 — capture-composing verbs, so rollback is never two calls

`api/optimistic-mutations.ts` (they belong to `withOptimistic`, not `withRowEdit` — no `open`
involvement)

The requirement that drove this: **a consumer must not have to remember a separate
`captureEdit`.** The writes most likely to need rollback — a row action, a delete, a background
patch — are exactly the ones with no natural capture trigger. A form-driven edit has one (focus, or
`beginEdit`); an updater call has none. Leaving capture manual means the cases that most need a
restore point are the ones most likely to silently lack one.

```ts
/** Captures row + index if none is held, then removes the row — one write. Needs no prior
 * `beginEdit`/`captureEdit`. Capture-if-absent (D31.1), so removing an already-open row keeps its
 * true pre-edit restore point. `revertEdit(id)` puts it back at `at`. */
export function removeEdit<TRow>(id: RowId): EditingUpdater<TRow>;

/** Same shape for a write no form made — a row action, a background patch. */
export function patchEdit<TRow>(id: RowId, partial: Partial<TRow>): EditingUpdater<TRow>;
```

Both: resolve the index, no-op if the id is absent, `writeData` the row change, return state with
the snapshot added (if none held). `removeEdit` also drops the id from `open` — a removed row shows
no inputs.

**Why not a flag on `removeRow`/`patchRow`.** Structural, not policy:

```ts
type RowUpdater<TRow>     = (rows, { trackBy })                   => TRow[];
type EditingUpdater<TRow> = (state, { data, trackBy, writeData }) => EditingState<TRow>;
```

Composition is one-way. A `RowUpdater` has no handle on editing state, so a `{ capture: true }`
flag would have nothing to act on; an `EditingUpdater` has `writeData` and can do both. `beginEdit(id,
{ insert })` is the existing precedent — D42 landed it for exactly this reason on the add side.
`table.value` must keep working on tables composing no editing feature, so it cannot gain access.

`removeRow`/`patchRow` stay untouched as pure `RowUpdater`s for the non-optimistic path.

## Change 4 — ADR-0006 pruning must exempt detached snapshots

`api/features/editing-state.ts`, `createEditingStore().onRowsRemoved`

**Without this, Change 3 silently does nothing.** `removeEdit` takes the row out of `data`, which
fires the `onRowsRemoved` reconciliation, which prunes the snapshot it just captured. Rollback gone,
no error.

```ts
const nextSnapshots = pruneByIds(
  current.snapshots,
  ids,
  (value) => value.detached,     // was: (value) => value === ABSENT
);
```

`detached` distinguishes "we removed this deliberately and hold its restore point" from "it vanished
externally, nothing left to restore."

**Ordering checked — it is safe, but pin it with a test.** The reconciliation is an Angular
`effect()` (`engine/compose-table.ts:122`), so it flushes *after* the current synchronous execution.
Inside one updater, `writeData` runs, then the store applies the returned state (with
`detached: true`) synchronously — so by the time the effect diffs `indexById`, the exemption is
already in `snapshots`. The dependency is real but currently satisfied; a test is what keeps it that
way if the effect ever becomes synchronous.

## Change 5 — O(1) id lookups (independent; land separately if convenient)

The engine already computes what every id-based updater re-derives by hand:
`core.indexById: Signal<ReadonlyMap<RowId, number>>` (`engine/core.ts:52`), built over `data()` for
`sourceIndex` (D23). Neither updater context carries it.

Widen both contexts (`engine/core.ts` `createWritableView` call sites, `api/types.ts`
`RowUpdaterContext`, `features/editing-state.ts` `EditingUpdaterContext`), then:

```ts
function resolveIndex<TRow>(rows: TRow[], id: RowId, { trackBy, indexById }): number {
  const at = indexById.get(id);
  if (at !== undefined && trackBy(rows[at]) === id) return at;   // O(1) hit
  return rows.findIndex((row) => trackBy(row) === id);            // fallback, always correct
}
```

The guard is one `trackBy` call and removes every staleness question — including a chained
`writeData` inside a single updater, which is the case that would otherwise bite. `removeRow`,
`patchRow`, `removeEdit`, `patchEdit`, `revertEdit`, `beginEdit`, `captureEdit` all use it; `findRow`
should be reimplemented over it so there is one lookup path.

**Be honest in the commit message about the gain.** Complexity stays O(n) — the array is rebuilt
immutably either way. What disappears is **N `trackBy` invocations per write, down to one**.
`trackBy` is a user function call per row, so it dominates a patch on a large table, and it is the
only avoidable part.

**A consumer-supplied `at` was considered and rejected.** `RenderRow.sourceIndex` makes it tempting,
but a consumer index is captured at render time; where the guard cannot catch a stale one (it now
points at a different row that exists) the table deletes the wrong row silently. The internal map is
derived from the same `data()` the updater writes, so it is correct by construction.

---

## Consumer-facing result

```ts
// delete with rollback — was impossible, then three calls; now one
this.table.editing.update(removeEdit(id));
this.service.delete(id).subscribe({
  next:  () => this.table.editing.update(releaseEdit(id)),
  error: () => this.table.editing.update(revertEdit(id)),
});

// row action, no form involved
this.table.editing.update(patchEdit(id, { status: 'done' }));

// undo a delete — just never release
this.table.editing.update(removeEdit(id));       // restore point kept
// later:
this.table.editing.update(revertEdit(id));       // reappears at its old index
```

`pending()` already reports exactly the set of rows holding an unreleased restore point, so the
"N deleted — Undo" bar needs no new state.

---

## Files

| File | Change |
|---|---|
| `api/features/editing-state.ts` | `RowRestorePoint`, drop `ABSENT`, pruning predicate, context gains `indexById` |
| `api/optimistic-mutations.ts` | `revertEdit` rewrite, new `discardEdit` / `removeEdit` / `patchEdit` |
| `api/row-edit-mutations.ts` | `beginEdit` snapshot construction, `?? ABSENT` removal |
| `api/row-mutations.ts` | `removeRow` / `patchRow` via `resolveIndex` |
| `api/types.ts` | `RowUpdaterContext` gains `indexById` |
| `engine/core.ts` | pass `indexById` into both writable views |
| `index.ts` | export new verbs; `ABSENT` removal (breaking) |
| `api/optimistic-mutations.spec.ts`, `row-edit-mutations.spec.ts`, `row-mutations.spec.ts`, `features/with-optimistic.spec.ts`, `features/with-row-edit.spec.ts`, `engine/rows.spec.ts` | all reference `ABSENT` / the changed verbs |

**Stories and demos:** the six stories read `editing()` / `pending()` and call
`beginEdit`/`endEdit`/`revertEdit`/`captureEdit`/`releaseEdit` — none construct a snapshot, so none
should need changing. `gated-edit`'s `discardEdit()` handler currently composes three calls and
becomes the new single verb. **No story has an on-row Delete affordance today** — one should be
added to demonstrate delete rollback, or the feature ships undemonstrated (the same trap G12 caught
`rebaseEdit` in).

## Tests to add

- revert of a **deleted** row re-inserts at `at`; revert of a **present** row still replaces in
  place and ignores `at`.
- `removeEdit` then `revertEdit` **with the ADR-0006 effect actually running** — this is Change 4's
  regression guard and is the one that will catch an ordering mistake.
- `removeEdit` on an already-open row keeps the pre-edit restore point (capture-if-absent).
- `revertEdit` with a `row` override on a removed row uses the override's value and the snapshot's
  `at`.
- `resolveIndex` falls back correctly when `indexById` is stale mid-updater.
- stale `at` on re-insert clamps rather than throwing (`addRow` semantics, D27).

## Docs to update after implementing

- `features/row-editing.md` — §2's "never delete or move" table, §4's updater tables, §5's flows,
  §7's "Rolls back no deletes or moves", and the Renamed-in-v2.0 table.
- **§4's save snippet is already stale, independent of this work**: it shows
  `table.value.update(patchRow(id, values))` on the save path, but **every one of the six stories
  reads the already-committed row** (`data().find(...)`) because `debounce('blur')` wrote it. A
  form-driven save needs no `patchRow`. Fix while in there.
- `with-row-editing/5-gaps.md` — G5 closes for delete (not move); O22's representation half
  narrows.
- `docs/0-product/row-editing.md` — §3.1 and §3.2 currently say delete-undo is structurally blocked.
  It is not, after this.
- New decision record in this folder (`2-decisions.md`, D45+) covering all five changes.

---

## Open questions — answer before or during implementation

**OQ-A — Does `revertEdit` on a detached (deleted) row belong to `withOptimistic` alone, or does a
gated table need a different close behavior?** A re-inserted row returns with `open` cleared. On a
gated table, should it come back **open** (the user was mid-edit when the delete failed) or closed?
*Recommendation:* closed. The user's last action was Delete, not Edit. *To decide:* whether any
consumer flow deletes from inside an open row.

**OQ-B — Is dropping `ABSENT` a major version bump, or a deprecation window?** It is a public export
(`index.ts:19`) with public types (`RowSnapshot`, `SnapshotMap`). *Recommendation:* straight
removal if no consumer outside this repo has adopted the library yet — check before assuming.
*To decide:* the library's actual consumer list and versioning policy, neither of which is recorded
in the docs I read.

**OQ-C — Should `discardEdit` also work when no restore point is held?** As written it no-ops, which
means "discard this row" silently does nothing on a row nobody captured. *Recommendation:* keep the
no-op (the house rule is that every updater no-ops on a miss), and let plain `removeRow` cover the
no-restore-point case. *To decide:* whether consumers will reach for `discardEdit` as a general
delete and be confused when it does nothing.

**OQ-D — Does `patchEdit` capture on *every* call or capture-if-absent?** As specified:
capture-if-absent, matching `beginEdit`. That means two successive `patchEdit` calls roll back to
before the *first* one. *Recommendation:* keep capture-if-absent — it matches D31.1's "oldest
restore point wins", and a consumer wanting to move the point forward has `captureEdit`.
*To decide:* nothing external; confirm the semantics read correctly in the JSDoc.

**~~OQ-E — Ordering of `writeData` versus the ADR-0006 reconciliation effect.~~ RESOLVED
2026-08-27.** The reconciliation is an `effect()` (`engine/compose-table.ts:122`), which flushes
after the synchronous updater run, so the `detached` flag is in `snapshots` before the prune diffs.
Safe as designed. Left here because it is a **load-bearing assumption, not an invariant** — the
regression test named above is what protects it.

## Added scope — a `restored` signal (decided 2026-08-27, product OQ-2)

A row that comes back via `revertEdit` after a delete re-inserts at its stored index and is then
sorted by the pipeline, so it can return **off screen with nothing indicating it returned**. The
product call was: the state layer exposes the fact, a UI directive later does the scrolling and
flashing.

So this work also ships a read-only signal naming **rows that just returned** — the same split
`pending()` already uses (table owns the fact, consumer owns the presentation). Open shape
questions for the implementer: whether it is a `Signal<ReadonlySet<RowId>>` alongside `pending`, how
an entry leaves it (next write? a tick? an explicit acknowledge?), and whether a restored row is
distinguishable from a rolled-back *update*, which is not a return and should probably not appear in
it. No DOM, no scrolling, no highlighting in this layer.

**Not in scope, deliberately:** `moveRow` rollback (position is representable now, but the move verb
itself does not exist — D19), bulk/batch arity (D32), and the undo *affordance* (a UI concern; the
state layer only has to make it possible).
