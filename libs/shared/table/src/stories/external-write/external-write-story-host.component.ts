import { JsonPipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createTable } from '../../api/create-table';
import { beginEdit, rebaseEdit, revertEdit } from '../../api/row-edit-mutations';
import { removeRow } from '../../api/row-mutations';
import { NgpTableRowFieldDirective } from '../../directives/ngp-table-row-field.directive';
import type { RowId } from '../../api/types';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../row-edit.mock';
import { editRowsSchema, gatedTableSchema } from '../row-edit.schema';
import type { EditRow } from '../row-edit.types';

/**
 * S5 — external write while a row is open. "Simulate server push" patches `data` under the
 * open row and calls `rebaseEdit` (O13/D34) so Cancel restores the pushed value rather than
 * the stale pre-edit one. "Remove row externally" deletes it from `data` while open, exercising
 * ADR-0006's `onRowsRemoved` reconciliation — the entry is pruned rather than left dangling.
 */
@Component({
  selector: 'ngp-external-write-story-host',
  imports: [FormField, JsonPipe, NgpTableRowFieldDirective],
  templateUrl: './external-write-story-host.component.html',
  styleUrl: '../row-edit-story.css',
})
export class ExternalWriteStoryHostComponent {
  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, gatedTableSchema());
  protected readonly rows = form(this.data, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;

  // Surfaces ADR-0006 pruning directly: editingIds drops the removed row's id the
  // instant onRowsRemoved runs, before the row itself disappears from the DOM.
  protected readonly editingIds = computed(() => Array.from(this.table.editing()));

  protected openEdit(id: RowId): void {
    // beginEdit: opens the row and captures its current value as the restore point.
    this.table.editing.update(beginEdit(id));
  }

  protected cancelEdit(id: RowId): void {
    // revertEdit: restores the row's snapshot (the pushed value, after rebaseEdit ran) and closes it.
    this.table.editing.update(revertEdit(id));
  }

  protected simulateServerPush(id: RowId): void {
    const row = this.data().find((candidate) => this.table.trackBy(candidate) === id);
    if (row === undefined) {
      return;
    }
    const nextDept: string =
      DEPT_OPTIONS[(DEPT_OPTIONS.indexOf(row.dept as (typeof DEPT_OPTIONS)[number]) + 1) % DEPT_OPTIONS.length];
    const pushed: EditRow = { ...row, dept: nextDept };
    this.data.update((rows) => rows.map((candidate) => (candidate.id === id ? pushed : candidate)));
    // rebaseEdit: moves the open row's restore point forward to the pushed value, so Cancel
    // doesn't undo this external write.
    this.table.editing.update(rebaseEdit(id, pushed));
  }

  protected removeRowExternally(id: RowId): void {
    this.table.value.update(removeRow(id));
  }
}
