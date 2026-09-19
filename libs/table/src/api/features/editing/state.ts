import { computed, signal, type Signal } from '@angular/core';
import { pruneByIds, resolveIndex } from '../../../engine/rows';
import { createWritableView, type WritableView } from '../../../engine/writable-view';
import type { RowId, TableStore, TrackByFn } from '../../types';

// The editing state model — restore-point shape, state shape, updater contract, and the store
// both editing features are built on. Types and factory live together the way
// `engine/writable-view.ts` keeps `WritableView` beside `createWritableView()`: one concern,
// and splitting them would create a cycle with the updater modules that consume both.
//
// Not a feature. Each editing feature builds its own instance — `withRowEdit()` adds the open
// set on top, `withOptimistic()` stops at the restore points. Composing both is a collision,
// not a sharing arrangement.

/**
 * Which CRUD operation armed this restore point. `'delete'` is what `detached` used to mean —
 * captured by a verb that then removed the row, so removal-pruning must not drop it.
 */
export type PendingOp = 'create' | 'update' | 'delete';

/**
 * A row's restore point. Carries its position as well as its value, so `revertEdit` can
 * re-insert a row that was removed, not just replace one still present.
 */
export interface RowRestorePoint<TRow> {
  readonly row: TRow;
  /** Index in `data` at capture time. Read **only** when the row is missing at revert — a row
   * still present is replaced in place, since a sort or another write may have moved it. */
  readonly at: number;
  readonly op: PendingOp;
}

export type RowSnapshot<TRow> = RowRestorePoint<TRow>;

/** Config for `patchEdit` (`optimistic-mutations.ts`). */
export interface PatchEditOptions {
  /** Default `'if-absent'` — oldest restore point wins, matches `beginEdit`. `'always'`
   * overwrites the restore point on every call, matching `captureEdit`. */
  capture?: 'if-absent' | 'always';
}

/** id -> the row's restore point, captured the moment it was first opened/removed/patched
 * without one. One restore point per row; whether that row is currently open is a separate
 * fact. */
export type SnapshotMap<TRow> = ReadonlyMap<RowId, RowSnapshot<TRow>>;

/**
 * What an editing updater reads and writes. Three orthogonal facts, not copies of one another:
 * `snapshots` is *what a rollback restores*, `open` is *which rows show inputs*, `unconfirmed` is
 * *which client ids the server has never acknowledged*. `pending`/`pendingOps` are derived from
 * `snapshots` and `open` together, never stored.
 *
 * Ownership splits without splitting the shape — `withOptimistic()` writes `snapshots` and
 * `unconfirmed`, leaving `open` permanently empty; `withRowEdit()` writes all three.
 */
export interface EditingState<TRow> {
  readonly snapshots: SnapshotMap<TRow>;
  /** Rows currently open. Always a subset of `snapshots`' keys — every updater preserves that,
   * and `pending` (`snapshots` minus `open`) depends on it. */
  readonly open: ReadonlySet<RowId>;
  /** Client ids the server never acknowledged. Outlives a restore point: a failed create's
   * `revertEdit` spends the snapshot, but the row must still POST on retry. */
  readonly unconfirmed: ReadonlySet<RowId>;
}

export interface EditingUpdaterContext<TRow> {
  readonly data: TRow[];
  readonly trackBy: TrackByFn<TRow>;
  /** Restoring/removing a row is one write, not two calls to `table.value.update(...)`. */
  writeData(rows: TRow[]): void;
  /** O(1) id -> index lookup, mirroring `RowUpdaterContext`. Resolved against `data` at read
   * time — stale after a `writeData` earlier in the same updater, which is exactly what
   * `resolveIndex`'s linear-scan fallback exists for. */
  readonly indexById: ReadonlyMap<RowId, number>;
}

export type EditingUpdater<TRow> = (
  state: EditingState<TRow>,
  ctx: EditingUpdaterContext<TRow>
) => EditingState<TRow>;

