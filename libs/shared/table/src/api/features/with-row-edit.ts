import { signal, type Signal } from '@angular/core';
import type { TableFeatureSpec } from '../../engine/types';
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
  readonly editing: Signal<EditingMap<TRow>>;
}

/**
 * Internal write surface `row-edit-mutations.ts` reaches via a typed cast — the same trick
 * `TableCore.data`/`baseColumns` use to recover write access `RowEditMembers` intentionally
 * hides. Not part of the public contract; never assigned to publicly on `TableStore`.
 */
export interface RowEditWritable<TRow> {
  applyEditing(next: EditingMap<TRow>): void;
}

/**
 * Adds button-triggered edit-mode tracking (F2b) to a `createTable()` — which rows are
 * currently open for editing, plus their pre-edit snapshots for `revertEdit` (D17/D28). Mode
 * gate only: claims no pipeline stage and no `renderRows` slot (D10, `4-increments.md` E3).
 * The consumer's own `form(data)` (D22) owns the actual field values; this feature only
 * tracks which rows show the form's inputs.
 */
export function withRowEdit<TRow = unknown>(config: WithRowEditConfig = {}) {
  const multiple = config.multiple ?? false;

  return (): TableFeatureSpec<TRow, RowEditMembers<TRow>> => {
    const editing = signal<EditingMap<TRow>>(new Map());

    // Enforces D14's single-mode "closes whatever was open" without any updater (beginEdit,
    // etc.) needing to know about `multiple` — every write funnels through here.
    function applyEditing(next: EditingMap<TRow>): void {
      if (!multiple && next.size > 1) {
        const lastEntry = [...next].at(-1) as [RowId, RowSnapshot<TRow>];
        editing.set(new Map([lastEntry]));
        return;
      }
      editing.set(next);
    }

    const members = {
      editing: editing.asReadonly(),
      applyEditing,
    };

    return { members } as TableFeatureSpec<TRow, RowEditMembers<TRow>>;
  };
}
