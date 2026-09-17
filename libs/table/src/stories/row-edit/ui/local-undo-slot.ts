import { computed, signal, type Signal } from '@angular/core';
import type { RowId } from '../../../api/types';

/** Snapshot of the last committed field value, restorable via Ctrl+Z/Cmd+Z. */
export interface FieldCommitUndo<TField extends string = string> {
  readonly kind: 'commit';
  readonly id: RowId;
  readonly field: TField;
  readonly previousValue: string;
}

/** Snapshot of a discarded row plus the index it sat at, restorable via Undo/Ctrl+Z. */
export interface RowDiscardUndo<TRow> {
  readonly kind: 'discard';
  readonly row: TRow;
  readonly at: number;
}

export type UndoableAction<TRow, TField extends string = string> =
  | FieldCommitUndo<TField>
  | RowDiscardUndo<TRow>;

export interface LocalUndoSlot<TRow, TField extends string = string> {
  readonly action: Signal<UndoableAction<TRow, TField> | null>;
  readonly label: Signal<string | null>;
  recordCommit(id: RowId, field: TField, previousValue: string): void;
  recordDiscard(row: TRow, at: number): void;
  /** Returns the current action and clears the slot in one step. */
  consume(): UndoableAction<TRow, TField> | null;
}

/** A single-slot undo history — the last field commit or discarded row, whichever happened most
 * recently, overwritten (never merged) by the next `recordCommit`/`recordDiscard`. `describeRow`
 * names the row in the discard label. */
export function createLocalUndoSlot<TRow, TField extends string = string>(
  describeRow: (row: TRow) => string,
): LocalUndoSlot<TRow, TField> {
  const action = signal<UndoableAction<TRow, TField> | null>(null);

  const label = computed(() => {
    const current = action();
    if (current === null) return null;
    return current.kind === 'discard'
      ? `Undo discard of ${describeRow(current.row)}`
      : 'Undo last commit';
  });

  function recordCommit(id: RowId, field: TField, previousValue: string): void {
    action.set({ kind: 'commit', id, field, previousValue });
  }

  function recordDiscard(row: TRow, at: number): void {
    action.set({ kind: 'discard', row, at });
  }

  function consume(): UndoableAction<TRow, TField> | null {
    const current = action();
    action.set(null);
    return current;
  }

  return { action: action.asReadonly(), label, recordCommit, recordDiscard, consume };
}
