import { ABSENT, type RowSnapshot, type SnapshotMap } from './features/with-row-edit';
import type { RowId, TrackByFn } from './types';

/**
 * What an editing updater reads and writes (D31.5). Two orthogonal facts, not two copies of
 * one: `snapshots` is *what Cancel restores*, `open` is *which rows show inputs*. `pending` is
 * derived from the pair, never stored.
 */
export interface EditingState<TRow> {
  /** One restore point per row: its value at the first `beginEdit` (D17), or `ABSENT` when the
   * id had no row yet (D28). Outlives closing when the close was optimistic. */
  readonly snapshots: SnapshotMap<TRow>;
  /** Rows currently open. Always a subset of `snapshots`' keys — every updater preserves that,
   * and `pending` (`snapshots` minus `open`) depends on it. */
  readonly open: ReadonlySet<RowId>;
}

export interface EditingUpdaterContext<TRow> {
  readonly data: TRow[];
  readonly trackBy: TrackByFn<TRow>;
  /** Only `revertEdit` uses this — restoring/removing a row is one write, not two calls to
   * `table.value.update(...)` (D30). */
  writeData(rows: TRow[]): void;
}

export type EditingUpdater<TRow> = (
  state: EditingState<TRow>,
  ctx: EditingUpdaterContext<TRow>
) => EditingState<TRow>;

export interface EndEditOptions {
  /** D31 optimistic save: keep the restore point after closing, so a failed save can still
   * `revertEdit`. The row becomes `pending` by virtue of being closed but still held. Settle
   * with `settleEdit(id)` on success. */
  keepSnapshot?: boolean;
}

function findRow<TRow>(data: TRow[], trackBy: TrackByFn<TRow>, id: RowId): TRow | undefined {
  return data.find((row) => trackBy(row) === id);
}

function withSnapshot<TRow>(
  snapshots: SnapshotMap<TRow>,
  id: RowId,
  snapshot: RowSnapshot<TRow>
): SnapshotMap<TRow> {
  return new Map(snapshots).set(id, snapshot);
}

function withoutSnapshot<TRow>(snapshots: SnapshotMap<TRow>, id: RowId): SnapshotMap<TRow> {
  const next = new Map(snapshots);
  next.delete(id);
  return next;
}

function withOpen(open: ReadonlySet<RowId>, id: RowId): ReadonlySet<RowId> {
  return new Set(open).add(id);
}

function withoutOpen(open: ReadonlySet<RowId>, id: RowId): ReadonlySet<RowId> {
  const next = new Set(open);
  next.delete(id);
  return next;
}

/**
 * D17/D28: captures the row's current value as its restore point, or `ABSENT` when the id has
 * no entry in `data` yet (the blank-row-add flow — `beginEdit` before `addRow`).
 *
 * D31.1 needs no branch here: a row that already has a restore point keeps it, whether it is a
 * `pending` row re-opening or a double `beginEdit`. Cancel therefore returns to the true
 * pre-edit state rather than an unconfirmed optimistic one — the oldest restore point wins.
 * Moving one forward is `rebaseEdit`'s job (D30).
 */
export function beginEdit<TRow>(id: RowId): EditingUpdater<TRow> {
  return (state, { data, trackBy }) => {
    if (state.open.has(id)) {
      return state;
    }
    return {
      snapshots: state.snapshots.has(id)
        ? state.snapshots
        : withSnapshot(state.snapshots, id, findRow(data, trackBy, id) ?? ABSENT),
      open: withOpen(state.open, id),
    };
  };
}

/**
 * Closes the row, keeping whatever is currently in `data` (Save is composed elsewhere:
 * `table.value.update(patchRow(...))` then `table.editing.update(endEdit(...))`, per D16/D30).
 *
 * `{ keepSnapshot: true }` (D31) holds the restore point instead of dropping it. Nothing moves
 * between containers — the row is `pending` because it is closed and still held.
 */
export function endEdit<TRow>(id: RowId, options: EndEditOptions = {}): EditingUpdater<TRow> {
  return (state) => {
    if (!state.open.has(id)) {
      return state;
    }
    return {
      snapshots: options.keepSnapshot ? state.snapshots : withoutSnapshot(state.snapshots, id),
      open: withoutOpen(state.open, id),
    };
  };
}

/**
 * Closes every open row, dropping their restore points the way a plain `endEdit` does.
 *
 * Dropping them is the point, not an oversight: closing without `keepSnapshot` and leaving the
 * restore point behind would mark the row `pending`, arming a rollback for a save nobody
 * started. Rows already pending are untouched — they are not open (D31.3).
 */
export function clearEditing<TRow>(): EditingUpdater<TRow> {
  return (state) => {
    if (state.open.size === 0) {
      return state;
    }
    const snapshots = new Map(state.snapshots);
    for (const id of state.open) {
      snapshots.delete(id);
    }
    return { snapshots, open: new Set() };
  };
}

/**
 * D28: `snapshot === ABSENT` removes the row (it never existed); otherwise restores the
 * snapshot value. Either way the restore point is spent and the row ends up closed.
 *
 * One lookup covers both cases D31 used to split: cancelling an open row and rolling back a
 * failed optimistic save read the same restore point, because there is only one. No-op when the
 * id has none.
 */
export function revertEdit<TRow>(id: RowId): EditingUpdater<TRow> {
  return (state, { data, trackBy, writeData }) => {
    const snapshot = state.snapshots.get(id);
    if (snapshot === undefined) {
      return state;
    }

    writeData(
      snapshot === ABSENT
        ? data.filter((row) => trackBy(row) !== id)
        : data.map((row) => (trackBy(row) === id ? snapshot : row))
    );

    return {
      snapshots: withoutSnapshot(state.snapshots, id),
      open: withoutOpen(state.open, id),
    };
  };
}

/**
 * D30: moves an open row's restore point forward, so Cancel does not undo someone else's
 * write. Resolves a stale snapshot without the library watching `data` — it cannot tell an
 * external write from any other, so the consumer says when they wrote.
 *
 * Omitting `row` re-reads `data()` for the id (`ABSENT` if it's gone); an explicit `row` sets
 * that as the new restore point (e.g. the server's response). No-op if `id` isn't currently
 * *open* — a pending row's rollback is settled with `settleEdit`, not re-pointed (D31.3).
 */
export function rebaseEdit<TRow>(id: RowId, row?: TRow): EditingUpdater<TRow> {
  return (state, { data, trackBy }) => {
    if (!state.open.has(id)) {
      return state;
    }
    const snapshot: RowSnapshot<TRow> = row ?? findRow(data, trackBy, id) ?? ABSENT;
    return { ...state, snapshots: withSnapshot(state.snapshots, id, snapshot) };
  };
}

/**
 * D31: settles an optimistic save by dropping the restore point once the server has confirmed
 * it — the row is done, nothing left to roll back to. No-op for an id that is still open
 * (closing one is `endEdit`'s job) or that holds no restore point.
 */
export function settleEdit<TRow>(id: RowId): EditingUpdater<TRow> {
  return (state) =>
    state.open.has(id) || !state.snapshots.has(id)
      ? state
      : { ...state, snapshots: withoutSnapshot(state.snapshots, id) };
}
