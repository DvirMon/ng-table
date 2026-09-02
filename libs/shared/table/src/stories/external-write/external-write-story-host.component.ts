import { JsonPipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createTable } from '../../api/create-table';
import { beginEdit } from '../../mutations/row-edit-mutations';
import { captureEdit, revertEdit } from '../../mutations/optimistic-mutations';
import { patchRow, removeRow } from '../../mutations/row-mutations';
import { NgpTableRowFieldDirective } from '../../directives/ngp-table-row-field.directive';
import type { RowId } from '../../api/types';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../row-edit.mock';
import { editRowsSchema, gatedTableSchema } from '../row-edit.schema';
import type { EditRow } from '../row-edit.types';
import { diffEditableFields, nextDept } from './external-write.utils';
import type { DeletedRowNotice, EditableField, RowConflict } from './external-write.types';

/**
 * S5 — external write while a row is open, extended to close the product doc's §1.5 gap: the
 * plumbing (`captureEdit` moving the restore point forward) was already covered, but nothing on
 * screen told the person a conflicting write had arrived. "Simulate server push" now stages a
 * `RowConflict` instead of writing straight into `data` — the person's typed value stays put
 * until they pick Keep mine / Take theirs / merge field-by-field, so doing nothing is never a
 * silent overwrite. "Push to row I'm not editing" patches a closed row the same way, but skips
 * `captureEdit` (no session to move forward) and any focus/scroll code, to demonstrate a quiet
 * update. "Remove row externally" now also surfaces a dismissible notice when the removed row
 * had an open editor, on top of ADR-0006's existing `onRowsRemoved` pruning.
 */
@Component({
  selector: 'ngp-external-write-story-host',
  imports: [FormField, JsonPipe, NgpTableRowFieldDirective],
  templateUrl: './external-write-story-host.component.html',
  styleUrls: ['../row-edit-story.css', './external-write.css'],
})
export class ExternalWriteStoryHostComponent {
  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, gatedTableSchema());
  protected readonly rows = form(this.data, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;

  // Surfaces ADR-0006 pruning directly: editingIds drops the removed row's id the
  // instant onRowsRemoved runs, before the row itself disappears from the DOM.
  protected readonly editingIds = computed(() => Array.from(this.table.editing()));

  // Keyed by row id — at most one pending conflict per row, cleared once every field resolves.
  protected readonly conflicts = signal<Map<RowId, RowConflict>>(new Map());
  protected readonly deletedNotices = signal<DeletedRowNotice[]>([]);

  protected openEdit(id: RowId): void {
    // beginEdit: opens the row and captures its current value as the restore point.
    this.table.editing.update(beginEdit(id));
  }

  protected cancelEdit(id: RowId): void {
    // A pending conflict never touched `data` (see simulateServerPush) — drop it without moving
    // the restore point, then revertEdit as usual restores the snapshot and closes the row.
    this.dropConflict(id);
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
    this.conflicts.update((map) => new Map(map).set(id, { id, fields: changedFields, merging: false }));
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
    const conflict = this.conflicts().get(id);
    if (conflict === undefined) {
      return;
    }
    const patch = Object.fromEntries(
      conflict.fields.map((fieldDiff) => [fieldDiff.field, fieldDiff.theirsValue])
    ) as Partial<EditRow>;
    this.table.value.update(patchRow(id, patch));
    this.resolveConflict(id);
  }

  /** Switches the banner from the three-way choice into a per-field toggle list. */
  protected startMerge(id: RowId): void {
    this.conflicts.update((map) => {
      const conflict = map.get(id);
      return conflict === undefined ? map : new Map(map).set(id, { ...conflict, merging: true });
    });
  }

  protected keepMineField(id: RowId, field: EditableField): void {
    this.resolveMergeField(id, field);
  }

  protected takeTheirsField(id: RowId, field: EditableField): void {
    const fieldDiff = this.conflicts()
      .get(id)
      ?.fields.find((candidate) => candidate.field === field);
    if (fieldDiff === undefined) {
      return;
    }
    this.table.value.update(patchRow(id, { [fieldDiff.field]: fieldDiff.theirsValue } as Partial<EditRow>));
    this.resolveMergeField(id, field);
  }

  private resolveMergeField(id: RowId, field: EditableField): void {
    const conflict = this.conflicts().get(id);
    if (conflict === undefined) {
      return;
    }
    const remaining = conflict.fields.filter((fieldDiff) => fieldDiff.field !== field);
    if (remaining.length === 0) {
      this.resolveConflict(id);
      return;
    }
    this.conflicts.update((map) => new Map(map).set(id, { ...conflict, fields: remaining }));
  }

  /** Clears an explicitly-resolved conflict (Keep mine / Take theirs / last merged field) and
   * moves the restore point forward to whatever `data` now holds — the person's accepted answer
   * — so Cancel doesn't later undo a choice they just made (D40). */
  private resolveConflict(id: RowId): void {
    if (!this.dropConflict(id)) {
      return;
    }
    this.table.editing.update(captureEdit(id));
  }

  /** Removes a conflict entry without touching the restore point — used by Cancel and row
   * removal, where the row session is ending rather than being reconciled. Returns whether a
   * conflict was actually present. */
  private dropConflict(id: RowId): boolean {
    if (!this.conflicts().has(id)) {
      return false;
    }
    this.conflicts.update((map) => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });
    return true;
  }

  protected removeRowExternally(id: RowId): void {
    const wasOpen = this.table.editing().has(id);
    const removedRow = this.data().find((candidate) => this.table.trackBy(candidate) === id);
    this.table.value.update(removeRow(id));
    this.dropConflict(id);
    if (wasOpen && removedRow !== undefined) {
      this.deletedNotices.update((notices) => [...notices, { id, name: removedRow.name }]);
    }
  }

  protected dismissDeletedNotice(id: RowId): void {
    this.deletedNotices.update((notices) => notices.filter((notice) => notice.id !== id));
  }
}
