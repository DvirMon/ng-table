import {
  ABSENT,
  findRow,
  withSnapshot,
  withoutOpen,
  withoutSnapshot,
  type EditingUpdater,
  type RowSnapshot,
} from './features/editing-state';
import type { RowId } from './types';

/**
 * The rollback verbs — `withOptimistic()`'s slice (D37). Meaningful whether or not an edit
 * session exists: they read and write `snapshots`, and touch `open` only to leave it (which is a
 * no-op on a table where nothing ever opens).
 *
 * Scope is update and create, never delete or move (D38, G5) — a restore point holds a value,
 * never an index.
 */

/**
 * D40: captures a restore point for `id`, **overwriting** any existing one. Omitting `row`
 * re-reads `data()` for the id (`ABSENT` if it's gone); an explicit `row` sets that as the new
 * restore point (e.g. the server's response).
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
  return (state, { data, trackBy }) => {
    const snapshot: RowSnapshot<TRow> = row ?? findRow(data, trackBy, id) ?? ABSENT;
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
 * rejected value would stay on screen with no error. Bulk teardown is `clearEditing()`, which
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
 * D28: `snapshot === ABSENT` removes the row (it never existed); otherwise restores the snapshot
 * value. Either way the restore point is spent and the row ends up closed — this is Cancel on a
 * gated table and rollback on a live one, which were never two mechanisms.
 *
 * One lookup covers both cases D31 used to split: cancelling an open row and rolling back a
 * failed optimistic save read the same restore point, because there is only one. No-op when the
 * id has none.
 *
 * The optional `row` overrides what gets written — revert to *this* value instead of the stored
 * snapshot, still closing and spending the restore point. Orthogonal to `captureEdit`, which
 * stays open and only moves the restore point for a *later* revert.
 *
 * Removal is not a revert (D36). A consumer who wants Cancel to remove a row composes it, the
 * same way Save composes `patchRow` + `endEdit`:
 *
 * ```ts
 * table.value.update(removeRow(id));
 * table.editing.update(endEdit(id));
 * table.editing.update(releaseEdit(id));
 * ```
 */
export function revertEdit<TRow>(id: RowId, row?: TRow): EditingUpdater<TRow> {
  return (state, { data, trackBy, writeData }) => {
    const snapshot = state.snapshots.get(id);
    if (snapshot === undefined) {
      return state;
    }

    const target: RowSnapshot<TRow> = row ?? snapshot;
    writeData(
      target === ABSENT
        ? data.filter((row) => trackBy(row) !== id)
        : data.map((row) => (trackBy(row) === id ? target : row))
    );

    return {
      snapshots: withoutSnapshot(state.snapshots, id),
      open: withoutOpen(state.open, id),
    };
  };
}
