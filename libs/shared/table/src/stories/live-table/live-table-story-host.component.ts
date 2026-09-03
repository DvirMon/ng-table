import { Component, ElementRef, afterRenderEffect, computed, effect, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createTable } from '../../api/create-table';
import { insertRow, patchRow, removeRow } from '../../mutations/row-mutations';
import type { RowId } from '../../api/types';
import { EDIT_ROWS_MOCK, DEPT_OPTIONS } from '../row-edit.mock';
import { editRowsSchema, liveTableSchema } from '../row-edit.schema';
import type { EditRow } from '../row-edit.types';
import type { EditableField, UndoableAction } from './live-table.types';

const EDITABLE_FIELDS: readonly EditableField[] = ['name', 'dept'];

/** What a row is called in announcements and accessible labels — its name, or a stand-in when a
 * freshly-added row hasn't been named yet. */
function rowLabel(row: EditRow): string {
  return row.name.trim() === '' ? 'unnamed row' : `row ${row.name}`;
}

/**
 * S1 — the live table (D29): no `withRowEdit()` composed, inputs always render. `commitCount`
 * instruments `data()` emissions to make the `debounce('blur')` commit boundary observable —
 * typing does not tick it, blur/select-change does.
 *
 * Live mode has no Cancel (no session to cancel), so a single undo slot is the only recovery
 * path (§1.3, §3.2): Ctrl+Z/Cmd+Z or the toolbar Undo restores either the last *committed* field
 * value or the last *discarded* row, whichever happened last. Field commits are found by
 * `snapshotChanges` diffing `data()` against its previous emission; discards record their row and
 * index at the call site, since no feature holds a restore point here.
 */
@Component({
  selector: 'ngp-live-table-story-host',
  imports: [FormField],
  templateUrl: './live-table-story-host.component.html',
  styleUrls: ['../row-edit-story.css', './live-table-story-host.component.css'],
  host: {
    '(keydown)': 'onKeydown($event)',
  },
})
export class LiveTableStoryHostComponent {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Plain (non-signal) snapshot of the previous `data()` emission — diffed on every emission to
   * find which field just committed. Not itself reactive state; only ever read inside the effect
   * that also produced it. */
  private previousData: EditRow[] = EDIT_ROWS_MOCK;

  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, liveTableSchema);
  protected readonly rows = form(this.data, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;

  protected readonly commitCount = signal(0);
  protected readonly insertAt = signal(0);

  /** Row from `insertRow()` still awaiting its first field commit — marks the row `new` (§2.1)
   * for focus + styling until `snapshotChanges` clears it. */
  protected readonly newRowId = signal<RowId | null>(null);

  /** Last undoable action — a committed field value or a discarded row. `null` once nothing is
   * left to undo. */
  protected readonly lastAction = signal<UndoableAction | null>(null);

  /** Screen-reader announcement for the discard/undo pair — a removed row is otherwise a silent
   * change (§3.1). */
  protected readonly announcement = signal('');

  protected readonly undoLabel = computed(() => {
    const action = this.lastAction();
    if (action === null) return null;
    return action.kind === 'discard'
      ? `Undo discard of ${rowLabel(action.row)}`
      : 'Undo last commit';
  });

  constructor() {
    effect(() => {
      const current = this.data();
      this.commitCount.update((count) => count + 1);
      this.snapshotChanges(current);
    });

    // Moves focus into the newly-inserted row's first input once it has rendered (§2.1).
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

  protected sortArrow(columnId: string): string {
    const direction = this.table.sortDirections().get(columnId);
    if (direction === 'asc') return '▲';
    if (direction === 'desc') return '▼';
    return '↕';
  }

  protected insertRow(): void {
    const id = crypto.randomUUID();
    this.newRowId.set(id);
    this.table.value.update(
      insertRow(
        { id, name: '', dept: DEPT_OPTIONS[0] },
        { at: this.insertAt() },
      ),
    );
  }

  /** Names the row a discard button removes, for its accessible label (§3.1) — the label carries
   * the row's identity, not a bare "Delete". */
  protected discardLabel(row: EditRow): string {
    return `Discard ${rowLabel(row)}`;
  }

  /** The discard flow's forward half: removes the row and parks it — with the index it sat at —
   * in the undo slot. No confirmation dialog: undo is the safety net for a single row (§3.2). */
  protected discardRow(id: RowId): void {
    const at = this.data().findIndex((row) => this.table.trackBy(row) === id);
    if (at === -1) return;

    const row = this.data()[at];
    this.table.value.update(removeRow<EditRow>(id));
    this.lastAction.set({ kind: 'discard', row, at });
    this.announcement.set(`${rowLabel(row)} discarded. Undo available.`);
    if (this.newRowId() === id) {
      this.newRowId.set(null);
    }
  }

  /** The discard flow's back half, shared with field-commit undo: a discarded row goes back at
   * the index it was removed from, a committed field back to its previous value. */
  protected undoLastAction(): void {
    const action = this.lastAction();
    if (action === null) return;

    if (action.kind === 'discard') {
      this.table.value.update(insertRow<EditRow>(action.row, { at: action.at }));
      this.announcement.set(`${rowLabel(action.row)} restored.`);
    } else {
      const patch: Partial<EditRow> =
        action.field === 'name' ? { name: action.previousValue } : { dept: action.previousValue };
      this.table.value.update(patchRow<EditRow>(action.id, patch));
    }
    this.lastAction.set(null);
  }

  /** Ctrl+Z / Cmd+Z drives the same undo slot as the toolbar button — the only undo affordance
   * live mode gets, since there's no open/Cancel session to fall back on (§1.3). */
  protected onKeydown(event: KeyboardEvent): void {
    const isUndoChord =
      (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
    if (!isUndoChord || this.lastAction() === null) return;

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

      this.lastAction.set({
        kind: 'commit',
        id: row.id,
        field: changedField,
        previousValue: previousRow[changedField],
      });
      if (this.newRowId() === row.id) {
        this.newRowId.set(null);
      }
    }

    this.previousData = current;
  }
}
