import { Component, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createTable } from '../../api/create-table';
import { captureEdit, patchEdit, releaseEdit } from '../../mutations/optimistic-mutations';
import type { RowId } from '../../api/types';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../row-edit.mock';
import { editRowsSchema, liveOptimisticSchema } from '../row-edit.schema';
import type { EditRow } from '../row-edit.types';

/**
 * S6 (Live + Pessimistic) — sibling of `../live-optimistic/`, same `withOptimistic()`-only
 * schema and the same focus-is-the-edit-session model (D39): no `withRowEdit()`, so
 * `table.editing()` stays empty and `table.pending()` is the in-flight indicator.
 *
 * The two stories differ only in *when* the revert happens relative to the request, proving the
 * other half of the same three verbs (`captureEdit`/`patchEdit`/`releaseEdit`):
 * - **Live + Optimistic** (the sibling): blur commits the typed value straight to `data`, a
 *   non-blocking badge shows the in-flight save, and a failure snaps the value back
 *   (revert-after-failure).
 * - **Live + Pessimistic** (this story): blur immediately snaps `data` back to the pre-edit
 *   value and locks the row (revert-before-send) — nothing ever looks committed until the server
 *   confirms it. A failure needs no visible rollback, because the reverted value is already on
 *   screen; only the lock needs to lift.
 */
@Component({
  selector: 'ngp-live-pessimistic-story-host',
  imports: [FormField],
  templateUrl: './live-pessimistic-story-host.component.html',
  styleUrl: '../row-edit-story.css',
})
export class LivePessimisticStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(600);

  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly liveTable = createTable(this.data, liveOptimisticSchema);
  protected readonly rows = form(this.data, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;
  protected readonly saveError = signal<string | null>(null);
  protected readonly savingIds = signal<ReadonlySet<RowId>>(new Set());

  /** Pre-edit value per row, read at focus time. `captureEdit`'s restore point has no public
   * getter to read a single held value back out — only the mutation verbs — so the host keeps its
   * own copy to reach the value on blur, before reverting. */
  private readonly preEditValues = new Map<RowId, EditRow>();

  /** Takes the restore point this row will revert to on blur. Guarded: a row already `pending()`
   * holds a snapshot for an in-flight save, and re-capturing would overwrite it. */
  protected onEnterRow(id: RowId): void {
    const isRowPending = this.liveTable.pending().has(id);
    if (isRowPending) {
      return;
    }
    const preEditRow = this.data().find((candidate) => this.liveTable.trackBy(candidate) === id);
    if (preEditRow === undefined) {
      return;
    }
    this.preEditValues.set(id, preEditRow);
    this.liveTable.editing.update(captureEdit<EditRow>(id));
  }

  /** Deferred a tick on purpose: `debounce(row.name, 'blur')` (D24) commits the typed value to
   * `data` as part of the same blur, and the revert has to read what landed, not what was there
   * before it. */
  protected onLeaveRow(id: RowId): void {
    setTimeout(() => void this.save(id));
  }

  private async save(id: RowId): Promise<void> {
    const typedRow = this.data().find((candidate) => this.liveTable.trackBy(candidate) === id);
    const preEditRow = this.preEditValues.get(id);
    if (typedRow === undefined || preEditRow === undefined) {
      return;
    }

    this.saveError.set(null);
    // Revert-before-send: write the pre-edit value back right now, before the request even goes
    // out. `patchEdit`'s default `capture: 'if-absent'` leaves the snapshot `captureEdit` already
    // took alone — nothing re-captures here.
    this.liveTable.editing.update(patchEdit<EditRow>(id, preEditRow));
    this.savingIds.update((ids) => new Set(ids).add(id));

    try {
      const response = await fetch(`/api/rows/${id}`, {
        method: 'PUT',
        headers: this.simulatedHeaders(),
        body: JSON.stringify(typedRow),
      });
      if (!response.ok) {
        const errorBody = (await response.json()) as { message?: string };
        throw new Error(errorBody.message ?? 'Save failed.');
      }
      // Confirmed — reveal the new value, then drop the now-spent snapshot.
      this.liveTable.editing.update(patchEdit<EditRow>(id, typedRow));
      this.liveTable.editing.update(releaseEdit<EditRow>(id));
    } catch (error) {
      // `data` already shows the pre-edit value from the revert above — nothing left to roll
      // back, just drop the snapshot and surface the error.
      this.saveError.set(error instanceof Error ? error.message : 'Save failed.');
      this.liveTable.editing.update(releaseEdit<EditRow>(id));
    } finally {
      this.savingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
      this.preEditValues.delete(id);
    }
  }

  /** Headers driving MSW's simulated latency/failure. */
  private simulatedHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Force-Failure': String(this.forceFailure()),
      'X-Latency-Ms': String(this.latencyMs()),
    };
  }
}
