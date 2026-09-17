import { signal, type Signal } from '@angular/core';
import type { RowId } from '../../../api/types';

/**
 * UI-only bookkeeping for the bulk-add demo — which rows are still unsaved and the last batch
 * outcome message. Count/insert-position are the toolbar's own local state
 * (`gated-bulk-optimistic-toolbar.component.ts`), not tracked here. None of this is the feature
 * being demonstrated (that's `createRow`'s array overload and the bulk save); it's story chrome,
 * kept out of the host class so its body reads as only the feature calls.
 */
export interface BulkAddUi {
  readonly pendingIds: Signal<ReadonlySet<RowId>>;
  readonly summary: Signal<string | null>;
  addPending(ids: readonly RowId[]): void;
  removePending(id: RowId): void;
  clearPending(): void;
  setSummary(message: string | null): void;
}

export function createBulkAddUi(): BulkAddUi {
  const pendingIds = signal<ReadonlySet<RowId>>(new Set());
  const summary = signal<string | null>(null);

  return {
    pendingIds: pendingIds.asReadonly(),
    summary: summary.asReadonly(),
    addPending(ids) {
      pendingIds.update((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.add(id));
        return next;
      });
    },
    removePending(id) {
      if (!pendingIds().has(id)) return;
      pendingIds.update((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    },
    clearPending() {
      pendingIds.set(new Set());
    },
    setSummary(message) {
      summary.set(message);
    },
  };
}
