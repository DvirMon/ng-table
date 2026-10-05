import { Component, computed, signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import { createTable } from '../../../api/create-table';
import { withFiltering } from '../../../api/features/with-filtering';
import { withSelection } from '../../../api/features/with-selection';
import { withSorting } from '../../../api/features/with-sorting';
import { selectAllIds } from '../../../api/features/with-selection/utils';
import type { RowId } from '../../../api/types';
import { removeRow } from '../../../mutations/row-mutations';
import { NgpTableDirective } from '../../../directives/ngp-table.directive';
import { NgpTableRowDirective } from '../../../directives/ngp-table-row.directive';
import { INVOICE_ROWS_MOCK, STATUS_OPTIONS, TAG_OPTIONS } from '../../filtering/fixtures/mock';
import { selectionInvoiceConfig } from '../../filtering/fixtures/schema';
import type { InvoiceRow } from '../../filtering/fixtures/types';
import { toggleOption } from '../../filtering/fixtures/utils';
import { selectionInvoiceFilters } from './filtering-selection.filters';
import { FilteringSelectionToolbarComponent } from './filtering-selection-toolbar.component';

/**
 * Selection under an active filter
 *
 * `withFiltering()` + `withSelection()` + `withSorting()` combine so selection survives both.
 *
 * Selection restores exactly as it was once the filter clears; only deleting a row prunes it.
 */
@Component({
  selector: 'ngp-filtering-selection-story-host',
  imports: [NgpTableDirective, NgpTableRowDirective, FilteringSelectionToolbarComponent],
  templateUrl: './filtering-selection-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../../filtering/filtering-story.css'],
})
export class FilteringSelectionStoryHostComponent {
  protected readonly data = signal<InvoiceRow[]>(INVOICE_ROWS_MOCK);

  protected readonly table = createTable(
    this.data,
    selectionInvoiceConfig,
    withFiltering({ schema: selectionInvoiceFilters }),
    withSelection(),
    withSorting(),
  );

  /** The subset this story filters by — enough to move rows in and out of view while a
   * selection is held, without rebuilding the client story's whole filter row. */
  protected readonly filters = this.table.filters;

  protected readonly filterForm = form(this.filters().value);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly tagOptions = TAG_OPTIONS;

  protected readonly visibleIds = computed(() => selectAllIds(this.table));
  protected readonly visibleSelectionState = computed(() =>
    this.table.selectionStateOf(this.visibleIds()),
  );
  protected readonly isEveryVisibleRowSelected = computed(
    () => this.visibleSelectionState() === 'all',
  );
  protected readonly isSomeVisibleRowSelected = computed(
    () => this.visibleSelectionState() === 'some',
  );
  protected readonly selectedCount = computed(() => this.table.selectedRows().size);
  /** Rendered so "restored exactly" is checkable rather than asserted. */
  protected readonly selectedIdsLabel = computed(() => [...this.table.selectedRows()].join(', '));

  protected toggleRow(id: RowId): void {
    this.table.toggle(id);
  }

  protected toggleAllVisibleRows(): void {
    const visibleIds = this.visibleIds();
    if (this.isEveryVisibleRowSelected()) {
      this.table.deselect(visibleIds);
      return;
    }
    this.table.select(visibleIds);
  }

  /** A real removal, unlike filtering one out: the id leaves `data`, so the engine prunes it
   * and the selected count drops. */
  protected deleteRow(id: RowId): void {
    this.table.value.update(removeRow<InvoiceRow>(id));
  }

  protected toggleSort(id: string): void {
    this.table.toggleSort(id);
  }

  /** Hand-wired: a tag multi-select is a set, not a single control value. */
  protected toggleTag(tag: string): void {
    this.filters.tags().value.update((selected) => toggleOption(selected, tag, this.tagOptions));
  }

  protected clearAllFilters(): void {
    this.filters().reset(null);
  }
}
