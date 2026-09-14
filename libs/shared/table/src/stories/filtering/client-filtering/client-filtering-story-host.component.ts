import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createFilters } from '../../../filters/create-filters';
import {
  anyOf,
  contains,
  equals,
  filter,
  inDateRange,
  inRange,
} from '../../../filters/rules';
import { createTable } from '../../../api/create-table';
import { withFiltering } from '../../../api/features/with-filtering';
import { NgpTableDirective } from '../../../directives/ngp-table.directive';
import { NgpTableRowDirective } from '../../../directives/ngp-table-row.directive';
import { INVOICE_ROWS_MOCK, STATUS_OPTIONS, TAG_OPTIONS } from '../fixtures/mock';
import { clientInvoiceConfig } from '../fixtures/schema';
import type {
  ClientInvoiceFilterState,
  InvoiceRow,
  RangeCriterion,
  TagCriterion,
} from '../fixtures/types';
import {
  EMPTY_TAG_CRITERION,
  formatCriterion,
  isDateRangeCriterion,
  isEmptyTagCriterion,
  isInvoiceStatus,
  isRangeCriterion,
  isTagCriterion,
  matchesInvoiceNumber,
  matchesTagCriterion,
  toDateInputValue,
  toggleOption,
} from '../fixtures/utils';

/** One entry of the summary row, read from the filter nodes rather than a host copy. */
interface ActiveCriterion {
  readonly key: ClientFilterKey;
  readonly label: string;
}

/** Declared once so the summary row and its × buttons stay typed — `Object.entries()` over
 * `active()` would hand back a bare `string` key that cannot index the filter set. */
const CLIENT_FILTER_KEYS = [
  'status',
  'customer',
  'amount',
  'issuedAt',
  'tags',
  'search',
] as const;

type ClientFilterKey = (typeof CLIENT_FILTER_KEYS)[number];

/** The `amount` default the story's `Reset to defaults` restores and `Clear all` does not.
 * Without a declared `source` the two buttons would be indistinguishable. */
