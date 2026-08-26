import { computed, effect, signal, type Signal } from '@angular/core';
import { pruneByIds } from '../../engine/rows';
import type { TableCore, TableFeatureSpec } from '../../engine/types';
import { createWritableView, type WritableView } from '../../engine/writable-view';
import type { EditingState, EditingUpdater } from '../row-edit-mutations';
import type { RowId } from '../types';

/** Sentinel snapshot value: the row did not exist in `data` when `beginEdit` captured it
 * (D28) — the blank-row-add flow. `revertEdit` reads this to remove the row instead of
 * restoring a value. */
export const ABSENT = Symbol('row-edit-absent');

export type RowSnapshot<TRow> = TRow | typeof ABSENT;

/** id -> the row's value at the moment `beginEdit` first captured it (D17), or `ABSENT` (D28).
 * One restore point per row; whether that row is currently open is a separate fact. */
export type SnapshotMap<TRow> = ReadonlyMap<RowId, RowSnapshot<TRow>>;

export interface WithRowEditConfig {
  /** Default `false` (D14): a second `beginEdit` closes whatever row was already open.
   * Accepts a plain accessor (`() => boolean`, e.g. `() => isWide()`) to react live — no need
   * to write `computed()` yourself, this feature wraps it. Toggling `true` -> `false` while N
   * rows are open collapses down to the most-recently-opened one, same as `closeAllButLast` on
   * write. A `Signal<boolean>` works too since a signal is itself callable as `() => boolean`. */
  multiple?: boolean | (() => boolean);
}

export interface RowEditMembers<TRow> {
  /** Read: which rows are open for editing. Write: `.update(updater)` (D30) — e.g.
   * `table.editing.update(beginEdit(id))`. Every updater, including the ones that only touch
   * restore points, is applied through this one view. */
  readonly editing: WritableView<ReadonlySet<RowId>, EditingUpdater<TRow>>;
  /** D31: rows closed by `endEdit(id, { keepSnapshot: true })` — visually done, still
   * rollback-able while an optimistic save is in flight. Derived from the state, so a row can
   * never be open and pending at once. */
  readonly pending: Signal<ReadonlySet<RowId>>;
}

const NO_IDS: ReadonlySet<RowId> = new Set();

/**
 * D31: holds a restore point but is no longer open. Derived rather than stored — this is what
 * makes `endEdit`'s "move to pending" a single `open.delete(id)` with no second container to
 * fall out of step with (D31.5).
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

/**
 * Single mode (D14): keeps only the most recently opened row. The rows it displaces are closed
 * the way `endEdit` does — their restore points go with them, since under D24 whatever the user
 * typed was already committed on blur and keeping it is the unsurprising outcome (D31.2).
 */
function closeAllButLast<TRow>(state: EditingState<TRow>): EditingState<TRow> {
  const ids = [...state.open];
  const snapshots = new Map(state.snapshots);
  for (const displaced of ids.slice(0, -1)) {
    snapshots.delete(displaced);
  }
  return { snapshots, open: new Set(ids.slice(-1)) };
}

/**
 * Adds button-triggered edit-mode tracking (F2b) to a `createTable()` — which rows are
 * currently open for editing, plus their pre-edit restore points for `revertEdit` (D17/D28).
 * Mode gate only: claims no pipeline stage and no `renderRows` slot (D10, `4-increments.md`
 * E3). The consumer's own `form(data)` (D22) owns the actual field values; this feature only
 * tracks which rows show the form's inputs.
 *
 * `{ multiple: true }` combined with optimistic save (D31) is undesigned — N open rows × M
 * in-flight saves — and unsupported until someone specs it (D31.2).
 */
export function withRowEdit<TRow = unknown>(config: WithRowEditConfig = {}) {
  const multiple =
    typeof config.multiple === 'function' ? computed(config.multiple) : signal(config.multiple ?? false);

  return (core: TableCore<TRow>): TableFeatureSpec<TRow, RowEditMembers<TRow>> => {
    // One signal over both facts: `pending` is derived from them together, so it can never
    // read a half-applied write (D31.5).
    const state = signal<EditingState<TRow>>({ snapshots: new Map(), open: new Set() });

    // Enforces D14's single-mode "closes whatever was open" without any updater (beginEdit,
    // etc.) needing to know about `multiple` — every write funnels through here.
    function applyEditingState(next: EditingState<TRow>): void {
      const exceedsSingleMode = !multiple() && next.open.size > 1;
      state.set(exceedsSingleMode ? closeAllButLast(next) : next);
    }

    const members = {
      editing: createWritableView<ReadonlySet<RowId>, EditingUpdater<TRow>>(
        () => state().open,
        (updater) =>
          applyEditingState(
            updater(state(), {
              data: core.value(),
              trackBy: core.trackBy,
              writeData: (rows) => core.value.update(() => rows),
            })
          )
      ),
      pending: computed(() => pendingIds(state())),
    };

    // ADR-0006: an id that leaves `data` must leave both `open` (nothing left to show inputs
    // for) and `snapshots` (nothing left to restore) — `pending` needs no pruning of its own,
    // since it is derived from the other two, not stored. `open` is pruned independently of
    // `snapshots`: `pendingIds()` treats "has a snapshot but isn't open" as pending, so leaving
    // a removed id in `open` would surface it as newly pending. `ABSENT` snapshots (D28) are
    // exempt — they were never backed by a row in `data` to begin with.
    function onRowsRemoved(ids: readonly RowId[]): void {
      const current = state();
      const nextOpen = pruneByIds(current.open, ids);
      const nextSnapshots = pruneByIds(current.snapshots, ids, (value) => value === ABSENT);
      if (nextOpen !== current.open || nextSnapshots !== current.snapshots) {
        applyEditingState({ open: nextOpen, snapshots: nextSnapshots });
      }
    }

    // Collapses to D14's single-mode automatically when `multiple` flips false live, not just
    // on the next `editing.update()` — otherwise a signal-backed `multiple` would silently lag
    // the config it's supposed to track. No-ops once collapsed (re-reads `state()` on any
    // change, but `applyEditingState` is idempotent once `open.size <= 1`).
    function onMultipleChanged(): void {
      if (!multiple() && state().open.size > 1) {
        applyEditingState(state());
      }
    }

    return {
      members,
      onRowsRemoved,
      onInit: () => effect(onMultipleChanged),
    } as TableFeatureSpec<TRow, RowEditMembers<TRow>>;
  };
}
