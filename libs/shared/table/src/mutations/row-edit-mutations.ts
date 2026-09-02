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
 * The edit-session verbs — `withRowEdit()`'s slice (D37). They write `open` unconditionally;
 * there is no feature check. On a table composing only `withOptimistic()` this is
 * meaningless-but-not-inert, not a no-op: calling `beginEdit` there populates `open`, which
 * `withOptimistic()` never reads or clears, silently shrinking `pending` (derived as
 * `snapshots` minus `open`) — the signal a live table actually reads. This is a misuse case
 * the types don't prevent, not a supported no-op.
 *
 * The rollback verbs (`captureEdit` / `releaseEdit` / `revertEdit`) live in
 * `optimistic-mutations.ts` and work under either composition.
 */

export interface BeginEditOptions<TRow> {
  /** D42: adds this row to `data` before opening it, so the blank-row-add flow is one call.
   * No-ops if its id is already taken. */
  insert?: NoInfer<TRow>;
  /** `Array.prototype.splice(at, 0, row)` semantics for `insert`, clamped (D27). */
  at?: number;
}

/**
 * D17/D28: opens the row, capturing its current value as the restore point — or, when the id has
 * no entry in `data` yet and `{ insert }` wasn't used (misuse), no snapshot at all.
 *
 * D31.1 needs no branch here: a row that already has a restore point keeps it, whether it is a
 * `pending` row re-opening or a double `beginEdit`. Cancel therefore returns to the true pre-edit
 * state rather than an unconfirmed optimistic one — the oldest restore point wins. Moving one
 * forward is `captureEdit`'s job (D40).
 *
 * **`{ insert }` (D42, superseding D35/D36)** adds the row first, then captures and opens it —
 * the blank-row-add flow without the two-call sequence whose order silently selected Cancel's
 * outcome. The restore point is the row itself, so plain `revertEdit(id)` *resets* the row
 * rather than removing it; removal is composed explicitly at a call site that wants one.
 * D36 established that this is pure ergonomics rather than a separate intent, which is why it is
 * an option here instead of the separate `addNewRow` verb it used to be.
 *
 * Inserting lives on the editing slice, not beside `insertRow`, because only an `EditingUpdater` can
 * write both — a `RowUpdater` returns an array and has no handle on editing state.
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
 * Closes the row, keeping whatever is currently in `data` **and** its restore point — the row
 * becomes `pending`. Save is composed elsewhere (`endEdit(id, partial)` merges and closes in one
 * call, then `releaseEdit`/`revertEdit` settles per the round trip's outcome, per D16/D30).
 *
 * D41 removed the `keepSnapshot` flag: keeping is now the only behavior, and dropping the restore
 * point is `releaseEdit`'s job. A purely local save that has nothing to confirm calls both.
 *
 * `partial`, when given, merges into `data` via `patchEdit` before closing — the same write +
 * close is otherwise always two separate calls a consumer has to remember to pair and order
 * correctly. There's no legitimate case for closing-with-keep *without* merging first (that's
 * what makes this safe to fold in): a close that should discard the edit instead is
 * `revertEdit`/`discardEdit`, a different verb entirely. `patchEdit` itself stays exported
 * separately for its own real use — a background patch on a row that was never open at all
 * (`optimistic-mutations.ts`).
 *
 * Takes a **required** id. A bulk form would close every row while keeping every restore point,
 * leaking all of them into `pending` with nothing left to release them (D44) — bulk teardown is
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
 * from `endEdit` + `releaseEdit` (D44). Spelled as a pair it would close every row first, leaving
 * the release nothing to find, and every row would leak into `pending` forever with no error.
 *
 * Dropping the restore points is the point, not an oversight: closing and leaving them behind
 * would mark each row `pending`, arming a rollback for a save nobody started. Rows already
 * pending are untouched — they are not open (D31.3).
 */
export function clearEdit<TRow>(): EditingUpdater<TRow> {
  return (state) => closeAll(state);
}
