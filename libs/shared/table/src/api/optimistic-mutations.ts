import { resolveIndex } from '../engine/rows';
import { insertRow } from './row-mutations';
import {
  findRow,
  withSnapshot,
  withoutOpen,
  withoutSnapshot,
  type EditingUpdater,
  type PatchEditOptions,
  type RowRestorePoint,
} from './features/editing-state';
import type { RowId } from './types';

export type { PatchEditOptions } from './features/editing-state';

/**
 * The rollback verbs — `withOptimistic()`'s slice (D37). Meaningful whether or not an edit
 * session exists: they read and write `snapshots`, and touch `open` only to leave it (which is a
 * no-op on a table where nothing ever opens).
 *
 * Scope is update, create, and delete (Change 1/2 of the optimistic-CRUD handoff extended D38/G5
 * to delete — a restore point now carries a position as well as a value). `moveRow` rollback is
 * still out of scope — position is representable, but the move verb itself doesn't exist (D19).
 */

/**
 * D40: captures a restore point for `id`, **overwriting** any existing one. Omitting `row`
 * re-reads `data()` for the id; if neither `row` nor a lookup finds a value, no snapshot is
 * written at all — capturing nothing is more honest than capturing a tombstone (post-D42, this
 * can only arise from a since-removed row).
 *
 * Two entry points, one difference: `beginEdit` captures *only if absent* (D31.1 — the oldest
 * restore point wins, so Cancel returns to the true pre-edit state), `captureEdit` always
 * overwrites. That is the whole of what the former `rebaseEdit` expressed, now a difference
 * between two verbs rather than a flag on one.
 *
 * Supersedes `rebaseEdit` (D34), whose open-only guard is dropped: capture is no longer a
 * session concern, and the guard would make this dead on a live table — the one place it is the
 * primary entry point.
 */
export function captureEdit<TRow>(id: RowId, row?: TRow): EditingUpdater<TRow> {
  return (state, { data, trackBy, indexById }) => {
    const at = resolveIndex(data, id, { trackBy, indexById });
    const found = row ?? (at === -1 ? undefined : data[at]);
    if (found === undefined) {
      return state;
    }
    const snapshot: RowRestorePoint<TRow> = { row: found, at, detached: false };
    return { ...state, snapshots: withSnapshot(state.snapshots, id, snapshot) };
  };
}

/**
 * D41: drops a restore point once the server has confirmed the write — the row is done, nothing
 * left to roll back to. Renamed from `settleEdit`, pairing with `captureEdit` as acquire/release.
 *
 * Takes a **required** id, deliberately. A bulk form meaning "release everything" discards
 * in-flight rollbacks: harmless on a gated table where most restore points belong to rows the
 * user is typing in, but on a live table nothing is ever open, so every restore point belongs to
 * a request still waiting on the server. A later rejection would find nothing to restore and the
 * rejected value would stay on screen with no error. Bulk teardown is `clearEdit()`, which
 * closes and releases atomically (D44).
 *
 * No-ops for an id that is still open (closing one is `endEdit`'s job) or that holds no restore
 * point.
 */
export function releaseEdit<TRow>(id: RowId): EditingUpdater<TRow> {
  return (state) =>
    state.open.has(id) || !state.snapshots.has(id)
      ? state
      : { ...state, snapshots: withoutSnapshot(state.snapshots, id) };
}

/**
 * Restores `id` to its held snapshot — and nothing else. If the row is still present in `data`
 * it is replaced in place (a sort or another write may have moved it, so position is ignored);
 * if it is gone (removed by `removeEdit`, or externally), it is re-inserted at the snapshot's
 * `at`. Either way the restore point is spent and the row ends up closed.
 *
 * The optional `row` overrides what gets written — revert to *this* value instead of the stored
 * snapshot's row, while still using the snapshot's `at` for a re-insert. Orthogonal to
 * `captureEdit`, which stays open and only moves the restore point for a *later* revert.
 *
 * No-op when the id holds no restore point. Removal is a different intent — see `discardEdit`.
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
      snapshots: withoutSnapshot(state.snapshots, id),
      open: withoutOpen(state.open, id),
    };
  };
}

/**
 * Drops the restore point and removes the row — the discard path. Counterpart to `revertEdit`,
 * not a mode of it. Replaces the three-call `removeRow` + `endEdit` + `releaseEdit` sequence the
 * docs previously prescribed.
 *
 * No-op when no restore point is held (house rule — every updater no-ops on a miss); plain
 * `removeRow` covers deleting a row nobody captured.
 */
export function discardEdit<TRow>(id: RowId): EditingUpdater<TRow> {
  return (state, { data, trackBy, writeData }) => {
    if (!state.snapshots.has(id)) {
      return state;
    }
    writeData(data.filter((r) => trackBy(r) !== id));
    return {
      snapshots: withoutSnapshot(state.snapshots, id),
      open: withoutOpen(state.open, id),
    };
  };
}

/**
 * Captures row + index if none is held, then removes the row — one write. Needs no prior
 * `beginEdit`/`captureEdit`. Capture-if-absent (D31.1), so removing an already-open row keeps its
 * true pre-edit restore point. `revertEdit(id)` puts it back at `at`.
 *
 * Belongs to `withOptimistic`, not `withRowEdit` — it touches `open` only to clear it (a removed
 * row shows no inputs), no session semantics involved.
 */
export function removeEdit<TRow>(id: RowId): EditingUpdater<TRow> {
  return (state, { data, trackBy, writeData, indexById }) => {
    const at = resolveIndex(data, id, { trackBy, indexById });
    if (at === -1) {
      return state; // house rule: no-op on a miss
    }

    const held = state.snapshots.get(id);
    const snapshot: RowRestorePoint<TRow> = held
      ? { ...held, detached: true } // IMPORTANT: keep the captured row/at, but flip detached
        // true — else ADR-0006 pruning wipes a snapshot that was captured while the row was
        // still present (detached: false from beginEdit/captureEdit), the moment removeEdit
        // fires.
      : { row: data[at], at, detached: true };

    writeData(data.filter((row) => trackBy(row) !== id));
    return {
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
      ? withSnapshot(state.snapshots, id, { row: data[at], at, detached: false })
      : state.snapshots;

    writeData(data.map((row) => (trackBy(row) === id ? { ...row, ...partial } : row)));
    return { ...state, snapshots };
  };
}
