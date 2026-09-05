import { signal, type Signal, type WritableSignal } from '@angular/core';
import type { RowId } from '../../api/types';

/**
 * UI-only bookkeeping for the bulk-add demo — how many rows to open, where, which of them are
 * still unsaved, and the last batch outcome message. None of this is the feature being
 * demonstrated (that's `createRow`'s array overload and the bulk save); it's story chrome, kept
 * out of the host class so its body reads as only the feature calls.
 */
export interface BulkAddUi {
  readonly count: WritableSignal<number>;
  readonly insertAt: WritableSignal<number>;
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
    count: signal(3),
    insertAt: signal(0),
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
