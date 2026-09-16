import { Component, computed, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createFilters } from '../../../filters/create-filters';
import { contains, filter, hasAny } from '../../../filters/rules';
import { createTable } from '../../../api/create-table';
import { withFiltering } from '../../../api/features/with-filtering';
import { withSelection } from '../../../api/features/with-selection';
import { withSorting } from '../../../api/features/with-sorting';
import { selectAllIds } from '../../../api/features/selection.utils';
import type { RowId } from '../../../api/types';
import { removeRow } from '../../../mutations/row-mutations';
import { NgpTableDirective } from '../../../directives/ngp-table.directive';
import { NgpTableRowDirective } from '../../../directives/ngp-table-row.directive';
import { INVOICE_ROWS_MOCK, STATUS_OPTIONS, TAG_OPTIONS } from '../fixtures/mock';
import { selectionInvoiceConfig } from '../fixtures/schema';
import type { InvoiceRow } from '../fixtures/types';
import { matchesStatus, toggleOption } from '../fixtures/utils';

/**
 * Selection under an active filter
 *
 * `withFiltering()` + `withSelection()` + `withSorting()` combine so selection survives both.
 * Two select-all buttons: `selectAllIds(table)` scopes to visible `rows()`; `{ includeHidden:
 * true }` scopes to the whole dataset.
 *
 * Selection restores exactly as it was once the filter clears; only deleting a row prunes it.
 */
@Component({
  selector: 'ngp-selection-filtering-story-host',
  imports: [FormField, NgpTableDirective, NgpTableRowDirective],
  templateUrl: './selection-filtering-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../filtering-story.css'],
})
export class SelectionFilteringStoryHostComponent {
  protected readonly data = signal<InvoiceRow[]>(INVOICE_ROWS_MOCK);

  /** The subset this story filters by — enough to move rows in and out of view while a
   * selection is held, without rebuilding the client story's whole filter row. */
  protected readonly filters = createFilters(this.data, (path) => [
    filter(path.status, matchesStatus, { emptyValue: '' }),
    contains(path.customer),
    hasAny(path.tags),
  ]);

  protected readonly filterForm = form(this.filters().value);

  protected readonly table = createTable(
    this.data,
    selectionInvoiceConfig,
    withFiltering({ predicates: () => [this.filters().matcher()] }),
    withSelection(),
    withSorting(),
  );

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly tagOptions = TAG_OPTIONS;

  /** The row the delete control acts on — picked from the whole dataset, so a row currently
   * filtered out is reachable. */
  protected readonly rowToDelete = signal<RowId | null>(null);

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
  protected readonly selectedIdsLabel = computed(() =>
    [...this.table.selectedRows()].join(', '),
  );
  protected readonly selectedTagSet = computed(() => new Set(this.filters.tags().value()));

  protected toggleRow(id: RowId): void {
    this.table.toggle(id);
  }

  /** Post-filter, post-sort — the default scope. */
  protected selectAllVisibleRows(): void {
    this.table.select(selectAllIds(this.table));
  }

  /** The whole dataset, filtered-out rows included. */
  protected selectAllRowsIncludingHidden(): void {
    this.table.select(selectAllIds(this.table, { includeHidden: true }));
  }

  protected toggleAllVisibleRows(): void {
    const visibleIds = this.visibleIds();
    if (this.isEveryVisibleRowSelected()) {
      this.table.deselect(visibleIds);
      return;
    }
    this.table.select(visibleIds);
  }

  protected clearSelection(): void {
    this.table.clearSelection();
  }

  protected sortByAmount(): void {
    this.table.toggleSort('amount');
  }

  protected pickRowToDelete(raw: string): void {
    this.rowToDelete.set(raw === '' ? null : Number(raw));
  }

  /** A real removal, unlike filtering one out: the id leaves `data`, so the engine prunes it
   * and the selected count drops. */
  protected deletePickedRow(): void {
    const id = this.rowToDelete();
    if (id === null) {
      return;
    }
    this.table.value.update(removeRow<InvoiceRow>(id));
    this.rowToDelete.set(null);
  }

  /** Hand-wired: a tag multi-select is a set, not a single control value. */
  protected toggleTag(tag: string): void {
    this.filters
      .tags()
      .value.update((selected) => toggleOption(selected, tag, this.tagOptions));
  }

  protected clearAllFilters(): void {
    this.filters().reset(null);
  }
}
