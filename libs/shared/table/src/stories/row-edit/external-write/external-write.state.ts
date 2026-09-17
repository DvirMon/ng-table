import { signal, type Signal } from '@angular/core';
import type { RowId } from '../../../api/types';
import type { EditableField, FieldDiff, RowConflict } from './external-write.types';

/**
 * Conflict bookkeeping for S5's external-write flow (§1.5): one pending `RowConflict` per row,
 * keyed by id, cleared once every field resolves. Kept out of the host so its body reads as only
 * the table-editing calls (`captureEdit`, `table.value.update`) that are the actual feature.
 */
export interface ConflictStore {
  readonly byId: Signal<ReadonlyMap<RowId, RowConflict>>;
  /** Stages a new conflict for `id`, replacing any existing one. */
  stage(id: RowId, fields: readonly FieldDiff[]): void;
  /** Switches the banner from the three-way choice into the per-field toggle list. */
  startMerge(id: RowId): void;
  /** Removes `field` from `id`'s conflict. Returns true when that was the last field — the
   * conflict is fully cleared in that case, same as `drop`. */
  settleField(id: RowId, field: EditableField): boolean;
  /** Removes `id`'s conflict outright. Returns whether a conflict was actually present. */
  drop(id: RowId): boolean;
}

export function createConflictStore(): ConflictStore {
  const conflicts = signal<Map<RowId, RowConflict>>(new Map());

  function removeEntry(id: RowId): void {
    conflicts.update((map) => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });
  }

  return {
    byId: conflicts.asReadonly(),
    stage(id, fields) {
      conflicts.update((map) => new Map(map).set(id, { id, fields: [...fields], merging: false }));
    },
    startMerge(id) {
      conflicts.update((map) => {
        const conflict = map.get(id);
        return conflict === undefined ? map : new Map(map).set(id, { ...conflict, merging: true });
      });
    },
    settleField(id, field) {
      const conflict = conflicts().get(id);
      if (conflict === undefined) {
        return false;
      }
      const remaining = conflict.fields.filter((fieldDiff) => fieldDiff.field !== field);
      if (remaining.length === 0) {
        removeEntry(id);
        return true;
      }
      conflicts.update((map) => new Map(map).set(id, { ...conflict, fields: remaining }));
      return false;
    },
    drop(id) {
      if (!conflicts().has(id)) {
        return false;
      }
      removeEntry(id);
      return true;
    },
  };
}
