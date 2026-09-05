import { Component, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createTable } from '../../api/create-table';
import { beginEdit, createRow, endEdit } from '../../mutations/row-edit-mutations';
import { discardEdit, releaseEdit, revertEdit, swapRowId } from '../../mutations/optimistic-mutations';
import { patchRow } from '../../mutations/row-mutations';
import { NgpTableRowFieldDirective } from '../../directives/ngp-table-row-field.directive';
import type { RowId } from '../../api/types';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../row-edit.mock';
import { editRowsSchema, gatedTableSchema } from '../row-edit.schema';
import { injectRowEditApi, type RowEditRequestOptions } from '../row-edit.http';
import type { EditRow } from '../row-edit.types';
import { createBulkAddUi } from './gated-bulk-optimistic.state';

/**
 * §1.8/OQ-7's D32, bulk-add half resolved 2026-09-05: `createRow`'s array overload
 * (`mutations/row-edit-mutations.ts`) opens `ui.count()` blank rows in **one** call — no per-row
 * loop, one `data` write and one `{ snapshots, open }` transition regardless of count.
 *
 * "Save batch" is the other half: `rowEditApi.saveBulk()` sends every pending row in one request,
 * and the outcome applies to the whole set together — either every row gets its server id
 * (`patchRow` + `swapRowId`, one pair per row off the single response) or every row reverts and
 * reopens. Contrast with `../gated-multiple-optimistic/`'s Save All, which is N independent
 * requests with N independent rollback units — both answers to the same open question, not a
 * replacement of one by the other.
 *
 * Story-only bookkeeping (row count, insert position, pending ids, the outcome message) lives in
 * `./gated-bulk-optimistic.state.ts` — none of it is the feature being demonstrated.
 *
 * Scoped to only the bulk-create path — editing or deleting a pre-existing row is already covered
 * by every other gated story and isn't shown here.
 */
@Component({
  selector: 'ngp-gated-bulk-optimistic-story-host',
  imports: [FormField, NgpTableRowFieldDirective],
  templateUrl: './gated-bulk-optimistic-story-host.component.html',
  styleUrl: '../row-edit-story.css',
})
export class GatedBulkOptimisticStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(600);

  private readonly rowEditApi = injectRowEditApi();

  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, gatedTableSchema({ multiple: () => true }));
  /** Gated mode's commit boundary is the row (OQ-3) — `form()` writes into `table.draft` instead
   * of `data`. */
  protected readonly rows = form(this.table.draft, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;
  protected readonly ui = createBulkAddUi();

  /** Opens `ui.count()` blank rows in one call — `createRow`'s array overload, not a loop of
   * single-row `createRow` calls. */
  protected addBulkRows(): void {
    const count = Math.max(0, Math.trunc(this.ui.count()));
    const entries = Array.from({ length: count }, () => {
      const id = crypto.randomUUID();
      return { id, row: { id, name: '', dept: DEPT_OPTIONS[0] } as EditRow };
    });
    if (entries.length === 0) return;

    this.table.editing.update(createRow<EditRow>(entries, { at: this.ui.insertAt() }));
    this.ui.addPending(entries.map((entry) => entry.id));
  }

  /** Removes one still-open, never-saved row locally — nothing to tell a server about yet. */
  protected discardPendingRow(id: RowId): void {
    this.table.editing.update(discardEdit<EditRow>(id));
    this.ui.removePending(id);
  }

  /** Drops every still-open, never-saved row — the bulk-add's own "start over". Distinct from a
   * batch save *failure*, which keeps the rows and reopens them instead of removing them. */
  protected discardAllPending(): void {
    for (const id of this.ui.pendingIds()) {
      this.table.editing.update(discardEdit<EditRow>(id));
    }
    this.ui.clearPending();
    this.ui.setSummary(null);
  }

  /** The batched-save half of D32. Every pending row closes (`endEdit`) before the single request
   * fires — same "close before send" shape `saveEdit` uses elsewhere in this cluster — then
   * `rowEditApi.saveBulk()` carries all of them in one request. Success or failure applies to the
   * whole batch together: never a partial batch. */
  protected saveBatch(): void {
    this.ui.setSummary(null);
    const ids = Array.from(this.ui.pendingIds());
    if (ids.length === 0) {
      this.ui.setSummary('No pending rows to save.');
      return;
    }

    const draft = this.table.draft();
    const rowsById = new Map(draft.map((row) => [this.table.trackBy(row), row] as const));
    const payload = ids
      .map((id) => rowsById.get(id))
      .filter((row): row is EditRow => row !== undefined);

    for (const id of ids) {
      this.table.editing.update(endEdit<EditRow>(id, rowsById.get(id)));
    }

    const options: RowEditRequestOptions = { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() };
    this.rowEditApi.saveBulk(payload, options).subscribe({
      next: (saved) => {
        ids.forEach((id, index) => {
          const savedRow = saved[index];
          if (savedRow === undefined) return;
          this.table.value.update(patchRow<EditRow>(id, savedRow));
          this.table.editing.update(swapRowId<EditRow>(id, savedRow.id));
          this.table.editing.update(releaseEdit<EditRow>(savedRow.id));
        });
        this.ui.clearPending();
        this.ui.setSummary(`Saved ${saved.length} row(s) in one batch.`);
      },
      error: (error: unknown) => {
        // One rollback unit: every row in the batch reverts to its blank snapshot and reopens
        // together, not independently — the contrast with `saveAll()`'s N-independent-requests
        // shape. `ui.pendingIds()` stays set so retry re-posts.
        for (const id of ids) {
          this.table.editing.update(revertEdit<EditRow>(id));
          this.table.editing.update(beginEdit<EditRow>(id));
        }
        this.ui.setSummary(error instanceof Error ? error.message : 'Batch save failed.');
      },
    });
  }
}
