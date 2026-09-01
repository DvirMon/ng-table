import { Component, computed, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createTable } from '../../api/create-table';
import { discardEdit, releaseEdit, revertEdit } from '../../api/optimistic-mutations';
import { beginEdit, endEdit } from '../../api/row-edit-mutations';
import type { RowId } from '../../api/types';
import { NgpTableRowFieldDirective } from '../../directives/ngp-table-row-field.directive';
import { NullableTextFieldDirective } from './nullable-text-field.directive';
import { SORT_EDIT_ROWS_MOCK } from './sorting-editing.mock';
import { sortEditRowsSchema, sortEditTableSchema } from './sorting-editing.schema';
import type { SortEditRow } from './sorting-editing.types';
import { saveSortEditRow } from './sorting-editing.utils';

/**
 * S-1 / S-2 (`0-product/row-editing.md` §5) — `withSorting()` + `withRowEdit()` composed
 * together, the one interaction no other story exercises. S-2 (null/empty placement,
 * `applySortNulls()`'s shipped `'last'` default) is expected to pass. S-1 (row must not move
 * while open) is expected to **fail** today — OQ-3's row-hold is designed, not implemented —
 * so `rowHoldNotice` below is an honest regression demo, not a workaround: it observes the
 * gap live rather than papering over it, and starts passing on its own once the row-hold ships.
 */
@Component({
  selector: 'ngp-sorting-editing-story-host',
  imports: [FormField, NgpTableRowFieldDirective, NullableTextFieldDirective],
  templateUrl: './sorting-editing-story-host.component.html',
  styleUrl: '../row-edit-story.css',
})
export class SortingEditingStoryHostComponent {
  protected readonly data = signal<SortEditRow[]>(SORT_EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, sortEditTableSchema);
  protected readonly rows = form(this.data, sortEditRowsSchema);
  protected readonly saveError = signal<string | null>(null);

  /** Row id -> render-row index captured at `beginEdit` time, for the S-1 row-hold check below.
   * Cleared once the row leaves editing, whatever the exit path. */
  private readonly openIndexById = signal<ReadonlyMap<RowId, number>>(new Map());

  /** S-1 regression demo (OQ-3, not implemented): compares each currently-open row's render
   * position against the position it held when it was opened. A mismatch means the row moved
   * while still open — expected to fire today the moment a sorted column's value commits. */
  protected readonly rowHoldNotice = computed<string | null>(() => {
    const openedAt = this.openIndexById();
    if (openedAt.size === 0) {
      return null;
    }
    const currentRows = this.table.renderRows();
    for (const [id, indexAtOpen] of openedAt) {
      const currentIndex = currentRows.findIndex((row) => row.id === id);
      if (currentIndex !== -1 && currentIndex !== indexAtOpen) {
        return (
          `Row "${id}" was at position ${indexAtOpen} when opened, now at ${currentIndex} ` +
          `while still open — S-1's row-hold (OQ-3) isn't implemented yet, so this is expected.`
        );
      }
    }
    return null;
  });

  protected sortArrow(columnId: string): string {
    const direction = this.table.sortDirections().get(columnId);
    if (direction === 'asc') return '▲';
    if (direction === 'desc') return '▼';
    return '↕';
  }

  protected clearSort(): void {
    this.table.clearSorting();
  }

  /** Adds a normally-valued row while a sort is active (§2.2) — demonstrates whatever the
   * pipeline currently does with a fresh insert under an active comparator; no row-hold exists
   * yet to keep it in view during the fill. */
  protected addRowWhileSorted(): void {
    const id = crypto.randomUUID();
    this.table.editing.update(
      beginEdit(id, { insert: { id, name: 'New Person', dueDate: '2026-09-01' }, at: 0 }),
    );
  }

  /** Adds a row with a `null` `dueDate` — demonstrates the shipped `applySortNulls()` default
   * (S-2): stable, direction-independent placement regardless of which way `dueDate` is sorted. */
  protected addRowWithBlankDueDate(): void {
    const id = crypto.randomUUID();
    this.table.editing.update(
      beginEdit(id, { insert: { id, name: 'Unscheduled', dueDate: null }, at: 0 }),
    );
  }

  protected openEdit(id: RowId): void {
    this.table.editing.update(beginEdit(id));
    const index = this.table.renderRows().findIndex((row) => row.id === id);
    this.openIndexById.update((map) => new Map(map).set(id, index));
  }

  /** Resets the row to its snapshot and closes it. */
  protected cancelEdit(id: RowId): void {
    this.saveError.set(null);
    this.table.editing.update(revertEdit(id));
    this.clearOpenIndex(id);
  }

  /** Removes the row and closes it — available on any open row, whether it pre-existed or was
   * just added (same shape as `gated-edit/`'s Discard). */
  protected discardRow(id: RowId): void {
    this.saveError.set(null);
    this.table.editing.update(discardEdit(id));
    this.clearOpenIndex(id);
  }

  /** Pessimistic save: the row stays open for the whole round trip, same shape as
   * `gated-edit/`'s Save. */
  protected async saveEdit(id: RowId): Promise<void> {
    this.saveError.set(null);
    const row = this.data().find((candidate) => this.table.trackBy(candidate) === id);
    if (row === undefined) {
      return;
    }

    try {
      await saveSortEditRow(row);
      //TODO - why this are separate updates? Why not just one update with endEdit()?
      this.table.editing.update(endEdit(id));
      // this.table.editing.update(releaseEdit(id));
      this.clearOpenIndex(id);
    } catch (error) {
      this.saveError.set(error instanceof Error ? error.message : 'Save failed.');
    }
  }

  private clearOpenIndex(id: RowId): void {
    if (!this.openIndexById().has(id)) {
      return;
    }
    this.openIndexById.update((map) => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });
  }
}
