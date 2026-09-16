import { Component, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import {
  captureEdit,
  releaseEdit,
  removeEdit,
  revertEdit,
  swapRowId,
} from '../../../mutations/optimistic-mutations';
import { insertRow, patchRow } from '../../../mutations/row-mutations';
import type { RowId } from '../../../api/types';
import { FocusNewRowDirective } from '../ui/focus-new-row.directive';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../fixtures/mock';
import { createTable } from '../../../api/create-table';
import { withOptimistic } from '../../../api/features/with-optimistic';
import { editTableConfig, editRowsSchema } from '../fixtures/schema';
import { injectRowEditApi } from '../fixtures/http';
import type { EditRow } from '../fixtures/types';
import { createRowFlags } from '../ui/row-flags';
import { createUndoWindow } from './undo-window';
import { createPendingAnnouncer } from './pending-announcer';

/** How long a delete's Undo affordance stays live before its restore point is released. */
const UNDO_WINDOW_MS = 6000;

/**
 * S6 — optimistic updates & rollback (`2-gap-analysis.md` §3). The edit session is
 * focus-delimited (D39): there is no button to open a row, so `withOptimistic()` alone supplies
 * the three rollback verbs (`captureEdit`/`releaseEdit`/`revertEdit`) — `table.editing()` stays
 * empty for the whole story, and `table.pending()` is exactly the in-flight save set.
 *
 * `addRow()` inserts a blank row under a temp id (`pendingCreateIds`); focusing it captures the
 * blank snapshot same as any row, and its first blur `POST`s (create) instead of `PUT`s
 * (update) — success re-keys via `patchRow` + `swapRowId(tempId, saved.id)` before `releaseEdit`,
 * failure `revertEdit`s to blank, same as this story's existing revert-after-failure character
 * (a deliberate difference from `../live-table/`'s create failure, which keeps typed values for
 * retry — different stories are allowed different, self-consistent answers here).
 */
@Component({
  selector: 'ngp-live-optimistic-story-host',
  imports: [FormField, FocusNewRowDirective],
  templateUrl: './live-optimistic-story-host.component.html',
  styleUrl: '../../styles/story-host.css',
  host: {
    '(window:beforeunload)': 'onBeforeUnload($event)',
    '(window:keydown)': 'onWindowKeydown($event)',
  },
})
export class LiveOptimisticStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(600);

  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly liveTable = createTable(this.data, editTableConfig, withOptimistic());
  protected readonly rows = form(this.data, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;
  protected readonly saveError = signal<string | null>(null);
  protected readonly leavePagePendingCount = signal<number | null>(null);
  protected readonly announcement = createPendingAnnouncer(this.liveTable.pending);
  protected readonly insertAt = signal(0);
  /** Demo-only per-row UI flags; only `pendingCreateIds` is used here — `save` reads it to
   * decide `POST` vs `PUT`. */
  protected readonly flags = createRowFlags();
  /** The just-inserted row to focus once rendered — cleared the moment it's left (§2.1). */
  protected readonly newRowId = signal<RowId | null>(null);
  /** The one row currently offering Undo after a settled delete (demo scope — one at a time). */
  protected readonly undo = createUndoWindow(UNDO_WINDOW_MS, (id) =>
    this.liveTable.editing.update(releaseEdit<EditRow>(id)),
  );

  private readonly rowEditApi = injectRowEditApi();

  /** Inserts a blank row under a temp client id — nothing is saved yet; the row's first blur
   * (`save()`) is what actually creates it. */
  protected addRow(): void {
    const id = crypto.randomUUID();
    this.newRowId.set(id);
    this.flags.markPendingCreate(id);
    this.liveTable.value.update(
      insertRow<EditRow>({ id, name: '', dept: DEPT_OPTIONS[0] }, { at: this.insertAt() }),
    );
  }

  /** Focus takes the restore point this row will roll back to. Guarded: a row already
   * `pending()` holds a snapshot for an in-flight save, and re-capturing would overwrite it
   * (2-decisions.md correction 2). */
  protected onEnterRow(id: RowId): void {
    const isRowPending = this.liveTable.pending().has(id);
    if (isRowPending) {
      return;
    }
    this.liveTable.editing.update(captureEdit<EditRow>(id));
  }

  /** Deferred a tick on purpose: `debounce(row.name, 'blur')` (D24) commits the typed value to
   * `data` as part of the same blur, and the save has to read what landed, not what was there
   * before it. */
  protected onLeaveRow(id: RowId): void {
    if (this.newRowId() === id) {
      this.newRowId.set(null);
    }
    setTimeout(() => this.save(id));
  }

  /** Delete-with-rollback plus an Undo window: the restore point is deliberately held open past
   * a successful delete (`undo.arm`) instead of being released immediately, so `revertEdit` can
   * still bring the row back if the user clicks Undo/presses Ctrl+Z within the window. */
  protected deleteRow(id: RowId): void {
    this.saveError.set(null);
    this.undo.disarm();
    this.liveTable.editing.update(removeEdit<EditRow>(id));
    this.remove(id);
  }

  protected undoDelete(): void {
    const id = this.undo.disarm();
    if (id === null) {
      return;
    }
    this.liveTable.editing.update(revertEdit<EditRow>(id));
  }

  /** A real `beforeunload` won't fire from a synthetic click in Storybook, so this simulates the
   * resulting UI state directly instead of relying on the click to trigger the guard below. */
  protected simulateLeavePage(): void {
    this.leavePagePendingCount.set(this.liveTable.pending().size);
  }

  /** Real guard, for a real navigation (won't fire from the demo button above). */
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.liveTable.pending().size > 0) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  protected onWindowKeydown(event: KeyboardEvent): void {
    const isUndoCombo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z';
    if (isUndoCombo && this.undo.rowId() !== null) {
      event.preventDefault();
      this.undoDelete();
    }
  }

  private save(id: RowId): void {
    this.saveError.set(null);
    const row = this.data().find((candidate) => this.liveTable.trackBy(candidate) === id);
    if (row === undefined) {
      return;
    }
    const isCreate = this.flags.pendingCreateIds().has(id);

    this.rowEditApi
      .saveRow(id, row, isCreate, { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() })
      .subscribe({
        next: (saved) => {
          if (isCreate) {
            this.liveTable.value.update(patchRow<EditRow>(id, saved));
            this.liveTable.editing.update(swapRowId<EditRow>(id, saved.id));
            this.liveTable.editing.update(releaseEdit<EditRow>(saved.id));
            this.flags.removePendingCreate(id);
          } else {
            // releaseEdit: confirmed — drop the restore point, the written value stands.
            this.liveTable.editing.update(releaseEdit<EditRow>(id));
          }
        },
        error: (error: unknown) => {
          this.saveError.set(error instanceof Error ? error.message : 'Save failed.');
          // revertEdit: rejected — put the captured value back (blank, for a create).
          this.liveTable.editing.update(revertEdit<EditRow>(id));
        },
      });
  }

  private remove(id: RowId): void {
    this.rowEditApi
      .deleteRow(id, { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() })
      .subscribe({
        next: () => {
          this.undo.arm(id);
        },
        error: (error: unknown) => {
          this.saveError.set(error instanceof Error ? error.message : 'Delete failed.');
          this.liveTable.editing.update(revertEdit<EditRow>(id));
        },
      });
  }
}
