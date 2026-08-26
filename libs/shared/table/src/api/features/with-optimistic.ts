import type { Signal } from '@angular/core';
import type { TableCore, TableFeatureSpec } from '../../engine/types';
import type { RowId } from '../types';
import { createEditingStore, type EditingUpdater } from './editing-state';
import type { WritableView } from '../../engine/writable-view';

export interface OptimisticMembers<TRow> {
  /** Read: which rows are open for editing — **always empty** unless `withRowEdit()` is composed,
   * since nothing else opens a row. Write: `.update(updater)` (D30), e.g.
   * `table.editing.update(captureEdit(id))`. Every updater, including the ones that only touch
   * restore points, is applied through this one view. */
  readonly editing: WritableView<ReadonlySet<RowId>, EditingUpdater<TRow>>;
  /** D31: rows holding a restore point that is not open — an optimistic save in flight. Derived
   * from the state, so a row can never be open and pending at once. On a live table this is every
   * held restore point, which is exactly the in-flight set. */
  readonly pending: Signal<ReadonlySet<RowId>>;
}

/**
 * Restore points around writes that can fail: capture before the write, release when the server
 * confirms, revert when it rejects.
 *
 * Composed on its own by an **always-editable** table (D39), whose edit session is delimited by
 * focus rather than by a button — there is nothing to open, so it needs no edit session at all:
 *
 * ```ts
 * onFocus: table.editing.update(captureEdit(id));
 * onBlur:  table.value.update(patchRow(id, partial));
 * server:  ok ? releaseEdit(id) : revertEdit(id);
 * ```
 *
 * `withRowEdit()` composes the same state for gated tables and adds the open set on top; listing
 * both in `features` throws at construction (ADR-0007).
 *
 * **Scope — update and create only, never delete or move (D38, G5).** A restore point holds a
 * *value*, never an index: `revertEdit` replaces in place and cannot re-insert a removed row, and
 * a moved row's position is not part of a snapshot. Optimistic create works because its restore
 * point is `ABSENT`, so rolling back removes the row. Covering delete/move needs an
 * inverse-operation representation this library does not have — the open half of O22.
 */
export function withOptimistic<TRow = unknown>() {
  return (core: TableCore<TRow>): TableFeatureSpec<TRow, OptimisticMembers<TRow>> => {
    const store = createEditingStore<TRow>(core);

    return {
      members: { editing: store.editing, pending: store.pending },
      onRowsRemoved: store.onRowsRemoved,
    } as TableFeatureSpec<TRow, OptimisticMembers<TRow>>;
  };
}
