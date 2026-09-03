import { Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createTable } from '../../api/create-table';
import { beginEdit, clearEdit, endEdit } from '../../mutations/row-edit-mutations';
import { discardEdit, releaseEdit, revertEdit } from '../../mutations/optimistic-mutations';
import { NgpTableRowFieldDirective } from '../../directives/ngp-table-row-field.directive';
import type { RowId } from '../../api/types';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../row-edit.mock';
import { editRowsSchema, gatedTableSchema } from '../row-edit.schema';
import { containFocusTab, saveRowPessimistic } from '../row-edit.utils';
import type { EditRow } from '../row-edit.types';

/**
 * S2/S5 — the gated table (`withRowEdit()`), fixed to single-row + pessimistic save: the row
 * stays open for the whole round trip, and `endEdit(id, row)` only runs once
 * `saveRowPessimistic` resolves — a failure leaves the row open with its draft intact, no
 * rollback needed since nothing closed early. `multiple` is left unconfigured —
 * `gatedTableSchema()` defaults to single-row (D14). See `../gated-single-optimistic/` for the
 * same single-row surface with an optimistic (close-then-reconcile) save, and
 * `../gated-multiple-optimistic/` for several rows open at once.
 */
@Component({
  selector: 'ngp-gated-single-pessimistic-story-host',
  imports: [FormField, NgpTableRowFieldDirective],
  templateUrl: './gated-single-pessimistic-story-host.component.html',
  styleUrl: '../row-edit-story.css',
})
export class GatedSinglePessimisticStoryHostComponent {
  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, gatedTableSchema());
  /** Gated mode's commit boundary is the row (OQ-3) — `form()` writes into `table.draft` instead
   * of `data`, so a field's blur-commit can't move the row under the user or leak into the
   * pipeline before Save (`withRowEdit()`'s `draft` member, `api/features/draft-rows.ts`). */
  protected readonly rows = form(this.table.draft, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;
  protected readonly insertAt = signal(0);
  protected readonly saveAllSummary = signal<string | null>(null);

  /** id -> a save failure's message, persistent until dismissed or retried (§1.4) — unlike the
   * old single `saveError` signal, this doesn't clear itself on an unrelated action, and it's
   * keyed per row so `saveAll()` can report which rows failed. */
  protected readonly rowErrors = signal<ReadonlyMap<RowId, string>>(new Map());

  /** Row ids a "Force invalid" toggle has marked — disables Save and shows the reason at the
   * cell (§1.7), independent of the form's own validity. */
  protected readonly forcedInvalid = signal<ReadonlySet<RowId>>(new Set());

  /** Row ids whose `name` was copied verbatim from a duplicate's source — flagged so the UI can
   * visibly mark the field as needing a change rather than silently copying a collision
   * (`0-product/row-editing.md` §4.1). Cleared once the row leaves editing, whatever the exit. */
  protected readonly needsUniqueName = signal<ReadonlySet<RowId>>(new Set());

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
    // §4.1: `name` was copied verbatim from `source` — flag it as needing a change instead of
    // silently copying a collision.
    this.needsUniqueName.update((ids) => new Set(ids).add(id));
  }

  protected openEdit(id: RowId): void {
    // beginEdit: opens the row; existing restore point wins if one is already held (D31.1).
    this.table.editing.update(beginEdit(id));
  }

  /** Resets the row to its snapshot and closes it. Available on any open row. */
  protected cancelEdit(id: RowId): void {
    this.table.editing.update(revertEdit(id));
    this.clearNeedsUniqueName(id);
    this.clearRowError(id);
  }

  /** Removes the row and closes it — one call (`discardEdit`). Available on any open row,
   * whether it pre-existed or was just added: discarding an edit to an existing row removes it
   * too, deliberately. */
  protected discardRow(id: RowId): void {
    this.table.editing.update(discardEdit(id));
    this.clearNeedsUniqueName(id);
    this.clearRowError(id);
  }

  protected clearAll(): void {
    // clearEdit: closes every open row, dropping their restore points.
    this.table.editing.update(clearEdit());
    this.needsUniqueName.set(new Set());
    this.rowErrors.set(new Map());
  }

  /** §1.7: per-row toggle that blocks Save independent of form validity — "Force invalid". */
  protected toggleForceInvalid(id: RowId): void {
    this.forcedInvalid.update((ids) => {
      const next = new Set(ids);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
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
      void this.saveEdit(id);
      return;
    }
    if (event.key === 'Tab') {
      containFocusTab(event, event.currentTarget as HTMLElement);
    }
  }

  /** Checks force-invalid, then dispatches to the one save path this story has — no mode
   * branch, unlike `gated-edit/`'s dual-path predecessor. */
  protected async saveEdit(id: RowId): Promise<void> {
    this.clearRowError(id);
    if (this.forcedInvalid().has(id)) {
      this.setRowError(id, 'Row is marked invalid — clear "Force invalid" before saving.');
      return;
    }

    await this.saveEditPessimistic(id);
  }

  /** A pessimistic failure never closes the row (the catch below only records the error) — so
   * retry is just re-running `saveEdit`, no reopen branch needed. */
  protected retrySave(id: RowId): void {
    void this.saveEdit(id);
  }

  protected dismissError(id: RowId): void {
    this.clearRowError(id);
  }

  /** §1.8 save-all: reuses `saveEdit` per open row rather than inventing a batched verb — the
   * library has none for this. A pessimistic failure leaves its row open, so only rows that
   * actually saved end up closed. */
  protected async saveAll(): Promise<void> {
    this.saveAllSummary.set(null);
    const openIds = Array.from(this.table.editing());
    if (openIds.length === 0) {
      this.saveAllSummary.set('No open rows to save.');
      return;
    }

    await Promise.all(openIds.map((id) => this.saveEdit(id)));

    const failedIds = openIds.filter((id) => this.rowErrors().has(id));
    const succeededCount = openIds.length - failedIds.length;
    this.saveAllSummary.set(
      failedIds.length === 0
        ? `Saved all ${succeededCount} row(s).`
        : `Saved ${succeededCount} of ${openIds.length} row(s); ${failedIds.length} failed.`,
    );
  }

  /** §2.3 "add several in a run": saves the open row, then — only once it actually saved —
   * opens a fresh blank row via the same `beginEdit({ insert, at })` path `addBlankRow()` uses. */
  protected async saveAndAddNext(id: RowId): Promise<void> {
    await this.saveEdit(id);
    if (this.rowErrors().has(id)) {
      return;
    }
    this.addBlankRow();
  }

  /** Pessimistic save (S2/S5): the row stays open, unsorted, for the whole round trip — merging
   * the draft into `data` and closing only on success (`endEdit(id, row)`) keeps the resort and
   * the edit-mode close atomic, instead of resorting under a still-open row the moment Save is
   * clicked. */
  private async saveEditPessimistic(id: RowId): Promise<void> {
    const row = this.table.draft().find((candidate) => this.table.trackBy(candidate) === id);
    if (row === undefined) {
      return;
    }

    try {
      await saveRowPessimistic(row);
      // D41: closing keeps the restore point, so a purely local save releases it too —
      // otherwise the row would sit in `pending` with nothing left to confirm it.
      this.table.editing.update(endEdit(id, row));
      this.table.editing.update(releaseEdit(id));
      this.clearNeedsUniqueName(id);
    } catch (error) {
      this.setRowError(id, error instanceof Error ? error.message : 'Save failed.');
    }
  }

  /** Drops `id`'s duplicate flag once its row leaves editing, whatever the exit path. */
  private clearNeedsUniqueName(id: RowId): void {
    if (!this.needsUniqueName().has(id)) return;
    this.needsUniqueName.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  private setRowError(id: RowId, message: string): void {
    this.rowErrors.update((errors) => new Map(errors).set(id, message));
  }

  private clearRowError(id: RowId): void {
    if (!this.rowErrors().has(id)) return;
    this.rowErrors.update((errors) => {
      const next = new Map(errors);
      next.delete(id);
      return next;
    });
  }
}
