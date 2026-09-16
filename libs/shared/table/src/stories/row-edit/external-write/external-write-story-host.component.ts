import { JsonPipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { beginEdit } from '../../../mutations/row-edit-mutations';
import { captureEdit, revertEdit } from '../../../mutations/optimistic-mutations';
import { patchRow } from '../../../mutations/row-mutations';
import { NgpTableRowFieldDirective } from '../../../directives/ngp-table-row-field.directive';
import type { RowId } from '../../../api/types';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../fixtures/mock';
import { createTable } from '../../../api/create-table';
import { withRowEdit } from '../../../api/features/with-row-edit';
import { editTableConfig, editRowsSchema } from '../fixtures/schema';
import type { EditRow } from '../fixtures/types';
import { diffEditableFields, nextDept, toPatch } from './external-write.utils';
import { createConflictStore } from './external-write.state';
import type { EditableField } from './external-write.types';

/**
 * External write conflicts
 *
 * "Simulate server push" stages a `RowConflict` on an open row instead of overwriting it
 * silently — the typed value stays put until you pick Keep mine, Take theirs, or merge
 * field-by-field. "Push to row I'm not editing" applies the same write quietly, since there's
 * no open session to move forward.
 */
@Component({
  selector: 'ngp-external-write-story-host',
  imports: [FormField, JsonPipe, NgpTableRowFieldDirective],
  templateUrl: './external-write-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', './external-write.css'],
})
export class ExternalWriteStoryHostComponent {
  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, editTableConfig, withRowEdit());
  protected readonly rows = form(this.data, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;

  protected readonly editingIds = computed(() => Array.from(this.table.editing()));

  // Keyed by row id — at most one pending conflict per row, cleared once every field resolves.
  protected readonly conflicts = createConflictStore();

  protected openEdit(id: RowId): void {
    // beginEdit: opens the row and captures its current value as the restore point.
    this.table.editing.update(beginEdit(id));
  }

  protected cancelEdit(id: RowId): void {
    // A pending conflict never touched `data` (see simulateServerPush) — drop it without moving
    // the restore point, then revertEdit as usual restores the snapshot and closes the row.
    this.conflicts.drop(id);
    this.table.editing.update(revertEdit(id));
  }

  /**
   * Pushes an external change into an open row. Rather than writing it straight into `data` —
   * which would silently clobber whatever the person has typed, since the form binds directly to
   * `data` — it's staged as a `RowConflict` until the person resolves it (§1.5).
   */
  protected simulateServerPush(id: RowId): void {
    const mine = this.data().find((candidate) => this.table.trackBy(candidate) === id);
    if (mine === undefined) {
      return;
    }
    const theirs: EditRow = { ...mine, dept: nextDept(mine.dept) };
    const changedFields = diffEditableFields(mine, theirs);
    if (changedFields.length === 0) {
      return;
    }
    this.conflicts.stage(id, changedFields);
  }

  /** Patches a row that is *not* currently open — no `captureEdit` (no session to move forward)
   * and no focus/scroll code, so the update lands without disturbing whatever the person is
   * doing elsewhere in the table. */
  protected pushToUnopenedRow(): void {
    const openIds = this.table.editing();
    const target = this.data().find((row) => !openIds.has(this.table.trackBy(row)));
    if (target === undefined) {
      return;
    }
    const theirs: EditRow = { ...target, dept: nextDept(target.dept) };
    this.table.value.update(patchRow(this.table.trackBy(target), theirs));
  }

  /** Keep mine: dismiss the banner, don't touch `data` — the in-progress edit stands as-is. */
  protected keepMine(id: RowId): void {
    this.resolveConflict(id);
  }

  /** Take theirs: apply every conflicting field's pushed value, replacing what was typed. */
  protected takeTheirs(id: RowId): void {
    const conflict = this.conflicts.byId().get(id);
    if (conflict === undefined) {
      return;
    }
    this.table.value.update(patchRow(id, toPatch(conflict.fields)));
    this.resolveConflict(id);
  }

  /** Switches the banner from the three-way choice into a per-field toggle list. */
  protected startMerge(id: RowId): void {
    this.conflicts.startMerge(id);
  }

  protected keepMineField(id: RowId, field: EditableField): void {
    this.resolveMergeField(id, field);
  }

  protected takeTheirsField(id: RowId, field: EditableField): void {
    const fieldDiff = this.conflicts
      .byId()
      .get(id)
      ?.fields.find((candidate) => candidate.field === field);
    if (fieldDiff === undefined) {
      return;
    }
    this.table.value.update(patchRow(id, toPatch([fieldDiff])));
    this.resolveMergeField(id, field);
  }

  private resolveMergeField(id: RowId, field: EditableField): void {
    if (this.conflicts.settleField(id, field)) {
      this.table.editing.update(captureEdit(id));
    }
  }

  /** Clears an explicitly-resolved conflict and moves the restore point forward (D40). */
  private resolveConflict(id: RowId): void {
    if (!this.conflicts.drop(id)) {
      return;
    }
    this.table.editing.update(captureEdit(id));
  }
}
