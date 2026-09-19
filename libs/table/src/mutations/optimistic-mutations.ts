import { resolveIndex } from '../engine/rows';
import { insertRow, patchRow, removeRow } from './row-mutations';
import {
  findRow,
  withSnapshot,
  withoutOpen,
  withoutSnapshot,
  withoutUnconfirmed,
  type EditingUpdater,
  type PatchEditOptions,
  type RowRestorePoint,
} from '../api/features/editing/state';
import type { RowId } from '../api/types';

export type { PatchEditOptions } from '../api/features/editing/state';

/**
 * The rollback verbs — `withOptimistic()`'s slice. Meaningful whether or not an edit session
 * exists: they read and write `snapshots`, and touch `open` only to leave it (a no-op on a table
 * where nothing ever opens).
 *
 * Covers update, create, and delete rollback. `moveRow` rollback is out of scope — there's no
 * `moveRow` updater to roll back yet.
 */

/**
 * Captures a restore point for `id`, **always overwriting** any existing one. Omitting `row`
 * re-reads `data()` for the id; if that finds nothing either, no snapshot is written.
 *
 * Use this to move the restore point forward (e.g. after accepting a live update while the row
 * stays open). For "capture only if absent" — the usual open-a-row case, where the oldest
 * restore point should win — use `beginEdit` instead.
 */
export function captureEdit<TRow>(id: RowId, row?: TRow): EditingUpdater<TRow> {
  return (state, { data, trackBy, indexById }) => {
    const at = resolveIndex(data, id, { trackBy, indexById });
    const found = row ?? (at === -1 ? undefined : data[at]);
    if (found === undefined) {
      return state;
    }
    const snapshot: RowRestorePoint<TRow> = { row: found, at, op: 'update' };
    return { ...state, snapshots: withSnapshot(state.snapshots, id, snapshot) };
  };
}

/**
 * Drops the restore point once the server has confirmed the write — nothing left to roll back
 * to. Pairs with `captureEdit` as acquire/release.
 *
 * Takes a required id — there's no bulk "release everything", since on a live table every
 * restore point belongs to a request still in flight, and dropping it early would leave a
 * rejected write silently stuck on screen. Bulk teardown is `clearEdit()` instead (closes and
 * releases atomically).
 *
 * No-op for an id that's still open (closing it is `endEdit`'s job) or holds neither a restore
 * point nor unconfirmed identity. Clears both on release — `unconfirmed` outlives a spent
 * restore point (a failed create that reverted, then retried), so releasing must not require
 * one to still be held.
 */
export function releaseEdit<TRow>(id: RowId): EditingUpdater<TRow> {
  return (state) => {
    if (state.open.has(id)) {
      return state;
    }
    if (!state.snapshots.has(id) && !state.unconfirmed.has(id)) {
      return state;
    }
    return {
      ...state,
      snapshots: withoutSnapshot(state.snapshots, id),
      unconfirmed: withoutUnconfirmed(state.unconfirmed, id),
    };
  };
}

/**
 * Restores `id` to its held snapshot. If the row is still present in `data` it's replaced in
 * place (position is ignored — a sort or write may have moved it); if it was removed (by
 * `removeEdit` or externally), it's re-inserted at the snapshot's `at`. Either way the restore
 * point is spent and the row ends up closed.
 *
 * The optional `row` overrides what gets written — revert to *this* value instead of the stored
 * snapshot, while still using the snapshot's `at` for a re-insert.
 *
 * No-op when the id holds no restore point. To remove the row instead of restoring it, see
 * `discardEdit`.
 */
export function revertEdit<TRow>(id: RowId, row?: TRow): EditingUpdater<TRow> {
  return (state, { data, trackBy, writeData, indexById }) => {
    const snapshot = state.snapshots.get(id);
    if (snapshot === undefined) {
      return state;
    }

    const value = row ?? snapshot.row;
    writeData(
      findRow(data, trackBy, id, indexById) !== undefined
        ? data.map((r) => (trackBy(r) === id ? value : r)) // still there — replace
        : insertRow<TRow>(value, { at: snapshot.at })(data, { trackBy, indexById }) // gone — put it back
    );

    return {
      ...state,
      snapshots: withoutSnapshot(state.snapshots, id),
      open: withoutOpen(state.open, id),
    };
  };
}

