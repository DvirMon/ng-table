import { Component, computed, effect, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createTable } from '../../api/create-table';
import { insertRow, patchRow, removeRow } from '../../mutations/row-mutations';
import {
  captureEdit,
  releaseEdit,
  removeEdit,
  revertEdit,
  swapRowId,
} from '../../mutations/optimistic-mutations';
import type { RowId } from '../../api/types';
import { CommitCounterComponent } from '../commit-counter.component';
import { FocusNewRowDirective } from '../focus-new-row.directive';
import { EDIT_ROWS_MOCK, DEPT_OPTIONS } from '../row-edit.mock';
import { injectRowEditApi, type RowEditRequestOptions } from '../row-edit.http';
import { createLocalUndoSlot } from '../local-undo-slot';
import { editRowsSchema, liveTableSchema } from '../row-edit.schema';
import type { EditRow } from '../row-edit.types';
import type { EditableField } from './live-table.types';

const EDITABLE_FIELDS: readonly EditableField[] = ['name', 'dept'];

/** What a row is called in announcements and accessible labels — its name, or a stand-in when a
 * freshly-added row hasn't been named yet. */
function rowLabel(row: EditRow): string {
  return row.name.trim() === '' ? 'unnamed row' : `row ${row.name}`;
}

/**
 * S1 — the live table (D29): no `withRowEdit()` composed, inputs always render — there is still
 * no *session*, no Edit/Save/Cancel. The `ngp-commit-counter` in the template instruments
 * `data()` emissions to make the `debounce('blur')` commit boundary observable — typing does not
 * tick it, blur/select-change does. `withOptimistic()` is composed (see `row-edit.schema.ts`)
 * purely for its rollback verbs:
 * every commit is now a real MSW-intercepted round trip, not a local-only write.
 *
 * - **Edit**: on a field commit, `captureEdit(id, previousRow)` takes the pre-commit value, then
 *   a real `PUT` fires; failure calls `revertEdit(id)` (§1.1's failure behavior), success calls
 *   `releaseEdit(id)`.
 * - **Add**: `insertRow()` inserts a blank row under a temp client id (`pendingCreateIds`); its
 *   *first* field commit is what actually creates it (`POST`, not `PUT`) — a blank row is nothing
 *   to save yet. On success, `patchRow` lands the server's id and `swapRowId(tempId, saved.id)`
 *   re-keys the pending-create bookkeeping. On failure, the typed values are left alone (§2.1's
 *   failure behavior: "the blank row and my typed values are still there") — no revert, since
 *   there's nothing to revert *to*; the row just stays a `pendingCreateIds` retry target.
 * - **Delete**: `removeEdit(id)` captures + removes optimistically, a real `DELETE` follows;
 *   failure calls `revertEdit(id)` to bring the row back (§3.1's failure behavior).
 *
 * Live mode still has no Cancel (no session to cancel), so the single local undo slot (§1.3,
 * §3.2) is unchanged and **stays local-only** (no server-backed undo — that's §3.2's own,
 * separately-tracked, still-❌ story): Ctrl+Z/Cmd+Z or the toolbar Undo restores either the last
 * *committed* field value or the last *confirmed-discarded* row, whichever happened last.
 */
