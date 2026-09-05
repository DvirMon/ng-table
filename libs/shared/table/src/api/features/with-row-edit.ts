import { computed, effect, signal, type WritableSignal } from '@angular/core';
import type { TableCore, TableFeatureSpec } from '../../engine/types';
import { createDraftRows } from './draft-rows';
import { closeAll, createEditingStore, type EditingState } from './editing-state';
import type { OptimisticMembers } from './with-optimistic';

export interface WithRowEditConfig {
  /** Default `false`: a second `beginEdit` closes whatever row was already open. Accepts a
   * plain accessor (`() => boolean`, e.g. `() => isWide()`) to react live — no need to write
   * `computed()` yourself, this feature wraps it. Toggling `true` -> `false` while N rows are
   * open closes all of them, no survivor chosen — same shape as `clearEdit()`, not
   * `closeAllButLast`'s keep-the-last-one. A `Signal<boolean>` works too since a signal is
   * itself callable as `() => boolean`. */
  multiple?: boolean | (() => boolean);
}

/**
 * Adds `draft` to `withOptimistic()`'s members — the edit session contributes `open`, which is
 * read through the same `editing` view, plus the draft-rows signal (`createDraftRows`) that
 * holds the gated commit boundary. One door either way for `editing`/`pending`; `draft` is this
 * feature's own, since it has no meaning without an edit session to gate.
 */
export type RowEditMembers<TRow> = OptimisticMembers<TRow> & {
  /** Build `form(table.draft, schema)` against this instead of `table.value` — see
   * `createDraftRows`. */
  readonly draft: WritableSignal<TRow[]>;
};

/**
 * Single mode: keeps only the most recently opened row. The rows it displaces are closed the way
 * `endEdit` does — their restore points go with them, and a displaced row's unsaved `draft` is
 * discarded rather than kept.
 *
 * Open product question whether that's the intended outcome — see G13/O26 in
 * `docs/1-state/work/with-row-editing/5-gaps.md`.
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
 * Edit-session tracking for a `createTable()` — which rows are currently open for editing, on
 * top of the restore points `withOptimistic()` owns.
 *
 * Mode gate only: claims no pipeline stage and no render stage. The consumer's own
 * `form(table.draft, schema)` owns the actual field values; this feature tracks which rows show
 * the form's inputs, and derives the draft signal `form()` should be built over instead of
 * `table.value` directly.
 *
 * **Composes `withOptimistic()` internally** — by calling its factory directly rather than
 * reading the `composed` seam, so composition never depends on `features` array order. Listing
 * both in `features` throws at construction (ADR-0007): they claim the same members.
 *
 * An always-editable table does not compose this — its session is delimited by focus, which
 * opens nothing, so it composes `withOptimistic()` alone.
 *
 * `{ multiple: true }` is optimistic-only (see `with-multiple-edit/1-design.md`): a save must
 * close its row via `endEdit` before firing, so an in-flight save is always `pending`, never
 * `open` — bulk close (`clearEdit()`, the single-mode trim) only ever touches `open` rows and so
 * can never discard a live restore point. Pessimistic save (row stays open through the round
 * trip) is unsupported under `multiple: true` for exactly that reason: a bulk close while an
 * open row is mid-save would silently drop its restore point.
 */
export function withRowEdit<TRow = unknown>(
  config: WithRowEditConfig = {}
): (core: TableCore<TRow>) => TableFeatureSpec<TRow, RowEditMembers<TRow>> {
  const multiple =
    typeof config.multiple === 'function'
      ? computed(config.multiple)
      : signal(config.multiple ?? false);

  return (core: TableCore<TRow>): TableFeatureSpec<TRow, RowEditMembers<TRow>> => {
    // Enforces single-mode's "closes whatever was open" without any updater (beginEdit, etc.)
    // needing to know about `multiple` — every write funnels through here.
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