const NO_IDS: ReadonlySet<RowId> = new Set();
const NO_OPS: ReadonlyMap<RowId, PendingOp> = new Map();

/**
 * Holds a restore point but is no longer open, paired with which operation armed it. Derived
 * rather than stored — this is what makes closing a row a single `open.delete(id)` with no
 * second container to fall out of step with. `pendingIds` is a thin projection of this, so the
 * two can never disagree.
 *
 * On a table composing only `withOptimistic()`, `open` is always empty, so this returns every
 * held restore point — exactly the in-flight set.
 */
export function pendingOps<TRow>(state: EditingState<TRow>): ReadonlyMap<RowId, PendingOp> {
  const ops = new Map<RowId, PendingOp>();
  for (const [id, snapshot] of state.snapshots) {
    if (!state.open.has(id)) {
      ops.set(id, snapshot.op);
    }
  }
  // Shared empty map so the common case (nothing pending) keeps a stable identity and does not
  // invalidate downstream computeds on every open/close. Checked after the scan, not before:
  // a size comparison would depend on `open ⊆ snapshots` holding, and would return a silently
  // wrong answer rather than fail if it ever stopped.
  return ops.size === 0 ? NO_OPS : ops;
}

/** Same in-flight set as `pendingOps`, without the operation — kept for the non-breaking
 * `pending` member shape. */
export function pendingIds<TRow>(state: EditingState<TRow>): ReadonlySet<RowId> {
  const ops = pendingOps(state);
  return ops.size === 0 ? NO_IDS : new Set(ops.keys());
}

/* --- pure helpers over the state shape, shared by both updater modules --- */

export function findRow<TRow>(
  data: TRow[],
  trackBy: TrackByFn<TRow>,
  id: RowId,
  indexById: ReadonlyMap<RowId, number>
): TRow | undefined {
  const at = resolveIndex(data, id, { trackBy, indexById });
  return at === -1 ? undefined : data[at];
}

export function withSnapshot<TRow>(
  snapshots: SnapshotMap<TRow>,
  id: RowId,
  snapshot: RowSnapshot<TRow>
): SnapshotMap<TRow> {
  return new Map(snapshots).set(id, snapshot);
}

export function withoutSnapshot<TRow>(
  snapshots: SnapshotMap<TRow>,
  id: RowId
): SnapshotMap<TRow> {
  const next = new Map(snapshots);
  next.delete(id);
  return next;
}

export function withOpen(open: ReadonlySet<RowId>, id: RowId): ReadonlySet<RowId> {
  return new Set(open).add(id);
}

export function withoutOpen(open: ReadonlySet<RowId>, id: RowId): ReadonlySet<RowId> {
  const next = new Set(open);
  next.delete(id);
  return next;
}

export function withUnconfirmed(unconfirmed: ReadonlySet<RowId>, id: RowId): ReadonlySet<RowId> {
  return new Set(unconfirmed).add(id);
}

export function withoutUnconfirmed(unconfirmed: ReadonlySet<RowId>, id: RowId): ReadonlySet<RowId> {
  const next = new Set(unconfirmed);
  next.delete(id);
  return next;
}

/**
 * Closes every open row, dropping their restore points — no survivor chosen. Shared by
 * `clearEdit()` (explicit "Cancel all") and `withRowEdit()`'s mode-flip `true` -> `false`
 * reaction, which must NOT reuse `closeAllButLast`'s keep-the-last-one behavior: nobody asked
 * for a specific row to survive a flip, so keeping one would be arbitrary (design doc,
 * `docs/1-state/work/with-multiple-edit/1-design.md`). Rows already `pending` are untouched.
 */
export function closeAll<TRow>(state: EditingState<TRow>): EditingState<TRow> {
  if (state.open.size === 0) {
    return state;
  }
  const snapshots = new Map(state.snapshots);
  for (const id of state.open) {
    snapshots.delete(id);
  }
  return { ...state, snapshots, open: new Set() };
}

