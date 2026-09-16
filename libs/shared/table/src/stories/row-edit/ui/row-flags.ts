import { signal, type Signal } from '@angular/core';
import type { RowId } from '../../../api/types';

/**
 * Demo-only per-row UI bookkeeping (pending-create flag, forced-invalid toggle, per-row error
 * message) — not the editing feature itself. Kept out of the story-host class so its body reads
 * as only the feature calls. Duplicate-name flagging is not here — it's real Signal Forms
 * validation (`fixtures/schema.ts`'s `editRowsWithUniqueNameSchema`), not UI bookkeeping.
 */
export interface RowFlags {
  readonly pendingCreateIds: Signal<ReadonlySet<RowId>>;
  readonly forcedInvalid: Signal<ReadonlySet<RowId>>;
  readonly rowErrors: Signal<ReadonlyMap<RowId, string>>;
  markPendingCreate(id: RowId): void;
  removePendingCreate(id: RowId): void;
  toggleForceInvalid(id: RowId): void;
  setRowError(id: RowId, message: string): void;
  clearRowError(id: RowId): void;
  clearAll(): void;
}

export function createRowFlags(): RowFlags {
  const pendingCreateIds = signal<ReadonlySet<RowId>>(new Set());
  const forcedInvalid = signal<ReadonlySet<RowId>>(new Set());
  const rowErrors = signal<ReadonlyMap<RowId, string>>(new Map());

  return {
    pendingCreateIds: pendingCreateIds.asReadonly(),
    forcedInvalid: forcedInvalid.asReadonly(),
    rowErrors: rowErrors.asReadonly(),
    markPendingCreate(id) {
      pendingCreateIds.update((ids) => new Set(ids).add(id));
    },
    removePendingCreate(id) {
      if (!pendingCreateIds().has(id)) return;
      pendingCreateIds.update((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    },
    toggleForceInvalid(id) {
      forcedInvalid.update((ids) => {
        const next = new Set(ids);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    setRowError(id, message) {
      rowErrors.update((errors) => new Map(errors).set(id, message));
    },
    clearRowError(id) {
      if (!rowErrors().has(id)) return;
      rowErrors.update((errors) => {
        const next = new Map(errors);
        next.delete(id);
        return next;
      });
    },
    clearAll() {
      rowErrors.set(new Map());
      pendingCreateIds.set(new Set());
    },
  };
}
