import { computed, effect, signal } from '@angular/core';
import type { TableCore, TableFeatureSpec } from '../../engine/types';
import { createEditingStore, type EditingState } from './editing-state';
import type { OptimisticMembers } from './with-optimistic';

export interface WithRowEditConfig {
  /** Default `false` (D14): a second `beginEdit` closes whatever row was already open.
   * Accepts a plain accessor (`() => boolean`, e.g. `() => isWide()`) to react live — no need
   * to write `computed()` yourself, this feature wraps it. Toggling `true` -> `false` while N
   * rows are open collapses down to the most-recently-opened one, same as `closeAllButLast` on
   * write. A `Signal<boolean>` works too since a signal is itself callable as `() => boolean`. */
  multiple?: boolean | (() => boolean);
}

/**
 * Adds nothing to `withOptimistic()`'s members — the edit session contributes `open`, which is
 * read through the same `editing` view (D37). One door either way.
 */
export type RowEditMembers<TRow> = OptimisticMembers<TRow>;

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
 * Edit-session tracking (F2b) for a `createTable()` — which rows are currently open for editing,
 * on top of the restore points `withOptimistic()` owns.
 *
 * Mode gate only: claims no pipeline stage and no `renderRows` slot (D10, `4-increments.md` E3).
 * The consumer's own `form(data)` (D22) owns the actual field values; this feature only tracks
 * which rows show the form's inputs.
 *
 * **Composes `withOptimistic()` internally** (D37) — by calling its factory directly rather than
 * reading the `composed` seam, so composition never depends on `features` array order. Listing
 * both in `features` throws at construction (ADR-0007): they claim the same members.
 *
 * An always-editable table does not compose this (D29/D39). Its session is delimited by focus,
 * which opens nothing — it composes `withOptimistic()` alone.
 *
 * `{ multiple: true }` combined with optimistic save is undesigned — N open rows × M in-flight
 * saves — and unsupported until someone specs it (D31.2, G4).
 */
export function withRowEdit<TRow = unknown>(config: WithRowEditConfig = {}) {
  const multiple =
    typeof config.multiple === 'function'
      ? computed(config.multiple)
      : signal(config.multiple ?? false);

  return (core: TableCore<TRow>): TableFeatureSpec<TRow, RowEditMembers<TRow>> => {
    // Enforces D14's single-mode "closes whatever was open" without any updater (beginEdit,
    // etc.) needing to know about `multiple` — every write funnels through here.
    function enforceSingleMode(next: EditingState<TRow>): EditingState<TRow> {
      const exceedsSingleMode = !multiple() && next.open.size > 1;
      return exceedsSingleMode ? closeAllButLast(next) : next;
    }

    const store = createEditingStore<TRow>(core, { onWrite: enforceSingleMode });

    // Collapses to D14's single-mode automatically when `multiple` flips false live, not just
    // on the next `editing.update()` — otherwise a signal-backed `multiple` would silently lag
    // the config it's supposed to track. No-ops once collapsed (re-reads `state()` on any
    // change, but the write is idempotent once `open.size <= 1`).
    function onMultipleChanged(): void {
      if (!multiple() && store.state().open.size > 1) {
        store.apply(store.state());
      }
    }

    return {
      members: { editing: store.editing, pending: store.pending },
      onRowsRemoved: store.onRowsRemoved,
      onInit: () => effect(onMultipleChanged),
    } as TableFeatureSpec<TRow, RowEditMembers<TRow>>;
  };
}
