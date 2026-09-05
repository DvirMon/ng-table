import { resolveIndex } from '../engine/rows';
import {
  closeAll,
  findRow,
  withOpen,
  withoutOpen,
  withSnapshot,
  type EditingUpdater,
  type RowRestorePoint,
} from '../api/features/editing-state';
import { patchEdit } from './optimistic-mutations';
import { insertRow } from './row-mutations';
import type { RowId } from '../api/types';

/**
 * The edit-session verbs — `withRowEdit()`'s slice. They write `open` unconditionally, with no
 * feature check: calling `beginEdit` on a table composing only `withOptimistic()` populates
 * `open`, which that feature never reads or clears — silently shrinking `pending` (derived as
 * `snapshots` minus `open`), the signal a live table actually reads. Misuse the types don't
 * prevent, not a supported no-op.
 *
 * The rollback verbs (`captureEdit` / `releaseEdit` / `revertEdit`) live in
 * `optimistic-mutations.ts` and work under either composition.
 */

export interface BeginEditOptions<TRow> {
  /** Adds this row to `data` before opening it, so the blank-row-add flow is one call. No-ops if
   * its id is already taken. */
  insert?: NoInfer<TRow>;
  /** `Array.prototype.splice(at, 0, row)` semantics for `insert`, clamped. */
  at?: number;
}

/**
 * Opens the row, capturing its current value as the restore point — or, when the id has no entry
 * in `data` yet and `{ insert }` wasn't used (misuse), no snapshot at all.
 *
 * A row that already has a restore point keeps it, whether it's a `pending` row re-opening or a
 * double `beginEdit` — Cancel returns to the true pre-edit state rather than an unconfirmed
 * optimistic one. Moving the restore point forward instead is `captureEdit`'s job.
 *
 * **`{ insert }`** adds the row first, then captures and opens it — the blank-row-add flow in
 * one call. The restore point is the row itself, so plain `revertEdit(id)` *resets* the row
 * rather than removing it; removal is composed explicitly at a call site that wants one.
 *
 * Inserting lives on the editing slice, not beside `insertRow`, because only an `EditingUpdater`
 * can write both — a `RowUpdater` returns an array and has no handle on editing state.
 */
export function beginEdit<TRow>(
  id: RowId,
  options: BeginEditOptions<TRow> = {}
): EditingUpdater<TRow> {
  return (state, { data, trackBy, writeData, indexById }) => {
    if (state.open.has(id)) {
      return state;
    }

    const { insert, at } = options;
    if (insert !== undefined) {
      // Guard, not a throw (the house rule — every updater no-ops on a miss). Adding a row whose
      // id is already taken would break `trackBy`'s uniqueness for every consumer of it, and
      // overwrite an existing restore point. `patchRow` is the verb for an id that already exists.
      if (findRow(data, trackBy, id, indexById) !== undefined) {
        return state;
      }
      const nextData = insertRow<TRow>(insert, { at })(data, { trackBy, indexById });
      writeData(nextData);
      // `indexById` from context is stale here on purpose — it reflects `data` *before* this
      // write. Resolve the just-inserted row's actual index against the newly written array;
      // `resolveIndex`'s linear-scan fallback makes this correct regardless.
      const insertedAt = resolveIndex(nextData, id, { trackBy, indexById });
      return {
        snapshots: withSnapshot(state.snapshots, id, { row: insert, at: insertedAt, detached: false }),
        open: withOpen(state.open, id),
      };
    }

    const foundAt = resolveIndex(data, id, { trackBy, indexById });
    if (foundAt === -1) {
      // Misuse — no `{ insert }` and the id isn't in `data`. No snapshot to set; still open it.
      return { ...state, open: withOpen(state.open, id) };
    }

    const snapshot: RowRestorePoint<TRow> = { row: data[foundAt], at: foundAt, detached: false };
    return {
      snapshots: state.snapshots.has(id) ? state.snapshots : withSnapshot(state.snapshots, id, snapshot),
      open: withOpen(state.open, id),
    };
  };
}

