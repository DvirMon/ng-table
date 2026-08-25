import { computed, signal, type Signal } from '@angular/core';
import type { TableCore, TableFeatureSpec } from '../../engine/types';
import { createWritableView, type WritableView } from '../../engine/writable-view';
import type { EditingState, EditingUpdater } from '../row-edit-mutations';
import type { RowId } from '../types';

/** Sentinel snapshot value: the row did not exist in `data` when `beginEdit` captured it
 * (D28) — the blank-row-add flow. `revertEdit` reads this to remove the row instead of
 * restoring a value. */
export const ABSENT = Symbol('row-edit-absent');

export type RowSnapshot<TRow> = TRow | typeof ABSENT;

/** id -> the row's value at the moment `beginEdit` was called (D17), or `ABSENT` (D28). */
export type EditingMap<TRow> = ReadonlyMap<RowId, RowSnapshot<TRow>>;

export interface WithRowEditConfig {
  /** Default `false` (D14): a second `beginEdit` closes whatever row was already open. */
  multiple?: boolean;
}

export interface RowEditMembers<TRow> {
  /** Read: which rows are open for editing, id to pre-edit snapshot. Write:
   * `.update(updater)` (D30) — e.g. `table.editing.update(beginEdit(id))`. Every updater,
   * including the ones that only touch `pending`, is applied through this one view. */
  readonly editing: WritableView<EditingMap<TRow>, EditingUpdater<TRow>>;
  /** D31: rows closed by `endEdit(id, { keepSnapshot: true })` — visually done, still
   * rollback-able while an optimistic save is in flight. Read-only: it is written by the same
   * updaters `editing.update(...)` applies. */
  readonly pending: Signal<EditingMap<TRow>>;
}

/** Keeps only the most recently inserted entry — the row `beginEdit` just opened. */
function keepLastEntry<TRow>(editing: EditingMap<TRow>): EditingMap<TRow> {
  return new Map([...editing].slice(-1));
}

/**
 * Adds button-triggered edit-mode tracking (F2b) to a `createTable()` — which rows are
 * currently open for editing, plus their pre-edit snapshots for `revertEdit` (D17/D28). Mode
 * gate only: claims no pipeline stage and no `renderRows` slot (D10, `4-increments.md` E3).
 * The consumer's own `form(data)` (D22) owns the actual field values; this feature only
 * tracks which rows show the form's inputs.
 *
 * `{ multiple: true }` combined with optimistic save (D31) is undesigned — N open rows × M
 * in-flight saves — and unsupported until someone specs it (D31.2).
 */
export function withRowEdit<TRow = unknown>(config: WithRowEditConfig = {}) {
  const multiple = config.multiple ?? false;

  return (core: TableCore<TRow>): TableFeatureSpec<TRow, RowEditMembers<TRow>> => {
    // One signal, not two: an entry moving between the maps (D31) is then a single write and
    // they cannot drift.
    const state = signal<EditingState<TRow>>({ editing: new Map(), pending: new Map() });

    // Enforces D14's single-mode "closes whatever was open" without any updater (beginEdit,
    // etc.) needing to know about `multiple` — every write funnels through here. Closing the
    // displaced row drops its snapshot, the way `endEdit` does: under D24 the user's typing
    // was already committed on blur, so keeping it is the unsurprising outcome (D31.2).
    function applyEditingState(next: EditingState<TRow>): void {
      const exceedsSingleMode = !multiple && next.editing.size > 1;
      state.set(exceedsSingleMode ? { ...next, editing: keepLastEntry(next.editing) } : next);
    }

    const members = {
      editing: createWritableView<EditingMap<TRow>, EditingUpdater<TRow>>(
        () => state().editing,
        (updater) =>
          applyEditingState(
            updater(state(), {
              data: core.value(),
              trackBy: core.trackBy,
              writeData: (rows) => core.value.update(() => rows),
            })
          )
      ),
      pending: computed(() => state().pending),
    };

    return { members } as TableFeatureSpec<TRow, RowEditMembers<TRow>>;
  };
}
