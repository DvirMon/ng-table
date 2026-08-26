import { computed, signal, type Signal } from '@angular/core';
import { pruneByIds } from '../../engine/rows';
import type { TableCore } from '../../engine/types';
import { createWritableView, type WritableView } from '../../engine/writable-view';
import type { RowId, TrackByFn } from '../types';

/**
 * The editing state model — the sentinel, the state shape, the updater contract, and the store
 * both editing features are built on. Types and factory live together the way
 * `engine/writable-view.ts` keeps `WritableView` beside `createWritableView()`: they are one
 * concern, and splitting them would put a value import (`ABSENT`) in a `.types.ts` file and
 * create a cycle with the updater modules that consume both.
 *
 * Not a feature. `withOptimistic()` and `withRowEdit()` each call `createEditingStore()`
 * themselves (D37) — neither reads the other's signal, and composition stays independent of
 * `features` array order.
 */

/** Sentinel snapshot value: the row did not exist in `data` when it was captured (D28) — the
 * blank-row-add flow. `revertEdit` reads this to remove the row instead of restoring a value. */
export const ABSENT = Symbol('row-edit-absent');

export type RowSnapshot<TRow> = TRow | typeof ABSENT;

/** id -> the row's value at the moment it was first captured (D17), or `ABSENT` (D28).
 * One restore point per row; whether that row is currently open is a separate fact. */
export type SnapshotMap<TRow> = ReadonlyMap<RowId, RowSnapshot<TRow>>;

/**
 * What an editing updater reads and writes (D31.5). Two orthogonal facts, not two copies of
 * one: `snapshots` is *what a rollback restores*, `open` is *which rows show inputs*. `pending`
 * is derived from the pair, never stored.
 *
 * D37 splits ownership without splitting the shape — `withOptimistic()` writes `snapshots` and
 * leaves `open` permanently empty; `withRowEdit()` writes both.
 */
export interface EditingState<TRow> {
  readonly snapshots: SnapshotMap<TRow>;
  /** Rows currently open. Always a subset of `snapshots`' keys — every updater preserves that,
   * and `pending` (`snapshots` minus `open`) depends on it. */
  readonly open: ReadonlySet<RowId>;
}

export interface EditingUpdaterContext<TRow> {
  readonly data: TRow[];
  readonly trackBy: TrackByFn<TRow>;
  /** Restoring/removing a row is one write, not two calls to `table.value.update(...)` (D30). */
  writeData(rows: TRow[]): void;
}

export type EditingUpdater<TRow> = (
  state: EditingState<TRow>,
  ctx: EditingUpdaterContext<TRow>
) => EditingState<TRow>;

const NO_IDS: ReadonlySet<RowId> = new Set();

/**
 * D31: holds a restore point but is no longer open. Derived rather than stored — this is what
 * makes closing a row a single `open.delete(id)` with no second container to fall out of step
 * with (D31.5).
 *
 * On a table composing only `withOptimistic()`, `open` is always empty, so this returns every
 * held restore point — exactly the in-flight set.
 */
export function pendingIds<TRow>(state: EditingState<TRow>): ReadonlySet<RowId> {
  const ids = new Set<RowId>();
  for (const id of state.snapshots.keys()) {
    if (!state.open.has(id)) {
      ids.add(id);
    }
  }
  // Shared empty set so the common case (nothing pending) keeps a stable identity and does not
  // invalidate downstream computeds on every open/close. Checked after the scan, not before:
  // a size comparison would depend on `open ⊆ snapshots` holding, and would return a silently
  // wrong answer rather than fail if it ever stopped.
  return ids.size === 0 ? NO_IDS : ids;
}

/* --- pure helpers over the state shape, shared by both updater modules --- */

export function findRow<TRow>(
  data: TRow[],
  trackBy: TrackByFn<TRow>,
  id: RowId
): TRow | undefined {
  return data.find((row) => trackBy(row) === id);
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

export interface EditingStoreOptions<TRow> {
  /** Runs on every write before it lands, so a feature can enforce an invariant the updaters
   * know nothing about. `withRowEdit()` uses it for D14's single-mode trim; `withOptimistic()`
   * passes nothing. */
  onWrite?: (next: EditingState<TRow>) => EditingState<TRow>;
}

export interface EditingStore<TRow> {
  readonly state: Signal<EditingState<TRow>>;
  readonly editing: WritableView<ReadonlySet<RowId>, EditingUpdater<TRow>>;
  readonly pending: Signal<ReadonlySet<RowId>>;
  /** Writes state through `onWrite`. Exposed so a feature can re-apply the current state when
   * its own config changes, not just when an updater runs. */
  apply(next: EditingState<TRow>): void;
  /** ADR-0006. Prunes `snapshots` (keeping `ABSENT`) and `open`. */
  onRowsRemoved(ids: readonly RowId[]): void;
}

export function createEditingStore<TRow>(
  core: TableCore<TRow>,
  options: EditingStoreOptions<TRow> = {}
): EditingStore<TRow> {
  // One signal over both facts: `pending` is derived from them together, so it can never read a
  // half-applied write (D31.5).
  const state = signal<EditingState<TRow>>({ snapshots: new Map(), open: new Set() });

  function apply(next: EditingState<TRow>): void {
    state.set(options.onWrite ? options.onWrite(next) : next);
  }

  const editing = createWritableView<ReadonlySet<RowId>, EditingUpdater<TRow>>(
    () => state().open,
    (updater) =>
      apply(
        updater(state(), {
          data: core.value(),
          trackBy: core.trackBy,
          writeData: (rows) => core.value.update(() => rows),
        })
      )
  );

  // ADR-0006: an id that leaves `data` must leave both `open` (nothing left to show inputs for)
  // and `snapshots` (nothing left to restore) — `pending` needs no pruning of its own, since it
  // is derived from the other two, not stored. `open` is pruned independently of `snapshots`:
  // `pendingIds()` treats "has a snapshot but isn't open" as pending, so leaving a removed id in
  // `open` would surface it as newly pending. `ABSENT` snapshots (D28) are exempt — they were
  // never backed by a row in `data` to begin with.
  function onRowsRemoved(ids: readonly RowId[]): void {
    const current = state();
    const nextOpen = pruneByIds(current.open, ids);
    const nextSnapshots = pruneByIds(current.snapshots, ids, (value) => value === ABSENT);
    if (nextOpen !== current.open || nextSnapshots !== current.snapshots) {
      apply({ open: nextOpen, snapshots: nextSnapshots });
    }
  }

  return {
    state: state.asReadonly(),
    editing,
    pending: computed(() => pendingIds(state())),
    apply,
    onRowsRemoved,
  };
}
