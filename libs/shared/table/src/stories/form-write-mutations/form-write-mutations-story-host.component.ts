import { JsonPipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createTable } from '../../api/create-table';
import { beginEdit, endEdit } from '../../mutations/row-edit-mutations';
import { releaseEdit, revertEdit } from '../../mutations/optimistic-mutations';
import { NgpTableRowFieldDirective } from '../../directives/ngp-table-row-field.directive';
import type { RowId } from '../../api/types';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../shared/row-edit/mock';
import { editRowsSchema, gatedTableSchema } from '../shared/row-edit/schema';
import { saveRowPessimistic } from '../shared/row-edit/utils';
import type { EditRow } from '../shared/row-edit/types';

/**
 * Add/remove go straight through the form's own root value signal (`rows().value.update(...)`)
 * instead of `beginEdit({ insert })`/`removeRow` + `table.editing.update`. That's a valid way to mutate
 * rows on its own — the schema/data binding doesn't care where a write comes from. What it
 * skips is table's optimistic-update support: `beginEdit({ insert })`/`removeRow` compose with
 * `table.editing`'s snapshot/pending machinery (D31/D41, `endEdit`/`releaseEdit`), so a save
 * can roll back cleanly on failure. A raw form write has no snapshot to roll back to. Field-level
 * edits (name/dept) still go through the normal `beginEdit`/`formField` flow — only the
 * row-structural mutations skip the table utilities, to isolate the effect.
 */
@Component({
  selector: 'ngp-form-write-mutations-story-host',
  imports: [FormField, JsonPipe, NgpTableRowFieldDirective],
  templateUrl: './form-write-mutations-story-host.component.html',
  styleUrl: '../shared/styles/story-host.css',
})
export class FormWriteMutationsStoryHostComponent {
  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, gatedTableSchema());
  protected readonly rows = form(this.data, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;

  // editingIds is untouched by addRowViaForm/removeRowViaForm below — neither one calls
  // table.editing.update, so a row added this way never enters `open` on its own.
  protected readonly editingIds = computed(() => Array.from(this.table.editing()));
  protected readonly saveError = signal<string | null>(null);

  protected openEdit(id: RowId): void {
    this.table.editing.update(beginEdit(id));
  }

  protected cancelEdit(id: RowId): void {
    this.saveError.set(null);
    this.table.editing.update(revertEdit(id));
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
      // D41: closing keeps the restore point; a local save has to release it as well.
      this.table.editing.update(endEdit(id));
      this.table.editing.update(releaseEdit(id));
    } catch (error) {
      this.saveError.set(error instanceof Error ? error.message : 'Save failed.');
    }
  }

  /**
   * Pushes straight through the form's root value signal instead of
   * `beginEdit(id, { insert })`. The row lands in `data`, so it renders — but no
   * `beginEdit` snapshot is captured and its id is never added to `table.editing()`. It shows
   * up read-only, and has no restore point for an optimistic save to roll back to if one is
   * added later; "Edit" has to be clicked separately to open it.
   */
  protected addRowViaForm(): void {
    this.rows().value.update((current) => [
      ...current,
      { id: crypto.randomUUID(), name: '', dept: DEPT_OPTIONS[0] },
    ]);
  }

  /**
   * Removes straight through the form's root value signal instead of
   * `table.value.update(removeRow(id))`. `onRowsRemoved` (ADR-0006) still prunes the id out of
   * `editing()` — that hook watches `data` itself, not the call site — but no `endEdit`/
   * `revertEdit` runs, so a mid-edit row's snapshot is discarded silently instead of going
   * through the normal close path an optimistic save would use to recover it.
   */
  protected removeRowViaForm(id: RowId): void {
    this.rows().value.update((current) =>
      current.filter((row) => this.table.trackBy(row) !== id),
    );
  }
}
