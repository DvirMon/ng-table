import { Component, effect, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createTable } from '../../api/create-table';
import { insertRow } from '../../api/row-mutations';
import { EDIT_ROWS_MOCK, DEPT_OPTIONS } from '../row-edit.mock';
import { editRowsSchema, liveTableSchema } from '../row-edit.schema';
import type { EditRow } from '../row-edit.types';

/**
 * S1 — the live table (D29): no `withRowEdit()` composed, inputs always render. `commitCount`
 * instruments `data()` emissions to make the `debounce('blur')` commit boundary observable —
 * typing does not tick it, blur/select-change does.
 */
@Component({
  selector: 'ngp-live-table-story-host',
  imports: [FormField],
  templateUrl: './live-table-story-host.component.html',
  styleUrl: '../row-edit-story.css',
})
export class LiveTableStoryHostComponent {
  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, liveTableSchema);
  protected readonly rows = form(this.data, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;

  protected readonly commitCount = signal(0);
  protected readonly insertAt = signal(0);

  constructor() {
    effect(() => {
      this.data();
      this.commitCount.update((count) => count + 1);
    });
  }

  protected insertRow(): void {
    this.table.value.update(
      insertRow(
        { id: crypto.randomUUID(), name: '', dept: DEPT_OPTIONS[0] },
        { at: this.insertAt() },
      ),
    );
  }
}
