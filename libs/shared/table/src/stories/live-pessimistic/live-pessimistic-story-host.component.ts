import { Component, ElementRef, afterRenderEffect, inject, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { finalize } from 'rxjs';
import { createTable } from '../../api/create-table';
import { captureEdit, patchEdit, releaseEdit, swapRowId } from '../../mutations/optimistic-mutations';
import { insertRow, patchRow, removeRow } from '../../mutations/row-mutations';
import type { RowId } from '../../api/types';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../row-edit.mock';
import { editRowsSchema, liveOptimisticSchema } from '../row-edit.schema';
import { injectRowEditApi } from '../row-edit.http';
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
 *
 * `addRow()` inserts a blank row under a temp id (`pendingCreateIds`); its first blur `POST`s
 * (create) instead of `PUT`s, reverting to blank before the request the same as every other
 * commit here — deliberately hiding the typed value even on the happy path, consistent with this
 * story's whole character (not §2.1's "typed values survive a failure," which is
 * `../live-table/`'s and `../live-optimistic/`'s answer instead). On success, `patchRow` writes
 * the server's id + value in one step and `swapRowId(tempId, saved.id)` re-keys the snapshot.
 * `discardRow` doesn't remove the row until the server confirms the delete — consistent with
 * "nothing ever looks committed until confirmed" — rather than `../live-optimistic/`'s
 * remove-then-rollback-on-failure.
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
  protected readonly insertAt = signal(0);
  /** Ids added this session that have never reached the server. */
  protected readonly pendingCreateIds = signal<ReadonlySet<RowId>>(new Set());
  /** The just-inserted row to focus once rendered — cleared the moment it's left. */
  protected readonly newRowId = signal<RowId | null>(null);

  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly rowEditApi = injectRowEditApi();

  /** Pre-edit value per row, read at focus time. `captureEdit`'s restore point has no public
   * getter to read a single held value back out — only the mutation verbs — so the host keeps its
   * own copy to reach the value on blur, before reverting. */
  private readonly preEditValues = new Map<RowId, EditRow>();

  constructor() {
    // Moves focus into the newly-inserted row's first input once it has rendered.
    afterRenderEffect({
      write: () => {
        const id = this.newRowId();
        if (id === null) return;
        this.elementRef.nativeElement
          .querySelector<HTMLInputElement>(`tr[data-row-new="${id}"] input`)
          ?.focus();
      },
    });
  }

  /** Inserts a blank row under a temp client id — nothing is saved yet; the row's first blur
   * (`save()`) is what actually creates it. */
  protected addRow(): void {
    const id = crypto.randomUUID();
    this.newRowId.set(id);
    this.pendingCreateIds.update((ids) => new Set(ids).add(id));
    this.liveTable.value.update(
      insertRow<EditRow>({ id, name: '', dept: DEPT_OPTIONS[0] }, { at: this.insertAt() }),
    );
  }

  /** Doesn't remove the row until the server confirms — consistent with this story's "nothing
   * ever looks committed until confirmed" character. A row never saved to the server
   * (`pendingCreateIds`) has nothing to delete remotely, so it's removed locally, final. */
  protected discardRow(id: RowId): void {
    this.saveError.set(null);

    if (this.pendingCreateIds().has(id)) {
      this.liveTable.value.update(removeRow<EditRow>(id));
      this.removePendingCreate(id);
      if (this.newRowId() === id) this.newRowId.set(null);
      return;
    }

    this.savingIds.update((ids) => new Set(ids).add(id));
    this.remove(id);
  }

  private remove(id: RowId): void {
    this.rowEditApi
      .deleteRow(id, { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() })
      .pipe(
        finalize(() => {
          this.savingIds.update((ids) => {
            const next = new Set(ids);
            next.delete(id);
            return next;
          });
        }),
      )
      .subscribe({
        next: () => {
          this.liveTable.value.update(removeRow<EditRow>(id));
        },
        error: (error: unknown) => {
          // Refused — the row was never removed from screen, so there's nothing to put back.
          this.saveError.set(error instanceof Error ? error.message : 'Delete failed.');
        },
      });
  }

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
    if (this.newRowId() === id) {
      this.newRowId.set(null);
    }
    setTimeout(() => this.save(id));
  }

  private save(id: RowId): void {
    const typedRow = this.data().find((candidate) => this.liveTable.trackBy(candidate) === id);
    const preEditRow = this.preEditValues.get(id);
    if (typedRow === undefined || preEditRow === undefined) {
      return;
    }
    const isCreate = this.pendingCreateIds().has(id);

    this.saveError.set(null);
    // Revert-before-send: write the pre-edit value back right now, before the request even goes
    // out. `patchEdit`'s default `capture: 'if-absent'` leaves the snapshot `captureEdit` already
    // took alone — nothing re-captures here.
    this.liveTable.editing.update(patchEdit<EditRow>(id, preEditRow));
    this.savingIds.update((ids) => new Set(ids).add(id));

    this.rowEditApi
      .saveRow(id, typedRow, isCreate, { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() })
      .pipe(
        finalize(() => {
          this.savingIds.update((ids) => {
            const next = new Set(ids);
            next.delete(id);
            return next;
          });
          this.preEditValues.delete(id);
        }),
      )
      .subscribe({
        next: (saved) => {
          if (isCreate) {
            // patchRow writes the new id and the typed values in one step — no separate "reveal"
            // patch needed, unlike the update path below.
            this.liveTable.value.update(patchRow<EditRow>(id, saved));
            this.liveTable.editing.update(swapRowId<EditRow>(id, saved.id));
            this.liveTable.editing.update(releaseEdit<EditRow>(saved.id));
            this.removePendingCreate(id);
          } else {
            // Confirmed — reveal the new value, then drop the now-spent snapshot.
            this.liveTable.editing.update(patchEdit<EditRow>(id, typedRow));
            this.liveTable.editing.update(releaseEdit<EditRow>(id));
          }
        },
        error: (error: unknown) => {
          // `data` already shows the pre-edit value from the revert above — nothing left to roll
          // back, just drop the snapshot and surface the error. A failed create stays
          // `pendingCreateIds`, so the next commit on this row retries the `POST`.
          this.saveError.set(error instanceof Error ? error.message : 'Save failed.');
          this.liveTable.editing.update(releaseEdit<EditRow>(id));
        },
      });
  }

  private removePendingCreate(id: RowId): void {
    if (!this.pendingCreateIds().has(id)) return;
    this.pendingCreateIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

}