@Component({
  selector: 'ngp-live-table-story-host',
  imports: [FormField, FocusNewRowDirective, CommitCounterComponent],
  templateUrl: './live-table-story-host.component.html',
  styleUrls: ['../row-edit-story.css', './live-table-story-host.component.css'],
  host: {
    '(keydown)': 'onKeydown($event)',
  },
})
export class LiveTableStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(600);

  /** Plain (non-signal) snapshot of the previous `data()` emission — diffed on every emission to
   * find which field just committed. Not itself reactive state; only ever read inside the effect
   * that also produced it. */
  private previousData: EditRow[] = EDIT_ROWS_MOCK;

  private readonly rowEditApi = injectRowEditApi();

  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, liveTableSchema);
  protected readonly rows = form(this.data, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;
  protected readonly insertAt = signal(0);

  /** Row from `insertRow()` still awaiting its first field commit — marks the row `new` (§2.1)
   * for focus + styling until `snapshotChanges` clears it. */
  protected readonly newRowId = signal<RowId | null>(null);

  /** The single local undo slot (§1.3, §3.2) — last field commit or last discarded row,
   * whichever happened most recently. Live mode has no Cancel session to fall back on, so this
   * is the only recovery path. */
  private readonly undo = createLocalUndoSlot<EditRow, EditableField>(rowLabel);

  /** Screen-reader announcement for the discard/undo pair — a removed row is otherwise a silent
   * change (§3.1). */
  protected readonly announcement = signal('');

  /** Ids inserted this session that have never reached the server — their first field commit
   * `POST`s (create) instead of `PUT`s (update). Cleared once that create succeeds. */
  protected readonly pendingCreateIds = signal<ReadonlySet<RowId>>(new Set());

  /** id -> a save/create/delete failure's message, persistent until dismissed or retried. */
  protected readonly rowErrors = signal<ReadonlyMap<RowId, string>>(new Map());

  protected readonly undoLabel = computed(() => this.undo.label());

  constructor() {
    effect(() => {
      this.snapshotChanges(this.data());
    });
  }

  protected sortArrow(columnId: string): string {
    const direction = this.table.sortDirections().get(columnId);
    if (direction === 'asc') return '▲';
    if (direction === 'desc') return '▼';
    return '↕';
  }

  protected insertRow(): void {
    const id = crypto.randomUUID();
    this.newRowId.set(id);
    this.pendingCreateIds.update((ids) => new Set(ids).add(id));
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

    if (this.pendingCreateIds().has(id)) {
      this.postCreate(id, row);
    } else {
      this.putUpdate(id, row);
    }
  }

  protected dismissError(id: RowId): void {
    this.clearRowError(id);
  }

  /** Names the row a discard button removes, for its accessible label (§3.1) — the label carries
   * the row's identity, not a bare "Delete". */
  protected discardLabel(row: EditRow): string {
    return `Discard ${rowLabel(row)}`;
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
    this.clearRowError(id);

    if (this.pendingCreateIds().has(id)) {
      this.table.value.update(removeRow<EditRow>(id));
      this.removePendingCreate(id);
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
        this.setRowError(id, error instanceof Error ? error.message : 'Delete failed.');
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

  /** Diffs `current` against the previous emission: records the most recently changed field as
   * the undo target, and clears `newRowId`'s marking the first time its row picks up a real edit
   * — an insert alone never counts, since the inserted id is absent from `previousData`. A
   * discard changes no surviving row, so it never overwrites the undo entry it just recorded. */
  private snapshotChanges(current: EditRow[]): void {
    const previousById = new Map(this.previousData.map((row) => [row.id, row]));

    for (const row of current) {
      const previousRow = previousById.get(row.id);
      if (previousRow === undefined) continue;

      const changedField = EDITABLE_FIELDS.find((field) => row[field] !== previousRow[field]);
      if (changedField === undefined) continue;

      this.undo.recordCommit(row.id, changedField, previousRow[changedField]);
      if (this.newRowId() === row.id) {
        this.newRowId.set(null);
      }

      // A commit is what actually saves in live mode (there's no separate Save button) — the
      // first one on a `pendingCreateIds` row creates it, every other commit updates it.
      if (this.pendingCreateIds().has(row.id)) {
        this.postCreate(row.id, row);
      } else {
        this.putUpdate(row.id, previousRow);
      }
    }

    this.previousData = current;
  }

  /** Create: fires only from a `pendingCreateIds` row's first commit — a blank row is nothing to
   * save yet. No `captureEdit`/`revertEdit` on failure: per §2.1's failure behavior the typed
   * values stay on screen for a retry, there's no snapshot to roll back *to*. On success,
   * `patchRow` lands the server's id and `swapRowId(id, saved.id)` re-keys `snapshots` so a
   * later commit's `captureEdit`/`releaseEdit` addresses the right row (D49). */
  private postCreate(id: RowId, row: EditRow): void {
    this.clearRowError(id);
    this.rowEditApi.saveRow(id, row, true, this.requestOptions()).subscribe({
      next: (saved) => {
        this.table.value.update(patchRow<EditRow>(id, saved));
        this.table.editing.update(swapRowId<EditRow>(id, saved.id));
        this.removePendingCreate(id);
      },
      error: (error: unknown) => {
        this.setRowError(id, error instanceof Error ? error.message : 'Create failed.');
      },
    });
  }

  /** Update: `captureEdit(id, previousRow)` takes the pre-commit value *before* the request goes
   * out, so `table.pending()` reflects the in-flight save immediately; `releaseEdit` on
   * confirmation, `revertEdit` (back to `previousRow`) on failure — §1.1's failure behavior. */
  private putUpdate(id: RowId, previousRow: EditRow): void {
    this.clearRowError(id);
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
        this.setRowError(id, error instanceof Error ? error.message : 'Save failed.');
        this.table.editing.update(revertEdit<EditRow>(id));
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

  /** Storybook forceFailure/latencyMs controls, forwarded to `row-edit.handlers.ts` (MSW) on
   * every request this story fires. */
  private requestOptions(): RowEditRequestOptions {
    return { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() };
  }
}
