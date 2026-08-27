import { Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createTable } from '../../api/create-table';
import { beginEdit, clearEditing, endEdit } from '../../api/row-edit-mutations';
import { discardEdit, releaseEdit, revertEdit } from '../../api/optimistic-mutations';
import { NgpTableRowFieldDirective } from '../../directives/ngp-table-row-field.directive';
import type { RowId } from '../../api/types';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../row-edit.mock';
import { editRowsSchema, gatedTableSchema } from '../row-edit.schema';
import { saveRowPessimistic } from '../row-edit.utils';
import type { EditRow } from '../row-edit.types';

/**
 * S2 — the gated table (`withRowEdit()`). `multiple` is passed as `this.multiple` (a signal,
 * which is itself callable as `() => boolean`) — `withRowEdit()` wraps it in a `computed()`
 * internally and reacts live, so a Storybook arg control can drive it without rebuilding the
 * table.
 */
@Component({
  selector: 'ngp-gated-edit-story-host',
  imports: [FormField, NgpTableRowFieldDirective],
  templateUrl: './gated-edit-story-host.component.html',
  styleUrl: '../row-edit-story.css',
})
export class GatedEditStoryHostComponent {
  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly multiple = signal(false);
  protected readonly table = createTable(
    this.data,
    gatedTableSchema({ multiple: () => this.multiple() }),
  );
  protected readonly rows = form(this.data, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;
  protected readonly saveError = signal<string | null>(null);
  protected readonly insertAt = signal(0);

  /** `withRowEdit()` reacts to `multiple` live, so flipping the signal is enough — no rebuild. */
  protected toggleMultiple(): void {
    this.saveError.set(null);
    this.multiple.update((value) => !value);
  }

  /** One add path (D36/D42): `beginEdit({ insert })` opens the row with a real-value snapshot,
   * same as `beginEdit` on an existing row. Discard-vs-reset is no longer chosen here — it's a
   * Cancel choice available on any open row, not something tied to how the row was added. */
  protected addBlankRow(): void {
    const id = crypto.randomUUID();
    this.table.editing.update(
      beginEdit(id, {
        insert: { id, name: '', dept: DEPT_OPTIONS[0] },
        at: this.insertAt(),
      }),
    );
  }

  /** Duplicates `sourceId`'s row directly below itself and opens the copy — `beginEdit({ insert })`
   * (D42), the same call `addBlankRow()` uses, just seeded from an existing row instead of blank
   * fields. No new library API (`1-design.md` §"Story this owes"). */
  protected duplicateRow(sourceId: RowId): void {
    const data = this.data();
    const sourceIndex = data.findIndex((row) => this.table.trackBy(row) === sourceId);
    if (sourceIndex === -1) return;

    const source = data[sourceIndex];
    const at = sourceIndex + 1;
    const id = crypto.randomUUID();
    this.table.editing.update(beginEdit(id, { insert: { ...source, id }, at }));
  }

  protected openEdit(id: RowId): void {
    // beginEdit: opens the row; existing restore point wins if one is already held (D31.1).
    this.table.editing.update(beginEdit(id));
  }

  /** Resets the row to its snapshot and closes it. Available on any open row. */
  protected cancelEdit(id: RowId): void {
    this.saveError.set(null);
    this.table.editing.update(revertEdit(id));
  }

  /** Removes the row and closes it — one call (`discardEdit`). Available on any open row,
   * whether it pre-existed or was just added: discarding an edit to an existing row removes it
   * too, deliberately. */
  protected discardEdit(id: RowId): void {
    this.saveError.set(null);
    this.table.editing.update(discardEdit(id));
  }

  protected clearAll(): void {
    this.saveError.set(null);
    // clearEditing: closes every open row, dropping their restore points.
    this.table.editing.update(clearEditing());
  }

  /** Pessimistic save: the row stays open for the whole round trip. */
  protected async saveEdit(id: RowId): Promise<void> {
    this.saveError.set(null);
    const row = this.data().find((candidate) => this.table.trackBy(candidate) === id);
    if (row === undefined) {
      return;
    }

    try {
      await saveRowPessimistic(row);
      // D41: closing keeps the restore point, so a purely local save releases it too —
      // otherwise the row would sit in `pending` with nothing left to confirm it.
      this.table.editing.update(endEdit(id));
      this.table.editing.update(releaseEdit(id));
    } catch (error) {
      this.saveError.set(error instanceof Error ? error.message : 'Save failed.');
    }
  }
}
