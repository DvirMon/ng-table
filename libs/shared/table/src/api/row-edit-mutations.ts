import { ABSENT, type EditingMap, type RowSnapshot } from './features/with-row-edit';
import type { RowId, TrackByFn } from './types';

export interface EditingUpdaterContext<TRow> {
  readonly data: TRow[];
  readonly trackBy: TrackByFn<TRow>;
  /** Only `revertEdit` uses this — restoring/removing a row is one write, not two calls to
   * `table.value.update(...)` (D30). */
  writeData(rows: TRow[]): void;
}

export type EditingUpdater<TRow> = (
  editing: EditingMap<TRow>,
  ctx: EditingUpdaterContext<TRow>
) => EditingMap<TRow>;

function findRow<TRow>(data: TRow[], trackBy: TrackByFn<TRow>, id: RowId): TRow | undefined {
  return data.find((row) => trackBy(row) === id);
}

/** D17/D28: captures the row's current value, or `ABSENT` when the id has no entry in
 * `data` yet (the blank-row-add flow — `beginEdit` before `addRow`). Re-opening an
 * already-open row simply re-captures. */
export function beginEdit<TRow>(id: RowId): EditingUpdater<TRow> {
  return (editing, { data, trackBy }) => {
    const snapshot: RowSnapshot<TRow> = findRow(data, trackBy, id) ?? ABSENT;
    return new Map(editing).set(id, snapshot);
  };
}

/** Drops the entry, keeping whatever is currently in `data` (Save is composed elsewhere:
 * `table.value.update(patchRow(...))` then `table.editing.update(endEdit(...))`, per D16/D30). */
export function endEdit<TRow>(id: RowId): EditingUpdater<TRow> {
  return (editing) => {
    if (!editing.has(id)) {
      return editing;
    }
    const next = new Map(editing);
    next.delete(id);
    return next;
  };
}

export function clearEditing<TRow>(): EditingUpdater<TRow> {
  return () => new Map();
}

/** D28: `snapshot === ABSENT` removes the row (it never existed); otherwise restores the
 * snapshot value. Either way drops the Map entry. No-op if `id` isn't currently being
 * edited. */
export function revertEdit<TRow>(id: RowId): EditingUpdater<TRow> {
  return (editing, { data, trackBy, writeData }) => {
    const snapshot = editing.get(id);
    if (snapshot === undefined) {
      return editing;
    }
    writeData(
      snapshot === ABSENT
        ? data.filter((row) => trackBy(row) !== id)
        : data.map((row) => (trackBy(row) === id ? snapshot : row))
    );
    const next = new Map(editing);
    next.delete(id);
    return next;
  };
}

/** D30: resolves a stale snapshot without the library watching `data`. Omitting `row`
 * re-reads `data()` for the id (`ABSENT` if it's gone); an explicit `row` sets that as the
 * new restore point (e.g. the server's response). No-op if `id` isn't currently being
 * edited. */
export function setSnapshot<TRow>(id: RowId, row?: TRow): EditingUpdater<TRow> {
  return (editing, { data, trackBy }) => {
    if (!editing.has(id)) {
      return editing;
    }
    const snapshot: RowSnapshot<TRow> = row ?? findRow(data, trackBy, id) ?? ABSENT;
    return new Map(editing).set(id, snapshot);
  };
}
