import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createFilters } from '../../../api/create-filters';
import { contains, equals, hasNone, inRange } from '../../../api/filters/rules';
import { createTable } from '../../../api/create-table';
import { createTableFeature } from '../../../api/create-table-feature';
import type { TableStore } from '../../../api/types';
import { NgpTableDirective } from '../../../directives/ngp-table.directive';
import { NgpTableRowDirective } from '../../../directives/ngp-table-row.directive';
import { injectInvoiceApi, type InvoiceRequestOptions } from '../fixtures/http';
import { STATUS_OPTIONS, TAG_OPTIONS } from '../fixtures/mock';
import { serverFilterFormSchema, serverInvoiceConfig } from '../fixtures/schema';
import type {
  InvoiceRow,
  RangeCriterion,
  ServerInvoiceFilterState,
} from '../fixtures/types';
import {
  EMPTY_RANGE,
  isInvoiceStatus,
  isRangeCriterion,
  isStringArray,
  toggleOption,
} from '../fixtures/utils';

interface InvoiceRequest {
  readonly params: Record<string, string>;
  readonly options: InvoiceRequestOptions;
}

/** The range the "server" eventually supplies as the amount filter's default. */
const SERVER_DEFAULT_AMOUNT: RangeCriterion = { min: 1000, max: 20000 };

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
 * Server-side filtering: the filters produce the data instead of narrowing it afterwards.
 *
 * **No filtering feature is composed.** `withFiltering({ manual: true })` exists for symmetry
 * with `withSorting()`, but in server mode it is an identity pass-through that still claims the
 * `filter` stage — composing it would occupy a slot to do nothing. `createFilters()` alone feeds
 * the request; the rows come back already narrowed.
 *
 * Three things only exist here. The **debounce** (`debounce(path.search, 300)`, in
 * `fixtures/schema.ts`) has a consequence only where a keystroke costs a request — the request
 * counter on canvas is the proof. It applies to the criterion itself: the form is built over
 * `filters().value`, so there is no second search model and no effect copying one into the
 * other — the typing pause *is* the criterion write, and the request follows from it. The **server's own total** overrides the core
 * `totalRowCount` through a tiny `createTableFeature()`, the one core key ADR-0005 leaves
 * overridable, and is rendered next to `renderRows().length` so it reads as the server's number
 * rather than an approximation from one page. And the **late default** race: the amount filter
 * declares `source: () => serverDefaultAmount()`, so typing into the box before the default
 * lands marks it dirty and the arriving default loses.
 *
 * Loading, no-matches and request-failed are three distinct blocks rather than one empty table.
 * No peer library documents a loading affordance for server filtering, so that split is a
 * decision this story makes, not a convention it inherits. A failed request keeps the rows that
 * were already on screen — blanking the table is the behaviour being argued against.
 */
@Component({
  selector: 'ngp-server-filtering-story-host',
  imports: [FormField, NgpTableDirective, NgpTableRowDirective],
  templateUrl: './server-filtering-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../filtering-story.css'],
})
export class ServerFilteringStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(600);

  /** Empty until "Deliver server default now" is pressed — the race needs a late arrival. */
  protected readonly serverDefaultAmount = signal<RangeCriterion>(EMPTY_RANGE);

  protected readonly filters = createFilters<InvoiceRow, ServerInvoiceFilterState>((path) => {
    equals(path.status);
    contains(path.customer, { as: 'search' });
    inRange(path.amount, { source: () => this.serverDefaultAmount() });
    hasNone(path.tags, { as: 'excludedTags' });
  });

  /** One form, over the criterion model itself — the debounced search field writes straight
   * into `filters.search()`. */
  protected readonly searchForm = form(this.filters().value, serverFilterFormSchema);

  protected readonly rows = signal<InvoiceRow[]>([]);
  protected readonly serverTotal = signal(0);
  protected readonly table = createTable(
    this.rows,
    serverInvoiceConfig,
    // ADR-0005 leaves exactly one core member overridable, and this is what it is for: the row
    // count a person sees is the server's, not the length of the page in hand.
    createTableFeature((_store: Pick<TableStore<InvoiceRow>, 'rows'>) => ({
      members: { totalRowCount: this.serverTotal.asReadonly() },
    })),
  );

  protected readonly isLoading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  /** One per request actually issued — the only way a debounce is visible. */
  protected readonly requestCount = signal(0);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly tagOptions = TAG_OPTIONS;

  protected readonly isStatusActive = computed(
    () => this.filters.status().active() !== undefined,
  );
  protected readonly isAmountActive = computed(
    () => this.filters.amount().active() !== undefined,
  );
  /** The late-default race, made visible: dirty means the typed value is no longer following
   * the declared `source`, so an arriving server default loses. */
  protected readonly isAmountDirty = computed(() => this.filters.amount().dirty());
  protected readonly isExcludedTagsActive = computed(
    () => this.filters.excludedTags().active() !== undefined,
  );
  protected readonly hasActiveCriteria = computed(
    () => Object.keys(this.filters().active()).length > 0,
  );
  protected readonly hasNoMatches = computed(
    () =>
      this.hasActiveCriteria() &&
      this.serverTotal() === 0 &&
      !this.isLoading() &&
      this.loadError() === null,
  );

  private readonly invoiceApi = injectInvoiceApi();

  constructor() {
    this.reloadWhenRequestChanges();
  }

  /** Hand-wired: a bound `<select>` writes `''`, and `equals`' empty criterion is `null`. */
  protected selectStatus(raw: string): void {
    this.filters.status().value.set(isInvoiceStatus(raw) ? raw : null);
  }

  /** Hand-wired: a tag multi-select is a set, not a single control value. */
  protected toggleExcludedTag(tag: string): void {
    this.filters
      .excludedTags()
      .value.update((selected) => toggleOption(selected, tag, this.tagOptions));
  }

  protected isExcludedTag(tag: string): boolean {
    return this.filters.excludedTags().value().includes(tag);
  }

  /** The late arrival. With a typed value already in the box, `dirty()` keeps it. */
  protected deliverServerDefault(): void {
    this.serverDefaultAmount.set(SERVER_DEFAULT_AMOUNT);
  }

  protected retry(): void {
    this.load(this.currentRequest());
  }

  private currentRequest(): InvoiceRequest {
    return {
      params: toQueryParams(this.filters().active()),
      options: { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() },
    };
  }

  private reloadWhenRequestChanges(): void {
    effect(() => {
      const request = this.currentRequest();
      untracked(() => this.load(request));
    });
  }

  private load(request: InvoiceRequest): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.requestCount.update((count) => count + 1);

    this.invoiceApi.fetchInvoices(request.params, request.options).subscribe({
      next: (page) => {
        this.rows.set(page.rows);
        this.serverTotal.set(page.total);
        this.isLoading.set(false);
      },
      // `rows` is deliberately untouched: the previously-loaded page stays on screen behind the
      // error marker instead of the table blanking.
      error: (error: unknown) => {
        this.loadError.set(error instanceof Error ? error.message : 'Loading invoices failed.');
        this.isLoading.set(false);
      },
    });
  }
}
