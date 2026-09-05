import { Component, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { catchError, forkJoin, map, of, tap, type Observable } from 'rxjs';
import { createTable } from '../../api/create-table';
import { beginEdit, clearEdit, endEdit } from '../../mutations/row-edit-mutations';
import { patchRow } from '../../mutations/row-mutations';
import {
  discardEdit,
  releaseEdit,
  revertEdit,
  swapRowId,
} from '../../mutations/optimistic-mutations';
import { NgpTableRowFieldDirective } from '../../directives/ngp-table-row-field.directive';
import type { RowId } from '../../api/types';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../row-edit.mock';
import { editRowsSchema, gatedTableSchema } from '../row-edit.schema';
import { injectRowEditApi } from '../row-edit.http';
import { containFocusTab } from '../row-edit.utils';
import type { EditRow } from '../row-edit.types';

/**
 * S2/S5 — the gated table (`withRowEdit()`), fixed to single-row + pessimistic save: the row
 * stays open for the whole round trip, and `endEdit` only runs once the real MSW-intercepted
 * `fetch` resolves — a failure leaves the row open with its draft intact, no rollback needed
 * since nothing closed early. `multiple` is left unconfigured — `gatedTableSchema()` defaults to
 * single-row (D14). See `../gated-single-optimistic/` for the same single-row surface with an
 * optimistic (close-then-reconcile) save, and `../gated-multiple-optimistic/` for several rows
 * open at once.
 *
 * This story is the one that demonstrates D49/G3's **second** bug, not its first: because the
 * row is still genuinely `open` (never closed early) at the moment a create's server response
 * lands, `swapRowId(tempId, saved.id)` here re-keys `open` itself — the case where, without it,
 * ADR-0006's reconciliation would silently prune the row out of edit mode the instant its id
 * changed underneath it. (`../gated-single-optimistic/`'s doc-comment covers the sibling bug —
 * a `pending` snapshot orphaned after the row already closed.) Known limitation this does
 * **not** fix: `@for (...; track row.id)` still recreates the `<tr>` on an id change, which can
 * take focus with it (G9).
 */
@Component({
  selector: 'ngp-gated-single-pessimistic-story-host',
  imports: [FormField, NgpTableRowFieldDirective],
  templateUrl: './gated-single-pessimistic-story-host.component.html',
  styleUrl: '../row-edit-story.css',
})
export class GatedSinglePessimisticStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(600);

  private readonly rowEditApi = injectRowEditApi();

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

  /** Ids added this session that have never reached the server — decides `POST` vs `PUT` in
   * `saveEditPessimistic`. Cleared once a create succeeds. */
  protected readonly pendingCreateIds = signal<ReadonlySet<RowId>>(new Set());

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
    this.markPendingCreate(id);
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
    this.markPendingCreate(id);
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

  /** Removes the row and closes it. Available on any open row. A row never saved to the server
   * (`pendingCreateIds`) has nothing to delete remotely — `discardEdit` alone is correct there;
   * anything else goes through a real `DELETE` first. */
  protected discardRow(id: RowId): void {
    this.clearRowError(id);

    if (this.pendingCreateIds().has(id)) {
      this.table.editing.update(discardEdit(id));
      this.clearNeedsUniqueName(id);
      this.removePendingCreate(id);
      return;
    }

    this.rowEditApi
      .deleteRow(id, { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() })
      .subscribe({
        next: () => {
          this.table.editing.update(discardEdit(id));
          this.clearNeedsUniqueName(id);
        },
        error: (error: unknown) => {
          this.setRowError(id, error instanceof Error ? error.message : 'Delete failed.');
        },
      });
  }

  protected clearAll(): void {
    // clearEdit: closes every open row, dropping their restore points.
    this.table.editing.update(clearEdit());
    this.needsUniqueName.set(new Set());
    this.rowErrors.set(new Map());
    this.pendingCreateIds.set(new Set());
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
      this.saveEdit(id);
      return;
    }
    if (event.key === 'Tab') {
      containFocusTab(event, event.currentTarget as HTMLElement);
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
    this.clearRowError(id);
  }

  /** §1.8 save-all: reuses `saveEdit$` per open row rather than inventing a batched verb — the
   * library has none for this. `forkJoin` subscribes to every row's save Observable up front and
   * completes once all of them have (each internally catches its own failure, so one row failing
   * never short-circuits the others). A pessimistic failure leaves its row open, so only rows
   * that actually saved end up closed. */
  protected saveAll(): void {
    this.saveAllSummary.set(null);
    const openIds = Array.from(this.table.editing());
    if (openIds.length === 0) {
      this.saveAllSummary.set('No open rows to save.');
      return;
    }

    forkJoin(openIds.map((id) => this.saveEdit$(id))).subscribe(() => {
      const failedIds = openIds.filter((id) => this.rowErrors().has(id));
      const succeededCount = openIds.length - failedIds.length;
      this.saveAllSummary.set(
        failedIds.length === 0
          ? `Saved all ${succeededCount} row(s).`
          : `Saved ${succeededCount} of ${openIds.length} row(s); ${failedIds.length} failed.`,
      );
    });
  }

  /** §2.3 "add several in a run": saves the open row, then — only once it actually saved —
   * opens a fresh blank row via the same `beginEdit({ insert, at })` path `addBlankRow()` uses. */
  protected saveAndAddNext(id: RowId): void {
    this.saveEdit$(id).subscribe(() => {
      if (this.rowErrors().has(id)) {
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
   * Returns an `Observable<void>` (not a fire-and-forget `.subscribe()`) so `saveAll`/
   * `saveAndAddNext` can compose completion via `forkJoin`/`.subscribe()` themselves. */
  private saveEdit$(id: RowId): Observable<void> {
    this.clearRowError(id);
    if (this.forcedInvalid().has(id)) {
      this.setRowError(id, 'Row is marked invalid — clear "Force invalid" before saving.');
      return of(undefined);
    }

    const row = this.table.draft().find((candidate) => this.table.trackBy(candidate) === id);
    if (row === undefined) {
      return of(undefined);
    }
    const isCreate = this.pendingCreateIds().has(id);

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
            this.removePendingCreate(id);
          } else {
            this.table.editing.update(endEdit(id, row));
            this.table.editing.update(releaseEdit(id));
          }
          this.clearNeedsUniqueName(id);
        }),
        map(() => undefined),
        catchError((error: unknown) => {
          this.setRowError(id, error instanceof Error ? error.message : 'Save failed.');
          return of(undefined);
        }),
      );
  }

  private markPendingCreate(id: RowId): void {
    this.pendingCreateIds.update((ids) => new Set(ids).add(id));
  }

  private removePendingCreate(id: RowId): void {
    if (!this.pendingCreateIds().has(id)) return;
    this.pendingCreateIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
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
