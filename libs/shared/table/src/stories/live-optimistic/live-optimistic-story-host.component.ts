import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createTable } from '../../api/create-table';
import { captureEdit, releaseEdit, removeEdit, revertEdit } from '../../mutations/optimistic-mutations';
import type { RowId } from '../../api/types';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../row-edit.mock';
import { editRowsSchema, liveOptimisticSchema } from '../row-edit.schema';
import type { EditRow } from '../row-edit.types';

/** How long a delete's Undo affordance stays live before its restore point is released. */
const UNDO_WINDOW_MS = 6000;

/**
 * S6 — optimistic updates & rollback (`2-gap-analysis.md` §3). The edit session is
 * focus-delimited (D39): there is no button to open a row, so `withOptimistic()` alone supplies
 * the three rollback verbs (`captureEdit`/`releaseEdit`/`revertEdit`) — `table.editing()` stays
 * empty for the whole story, and `table.pending()` is exactly the in-flight save set.
 *
 * See `../live-pessimistic/` for the same focus-triggered session shape under the opposite save
 * strategy (revert-before-send vs. this story's revert-after-failure).
 */
@Component({
  selector: 'ngp-live-optimistic-story-host',
  imports: [FormField],
  templateUrl: './live-optimistic-story-host.component.html',
  styleUrl: '../row-edit-story.css',
  host: {
    '(window:beforeunload)': 'onBeforeUnload($event)',
    '(window:keydown)': 'onWindowKeydown($event)',
  },
})
export class LiveOptimisticStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(600);

  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly liveTable = createTable(this.data, liveOptimisticSchema);
  protected readonly rows = form(this.data, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;
  protected readonly saveError = signal<string | null>(null);
  protected readonly leavePageMessage = signal<string | null>(null);
  protected readonly announcement = signal('');
  /** The one row currently offering Undo after a settled delete (demo scope — one at a time). */
  protected readonly undoRowId = signal<RowId | null>(null);

  private readonly destroyRef = inject(DestroyRef);
  private undoTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.announcePendingTransitions();
    this.destroyRef.onDestroy(() => this.clearUndoTimer());
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
    setTimeout(() => void this.save(id));
  }

  /** Delete-with-rollback plus an Undo window: the restore point is deliberately held open past
   * a successful delete (`armUndo`) instead of being released immediately, so `revertEdit` can
   * still bring the row back if the user clicks Undo/presses Ctrl+Z within the window. */
  protected deleteRow(id: RowId): void {
    this.saveError.set(null);
    this.clearUndoTimer();
    this.liveTable.editing.update(removeEdit<EditRow>(id));
    void this.remove(id);
  }

  protected undoDelete(): void {
    const id = this.undoRowId();
    if (id === null) {
      return;
    }
    this.clearUndoTimer();
    this.liveTable.editing.update(revertEdit<EditRow>(id));
    this.undoRowId.set(null);
  }

  /** A real `beforeunload` won't fire from a synthetic click in Storybook, so this simulates the
   * resulting UI state directly instead of relying on the click to trigger the guard below. */
  protected simulateLeavePage(): void {
    const pendingCount = this.liveTable.pending().size;
    this.leavePageMessage.set(
      pendingCount > 0
        ? `${pendingCount} unsaved change${pendingCount > 1 ? 's' : ''} in progress — leaving now would lose them.`
        : 'No unsaved changes — safe to leave.',
    );
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
    if (isUndoCombo && this.undoRowId() !== null) {
      event.preventDefault();
      this.undoDelete();
    }
  }

  private async save(id: RowId): Promise<void> {
    this.saveError.set(null);
    const row = this.data().find((candidate) => this.liveTable.trackBy(candidate) === id);
    if (row === undefined) {
      return;
    }

    try {
      const response = await fetch(`/api/rows/${id}`, {
        method: 'PUT',
        headers: this.simulatedHeaders(),
        body: JSON.stringify(row),
      });
      if (!response.ok) {
        const errorBody = (await response.json()) as { message?: string };
        throw new Error(errorBody.message ?? 'Save failed.');
      }
      // releaseEdit: confirmed — drop the restore point, the written value stands.
      this.liveTable.editing.update(releaseEdit<EditRow>(id));
    } catch (error) {
      this.saveError.set(error instanceof Error ? error.message : 'Save failed.');
      // revertEdit: rejected — put the captured value back.
      this.liveTable.editing.update(revertEdit<EditRow>(id));
    }
  }

  private async remove(id: RowId): Promise<void> {
    try {
      const response = await fetch(`/api/rows/${id}`, {
        method: 'DELETE',
        headers: this.simulatedHeaders(),
      });
      if (!response.ok) {
        const errorBody = (await response.json()) as { message?: string };
        throw new Error(errorBody.message ?? 'Delete failed.');
      }
      this.armUndo(id);
    } catch (error) {
      this.saveError.set(error instanceof Error ? error.message : 'Delete failed.');
      this.liveTable.editing.update(revertEdit<EditRow>(id));
    }
  }

  /** Holds `id`'s restore point open for `UNDO_WINDOW_MS` instead of releasing it right away —
   * the restore point is what `undoDelete()` reverts to. Releases on its own once the window
   * closes with no undo click. */
  private armUndo(id: RowId): void {
    this.undoRowId.set(id);
    this.undoTimer = setTimeout(() => {
      this.liveTable.editing.update(releaseEdit<EditRow>(id));
      this.undoRowId.set(null);
      this.undoTimer = null;
    }, UNDO_WINDOW_MS);
  }

  private clearUndoTimer(): void {
    if (this.undoTimer !== null) {
      clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }
  }

  /** Announces once per pending-state transition (a row entering or leaving `pending()`), not
   * per keystroke — `pending()` only changes at capture/settle points (focus/blur+fetch), never
   * mid-typing. */
  private announcePendingTransitions(): void {
    let previousPending: ReadonlySet<RowId> = new Set();
    effect(() => {
      const currentPending = this.liveTable.pending();
      const entered = [...currentPending].filter((id) => !previousPending.has(id));
      const left = [...previousPending].filter((id) => !currentPending.has(id));

      if (entered.length > 0) {
        this.announcement.set(`Saving ${entered.length} row${entered.length > 1 ? 's' : ''}…`);
      } else if (left.length > 0) {
        this.announcement.set('Save complete.');
      }
      previousPending = currentPending;
    });
  }

  /** Headers driving MSW's simulated latency/failure, shared by save and delete requests. */
  private simulatedHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Force-Failure': String(this.forceFailure()),
      'X-Latency-Ms': String(this.latencyMs()),
    };
  }
}
