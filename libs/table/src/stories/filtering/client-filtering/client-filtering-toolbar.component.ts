import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import { FormField } from '@angular/forms/signals';
import type { Filters } from '../../../api/features/with-filtering/types';
import { toggleOption } from '../fixtures/utils';
import type {
  InvoiceRow,
  InvoiceStatus,
  DateRangeCriterion,
  RangeCriterion,
} from '../fixtures/types';
import type { ClientCriteria } from './client-filtering.filters';

/**
 * Toolbar for the client-filtering story: search box, the load/reset/break-predicate/empty
 * actions, and the per-column filter controls. Summaries and notices that read table state stay
 * on the host.
 */
@Component({
  selector: 'ngp-client-filtering-toolbar',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-filtering-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css', '../filtering-story.css'],
})
export class ClientFilteringToolbarComponent {
  readonly searchField = input.required<FieldTree<string>>();
  readonly statusField = input.required<FieldTree<string>>();
  readonly customerField = input.required<FieldTree<string>>();
  readonly amountField = input.required<FieldTree<RangeCriterion>>();
  readonly issuedAtField = input.required<FieldTree<DateRangeCriterion>>();

  readonly filters = input.required<Filters<InvoiceRow, ClientCriteria>>();
  readonly tagsPredicateIsBroken = input.required<boolean>();
  readonly hasNoData = input.required<boolean>();
  readonly statusOptions = input.required<readonly InvoiceStatus[]>();
  readonly tagOptions = input.required<readonly string[]>();

  readonly resetToDefaults = output<void>();
  readonly clearAllFilters = output<void>();
  readonly toggleTagsPredicate = output<void>();
  readonly loadSavedFilterRaw = output<void>();
  readonly loadSavedFilterGuarded = output<void>();
  readonly emptyTheData = output<void>();
  readonly restoreTheData = output<void>();

  protected readonly includedTagSet = computed(
    () => new Set(this.filters().tags().value().include),
  );
  protected readonly excludedTagSet = computed(
    () => new Set(this.filters().tags().value().exclude),
  );
  protected readonly isEveryTagIncluded = computed(
    () => this.includedTagSet().size === this.tagOptions().length,
  );

  /** Hand-wired: a tag multi-select is a set, not a single control value. */
  protected toggleIncludedTag(tag: string): void {
    this.filters()
      .tags()
      .value.update((criterion) => ({
        ...criterion,
        include: toggleOption(criterion.include, tag, this.tagOptions()),
      }));
  }

  protected toggleExcludedTag(tag: string): void {
    this.filters()
      .tags()
      .value.update((criterion) => ({
        ...criterion,
        exclude: toggleOption(criterion.exclude, tag, this.tagOptions()),
      }));
  }

  /** The Select-All affordance every peer's multi-select ships. */
  protected toggleAllIncludedTags(): void {
    this.filters()
      .tags()
      .value.update((criterion) => ({
        ...criterion,
        include: this.isEveryTagIncluded() ? [] : [...this.tagOptions()],
      }));
  }
}