/**
 * Drops the restore point and removes the row — the discard path, as opposed to `revertEdit`'s
 * restore path.
 *
 * No-op when no restore point is held; plain `removeRow` covers deleting a row nobody captured.
 * Clears `unconfirmed` too — a discarded create is abandoned, not retried.
 */
export function discardEdit<TRow>(id: RowId): EditingUpdater<TRow> {
  return (state, { data, trackBy, writeData }) => {
    if (!state.snapshots.has(id)) {
      return state;
    }
    writeData(data.filter((r) => trackBy(r) !== id));
    return {
      ...state,
      snapshots: withoutSnapshot(state.snapshots, id),
      open: withoutOpen(state.open, id),
      unconfirmed: withoutUnconfirmed(state.unconfirmed, id),
    };
  };
}

/**
 * Captures row + index if none is held (keeping any existing restore point, so removing an
 * already-open row still reverts to its true pre-edit value), then removes the row — one write,
 * no prior `beginEdit`/`captureEdit` needed. `revertEdit(id)` puts it back at `at`.
 *
 * Belongs to `withOptimistic`, not `withRowEdit` — it touches `open` only to clear it (a removed
 * row shows no inputs); no session semantics involved.
 */
export function removeEdit<TRow>(id: RowId): EditingUpdater<TRow> {
  return (state, { data, trackBy, writeData, indexById }) => {
    const at = resolveIndex(data, id, { trackBy, indexById });
    if (at === -1) {
      return state;
    }

    const held = state.snapshots.get(id);
    // `op: 'delete'` marks the row as gone from `data` so removal-pruning doesn't wipe this
    // snapshot the moment the row disappears.
    const snapshot: RowRestorePoint<TRow> = held
      ? { ...held, op: 'delete' }
      : { row: data[at], at, op: 'delete' };

    writeData(removeRow<TRow>(id)(data, { trackBy, indexById }));
    return {
      ...state,
      snapshots: withSnapshot(state.snapshots, id, snapshot),
      open: withoutOpen(state.open, id),
    };
  };
}

/**
 * Same shape as `removeEdit`, for a write no form made — a row action, a background patch.
 * Belongs to `withOptimistic`, not `withRowEdit` — no `open` involvement at all.
 */
export function patchEdit<TRow>(
  id: RowId,
  partial: Partial<TRow>,
  options: PatchEditOptions = {}
): EditingUpdater<TRow> {
  return (state, { data, trackBy, writeData, indexById }) => {
    const at = resolveIndex(data, id, { trackBy, indexById });
    if (at === -1) {
      return state;
    }

    const shouldCapture = (options.capture ?? 'if-absent') === 'always' || !state.snapshots.has(id);
    const snapshots = shouldCapture
      ? withSnapshot(state.snapshots, id, { row: data[at], at, op: 'update' })
      : state.snapshots;

    writeData(patchRow<TRow>(id, partial)(data, { trackBy, indexById }));
    return { ...state, snapshots };
  };
}

/**
 * Re-keys `from` to `to` in whichever of `open`/`snapshots` hold it — the temp-id → server-id
 * swap on an optimistic create. Does not touch `data`; the caller writes the row's new identity
 * there (e.g. via `patchRow`) in the same synchronous handler, before this call. No-op when
 * nothing holds `from` (house rule).
 *
 * `unconfirmed` is dropped for `from`, never added for `to` — a swap **is** the server's
 * acknowledgement, so the new id is confirmed from the moment it exists.
 */
export function swapRowId<TRow>(from: RowId, to: RowId): EditingUpdater<TRow> {
  return (state) => {
    const heldOpen = state.open.has(from);
    const heldSnapshot = state.snapshots.get(from);
    const heldUnconfirmed = state.unconfirmed.has(from);
    if (!heldOpen && heldSnapshot === undefined && !heldUnconfirmed) {
      return state;
    }

    let open = state.open;
    if (heldOpen) {
      const nextOpen = new Set(open);
      nextOpen.delete(from);
      nextOpen.add(to);
      open = nextOpen;
    }

    let snapshots = state.snapshots;
    if (heldSnapshot !== undefined) {
      const nextSnapshots = new Map(snapshots);
      nextSnapshots.delete(from);
      nextSnapshots.set(to, heldSnapshot);
      snapshots = nextSnapshots;
    }

    const unconfirmed = heldUnconfirmed
      ? withoutUnconfirmed(state.unconfirmed, from)
      : state.unconfirmed;

    return { open, snapshots, unconfirmed };
  };
}
