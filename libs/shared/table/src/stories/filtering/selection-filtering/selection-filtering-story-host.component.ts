import { Component, computed, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createFilters } from '../../../api/create-filters';
import { contains, equals, hasAny } from '../../../api/filters/rules';
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
import type { InvoiceRow, SelectionInvoiceFilterState } from '../fixtures/types';
import { isInvoiceStatus, toggleOption } from '../fixtures/utils';

/**
 * Stated, not computed. `withSelection()` retains a row that a filter moved out of view, but no
 * shipped signal reports how many selected rows are currently hidden — so the story says the
 * signal is missing instead of faking one in the host. It stops rendering on its own once the
 * read-side count lands.
 */
const HIDDEN_SELECTION_NOTICE =
  'A filter is active. Rows selected before it was applied are still selected — but no shipped ' +
  'signal reports how many of them are currently out of view, so this story cannot show that ' +
  'count. Tracked in 1-state/work/computed-state-mechanism/1-intake.md and 0-product/selection.md §2.5.';

/**
 * Selection under an active filter — `withFiltering()` + `withSelection()` + `withSorting()`.
 *
 * **Two select-all buttons, co-equal and separately named.** `selectAllIds(table)` scopes to
 * `rows()` — post-filter, post-sort — and `selectAllIds(table, { includeHidden: true })` scopes
 * to the whole dataset. Deliberately TanStack's shape: it is the only library exposing both
 * scopes as first-class named calls rather than one flag with a chosen default, and there is no
 * convergent default to inherit. Every peer has shipped the wrong one at least once.
 *
 * **The header checkbox's denominator is an open question.** Its tri-state reads `all` while
 * selected-but-hidden rows exist, because `selectionStateOf(selectAllIds(table))` counts against
 * the visible set. That is rendered on purpose: no library researched has answered which
 * denominator is right, and the one open PR on the subject is still unmerged.
 *
 * **Retention is a rejected convention, not an unconsidered default.** MUI X documents the
 * opposite behaviour — "selected rows that do not pass the filtering criteria are automatically
 * deselected". Here the selection survives the filter and comes back exactly as it was when the
 * filter clears: nothing added, nothing lost.
 *
 * Two things separate "the row moved" from "the row left": sorting reorders rows and changes no
 * selection at all, while **deleting** a selected row drops it from the count even when it was
 * filtered out at the time. Retention and pruning are the same mechanism from two sides.
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
  protected readonly filters = createFilters<InvoiceRow, SelectionInvoiceFilterState>((path) => {
    equals(path.status);
    contains(path.customer);
    hasAny(path.tags);
  });

  protected readonly filterForm = form(this.filters().value);

  protected readonly table = createTable(
    this.data,
    selectionInvoiceConfig,
    withFiltering({ filters: this.filters }),
    withSelection(),
    withSorting(),
  );

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly tagOptions = TAG_OPTIONS;
  protected readonly hiddenSelectionNotice = HIDDEN_SELECTION_NOTICE;

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
  protected readonly isStatusActive = computed(
    () => this.filters.status().active() !== undefined,
  );
  protected readonly isCustomerActive = computed(
    () => this.filters.customer().active() !== undefined,
  );
  protected readonly isTagsActive = computed(() => this.filters.tags().active() !== undefined);
  protected readonly hasActiveCriteria = computed(
    () => Object.keys(this.filters().active()).length > 0,
  );

  protected isSelected(id: RowId): boolean {
    return this.table.selectedRows().has(id);
  }

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

  /** Hand-wired: a bound `<select>` writes `''`, and `equals`' empty criterion is `null`. */
  protected selectStatus(raw: string): void {
    this.filters.status().value.set(isInvoiceStatus(raw) ? raw : null);
  }

  /** Hand-wired: a tag multi-select is a set, not a single control value. */
  protected toggleTag(tag: string): void {
    this.filters
      .tags()
      .value.update((selected) => toggleOption(selected, tag, this.tagOptions));
  }

  protected isTagSelected(tag: string): boolean {
    return this.filters.tags().value().includes(tag);
  }

  protected clearAllFilters(): void {
    this.filters().reset(null);
  }
}
