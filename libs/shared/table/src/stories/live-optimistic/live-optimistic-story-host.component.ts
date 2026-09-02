import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createTable } from '../../api/create-table';
import { captureEdit, discardEdit, releaseEdit, removeEdit, revertEdit } from '../../mutations/optimistic-mutations';
import { beginEdit, endEdit } from '../../mutations/row-edit-mutations';
import type { RowId } from '../../api/types';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../row-edit.mock';
import { editRowsSchema, gatedTableSchema, liveOptimisticSchema } from '../row-edit.schema';
import type { EditRow } from '../row-edit.types';

/** How long a delete's Undo affordance stays live before its restore point is released. */
const UNDO_WINDOW_MS = 6000;

type EditMode = 'gated' | 'live';

/**
 * S6 — optimistic updates & rollback, standalone (`2-gap-analysis.md` §3). A **Gated/Live**
 * toggle switches between two `createTable()` instances sharing the same `data` signal —
 * `gatedTableSchema()` (`withRowEdit()`, which composes `withOptimistic()` internally, D37) and
 * `liveOptimisticSchema` (`withOptimistic()` alone). Listing both features in one `features`
 * array throws at construction (ADR-0007: same members) — `withRowEdit()` already IS the
 * optimistic member set for a gated table (`RowEditMembers<TRow> = OptimisticMembers<TRow>`), so
 * no new schema composition exists or is needed here. Two fixed table instances, toggled by a
 * `mode` signal, is simpler than rebuilding one table's config on every toggle.
 *
 * Same three rollback verbs prove out under both: `captureEdit`/`releaseEdit`/`revertEdit`
 * (focus-delimited under Live) and `beginEdit`/`endEdit` + the same rollback verbs
 * (button-delimited under Gated — save closes the row with `endEdit` before the fetch settles,
 * same optimistic-close shape `optimistic-save/` used).
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

  protected readonly mode = signal<EditMode>('live');
  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly liveTable = createTable(this.data, liveOptimisticSchema);
  protected readonly gatedTable = createTable(this.data, gatedTableSchema());
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

  /** The active table for whichever mode is selected. Both instances stay constructed and wired
   * for the lifetime of the story; only the active one is read from or written to. */
  protected get table(): typeof this.liveTable | typeof this.gatedTable {
    return this.mode() === 'gated' ? this.gatedTable : this.liveTable;
  }

  protected toggleMode(): void {
    this.saveError.set(null);
    this.leavePageMessage.set(null);
    this.mode.update((current) => (current === 'gated' ? 'live' : 'gated'));
  }

  /** Live mode only — focus takes the restore point this row will roll back to. Guarded: a row
   * already `pending()` holds a snapshot for an in-flight save, and re-capturing would overwrite
   * it (2-decisions.md correction 2). */
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
    setTimeout(() => void this.save(this.liveTable, id));
  }

  protected openEdit(id: RowId): void {
    this.gatedTable.editing.update(beginEdit(id));
  }

  /** Resets the row to its snapshot and closes it. */
  protected cancelEdit(id: RowId): void {
    this.saveError.set(null);
    this.gatedTable.editing.update(revertEdit(id));
  }

  /** Removes the row and closes it — one call. */
  protected discardEdit(id: RowId): void {
    this.saveError.set(null);
    this.gatedTable.editing.update(discardEdit(id));
  }

  /** Gated save closes the row optimistically (`endEdit`) before the fetch settles — same
   * `pending()`-driven rollback path as the live table, just entered by a button instead of a
   * blur. */
  protected async saveEditGated(id: RowId): Promise<void> {
    this.saveError.set(null);
    this.gatedTable.editing.update(endEdit<EditRow>(id));
    await this.save(this.gatedTable, id);
  }

  /** Delete-with-rollback plus an Undo window: the restore point is deliberately held open past
   * a successful delete (`armUndo`) instead of being released immediately, so `revertEdit` can
   * still bring the row back if the user clicks Undo/presses Ctrl+Z within the window. */
  protected deleteRow(id: RowId): void {
    this.saveError.set(null);
    this.clearUndoTimer();
    this.table.editing.update(removeEdit<EditRow>(id));
    void this.remove(id);
  }

  protected undoDelete(): void {
    const id = this.undoRowId();
    if (id === null) {
      return;
    }
    this.clearUndoTimer();
    this.table.editing.update(revertEdit<EditRow>(id));
    this.undoRowId.set(null);
  }

  /** A real `beforeunload` won't fire from a synthetic click in Storybook, so this simulates the
   * resulting UI state directly instead of relying on the click to trigger the guard below. */
  protected simulateLeavePage(): void {
    const pendingCount = this.table.pending().size;
    this.leavePageMessage.set(
      pendingCount > 0
        ? `${pendingCount} unsaved change${pendingCount > 1 ? 's' : ''} in progress — leaving now would lose them.`
        : 'No unsaved changes — safe to leave.',
    );
  }

  /** Real guard, for a real navigation (won't fire from the demo button above). */
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.table.pending().size > 0) {
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

  private async save(activeTable: typeof this.liveTable | typeof this.gatedTable, id: RowId): Promise<void> {
    this.saveError.set(null);
    const row = this.data().find((candidate) => activeTable.trackBy(candidate) === id);
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
      activeTable.editing.update(releaseEdit<EditRow>(id));
    } catch (error) {
      this.saveError.set(error instanceof Error ? error.message : 'Save failed.');
      // revertEdit: rejected — put the captured value back (and re-close, under gated mode).
      activeTable.editing.update(revertEdit<EditRow>(id));
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
      this.table.editing.update(revertEdit<EditRow>(id));
    }
  }

  /** Holds `id`'s restore point open for `UNDO_WINDOW_MS` instead of releasing it right away —
   * the restore point is what `undoDelete()` reverts to. Releases on its own once the window
   * closes with no undo click. */
  private armUndo(id: RowId): void {
    this.undoRowId.set(id);
    this.undoTimer = setTimeout(() => {
      this.table.editing.update(releaseEdit<EditRow>(id));
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
   * per keystroke — `pending()` only changes at capture/settle points (focus/blur+fetch under
   * Live, endEdit/settle under Gated), never mid-typing. Tracks whichever table is active so the
   * mode toggle doesn't need its own announcer. */
  private announcePendingTransitions(): void {
    let previousPending: ReadonlySet<RowId> = new Set();
    effect(() => {
      const currentPending = this.mode() === 'gated' ? this.gatedTable.pending() : this.liveTable.pending();
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
