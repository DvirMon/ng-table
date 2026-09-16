import { Component, computed, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createFilters } from '../../../filters/create-filters';
import {
  anyOf,
  contains,
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
import type { InvoiceRow, RangeCriterion, TagCriterion } from '../fixtures/types';
import {
  EMPTY_TAG_CRITERION,
  formatCriterion,
  isDateRangeCriterion,
  isEmptyTagCriterion,
  isInvoiceStatus,
  isRangeCriterion,
  isTagCriterion,
  matchesInvoiceNumber,
  matchesStatus,
  matchesTagCriterion,
  toggleOption,
} from '../fixtures/utils';
import { FILTERING_STORY_PIPES } from '../filtering-story.pipes';
import { createFilterReportLog } from './filter-report-log';
import { CLIENT_FILTER_KEYS } from './client-filtering.types';
import type { ActiveCriterion, ClientFilterKey, SavedFilterLoad } from './client-filtering.types';

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
/** The criterion map the schema below infers. Derived, never restated — a renamed filter key
 *  breaks this function rather than silently passing an unknown key to `reset()`. */
type ClientCriteria = ReturnType<
  ReturnType<ClientFilteringStoryHostComponent['filters']>['value']
>;

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
 * Per-column and compound predicates via `createFilters()` feed `withFiltering()` as one
 * matcher term, with Signal Forms driving the criteria directly. Load a stale saved filter
 * raw or through validation to compare the two paths.
 */
@Component({
  selector: 'ngp-client-filtering-story-host',
  imports: [FormField, NgpTableDirective, NgpTableRowDirective, ...FILTERING_STORY_PIPES],
  templateUrl: './client-filtering-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../filtering-story.css'],
})
export class ClientFilteringStoryHostComponent {
  /** Flipped by the "Break the tags filter" toggle; read by the compound `tags` predicate. */
  protected readonly tagsPredicateIsBroken = signal(false);

  protected readonly data = signal<InvoiceRow[]>(INVOICE_ROWS_MOCK);

  /** Public, not protected, only so `ClientCriteria` above can derive the criterion map from it. */
  readonly filters = createFilters(this.data, (path) => [
    filter(path.status, matchesStatus, { emptyValue: '' }),
    contains(path.customer),
    inRange(path.amount, { source: () => DEFAULT_AMOUNT_RANGE }),
    inDateRange(path.issuedAt),
    filter(
      path.tags,
      (cell: string[], criterion: TagCriterion): boolean => {
        if (this.tagsPredicateIsBroken()) {
          throw new Error('The tags predicate is broken (story control).');
        }
        return matchesTagCriterion(cell, criterion);
      },
      { isEmpty: isEmptyTagCriterion, emptyValue: EMPTY_TAG_CRITERION },
    ),
    // Declared paths (PrimeNG's shape), never scanned (AG Grid's). `note` is nullable and `id`
    // is numeric, so the typed matchers return `false` where a stringify-and-substring quick
    // filter throws. `customer` cannot join the group — it already owns a `contains` filter,
    // and one path carries one filter.
    anyOf('search', [contains(path.note), filter(path.id, matchesInvoiceNumber)]),
  ]);

  /** Signal Forms directly over the criterion model — `filters().value` is a `WritableSignal`,
   * so the form writes through to the nodes and there is nothing to keep in sync. */
  protected readonly filterForm = form(this.filters().value);

  protected readonly table = createTable(
    this.data,
    clientInvoiceConfig,
    withFiltering({ predicates: () => [this.filters().matcher()] }),
  );

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly tagOptions = TAG_OPTIONS;

  /** The library's own degradation reports, mirrored onto the canvas. */
  protected readonly filterReports = createFilterReportLog();

  protected readonly savedFilterLoad = signal<SavedFilterLoad>(null);

  protected readonly includedTagSet = computed(
    () => new Set(this.filters.tags().value().include),
  );
  protected readonly excludedTagSet = computed(
    () => new Set(this.filters.tags().value().exclude),
  );

  protected readonly isEveryTagIncluded = computed(
    () => this.includedTagSet().size === this.tagOptions.length,
  );

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
    this.tagsPredicateIsBroken.update((isBroken) => !isBroken);
  }

  /**
   * The anti-pattern, on purpose. `reset()` takes a `Partial<…>` of the criterion map
   * `createFilters` inferred from the schema above, and this snapshot satisfies none of it —
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
