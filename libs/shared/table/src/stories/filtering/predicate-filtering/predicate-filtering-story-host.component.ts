import { Component, computed, signal } from '@angular/core';
import { createTable } from '../../../api/create-table';
import { withFiltering } from '../../../api/features/with-filtering';
import { NgpTableDirective } from '../../../directives/ngp-table.directive';
import { NgpTableRowDirective } from '../../../directives/ngp-table-row.directive';
import { INVOICE_ROWS_MOCK, STATUS_OPTIONS } from '../fixtures/mock';
import type { InvoiceRow, InvoiceStatus } from '../fixtures/types';
import { predicateInvoiceConfig } from './predicate-filtering.schema';

/** Local, because `filtering/fixtures/utils.ts` reaches into the filters domain for its matchers
 * and this host imports nothing from there. */
function isInvoiceStatus(value: string): value is InvoiceStatus {
  return STATUS_OPTIONS.some((status) => status === value);
}

/**
 * Filtering with plain row predicates and no filter model at all — the point of the story is what
 * the import list above does not contain.
 *
 * `predicates` is a thunk, and that is the reactivity boundary: the filter stage calls it once per
 * pass, so terms closing over these signals re-narrow on their own. Terms are AND'd, and an empty
 * control contributes no term rather than a predicate that always returns `true`.
 */
@Component({
  selector: 'ngp-predicate-filtering-story-host',
  imports: [NgpTableDirective, NgpTableRowDirective],
  templateUrl: './predicate-filtering-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../filtering-story.css'],
})
export class PredicateFilteringStoryHostComponent {
  /** Plain signals, no criterion model — a predicate reads them and that is the whole wiring. */
  protected readonly search = signal('');
  protected readonly status = signal<InvoiceStatus | null>(null);

  protected readonly data = signal<InvoiceRow[]>(INVOICE_ROWS_MOCK);
  protected readonly table = createTable(
    this.data,
    predicateInvoiceConfig,
    withFiltering({ predicates: () => this.rowPredicates() }),
  );

  protected readonly statusOptions = STATUS_OPTIONS;

  protected readonly isSearchActive = computed(() => this.search().trim().length > 0);
  protected readonly isStatusActive = computed(() => this.status() !== null);
  protected readonly activeTermCount = computed(() => this.rowPredicates().length);

  /** The shipped member, never story-local arithmetic. */
  protected readonly matchCount = computed(() => this.table.totalRowCount());
  protected readonly rowCount = computed(() => this.table.value().length);
  protected readonly isFilteredToNothing = computed(
    () => this.activeTermCount() > 0 && this.matchCount() === 0,
  );

  protected setSearch(value: string): void {
    this.search.set(value);
  }

  protected selectStatus(raw: string): void {
    this.status.set(isInvoiceStatus(raw) ? raw : null);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.status.set(null);
  }

  /**
   * One call is one pass. A control that is empty adds nothing to the list, so "stops narrowing"
   * needs no `isEmpty` contract — the term simply isn't there.
   */
  private rowPredicates(): readonly ((row: InvoiceRow) => boolean)[] {
    const terms: ((row: InvoiceRow) => boolean)[] = [];

    const query = this.search().trim().toLowerCase();
    const hasQuery = query.length > 0;
    if (hasQuery) {
      terms.push((row) => row.customer.toLowerCase().includes(query));
    }

    const status = this.status();
    const hasStatus = status !== null;
    if (hasStatus) {
      terms.push((row) => row.status === status);
    }

    return terms;
  }
}
