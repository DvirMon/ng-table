import { ABSENT, type EditingMap, type RowSnapshot } from './features/with-row-edit';
import type { RowId, TrackByFn } from './types';

/**
 * The two snapshot maps an editing updater reads and writes (D31). One value, so a move
 * between the maps is a single write and they cannot drift.
 */
export interface EditingState<TRow> {
  /** Rows open for editing. This is the key set templates read to decide which rows render
   * inputs, and the only map `table.editing()` exposes. */
  readonly editing: EditingMap<TRow>;
  /** Rows closed by `endEdit(id, { keepSnapshot: true })` — visually done, still rollback-able
   * while an optimistic save is in flight. Settled by `settleEdit`, rolled back by
   * `revertEdit`. */
  readonly pending: EditingMap<TRow>;
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
  /** D31 optimistic save: move the entry to `pending` instead of dropping it, so a failed
   * save can still `revertEdit`. Settle with `settleEdit(id)` on success. */
  keepSnapshot?: boolean;
}

function findRow<TRow>(data: TRow[], trackBy: TrackByFn<TRow>, id: RowId): TRow | undefined {
  return data.find((row) => trackBy(row) === id);
}

function withEntry<TRow>(
  map: EditingMap<TRow>,
  id: RowId,
  snapshot: RowSnapshot<TRow>
): EditingMap<TRow> {
  return new Map(map).set(id, snapshot);
}

function withoutEntry<TRow>(map: EditingMap<TRow>, id: RowId): EditingMap<TRow> {
  const next = new Map(map);
  next.delete(id);
  return next;
}

/**
 * D17/D28: captures the row's current value, or `ABSENT` when the id has no entry in `data`
 * yet (the blank-row-add flow — `beginEdit` before `addRow`).
 *
 * D31.1: never re-captures over an existing snapshot. An already-open row is left alone; a
 * `pending` row re-opens carrying the snapshot taken at the *first* `beginEdit`, so Cancel
 * returns to the true pre-edit state rather than to the unconfirmed optimistic one.
 * Re-capturing a restore point is `rebaseEdit`'s job (D30).
 */
export function beginEdit<TRow>(id: RowId): EditingUpdater<TRow> {
  return (state, { data, trackBy }) => {
    if (state.editing.has(id)) {
      return state;
    }

    const kept = state.pending.get(id);
    if (kept !== undefined) {
      return {
        editing: withEntry(state.editing, id, kept),
        pending: withoutEntry(state.pending, id),
      };
    }

    const snapshot: RowSnapshot<TRow> = findRow(data, trackBy, id) ?? ABSENT;
    return { ...state, editing: withEntry(state.editing, id, snapshot) };
  };
}

/**
 * Closes the row, keeping whatever is currently in `data` (Save is composed elsewhere:
 * `table.value.update(patchRow(...))` then `table.editing.update(endEdit(...))`, per D16/D30).
 *
 * `{ keepSnapshot: true }` (D31) moves the entry to `pending` instead of dropping it — one
 * write, so the maps cannot drift.
 */
export function endEdit<TRow>(id: RowId, options: EndEditOptions = {}): EditingUpdater<TRow> {
  return (state) => {
    const snapshot = state.editing.get(id);
    if (snapshot === undefined) {
      return state;
    }
    return {
      editing: withoutEntry(state.editing, id),
      pending: options.keepSnapshot ? withEntry(state.pending, id, snapshot) : state.pending,
    };
  };
}

/** Closes every open row. `pending` entries are already closed, so they are left alone. */
export function clearEditing<TRow>(): EditingUpdater<TRow> {
  return (state) => ({ ...state, editing: new Map() });
}

/**
 * D28: `snapshot === ABSENT` removes the row (it never existed); otherwise restores the
 * snapshot value. Either way drops the entry.
 *
 * D31: reads `editing` first, then `pending` — so it rolls back a failed optimistic save just
 * as it cancels an open row. No-op when the id is in neither map.
 */
export function revertEdit<TRow>(id: RowId): EditingUpdater<TRow> {
  return (state, { data, trackBy, writeData }) => {
    const open = state.editing.has(id);
    const snapshot = open ? state.editing.get(id) : state.pending.get(id);
    if (snapshot === undefined) {
      return state;
    }

    writeData(
      snapshot === ABSENT
        ? data.filter((row) => trackBy(row) !== id)
        : data.map((row) => (trackBy(row) === id ? snapshot : row))
    );

    return open
      ? { ...state, editing: withoutEntry(state.editing, id) }
      : { ...state, pending: withoutEntry(state.pending, id) };
  };
}

/**
 * D30: moves an open row's restore point forward, so Cancel does not undo someone else's
 * write. Resolves a stale snapshot without the library watching `data` — it cannot tell an
 * external write from any other, so the consumer says when they wrote.
 *
 * Omitting `row` re-reads `data()` for the id (`ABSENT` if it's gone); an explicit `row` sets
 * that as the new restore point (e.g. the server's response). No-op if `id` isn't currently
 * *open* — a `pending` row's rollback is settled with `settleEdit`, not re-pointed.
 */
export function rebaseEdit<TRow>(id: RowId, row?: TRow): EditingUpdater<TRow> {
  return (state, { data, trackBy }) => {
    if (!state.editing.has(id)) {
      return state;
    }
    const snapshot: RowSnapshot<TRow> = row ?? findRow(data, trackBy, id) ?? ABSENT;
    return { ...state, editing: withEntry(state.editing, id, snapshot) };
  };
}

/**
 * D31: settles an optimistic save by dropping the `pending` entry once the server has
 * confirmed it — the row is done, nothing left to roll back to. No-op for an id that is still
 * open; closing an open row is `endEdit`'s job.
 */
export function settleEdit<TRow>(id: RowId): EditingUpdater<TRow> {
  return (state) =>
    state.pending.has(id) ? { ...state, pending: withoutEntry(state.pending, id) } : state;
}
