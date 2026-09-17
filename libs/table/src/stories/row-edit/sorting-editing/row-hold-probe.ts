import { computed, signal, type Signal } from '@angular/core';
import type { RenderRow, RowId } from '../../../api/types';
import type { RowHoldViolation, SortEditRow } from './sorting-editing.types';

/**
 * S-1 regression probe (OQ-3, not implemented): tracks each currently-open row's render
 * position at `record()` time and compares it against its live position on every read of
 * `movedRow`. A mismatch means the row moved while still open — expected to fire today the
 * moment a sorted column's value commits (`sorting-editing-story-host.component.ts`).
 */
export interface RowHoldProbe {
  readonly movedRow: Signal<RowHoldViolation | null>;
  record(id: RowId): void;
  clear(id: RowId): void;
}

export function createRowHoldProbe(
  renderRows: Signal<readonly RenderRow<SortEditRow>[]>,
): RowHoldProbe {
  const openIndexById = signal<ReadonlyMap<RowId, number>>(new Map());

  const movedRow = computed<RowHoldViolation | null>(() => {
    const openedAt = openIndexById();
    if (openedAt.size === 0) {
      return null;
    }
    const currentRows = renderRows();
    for (const [id, indexAtOpen] of openedAt) {
      const currentIndex = currentRows.findIndex((row) => row.id === id);
      if (currentIndex !== -1 && currentIndex !== indexAtOpen) {
        return { id, indexAtOpen, currentIndex };
      }
    }
    return null;
  });

  function record(id: RowId): void {
    const index = renderRows().findIndex((row) => row.id === id);
    openIndexById.update((map) => new Map(map).set(id, index));
  }

  function clear(id: RowId): void {
    if (!openIndexById().has(id)) {
      return;
    }
    openIndexById.update((map) => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });
  }

  return { movedRow, record, clear };
}
