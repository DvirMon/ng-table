import { Component, ElementRef, afterRenderEffect, effect, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createTable } from '../../api/create-table';
import { insertRow, patchRow } from '../../mutations/row-mutations';
import type { RowId } from '../../api/types';
import { EDIT_ROWS_MOCK, DEPT_OPTIONS } from '../row-edit.mock';
import { editRowsSchema, liveTableSchema } from '../row-edit.schema';
import type { EditRow } from '../row-edit.types';
import type { EditableField, FieldCommit } from './live-table.types';

const EDITABLE_FIELDS: readonly EditableField[] = ['name', 'dept'];

/**
 * S1 — the live table (D29): no `withRowEdit()` composed, inputs always render. `commitCount`
 * instruments `data()` emissions to make the `debounce('blur')` commit boundary observable —
 * typing does not tick it, blur/select-change does.
 *
 * Live mode has no Cancel (no session to cancel), so Ctrl+Z/Cmd+Z undoing the last *committed*
 * field value is the only recovery path (§1.3) — `snapshotChanges` diffs `data()` against its
 * previous emission to find that value, off the same commit boundary `commitCount` already
 * observes.
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

  /** Last committed field value, restorable via Ctrl+Z/Cmd+Z. `null` once nothing to undo. */
  protected readonly lastCommit = signal<FieldCommit | null>(null);

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

  /** Ctrl+Z / Cmd+Z restores `lastCommit`'s previous value — the only undo affordance live mode
   * gets, since there's no open/Cancel session to fall back on (§1.3). */
  protected onKeydown(event: KeyboardEvent): void {
    const isUndoChord =
      (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
    if (!isUndoChord) return;

    const commit = this.lastCommit();
    if (commit === null) return;

    event.preventDefault();
    const patch: Partial<EditRow> =
      commit.field === 'name' ? { name: commit.previousValue } : { dept: commit.previousValue };
    this.table.value.update(patchRow<EditRow>(commit.id, patch));
    this.lastCommit.set(null);
  }

  /** Diffs `current` against the previous emission: records the most recently changed field as
   * the undo target, and clears `newRowId`'s marking the first time its row picks up a real edit
   * — an insert alone never counts, since the inserted id is absent from `previousData`. */
  private snapshotChanges(current: EditRow[]): void {
    const previousById = new Map(this.previousData.map((row) => [row.id, row]));

    for (const row of current) {
      const previousRow = previousById.get(row.id);
      if (previousRow === undefined) continue;

      const changedField = EDITABLE_FIELDS.find((field) => row[field] !== previousRow[field]);
      if (changedField === undefined) continue;

      this.lastCommit.set({
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
