import { Component, computed, signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import { createTable } from '../../../api/create-table';
import { withFiltering } from '../../../api/features/with-filtering';
import { NgpTableDirective } from '../../../directives/ngp-table.directive';
import { NgpTableRowDirective } from '../../../directives/ngp-table-row.directive';
import { INVOICE_ROWS_MOCK, STATUS_OPTIONS, TAG_OPTIONS } from '../fixtures/mock';
import { clientInvoiceConfig } from '../fixtures/schema';
import type { InvoiceRow } from '../fixtures/types';
import {
  formatCriterion,
  isDateRangeCriterion,
  isInvoiceStatus,
  isRangeCriterion,
  isTagCriterion,
} from '../fixtures/utils';
import { FILTERING_STORY_PIPES } from '../filtering-story.pipes';
import { createFilterReportLog } from './filter-report-log';
import { CLIENT_FILTER_KEYS } from './client-filtering.types';
import type { ActiveCriterion, ClientFilterKey, SavedFilterLoad } from './client-filtering.types';
import {
  clientInvoiceFilters,
  tagsPredicateIsBroken as tagsPredicateIsBrokenControl,
} from './client-filtering.filters';
import type { ClientCriteria } from './client-filtering.filters';
import { ClientFilteringToolbarComponent } from './client-filtering-toolbar.component';


/**
 * A filter set persisted by an older build: `status` names a value that no longer exists, and
 * `amount` uses range keys from before a rename. Loaded raw it is applied verbatim; loaded
 * through `keepValidCriteria()` the unusable halves are dropped.
 */
const STALE_SAVED_FILTER: Record<string, unknown> = {
  status: 'archived',
  customer: 'Contoso',
  amount: { lo: 1000, hi: 5000 },
  retiredFilter: 'left over from a column that no longer exists',
};

/**
 * Drops every saved entry whose shape no longer matches what the schema declares. Keys left out
 * are reset to their declared default, so a partial load is still a complete state — which is
 * why the return type is `Partial<…>` and `reset()` accepts one.
 *
 * The guards are what let this return a typed value at all: each one narrows a single
 * `unknown` off the snapshot. That is the whole difference between the two load buttons.
 */
function keepValidCriteria(saved: Record<string, unknown>): Partial<ClientCriteria> {
  const guarded: Partial<ClientCriteria> = {};
  if (isInvoiceStatus(saved['status'])) {
    guarded.status = saved['status'];
  }
  if (typeof saved['customer'] === 'string') {
    guarded.customer = saved['customer'];
  }
  if (isRangeCriterion(saved['amount'])) {
    guarded.amount = saved['amount'];
  }
  if (isDateRangeCriterion(saved['issuedAt'])) {
    guarded.issuedAt = saved['issuedAt'];
  }
  if (isTagCriterion(saved['tags'])) {
    guarded.tags = saved['tags'];
  }
  if (typeof saved['search'] === 'string') {
    guarded.search = saved['search'];
  }
  return guarded;
}

/**
 * Table with client-side filtering
 *
 * The table owns the filter model directly: `clientInvoiceFilters` is a hoisted schema and
 * `withFiltering({ schema })` builds and exposes `filters`, with Signal Forms driving the
 * criteria directly. Load a stale saved filter raw or through validation to compare the two
 * paths.
 */
@Component({
  selector: 'ngp-client-filtering-story-host',
  imports: [
    NgpTableDirective,
    NgpTableRowDirective,
    ClientFilteringToolbarComponent,
    ...FILTERING_STORY_PIPES,
  ],
  templateUrl: './client-filtering-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../filtering-story.css'],
})
export class ClientFilteringStoryHostComponent {
  protected readonly data = signal<InvoiceRow[]>(INVOICE_ROWS_MOCK);

  protected readonly table = createTable(
    this.data,
    clientInvoiceConfig,
    withFiltering({ schema: clientInvoiceFilters }),
  );

  /** The shipped member, read by the template and `activeCriteria` below. */
  protected readonly filters = this.table.filters;

  /** Signal Forms directly over the criterion model — `filters().value` is a `WritableSignal`,
   * so the form writes through to the nodes and there is nothing to keep in sync. */
  protected readonly filterForm = form(this.table.filters().value);

  /** Template alias for the "Break the tags filter" toggle; the module-scope signal it points
   * to lives beside the schema in `client-filtering.filters.ts`. */
  protected readonly tagsPredicateIsBroken = tagsPredicateIsBrokenControl;

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly tagOptions = TAG_OPTIONS;

  /** The library's own degradation reports, mirrored onto the canvas. */
  protected readonly filterReports = createFilterReportLog();

  protected readonly savedFilterLoad = signal<SavedFilterLoad>(null);

  /** Labels only — the per-key and root booleans are shipped members, read straight from the
   *  template (`filters.status().isActive()`, `filters().isActive()`). */
  protected readonly activeCriteria = computed<ActiveCriterion[]>(() =>
    CLIENT_FILTER_KEYS.filter((key) => this.filters[key]().isActive()).map((key) => ({
      key,
      label: formatCriterion(this.filters[key]().value()),
    })),
  );
  /** The shipped member, never story-local arithmetic. */
  protected readonly matchCount = computed(() => this.table.totalRowCount());
  protected readonly rowCount = computed(() => this.table.value().length);
  protected readonly hasNoData = computed(() => this.rowCount() === 0);
  protected readonly isFilteredToNothing = computed(
    () => this.filters().isActive() && this.matchCount() === 0 && !this.hasNoData(),
  );

  /** One summary entry's ×. Empties that criterion alone; the rest keep narrowing. */
  protected clearCriterion(key: ClientFilterKey): void {
    this.filters[key]().reset(null);
  }

  /** `reset()` — back to every declared `source`. The amount filter has one, so this is not
   * the same as emptying. */
  protected resetToDefaults(): void {
    this.savedFilterLoad.set(null);
    this.filters().reset();
  }

  /** `reset(null)` — empty. Every peer's "Clear" means this one. */
  protected clearAllFilters(): void {
    this.savedFilterLoad.set(null);
    this.filters().reset(null);
  }

  protected toggleTagsPredicate(): void {
    this.filterReports.clear();
    tagsPredicateIsBrokenControl.update((isBroken) => !isBroken);
  }

  /**
   * The anti-pattern, on purpose. `reset()` takes a `Partial<…>` of the criterion map the
   * schema above infers, and this snapshot satisfies none of it —
   * `status: 'archived'` is not an `InvoiceStatus`, `amount` carries pre-rename keys,
   * `retiredFilter` names nothing. **Not being able to write this without stepping outside the
   * type is the finding**, so the escape is left visible rather than hidden behind a helper: an
   * unvalidated snapshot is not filter state, and the typed signature is what says so. The
   * guarded button below is the supported route.
   */
  protected loadSavedFilterRaw(): void {
    this.filters().reset(STALE_SAVED_FILTER as Partial<ClientCriteria>);
    this.savedFilterLoad.set('raw');
  }

  protected loadSavedFilterGuarded(): void {
    this.filters().reset(keepValidCriteria(STALE_SAVED_FILTER));
    this.savedFilterLoad.set('guarded');
  }

  protected emptyTheData(): void {
    this.data.set([]);
  }

  protected restoreTheData(): void {
    this.data.set(INVOICE_ROWS_MOCK);
  }
}
