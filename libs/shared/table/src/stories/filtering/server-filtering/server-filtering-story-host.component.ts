import { Component, computed, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { debounce, form } from '@angular/forms/signals';
import { createTable } from '../../../api/create-table';
import { createTableFeature } from '../../../api/create-table-feature';
import type { TableStore } from '../../../api/types';
import { NgpTableDirective } from '../../../directives/ngp-table.directive';
import { NgpTableRowDirective } from '../../../directives/ngp-table-row.directive';
import { injectInvoiceApi } from '../fixtures/http';
import { STATUS_OPTIONS, TAG_OPTIONS } from '../fixtures/mock';
import { serverInvoiceConfig } from '../fixtures/schema';
import type { InvoicePage, InvoiceRow, RangeCriterion } from '../fixtures/types';
import { EMPTY_RANGE, isRangeCriterion, isStringArray } from '../fixtures/utils';
import { createServerFilters } from './server-filtering.filters';
import { ServerFilteringToolbarComponent } from './server-filtering-toolbar.component';

/** The range the "server" eventually supplies as the amount filter's default. */
const SERVER_DEFAULT_AMOUNT: RangeCriterion = { min: 1000, max: 20000 };

/** Fallback for `lastPage`'s `computation` before any page has ever resolved. */
const EMPTY_PAGE: InvoicePage = { rows: [], total: 0 };

/**
 * The query mapping, hand-written. `createFilters()` ships no serializer — deliberately, since
 * no library can know a given backend's parameter names — so this is the code a consumer
 * actually writes, and the story shows it rather than hiding it in a helper.
 */
function toQueryParams(active: Partial<Record<string, unknown>>): Record<string, string> {
  const params: Record<string, string> = {};

  const status = active['status'];
  if (typeof status === 'string') {
    params['status'] = status;
  }

  const search = active['search'];
  if (typeof search === 'string') {
    params['search'] = search;
  }

  const amount = active['amount'];
  if (isRangeCriterion(amount)) {
    if (amount.min !== null) {
      params['amountMin'] = String(amount.min);
    }
    if (amount.max !== null) {
      params['amountMax'] = String(amount.max);
    }
  }

  const excludedTags = active['excludedTags'];
  if (isStringArray(excludedTags) && excludedTags.length > 0) {
    params['excludedTags'] = excludedTags.join(',');
  }

  return params;
}

/**
 * Server-side filtering
 *
 * Filters produce the data instead of narrowing it afterwards, via `rxResource` +
 * `linkedSignal` — `createFilters()` feeds the request builder directly, no filtering feature
 * composed. Debounced search writes into `filters().value`, so the typing pause is the request.
 *
 * The server's own total overrides `totalRowCount` via a tiny `createTableFeature()`; a failed
 * request keeps the last page on screen instead of blanking it.
 */
@Component({
  selector: 'ngp-server-filtering-story-host',
  imports: [NgpTableDirective, NgpTableRowDirective, ServerFilteringToolbarComponent],
  templateUrl: './server-filtering-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../filtering-story.css'],
})
export class ServerFilteringStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(600);

  /** Empty until "Deliver server default now" is pressed — the race needs a late arrival. */
  protected readonly serverDefaultAmount = signal<RangeCriterion>(EMPTY_RANGE);

  /**
   * Filters are declared here before any row has ever been fetched — `rows` below starts as an
   * empty array, so there is no data to anchor `InvoiceRow` to.
   */
  protected readonly filters = createServerFilters(this.serverDefaultAmount);

  /**
   * One form, over the criterion model itself — the debounced search field writes straight into
   * `filters.search()`. `debounce(path.search, 300)` turns a keystroke into one request per
   * typing pause instead of one per keystroke; it has no visible consequence in the synchronous
   * client story, which is why only this one carries it.
   */
  protected readonly searchForm = form(this.filters().value, (path) => {
    debounce(path.search, 300);
  });

  private readonly invoiceApi = injectInvoiceApi();

  /** One per request actually issued — the only way a debounce is visible. */
  protected readonly requestCount = signal(0);

  /** `docs/1-state/work/table-owned-filtering/spec.md` step 7: the request is driven by
   * `resource({ params: () => table.filters().criteria() })`, no `effect`/`untracked` loop. */
  protected readonly invoices = rxResource({
    params: () => ({
      query: toQueryParams(this.filters().criteria()),
      options: { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() },
    }),
    stream: ({ params }) => {
      this.requestCount.update((count) => count + 1);
      return this.invoiceApi.fetchInvoices(params.query, params.options);
    },
  });

  /** Last page that arrived. `hasValue()` is false while loading and on error; `previous` keeps
   * rows on screen through both. */
  private readonly lastPage = linkedSignal<InvoicePage | undefined, InvoicePage>({
    source: () => (this.invoices.hasValue() ? this.invoices.value() : undefined),
    computation: (page, previous) => page ?? previous?.value ?? EMPTY_PAGE,
  });

  protected readonly rows = linkedSignal(() => this.lastPage().rows);
  protected readonly serverTotal = computed(() => this.lastPage().total);

  protected readonly table = createTable(
    this.rows,
    serverInvoiceConfig,
    // ADR-0005 leaves exactly one core member overridable, and this is what it is for: the row
    // count a person sees is the server's, not the length of the page in hand.
    createTableFeature((_store: Pick<TableStore<InvoiceRow>, 'rows'>) => ({
      members: { totalRowCount: this.serverTotal },
    })),
  );

  protected readonly loadError = computed(() => this.invoices.error()?.message ?? null);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly tagOptions = TAG_OPTIONS;

  protected readonly hasNoMatches = computed(
    () =>
      this.filters().isActive() &&
      this.invoices.status() === 'resolved' &&
      this.serverTotal() === 0,
  );

  /** The late arrival. With a typed value already in the box, `dirty()` keeps it. */
  protected deliverServerDefault(): void {
    this.serverDefaultAmount.set(SERVER_DEFAULT_AMOUNT);
  }

  protected retry(): void {
    this.invoices.reload();
  }
}
