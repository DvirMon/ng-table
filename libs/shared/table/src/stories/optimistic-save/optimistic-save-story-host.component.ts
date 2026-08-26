import { Component, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createTable } from '../../api/create-table';
import { beginEdit, endEdit } from '../../api/row-edit-mutations';
import { releaseEdit, revertEdit } from '../../api/optimistic-mutations';
import { NgpTableRowFieldDirective } from '../../directives/ngp-table-row-field.directive';
import type { RowId } from '../../api/types';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../row-edit.mock';
import { editRowsSchema, gatedTableSchema } from '../row-edit.schema';
import type { EditRow } from '../row-edit.types';

/**
 * S4 — optimistic save (D31). Closes the row immediately (`endEdit`),
 * moving it to `pending`, then rolls back on a failed save or settles it on success. The save
 * itself is a real intercepted `fetch` (MSW), not a Promise stub — `forceFailure`/`latencyMs`
 * are Storybook-controlled request headers the handler reads.
 */
@Component({
  selector: 'ngp-optimistic-save-story-host',
  imports: [FormField, NgpTableRowFieldDirective],
  templateUrl: './optimistic-save-story-host.component.html',
  styleUrl: '../row-edit-story.css',
})
export class OptimisticSaveStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(600);

  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, gatedTableSchema());
  protected readonly rows = form(this.data, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;
  protected readonly saveError = signal<string | null>(null);

  protected openEdit(id: RowId): void {
    // beginEdit: opens the row and captures its current value as the restore point.
    this.table.editing.update(beginEdit(id));
  }

  protected async saveEdit(id: RowId): Promise<void> {
    this.saveError.set(null);
    // endEdit: closes the row immediately but keeps its restore point (D41 — keeping is the
    // only behavior now), so the row shows as `pending` until the fetch below resolves it.
    this.table.editing.update(endEdit(id));

    const row = this.data().find((candidate) => this.table.trackBy(candidate) === id);
    if (row === undefined) {
      return;
    }

    try {
      const response = await fetch(`/api/rows/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Force-Failure': String(this.forceFailure()),
          'X-Latency-Ms': String(this.latencyMs()),
        },
        body: JSON.stringify(row),
      });
      if (!response.ok) {
        const errorBody = (await response.json()) as { message?: string };
        throw new Error(errorBody.message ?? 'Save failed.');
      }
      // releaseEdit: save confirmed — drops the held restore point, row is no longer pending.
      this.table.editing.update(releaseEdit(id));
    } catch (error) {
      this.saveError.set(error instanceof Error ? error.message : 'Save failed.');
      // revertEdit: save failed — restores the pre-edit snapshot and closes the row.
      this.table.editing.update(revertEdit(id));
    }
  }
}
