import { Component, computed, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { insertRow, patchRow, removeRow } from '../../../mutations/row-mutations';
import {
  captureEdit,
  releaseEdit,
  removeEdit,
  revertEdit,
  swapRowId,
} from '../../../mutations/optimistic-mutations';
import type { RowId } from '../../../api/types';
import { CommitCounterComponent } from '../ui/commit-counter.component';
import { FocusNewRowDirective } from '../ui/focus-new-row.directive';
import { EDIT_ROWS_MOCK, DEPT_OPTIONS } from '../fixtures/mock';
import { rowLabel } from '../fixtures/utils';
import { injectRowEditApi, type RowEditRequestOptions } from '../fixtures/http';
import { createLocalUndoSlot } from '../ui/local-undo-slot';
import { createRowFlags } from '../ui/row-flags';
import { ROW_EDIT_STORY_PIPES } from '../row-edit-story.pipes';
import { createTable } from '../../../api/create-table';
import { withOptimistic } from '../../../api/features/with-optimistic';
import { withSorting } from '../../../api/features/with-sorting';
import { editTableConfig, editRowsSchema } from '../fixtures/schema';
import type { EditRow } from '../fixtures/types';
import { watchFieldCommits } from './field-commit-watcher';
import type { EditableField, FieldCommit } from './live-table.types';

const EDITABLE_FIELDS: readonly EditableField[] = ['name', 'dept'];

/**
 * Live table, no edit session
 *
 * No `withRowEdit()` composed — every field is always an input, and a field commit is what
 * saves. `withOptimistic()` is composed only for its rollback verbs; every commit is a real
 * round trip (create/update/delete).
 *
 * The local undo slot stays local-only.
 */
@Component({
  selector: 'ngp-live-table-story-host',
  imports: [FormField, FocusNewRowDirective, CommitCounterComponent, ...ROW_EDIT_STORY_PIPES],
  templateUrl: './live-table-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', './live-table-story-host.component.css'],
  host: {
    '(keydown)': 'onKeydown($event)',
  },
})
export class LiveTableStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(600);

  private readonly rowEditApi = injectRowEditApi();

  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, editTableConfig, withSorting(), withOptimistic());
  protected readonly rows = form(this.data, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;
  protected readonly insertAt = signal(0);

  /** Row from `insertRow()` still awaiting its first field commit — marks the row `new` (§2.1)
   * for focus + styling until its first commit clears it. */
  protected readonly newRowId = signal<RowId | null>(null);

  /** The single local undo slot (§1.3, §3.2) — last field commit or last discarded row,
   * whichever happened most recently. Live mode has no Cancel session to fall back on, so this
   * is the only recovery path. */
  private readonly undo = createLocalUndoSlot<EditRow, EditableField>(rowLabel);

  /** Screen-reader announcement for the discard/undo pair — a removed row is otherwise a silent
   * change (§3.1). */
  protected readonly announcement = signal('');

  /** Demo-only per-row UI bookkeeping (pending-create ids, persistent save/create/delete errors)
   * — see `row-flags.ts`. */
  protected readonly flags = createRowFlags();

  protected readonly undoLabel = computed(() => this.undo.label());

  protected readonly requestOptions = computed<RowEditRequestOptions>(() => ({
    forceFailure: this.forceFailure(),
    latencyMs: this.latencyMs(),
  }));

  constructor() {
    watchFieldCommits(this.data, EDITABLE_FIELDS, (commit) => this.onFieldCommit(commit));
  }

  protected insertRow(): void {
    const id = crypto.randomUUID();
    this.newRowId.set(id);
    this.flags.markPendingCreate(id);
    this.table.value.update(
      insertRow(
        { id, name: '', dept: DEPT_OPTIONS[0] },
        { at: this.insertAt() },
      ),
    );
  }

  /** Re-sends the row's current value — a create `POST`s again, an update `PUT`s again. Simple
   * by design: a retried update just re-saves whatever `revertEdit` already put back on screen. */
  protected retryRow(id: RowId): void {
    const row = this.data().find((candidate) => this.table.trackBy(candidate) === id);
    if (row === undefined) return;

    if (this.flags.pendingCreateIds().has(id)) {
      this.postCreate(id, row);
    } else {
      this.putUpdate(id, row);
    }
  }

  protected dismissError(id: RowId): void {
    this.flags.clearRowError(id);
  }

  /** The discard flow's forward half: removes the row immediately (optimistic — §3.1: "the row
   * disappears immediately on activation") and parks it — with the index it sat at — in the undo
   * slot once the delete is confirmed. No confirmation dialog: undo is the safety net for a
   * single row (§3.2). A row never saved to the server (`pendingCreateIds`) has nothing to
   * delete remotely — removing it locally is correct and final. */
  protected discardRow(id: RowId): void {
    const at = this.data().findIndex((row) => this.table.trackBy(row) === id);
    if (at === -1) return;
    const row = this.data()[at];
    this.flags.clearRowError(id);

    if (this.flags.pendingCreateIds().has(id)) {
      this.table.value.update(removeRow<EditRow>(id));
      this.flags.removePendingCreate(id);
      this.undo.recordDiscard(row, at);
      this.announcement.set(`${rowLabel(row)} discarded. Undo available.`);
      if (this.newRowId() === id) this.newRowId.set(null);
      return;
    }

    // removeEdit: captures the restore point and removes the row in one call — a real `DELETE`
    // follows; a failure calls `revertEdit` below to bring it back (§3.1's failure behavior).
    this.table.editing.update(removeEdit<EditRow>(id));
    if (this.newRowId() === id) this.newRowId.set(null);
    this.deleteRow(id, row, at);
  }

  private deleteRow(id: RowId, row: EditRow, at: number): void {
    this.rowEditApi.deleteRow(id, this.requestOptions()).subscribe({
      next: () => {
        // Confirmed — drop the restore point and hand the discard to the local undo slot, same
        // as every other discard (§3.2's own undo, unrelated to the rollback `removeEdit` held).
        this.table.editing.update(releaseEdit<EditRow>(id));
        this.undo.recordDiscard(row, at);
        this.announcement.set(`${rowLabel(row)} discarded. Undo available.`);
      },
      error: (error: unknown) => {
        // Refused — revertEdit puts the row back where it was; no Undo needed, it never left.
        this.table.editing.update(revertEdit<EditRow>(id));
        this.flags.setRowError(id, error instanceof Error ? error.message : 'Delete failed.');
        this.announcement.set(`${rowLabel(row)} could not be deleted.`);
      },
    });
  }

  /** The discard flow's back half, shared with field-commit undo: a discarded row goes back at
   * the index it was removed from, a committed field back to its previous value. */
  protected undoLastAction(): void {
    const action = this.undo.consume();
    if (action === null) return;

    if (action.kind === 'discard') {
      this.table.value.update(insertRow<EditRow>(action.row, { at: action.at }));
      this.announcement.set(`${rowLabel(action.row)} restored.`);
    } else {
      const patch: Partial<EditRow> =
        action.field === 'name' ? { name: action.previousValue } : { dept: action.previousValue };
      this.table.value.update(patchRow<EditRow>(action.id, patch));
    }
  }

  /** Ctrl+Z / Cmd+Z drives the same undo slot as the toolbar button — the only undo affordance
   * live mode gets, since there's no open/Cancel session to fall back on (§1.3). */
  protected onKeydown(event: KeyboardEvent): void {
    const isUndoChord =
      (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
    if (!isUndoChord || this.undo.action() === null) return;

    event.preventDefault();
    this.undoLastAction();
  }

  /** `watchFieldCommits`'s callback: records the changed field as the undo target, clears
   * `newRowId`'s marking the first time its row picks up a real edit — an insert alone never
   * counts, since the inserted id is absent from the previous snapshot — then saves. A commit is
   * what actually saves in live mode (there's no separate Save button): the first one on a
   * `pendingCreateIds` row creates it, every other commit updates it. A discard changes no
   * surviving row, so it never overwrites the undo entry it just recorded. */
  private onFieldCommit(commit: FieldCommit): void {
    const { row, previousRow, field } = commit;
    this.undo.recordCommit(row.id, field, previousRow[field]);
    if (this.newRowId() === row.id) {
      this.newRowId.set(null);
    }

    if (this.flags.pendingCreateIds().has(row.id)) {
      this.postCreate(row.id, row);
    } else {
      this.putUpdate(row.id, previousRow);
    }
  }

  /** Create: fires only from a `pendingCreateIds` row's first commit — a blank row is nothing to
   * save yet. No `captureEdit`/`revertEdit` on failure: per §2.1's failure behavior the typed
   * values stay on screen for a retry, there's no snapshot to roll back *to*. On success,
   * `patchRow` lands the server's id and `swapRowId(id, saved.id)` re-keys `snapshots` so a
   * later commit's `captureEdit`/`releaseEdit` addresses the right row (D49). */
  private postCreate(id: RowId, row: EditRow): void {
    this.flags.clearRowError(id);
    this.rowEditApi.saveRow(id, row, true, this.requestOptions()).subscribe({
      next: (saved) => {
        this.table.value.update(patchRow<EditRow>(id, saved));
        this.table.editing.update(swapRowId<EditRow>(id, saved.id));
        this.flags.removePendingCreate(id);
      },
      error: (error: unknown) => {
        this.flags.setRowError(id, error instanceof Error ? error.message : 'Create failed.');
      },
    });
  }

  /** Update: `captureEdit(id, previousRow)` takes the pre-commit value *before* the request goes
   * out, so `table.pending()` reflects the in-flight save immediately; `releaseEdit` on
   * confirmation, `revertEdit` (back to `previousRow`) on failure — §1.1's failure behavior. */
  private putUpdate(id: RowId, previousRow: EditRow): void {
    this.flags.clearRowError(id);
    this.table.editing.update(captureEdit<EditRow>(id, previousRow));

    const row = this.data().find((candidate) => this.table.trackBy(candidate) === id);
    if (row === undefined) {
      this.table.editing.update(releaseEdit<EditRow>(id));
      return;
    }

    this.rowEditApi.saveRow(id, row, false, this.requestOptions()).subscribe({
      next: () => {
        this.table.editing.update(releaseEdit<EditRow>(id));
      },
      error: (error: unknown) => {
        this.flags.setRowError(id, error instanceof Error ? error.message : 'Save failed.');
        this.table.editing.update(revertEdit<EditRow>(id));
      },
    });
  }
}
