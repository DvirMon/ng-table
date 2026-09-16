import { Component, computed, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { discardEdit, releaseEdit, revertEdit } from '../../../mutations/optimistic-mutations';
import { beginEdit, endEdit } from '../../../mutations/row-edit-mutations';
import type { RowId } from '../../../api/types';
import { NgpTableDirective } from '../../../directives/ngp-table.directive';
import { NgpTableRowDirective } from '../../../directives/ngp-table-row.directive';
import { NgpTableRowFieldDirective } from '../../../directives/ngp-table-row-field.directive';
import { NullableTextFieldDirective } from './nullable-text-field.directive';
import { createRowHoldProbe } from './row-hold-probe';
import { SORT_EDIT_ROWS_MOCK } from './sorting-editing.mock';
import { sortEditTableConfig, sortEditRowsSchema } from './sorting-editing.schema';
import type { SortEditRow } from './sorting-editing.types';
import { saveSortEditRow, sortAriaValue } from './sorting-editing.utils';
import { SortingEditingToolbarComponent } from './sorting-editing-toolbar.component';
import { createTable } from '../../../api/create-table';
import { withSorting } from '../../../api/features/with-sorting';
import { withRowEdit } from '../../../api/features/with-row-edit';

/**
 * Sorting + row editing composed
 *
 * `withSorting()` + `withRowEdit()` composed together — sort while a row is open. Null/empty
 * values sort last by the shipped default, and that ordering holds correctly.
 *
 * The open row is expected to move under a live sort today — row-hold isn't implemented yet,
 * so `rowHoldProbe` demonstrates the gap live rather than hiding it, and starts passing once
 * row-hold ships.
 */
@Component({
  selector: 'ngp-sorting-editing-story-host',
  imports: [
    FormField,
    NgpTableDirective,
    NgpTableRowDirective,
    NgpTableRowFieldDirective,
    NullableTextFieldDirective,
    SortingEditingToolbarComponent,
  ],
  templateUrl: './sorting-editing-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', './sorting-editing-flip.css'],
})
export class SortingEditingStoryHostComponent {
  protected readonly data = signal<SortEditRow[]>(SORT_EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, sortEditTableConfig, withSorting(), withRowEdit());
  /** Gated mode's commit boundary is the row (OQ-3) — `form()` writes into `table.draft` instead
   * of `data`, so a field's blur-commit can't move the row under the user or feed the sort
   * pipeline before Save (`withRowEdit()`'s `draft` member, `api/features/draft-rows.ts`). */
  protected readonly rows = form(this.table.draft, sortEditRowsSchema);
  protected readonly saveError = signal<string | null>(null);

  /** Header `[attr.aria-sort]` values for the two sortable columns — derived so the `<th>` glyph
   * and screen-reader state agree with `table.sortDirections()`. */
  protected readonly nameSortAria = computed(() => sortAriaValue(this.table.sortDirections().get('name')));
  protected readonly dueDateSortAria = computed(() =>
    sortAriaValue(this.table.sortDirections().get('dueDate')),
  );

  /** S-1 regression demo (OQ-3, not implemented): observes whether a currently-open row moves
   * from the render position it held when opened — expected to fire today the moment a sorted
   * column's value commits. */
  private readonly rowHoldProbe = createRowHoldProbe(this.table.renderRows);
  protected readonly movedRow = this.rowHoldProbe.movedRow;

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
    this.rowHoldProbe.record(id);
  }

  /** Resets the row to its snapshot and closes it. */
  protected cancelEdit(id: RowId): void {
    this.saveError.set(null);
    this.table.editing.update(revertEdit(id));
    this.rowHoldProbe.clear(id);
  }

  /** Removes the row and closes it — available on any open row, whether it pre-existed or was
   * just added (same shape as `gated-edit/`'s Discard). */
  protected discardRow(id: RowId): void {
    this.saveError.set(null);
    this.table.editing.update(discardEdit(id));
    this.rowHoldProbe.clear(id);
  }

  /** Pessimistic save: the row stays open, unsorted, for the whole round trip — merging the
   * draft into `data` and closing only on success (`endEdit(id, row)`) keeps the resort and the
   * edit-mode close atomic, instead of resorting under a still-open row the moment Save is
   * clicked. */
  protected async saveEdit(id: RowId): Promise<void> {
    this.saveError.set(null);
    const row = this.table.draft().find((candidate) => this.table.trackBy(candidate) === id);
    if (row === undefined) {
      return;
    }

    try {
      await saveSortEditRow(row);
      this.table.editing.update(endEdit(id, row));
      this.table.editing.update(releaseEdit(id));
      this.rowHoldProbe.clear(id);
    } catch (error) {
      this.saveError.set(error instanceof Error ? error.message : 'Save failed.');
    }
  }
}