/**
 * `beginEdit(id, { insert: row, at })` under a name that reads as what it does.
 *
 * `id` is required, not derived — `createRow` never reads `trackBy` itself. The array overload
 * opens every entry in **one** write — one `data` splice, one `{ snapshots, open }` — instead of
 * a consumer looping single-row calls. Entries are `{ id, row }` pairs, not parallel arrays. An
 * entry whose id already exists in `data` is skipped (same no-op-on-miss rule as the single-row
 * form); the rest of the batch still writes.
 */
export function createRow<TRow>(id: RowId, row: NoInfer<TRow>, opts?: { at?: number }): EditingUpdater<TRow>;
export function createRow<TRow>(
  rows: { id: RowId; row: NoInfer<TRow> }[],
  opts?: { at?: number },
): EditingUpdater<TRow>;
export function createRow<TRow>(
  idOrRows: RowId | { id: RowId; row: NoInfer<TRow> }[],
  rowOrOpts?: NoInfer<TRow> | { at?: number },
  maybeOpts?: { at?: number },
): EditingUpdater<TRow> {
  if (!Array.isArray(idOrRows)) {
    return beginEdit<TRow>(idOrRows, { insert: rowOrOpts as NoInfer<TRow>, at: maybeOpts?.at });
  }

  const entries = idOrRows;
  const opts = rowOrOpts as { at?: number } | undefined;

  return (state, { data, trackBy, writeData, indexById }) => {
    const fresh = entries.filter((entry) => findRow(data, trackBy, entry.id, indexById) === undefined);
    if (fresh.length === 0) {
      return state;
    }

    const nextData = insertRow<TRow>(
      fresh.map((entry) => entry.row),
      { at: opts?.at },
    )(data, { trackBy, indexById });
    writeData(nextData);

    let snapshots = state.snapshots;
    let open = state.open;
    for (const entry of fresh) {
      const insertedAt = resolveIndex(nextData, entry.id, { trackBy, indexById });
      snapshots = withSnapshot(snapshots, entry.id, { row: entry.row, at: insertedAt, detached: false });
      open = withOpen(open, entry.id);
    }
    return { snapshots, open };
  };
}

/**
 * Closes the row, keeping whatever is currently in `data` **and** its restore point — the row
 * becomes `pending`. Dropping the restore point instead is `releaseEdit`'s job; a purely local
 * save that has nothing to confirm calls both.
 *
 * `partial`, when given, merges into `data` via `patchEdit` before closing, so save doesn't need
 * two separate calls a consumer has to remember to pair and order correctly. A close that should
 * discard the edit instead is `revertEdit`/`discardEdit`, a different verb entirely.
 *
 * Takes a **required** id — a bulk form would close every row while keeping every restore point,
 * leaking all of them into `pending` with nothing left to release them. Bulk teardown is
 * `clearEdit()`.
 */
export function endEdit<TRow>(id: RowId, partial?: Partial<TRow>): EditingUpdater<TRow> {
  return (state, ctx) => {
    if (!state.open.has(id)) {
      return state;
    }
    const next = partial === undefined ? state : patchEdit<TRow>(id, partial)(state, ctx);
    return { ...next, open: withoutOpen(next.open, id) };
  };
}

/**
 * Closes every open row, dropping their restore points — one write, deliberately not composed
 * from `endEdit` + `releaseEdit`: spelled as a pair it would close every row first, leaving the
 * release nothing to find, and every row would leak into `pending` forever with no error.
 *
 * Dropping the restore points is the point, not an oversight: closing and leaving them behind
 * would mark each row `pending`, arming a rollback for a save nobody started. Rows already
 * pending are untouched — they are not open.
 */
export function clearEdit<TRow>(): EditingUpdater<TRow> {
  return (state) => closeAll(state);
}
