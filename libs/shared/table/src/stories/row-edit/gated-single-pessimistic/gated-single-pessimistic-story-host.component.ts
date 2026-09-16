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

/**
 * S2/S5 — `withRowEdit()` single-row + pessimistic save: the row stays open for the whole round
 * trip; `endEdit` runs only once the real MSW-intercepted `fetch` resolves, so a failure just
 * leaves the row open with its draft intact (D14). See `../gated-single-optimistic/` for the
 * optimistic sibling and `../gated-multiple-optimistic/` for several rows open at once.
 * Create's success path re-keys `open` while the row is still open (`swapRowId`, D49/G3).
 * Known limitation: `@for` still recreates the `<tr>` on an id change (G9).
 */
@Component({
  selector: 'ngp-gated-single-pessimistic-story-host',
  imports: [FormField, NgpTableRowFieldDirective],
  templateUrl: './gated-single-pessimistic-story-host.component.html',
  styleUrl: '../../styles/story-host.css',
})
export class GatedSinglePessimisticStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(600);

  private readonly rowEditApi = injectRowEditApi();

  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, editTableConfig, withRowEdit());
  /** Gated mode's commit boundary is the row (OQ-3) — `form()` writes into `table.draft` instead
   * of `data`, so a field's blur-commit can't move the row under the user or leak into the
   * pipeline before Save (`withRowEdit()`'s `draft` member, `api/features/draft-rows.ts`). */
  protected readonly rows = form(this.table.draft, editRowsWithUniqueNameSchema);
  protected readonly deptOptions = DEPT_OPTIONS;
  protected readonly insertAt = signal(0);

  protected readonly flags = createRowFlags();

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

  protected openEdit(id: RowId): void {
    // beginEdit: opens the row; existing restore point wins if one is already held (D31.1).
    this.table.editing.update(beginEdit(id));
  }

  /** Resets the row to its snapshot and closes it. Available on any open row. */
  protected cancelEdit(id: RowId): void {
    this.table.editing.update(revertEdit(id));
    this.flags.clearRowError(id);
  }

  /** Removes the row and closes it. Available on any open row. A row never saved to the server
   * (`pendingCreateIds`) has nothing to delete remotely — `discardEdit` alone is correct there;
   * anything else goes through a real `DELETE` first. */
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

  /** Checks force-invalid, then dispatches to the one save path this story has — no mode
   * branch, unlike `gated-edit/`'s dual-path predecessor. */
  protected saveEdit(id: RowId): void {
    this.saveEdit$(id).subscribe();
  }

  /** A pessimistic failure never closes the row (the catch below only records the error) — so
   * retry is just re-running `saveEdit`, no reopen branch needed. */
  protected retrySave(id: RowId): void {
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

  /** Pessimistic save (S2/S5): the row stays open, unsorted, for the whole round trip — a real
   * MSW-intercepted `HttpClient` request (`POST` for a `pendingCreateIds` row, `PUT` otherwise),
   * merging the draft into `data` and closing only on success keeps the resort and the edit-mode
   * close atomic, instead of resorting under a still-open row the moment Save is clicked.
   *
   * Create's success path re-keys *while the row is still `open`* — `swapRowId` runs before
   * `endEdit` closes it, which is the scenario the class doc-comment calls out: without the
   * swap, ADR-0006's reconciliation would prune the row (and its live edit) the instant
   * `patchRow` changes its id, instead of `swapRowId` beating that effect to the punch (D49).
   *
   * Returns an `Observable<void>` (not a fire-and-forget `.subscribe()`) so `saveAndAddNext`
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
    const isCreate = this.flags.pendingCreateIds().has(id);

    return this.rowEditApi
      .saveRow(id, row, isCreate, { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() })
      .pipe(
        tap((saved) => {
          if (isCreate) {
            this.table.value.update(patchRow<EditRow>(id, saved));
            this.table.editing.update(swapRowId<EditRow>(id, saved.id));
            // D41: closing keeps the restore point, so a purely local save releases it too —
            // otherwise the row would sit in `pending` with nothing left to confirm it.
            this.table.editing.update(endEdit(saved.id, saved));
            this.table.editing.update(releaseEdit(saved.id));
            this.flags.removePendingCreate(id);
          } else {
            this.table.editing.update(endEdit(id, row));
            this.table.editing.update(releaseEdit(id));
          }
        }),
        map(() => undefined),
        catchError((error: unknown) => {
          this.flags.setRowError(id, error instanceof Error ? error.message : 'Save failed.');
          return of(undefined);
        }),
      );
  }
}