export interface EditingStoreOptions<TRow> {
  /** Runs on every write before it lands, so a feature can enforce an invariant the updaters
   * know nothing about. `withRowEdit()` uses it for the single-mode trim; `withOptimistic()`
   * passes nothing. */
  onWrite?: (next: EditingState<TRow>) => EditingState<TRow>;
}

/** The store slice the editing store reads and writes through. */
export type EditingStoreInput<TRow> = Pick<TableStore<TRow>, 'value' | 'trackBy' | 'indexById'>;

export interface EditingStore<TRow> {
  readonly state: Signal<EditingState<TRow>>;
  readonly editing: WritableView<ReadonlySet<RowId>, EditingUpdater<TRow>>;
  readonly pending: Signal<ReadonlySet<RowId>>;
  readonly pendingOps: Signal<ReadonlyMap<RowId, PendingOp>>;
  readonly unconfirmed: Signal<ReadonlySet<RowId>>;
  /** Writes state through `onWrite`. Exposed so a feature can re-apply the current state when
   * its own config changes, not just when an updater runs. */
  apply(next: EditingState<TRow>): void;
  /** Prunes `snapshots` (keeping `op: 'delete'` restore points), `open`, and `unconfirmed`
   * (same exemption — a row mid-delete-rollback is still unconfirmed). */
  onRowsRemoved(ids: readonly RowId[]): void;
}

export function createEditingStore<TRow>(
  input: EditingStoreInput<TRow>,
  options: EditingStoreOptions<TRow> = {}
): EditingStore<TRow> {
  // One signal over all three facts: `pending` is derived from them together, so it can never
  // read a half-applied write.
  const state = signal<EditingState<TRow>>({
    snapshots: new Map(),
    open: new Set(),
    unconfirmed: new Set(),
  });

  function apply(next: EditingState<TRow>): void {
    state.set(options.onWrite ? options.onWrite(next) : next);
  }

  const editing = createWritableView<ReadonlySet<RowId>, EditingUpdater<TRow>>(
    () => state().open,
    (updater) =>
      apply(
        updater(state(), {
          data: input.value(),
          trackBy: input.trackBy,
          writeData: (rows) => input.value.update(() => rows),
          indexById: input.indexById(),
        })
      )
  );

  // An id that leaves `data` must leave `open` (nothing left to show inputs for), `snapshots`
  // (nothing left to restore), and `unconfirmed` (nothing left to retry) — `pending` needs no
  // pruning of its own, since it is derived from the other two, not stored. `open` is pruned
  // independently of `snapshots`: `pendingIds()` treats "has a snapshot but isn't open" as
  // pending, so leaving a removed id in `open` would surface it as newly pending. A restore
  // point whose `op` is `'delete'` is exempt — it was captured by a verb (`removeEdit`) that
  // deliberately took the row out of `data`, so pruning it here would erase the rollback the
  // verb exists to provide. `unconfirmed` shares that exemption: a row mid delete-rollback
  // still needs its retry-on-revert identity.
  function onRowsRemoved(ids: readonly RowId[]): void {
    const current = state();
    const nextOpen = pruneByIds(current.open, ids);
    const nextSnapshots = pruneByIds(current.snapshots, ids, (value) => value.op === 'delete');
    const nextUnconfirmed = pruneByIds(
      current.unconfirmed,
      ids,
      (id) => nextSnapshots.get(id)?.op === 'delete'
    );
    if (
      nextOpen !== current.open ||
      nextSnapshots !== current.snapshots ||
      nextUnconfirmed !== current.unconfirmed
    ) {
      apply({ open: nextOpen, snapshots: nextSnapshots, unconfirmed: nextUnconfirmed });
    }
  }

  return {
    state: state.asReadonly(),
    editing,
    pending: computed(() => pendingIds(state())),
    pendingOps: computed(() => pendingOps(state())),
    unconfirmed: computed(() => state().unconfirmed),
    apply,
    onRowsRemoved,
  };
}