const DEFAULT_AMOUNT_RANGE: RangeCriterion = { min: 1000, max: null };

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
function keepValidCriteria(
  saved: Record<string, unknown>,
): Partial<ClientInvoiceFilterState> {
  const guarded: Partial<ClientInvoiceFilterState> = {};
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
 * The filtering baseline — a standalone `createFilters()` object reaching the table as one
 * predicate term, `withFiltering({ predicates: () => [filters().matcher()] })`, client side,
 * synchronous, no MSW.
 *
 * **The declaration is in the host, not a fixture.** `createFilters()` reads like
 * `createTable()` directly above it, because the schema callback is the thing a consumer
 * actually writes. Only the row data, the option lists and the table config come from
 * `fixtures/`.
 *
 * **The criterion model is the form model.** `form(this.filters().value)` puts Signal Forms
 * over the filter state itself — no adapter, no second model, no sync effect. Text, number and
 * date inputs bind straight to a criterion through `[formField]`, including the nullable range
 * bounds: Signal Forms maps an empty number box to `null` and back, which is exactly
 * `inRange`'s empty value, so emptying a box stops it narrowing with no story-local guard.
 *
 * **The status select binds too, because its empty criterion is declared.** `equals(path.status,
 * { emptyValue: '' })` makes `''` the empty value, which is the only empty a native `<select>`
 * can express — so `<option value="">any</option>` deactivates the filter rather than leaving it
 * permanently active. Only the tag multi-select stays hand-wired: a checkbox group is several
 * elements, not one control value, so it writes through `filters.tags().value`.
 *
 * Shape follows what peer libraries converged on rather than an invented layout: per-column
 * inputs in an always-visible filter row, the quick filter in a toolbar above the table. The
 * quick filter's paths are **declared** (PrimeNG's shape), not scanned (AG Grid's), so its
 * nullable and numeric legs return `false` instead of throwing on a non-string cell.
 *
 * Two deliberate deviations from every peer researched, both visible on canvas: `Reset to
 * defaults` (`reset()`) and `Clear all` (`reset(null)`) are different buttons — no peer has a
 * reset-to-source concept — and a throwing filter predicate **widens** the result set with one
 * report per evaluation instead of taking the table down (ADR-0014).
 *
 * Option lists come from `TAG_OPTIONS`/`STATUS_OPTIONS`, hand-supplied: `createFilters()` takes
 * no `data` argument, so distinct values are never derived from the rows. A person cannot tell
 * a derived dropdown from a hardcoded one by looking, so this says which it is.
 *
 * "No matches" and "no data" are two states, not one. AG Grid and MUI X both ship two separate
 * overlays for exactly this reason, and both warn about the stale-rows trap behind conflating
 * them (ag-grid#3716).
 */
@Component({
  selector: 'ngp-client-filtering-story-host',
  imports: [FormField, NgpTableDirective, NgpTableRowDirective],
  templateUrl: './client-filtering-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../filtering-story.css'],
})
export class ClientFilteringStoryHostComponent {
  /** Flipped by the "Break the tags filter" toggle; read by the compound `tags` predicate. */
  protected readonly tagsPredicateIsBroken = signal(false);

  protected readonly filters = createFilters<InvoiceRow, ClientInvoiceFilterState>((path) => {
    equals(path.status, { emptyValue: '' });
    contains(path.customer);
    inRange(path.amount, { source: () => DEFAULT_AMOUNT_RANGE });
    inDateRange(path.issuedAt);
    filter(
      path.tags,
      (cell: string[], criterion: TagCriterion): boolean => {
        if (this.tagsPredicateIsBroken()) {
          throw new Error('The tags predicate is broken (story control).');
        }
        return matchesTagCriterion(cell, criterion);
      },
      { isEmpty: isEmptyTagCriterion, emptyValue: EMPTY_TAG_CRITERION },
    );
    // Declared paths (PrimeNG's shape), never scanned (AG Grid's). `note` is nullable and `id`
    // is numeric, so the typed matchers return `false` where a stringify-and-substring quick
    // filter throws. `customer` cannot join the group — it already owns a `contains` filter,
    // and one path carries one filter.
    anyOf<InvoiceRow>('search', (searchPath) => {
      contains(searchPath.note);
      filter(searchPath.id, matchesInvoiceNumber);
    });
  });

  /** Signal Forms directly over the criterion model — `filters().value` is a `WritableSignal`,
   * so the form writes through to the nodes and there is nothing to keep in sync. */
  protected readonly filterForm = form(this.filters().value);

  protected readonly data = signal<InvoiceRow[]>(INVOICE_ROWS_MOCK);
  protected readonly table = createTable(
    this.data,
    clientInvoiceConfig,
    withFiltering({ predicates: () => [this.filters().matcher()] }),
  );

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly tagOptions = TAG_OPTIONS;

  /** The library's own degradation reports, mirrored onto the canvas. */
  protected readonly filterReports = signal<readonly string[]>([]);
  protected readonly savedFilterNotice = signal<string | null>(null);

  protected readonly isStatusActive = computed(
    () => this.filters.status().active() !== undefined,
  );
  protected readonly isCustomerActive = computed(
    () => this.filters.customer().active() !== undefined,
  );
  protected readonly isAmountActive = computed(
    () => this.filters.amount().active() !== undefined,
  );
  protected readonly isIssuedAtActive = computed(
    () => this.filters.issuedAt().active() !== undefined,
  );
  protected readonly isTagsActive = computed(() => this.filters.tags().active() !== undefined);

  protected readonly activeCriteria = computed<ActiveCriterion[]>(() =>
    CLIENT_FILTER_KEYS.filter((key) => this.filters[key]().active() !== undefined).map(
      (key) => ({ key, label: formatCriterion(this.filters[key]().value()) }),
    ),
  );
  protected readonly hasActiveCriteria = computed(() => this.activeCriteria().length > 0);
  /** The shipped member, never story-local arithmetic. */
  protected readonly matchCount = computed(() => this.table.totalRowCount());
  protected readonly rowCount = computed(() => this.table.value().length);
  protected readonly hasNoData = computed(() => this.rowCount() === 0);
  protected readonly isFilteredToNothing = computed(
    () => this.hasActiveCriteria() && this.matchCount() === 0 && !this.hasNoData(),
  );

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.captureFilterReports();
  }

  /** Hand-wired: a tag multi-select is a set, not a single control value. */
  protected toggleIncludedTag(tag: string): void {
    this.filters.tags().value.update((criterion) => ({
      ...criterion,
      include: toggleOption(criterion.include, tag, this.tagOptions),
    }));
  }

  protected toggleExcludedTag(tag: string): void {
    this.filters.tags().value.update((criterion) => ({
      ...criterion,
      exclude: toggleOption(criterion.exclude, tag, this.tagOptions),
    }));
  }

  /** The Select-All affordance every peer's multi-select ships. */
  protected toggleAllIncludedTags(): void {
    this.filters.tags().value.update((criterion) => ({
      ...criterion,
      include: this.isEveryTagIncluded() ? [] : [...this.tagOptions],
    }));
  }

  protected isEveryTagIncluded(): boolean {
    return this.filters.tags().value().include.length === this.tagOptions.length;
  }

  protected isIncludedTag(tag: string): boolean {
    return this.filters.tags().value().include.includes(tag);
  }

  protected isExcludedTag(tag: string): boolean {
    return this.filters.tags().value().exclude.includes(tag);
  }

  /** Renders the time of day when a row carries one — the 16:45 invoice is why a same-day `to`
   * bound excludes it, and a cell showing only the date would hide the reason. */
  protected issuedLabel(invoice: InvoiceRow): string {
    const issuedAt = invoice.issuedAt;
    const day = toDateInputValue(issuedAt);
    const hasTimeOfDay = issuedAt.getHours() !== 0 || issuedAt.getMinutes() !== 0;
    if (!hasTimeOfDay) {
      return day;
    }
    const hours = String(issuedAt.getHours()).padStart(2, '0');
    const minutes = String(issuedAt.getMinutes()).padStart(2, '0');
    return `${day} ${hours}:${minutes}`;
  }

  /** One summary entry's ×. Empties that criterion alone; the rest keep narrowing. */
  protected clearCriterion(key: ClientFilterKey): void {
    this.filters[key]().reset(null);
  }

  /** `reset()` — back to every declared `source`. The amount filter has one, so this is not
   * the same as emptying. */
  protected resetToDefaults(): void {
    this.savedFilterNotice.set(null);
    this.filters().reset();
  }

  /** `reset(null)` — empty. Every peer's "Clear" means this one. */
  protected clearAllFilters(): void {
    this.savedFilterNotice.set(null);
    this.filters().reset(null);
  }

  protected toggleTagsPredicate(): void {
    this.filterReports.set([]);
    this.tagsPredicateIsBroken.update((isBroken) => !isBroken);
  }

  /**
   * The anti-pattern, on purpose. `reset()` takes `Partial<ClientInvoiceFilterState>`, and this
   * snapshot satisfies none of it — `status: 'archived'` is not an `InvoiceStatus`, `amount`
   * carries pre-rename keys, `retiredFilter` names nothing. **Not being able to write this
   * without stepping outside the type is the finding**, so the escape is left visible rather
   * than hidden behind a helper: an unvalidated snapshot is not filter state, and the typed
   * signature is what says so. The guarded button below is the supported route.
   */
  protected loadSavedFilterRaw(): void {
    this.filters().reset(STALE_SAVED_FILTER as Partial<ClientInvoiceFilterState>);
    this.savedFilterNotice.set(
      'Raw load: the saved `status: "archived"` was applied verbatim and matches no row, so the ' +
        'table looks broken rather than empty-because-you-asked. The renamed `amount` keys read ' +
        'as an empty range and narrow nothing at all — silently.',
    );
  }

  protected loadSavedFilterGuarded(): void {
    this.filters().reset(keepValidCriteria(STALE_SAVED_FILTER));
    this.savedFilterNotice.set(
      'Guarded load: `status: "archived"` and the renamed `amount` keys failed their shape ' +
        'check and were dropped back to their declared defaults; `customer` survived.',
    );
  }

  protected emptyTheData(): void {
    this.data.set([]);
  }

  protected restoreTheData(): void {
    this.data.set(INVOICE_ROWS_MOCK);
  }

  /**
   * Mirrors the library's `[createFilters]` degradation reports onto the canvas. The evaluator
   * reports through `console.error` and offers no observable channel, so proving "once per
   * evaluation, not once per row" means reading them from there. Deferred a tick because the
   * report fires inside the pipeline's own `computed()`, where a signal write is illegal.
   * Restored on destroy.
   */
  private captureFilterReports(): void {
    const originalError = console.error;
    console.error = (...args: unknown[]): void => {
      originalError(...args);
      const [message] = args;
      if (typeof message === 'string' && message.startsWith('[createFilters]')) {
        setTimeout(() => this.filterReports.update((reports) => [...reports, message]));
      }
    };
    this.destroyRef.onDestroy(() => {
      console.error = originalError;
    });
  }
}
