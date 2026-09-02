import { computed, effect, signal, type WritableSignal } from '@angular/core';
import type { TableCore, TableFeatureSpec } from '../../engine/types';
import { createDraftRows } from './draft-rows';
import { closeAll, createEditingStore, type EditingState } from './editing-state';
import type { OptimisticMembers } from './with-optimistic';

export interface WithRowEditConfig {
  /** Default `false` (D14): a second `beginEdit` closes whatever row was already open.
   * Accepts a plain accessor (`() => boolean`, e.g. `() => isWide()`) to react live — no need
   * to write `computed()` yourself, this feature wraps it. Toggling `true` -> `false` while N
   * rows are open closes all of them, no survivor chosen (nobody asked for a specific row to
   * stay open) — same shape as `clearEdit()`, not `closeAllButLast`'s keep-the-last-one. A
   * `Signal<boolean>` works too since a signal is itself callable as `() => boolean`. */
  multiple?: boolean | (() => boolean);
}

/**
 * Adds `draft` to `withOptimistic()`'s members — the edit session contributes `open`, which is
 * read through the same `editing` view (D37), plus the draft-rows signal (`createDraftRows`)
 * that holds the gated commit boundary. One door either way for `editing`/`pending`; `draft` is
 * this feature's own, since it has no meaning without an edit session to gate.
 */
export type RowEditMembers<TRow> = OptimisticMembers<TRow> & {
  /** Build `form(table.draft, schema)` against this instead of `table.value` — see
   * `createDraftRows`. */
  readonly draft: WritableSignal<TRow[]>;
};

/**
 * Single mode (D14): keeps only the most recently opened row. The rows it displaces are closed
 * the way `endEdit` does — their restore points go with them.
 *
 * D31.2's original reasoning ("whatever the user typed was already committed on blur, keeping it
 * is the unsurprising outcome") no longer holds now that `draft` gates the commit boundary
 * (blur no longer writes `data` in gated mode) — a displaced row's typed-but-unsaved edit is
 * discarded, not kept, since its `draft` entry re-derives from `data` the moment it's no longer
 * open. Flagging as a real behavior change from what D31.2 decided, not just a stale comment —
 * needs a product call on whether that's still the intended single-mode outcome.
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
 * The consumer's own `form(table.draft, schema)` (D22, superseded by `draft`'s commit-boundary
 * fix — see `RowEditMembers`) owns the actual field values; this feature tracks which rows show
 * the form's inputs, and derives the draft signal `form()` should be built over instead of
 * `table.value` directly.
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
export function withRowEdit<TRow = unknown>(
  config: WithRowEditConfig = {}
): (core: TableCore<TRow>) => TableFeatureSpec<TRow, RowEditMembers<TRow>> {
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
    const draft = createDraftRows(core.value, store.editing, core.trackBy, core.indexById);

    // Reacts to `multiple` flipping false live, not just on the next `editing.update()` —
    // otherwise a signal-backed `multiple` would silently lag the config it's supposed to
    // track. A single open row is already valid under single mode, so this only fires above
    // that; when it does, it closes every open row with no survivor (`closeAll`, not
    // `closeAllButLast`): a mode flip is nobody's request for a specific row to stay open,
    // unlike the on-write single-mode trim `enforceSingleMode` still performs for `beginEdit`.
    // No-ops once collapsed — re-reads `state()` on any change, but idempotent once
    // `open.size <= 1`.
    function onMultipleChanged(): void {
      const exceedsSingleMode = !multiple() && store.state().open.size > 1;
      if (exceedsSingleMode) {
        store.apply(closeAll(store.state()));
      }
    }

    return {
      members: { editing: store.editing, pending: store.pending, draft },
      onRowsRemoved: store.onRowsRemoved,
      setup: () => effect(onMultipleChanged),
    };
  };
}
