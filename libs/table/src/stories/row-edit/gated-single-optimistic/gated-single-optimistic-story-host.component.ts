import { Component, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { catchError, map, of, tap, type Observable } from 'rxjs';
import { beginEdit, endEdit } from '../../../mutations/row-edit-mutations';
import { patchRow } from '../../../mutations/row-mutations';
import {
  discardEdit,
  releaseEdit,
  revertEdit,
  swapRowId,
} from '../../../mutations/optimistic-mutations';
import { NgpTableRowFieldDirective } from '../../../directives/ngp-table-row-field.directive';
import type { RowId } from '../../../api/types';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../fixtures/mock';
import { createTable } from '../../../api/create-table';
import { withRowEdit } from '../../../api/features/with-row-edit';
import { editTableConfig, editRowsWithUniqueNameSchema } from '../fixtures/schema';
import { injectRowEditApi } from '../fixtures/http';
import { containFocusTab } from '../fixtures/utils';
import type { EditRow } from '../fixtures/types';
import { createRowFlags } from '../ui/row-flags';
import { InsertRowToolbarComponent } from '../ui/insert-row-toolbar.component';

/**
 * Single-row gated editing, optimistic
 *
 * `withRowEdit()` fixed to single-row optimistic save: `endEdit` merges the draft and closes
 * the row immediately, then a real intercepted `fetch` reconciles it — `releaseEdit` on
 * success, `revertEdit` on failure.
 *
 * A never-saved row `POST`s instead of `PUT`s and re-keys via `swapRowId` once the response
 * lands; `discardRow` deletes through the server unless the row was never saved.
 */
@Component({
  selector: 'ngp-gated-single-optimistic-story-host',
  imports: [FormField, NgpTableRowFieldDirective, InsertRowToolbarComponent],
  templateUrl: './gated-single-optimistic-story-host.component.html',
  styleUrl: '../../styles/story-host.css',
})
export class GatedSingleOptimisticStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(600);

  private readonly rowEditApi = injectRowEditApi();

  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, editTableConfig, withRowEdit());
  /** Gated mode's commit boundary is the row (OQ-3) — `form()` writes into `table.draft` instead
   * of `data`, so a field's blur-commit can't move the row under the user or leak into the
   * pipeline before Save (`withRowEdit()`'s `draft` member, `api/features/editing/draft-rows.ts`). */
  protected readonly rows = form(this.table.draft, editRowsWithUniqueNameSchema);
  protected readonly deptOptions = DEPT_OPTIONS;

  /** Demo-only per-row UI bookkeeping — pending-create ids, duplicate-name flags, forced-invalid
   * toggle, per-row error message. See `../ui/row-flags.ts`. */
  protected readonly flags = createRowFlags();

  /** One add path (D36/D42): `beginEdit({ insert })` opens the row with a real-value snapshot,
   * same as `beginEdit` on an existing row. Discard-vs-reset is no longer chosen here — it's a
   * Cancel choice available on any open row, not something tied to how the row was added. */
  protected addBlankRow(insertAt = 0): void {
    const id = crypto.randomUUID();
    this.table.editing.update(
      beginEdit(id, {
        insert: { id, name: '', dept: DEPT_OPTIONS[0] },
        at: insertAt,
      }),
    );
    this.flags.markPendingCreate(id);
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
    // §4.1: `name` is copied verbatim from `source` — `editRowsWithUniqueNameSchema` flags the
    // collision (and any other, not just this one) once the row renders.
    this.table.editing.update(beginEdit(id, { insert: { ...source, id }, at }));
    this.flags.markPendingCreate(id);
  }

  /**
   * D31.2: single-mode switches by discarding the displaced row's unsaved draft, cleanly — not a
   * Save. Whether to warn before that discard is a consumer decision the library doesn't own; this
   * demonstrates the pattern — check the outgoing row's own `dirty` state (Signal Forms already
   * tracks it) and confirm before calling `beginEdit`, which is the only thing that triggers the
   * switch.
   */
  protected openEdit(id: RowId): void {
    const displacedId = [...this.table.editing()].find((openId) => openId !== id);
    if (displacedId !== undefined && this.isRowDirty(displacedId)) {
      const discard = confirm('This row has unsaved changes. Discard them and switch rows?');
      if (!discard) return;
    }
    // beginEdit: opens the row; existing restore point wins if one is already held (D31.1).
    this.table.editing.update(beginEdit(id));
  }

  private isRowDirty(id: RowId): boolean {
    const sourceIndex = this.table.renderRows().find((row) => row.id === id)?.sourceIndex;
    return sourceIndex === undefined ? false : this.rows[sourceIndex]().dirty();
  }

  /** Resets the row to its snapshot and closes it. Available on any open row. */
  protected cancelEdit(id: RowId): void {
    this.table.editing.update(revertEdit(id));
    this.flags.clearRowError(id);
  }

  /** Removes the row and closes it. Available on any open row, whether it pre-existed or was
   * just added: discarding an edit to an existing row removes it too, deliberately. A row never
   * saved to the server (`pendingCreateIds`) has nothing to delete remotely — `discardEdit`
   * alone is correct there. Anything else goes through a real `DELETE` first. */
  protected discardRow(id: RowId): void {
    this.flags.clearRowError(id);

    if (this.flags.pendingCreateIds().has(id)) {
      this.table.editing.update(discardEdit(id));
      this.flags.removePendingCreate(id);
      return;
    }

    this.rowEditApi
      .deleteRow(id, { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() })
      .subscribe({
        next: () => {
          this.table.editing.update(discardEdit(id));
        },
        error: (error: unknown) => {
          this.flags.setRowError(id, error instanceof Error ? error.message : 'Delete failed.');
        },
      });
  }

  /** §1.6 keyboard: Escape cancels the open row, Enter saves it, Tab stays inside the row's
   * cells. Bound on the row's `<tr>` (`event.currentTarget`), which doubles as the Tab-contain
   * boundary. */
  protected onRowKeydown(event: KeyboardEvent, id: RowId): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEdit(id);
      return;
    }
    if (event.key === 'Enter' && !(event.target instanceof HTMLTextAreaElement)) {
      event.preventDefault();
      this.saveEdit(id);
      return;
    }
    if (event.key === 'Tab' && event.currentTarget instanceof HTMLElement) {
      containFocusTab(event, event.currentTarget);
    }
  }

  /** Optimistic save (S4): merges the draft into `data` and closes the row immediately
   * (`endEdit(id, row)`), moving it to `pending`, then rolls back on a failed save or settles it
   * on success. A real MSW-intercepted `HttpClient` request, not a Promise stub —
   * `forceFailure`/`latencyMs` are Storybook-controlled request headers the handler reads
   * (`row-edit.handlers.ts`). A `pendingCreateIds` row `POST`s instead of `PUT`s; on success the
   * server's id lands via `patchRow` + `swapRowId(id, saved.id)` instead of a plain
   * `releaseEdit` — see the class doc-comment for what that does and doesn't fix. */
  protected saveEdit(id: RowId): void {
    this.saveEdit$(id).subscribe();
  }

  /** Re-runs the save that just failed (§1.4's Retry). An optimistic failure always closes and
   * reverts the row first, so retry always reopens it via `beginEdit` before saving again — not a
   * mode branch, just this save path's shape. */
  protected retrySave(id: RowId): void {
    if (!this.table.editing().has(id)) {
      this.table.editing.update(beginEdit(id));
    }
    this.saveEdit(id);
  }

  protected dismissError(id: RowId): void {
    this.flags.clearRowError(id);
  }

  /** §2.3 "add several in a run": saves the open row, then — only once it actually saved —
   * opens a fresh blank row via the same `beginEdit({ insert, at })` path `addBlankRow()` uses. */
  protected saveAndAddNext(id: RowId): void {
    this.saveEdit$(id).subscribe(() => {
      if (this.flags.rowErrors().has(id)) {
        return;
      }
      this.addBlankRow();
    });
  }

  /** Returns an `Observable<void>` (not a fire-and-forget `.subscribe()`) so `saveAndAddNext`
   * can compose completion via `.subscribe()` itself. */
  private saveEdit$(id: RowId): Observable<void> {
    this.flags.clearRowError(id);
    if (this.flags.forcedInvalid().has(id)) {
      this.flags.setRowError(id, 'Row is marked invalid — clear "Force invalid" before saving.');
      return of(undefined);
    }

    const row = this.table.draft().find((candidate) => this.table.trackBy(candidate) === id);
    if (row === undefined) {
      return of(undefined);
    }
    // endEdit(id, row): merges the draft and closes the row immediately, together — it shows as
    // `pending` (restore point kept) until the request below resolves it.
    this.table.editing.update(endEdit(id, row));
    const isCreate = this.flags.pendingCreateIds().has(id);

    return this.rowEditApi
      .saveRow(id, row, isCreate, { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() })
      .pipe(
        tap((saved) => {
          if (isCreate) {
            // patchRow lands the server's identity in `data`; swapRowId re-keys
            // `open`/`snapshots` to match before the reconciliation effect can flush.
            // releaseEdit under the new id then drops the now-correctly-keyed restore point.
            this.table.value.update(patchRow<EditRow>(id, saved));
            this.table.editing.update(swapRowId<EditRow>(id, saved.id));
            this.table.editing.update(releaseEdit<EditRow>(saved.id));
            this.flags.removePendingCreate(id);
          } else {
            // releaseEdit: save confirmed — drops the held restore point, row is no longer pending.
            this.table.editing.update(releaseEdit(id));
          }
        }),
        map(() => undefined),
        catchError((error: unknown) => {
          this.flags.setRowError(id, error instanceof Error ? error.message : 'Save failed.');
          // revertEdit: save failed — restores the pre-edit snapshot and closes the row.
          this.table.editing.update(revertEdit(id));
          return of(undefined);
        }),
      );
  }
}
