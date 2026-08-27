import { Component, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createTable } from '../../api/create-table';
import { captureEdit, releaseEdit, removeEdit, revertEdit } from '../../api/optimistic-mutations';
import type { RowId } from '../../api/types';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../row-edit.mock';
import { editRowsSchema, liveOptimisticSchema } from '../row-edit.schema';
import type { EditRow } from '../row-edit.types';

/**
 * S6 — the live table with rollback (D39). Composes `withOptimistic()` and **not**
 * `withRowEdit()`: every row always renders inputs, so nothing ever opens and `table.editing()`
 * stays empty for the whole story. The edit session is the *focus* session.
 *
 * Three verbs, no open/close:
 * - focus  -> `captureEdit(id)` takes the restore point
 * - blur   -> the form's `debounce('blur')` commits to `data`, then the save fires
 * - server -> `releaseEdit(id)` on success, `revertEdit(id)` on rejection
 *
 * `pending()` is therefore exactly the in-flight set, which is what drives the saving state
 * here — the counterpart to S4's gated flow, where `pending` means "closed but unconfirmed".
 */
@Component({
  selector: 'ngp-live-optimistic-story-host',
  imports: [FormField],
  templateUrl: './live-optimistic-story-host.component.html',
  styleUrl: '../row-edit-story.css',
})
export class LiveOptimisticStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(600);

  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, liveOptimisticSchema);
  protected readonly rows = form(this.data, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;
  protected readonly saveError = signal<string | null>(null);

  /** Focus opens nothing — it only takes the restore point this row will roll back to. */
  protected onEnterRow(id: RowId): void {
    this.table.editing.update(captureEdit<EditRow>(id));
  }

  /**
   * Deferred a tick on purpose: `debounce(row.name, 'blur')` (D24) commits the typed value to
   * `data` as part of the same blur, and the save has to read what landed, not what was there
   * before it.
   */
  protected onLeaveRow(id: RowId): void {
    setTimeout(() => void this.save(id));
  }

  /**
   * Delete-with-rollback: the third verb pairing, no prior `captureEdit`/`beginEdit` needed —
   * `removeEdit` itself takes the restore point (row + index) before removing the row. Success
   * drops it (`releaseEdit`); failure re-inserts the row at its captured index (`revertEdit`).
   */
  protected deleteRow(id: RowId): void {
    this.saveError.set(null);
    this.table.editing.update(removeEdit<EditRow>(id));
    void this.remove(id);
  }

  private async save(id: RowId): Promise<void> {
    this.saveError.set(null);
    const row = this.data().find((candidate) => this.table.trackBy(candidate) === id);
    if (row === undefined) {
      return;
    }

    try {
      const response = await fetch(`/api/rows/${id}`, {
        method: 'PUT',
        headers: this.simulatedHeaders(),
        body: JSON.stringify(row),
      });
      if (!response.ok) {
        const errorBody = (await response.json()) as { message?: string };
        throw new Error(errorBody.message ?? 'Save failed.');
      }
      // releaseEdit: confirmed — drop the restore point, the written value stands.
      this.table.editing.update(releaseEdit<EditRow>(id));
    } catch (error) {
      this.saveError.set(error instanceof Error ? error.message : 'Save failed.');
      // revertEdit: rejected — put the captured value back. Nothing to close; nothing was open.
      this.table.editing.update(revertEdit<EditRow>(id));
    }
  }

  private async remove(id: RowId): Promise<void> {
    try {
      const response = await fetch(`/api/rows/${id}`, {
        method: 'DELETE',
        headers: this.simulatedHeaders(),
      });
      if (!response.ok) {
        const errorBody = (await response.json()) as { message?: string };
        throw new Error(errorBody.message ?? 'Delete failed.');
      }
      this.table.editing.update(releaseEdit<EditRow>(id));
    } catch (error) {
      this.saveError.set(error instanceof Error ? error.message : 'Delete failed.');
      this.table.editing.update(revertEdit<EditRow>(id));
    }
  }

  /** Headers driving MSW's simulated latency/failure, shared by save and delete requests. */
  private simulatedHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Force-Failure': String(this.forceFailure()),
      'X-Latency-Ms': String(this.latencyMs()),
    };
  }
}
