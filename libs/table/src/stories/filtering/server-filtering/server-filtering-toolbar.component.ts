import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import { FormField } from '@angular/forms/signals';
import type { Filters } from '../../../api/features/with-filtering/types';
import { toggleOption } from '../fixtures/utils';
import type { InvoiceRow, InvoiceStatus, RangeCriterion } from '../fixtures/types';
import type { ServerCriteria } from './server-filtering.filters';

/**
 * Toolbar for the server-filtering story: the debounced search box, the late-default trigger,
 * the retry action, and the per-column filter controls. Summaries and loading/error notices that
 * read table/resource state stay on the host.
 */
@Component({
  selector: 'ngp-server-filtering-toolbar',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './server-filtering-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css', '../filtering-story.css'],
})
export class ServerFilteringToolbarComponent {
  readonly searchField = input.required<FieldTree<string>>();
  readonly statusField = input.required<FieldTree<string>>();
  readonly amountField = input.required<FieldTree<RangeCriterion>>();

  readonly filters = input.required<Filters<InvoiceRow, ServerCriteria>>();
  readonly loadError = input.required<string | null>();
  readonly statusOptions = input.required<readonly InvoiceStatus[]>();
  readonly tagOptions = input.required<readonly string[]>();
  /** The late-default race, computed on the host: `dirty()` is `@internal`. */
  readonly amountIgnoresServerDefault = input.required<boolean>();

  readonly deliverServerDefault = output<void>();
  readonly retry = output<void>();

  protected readonly excludedTagSet = computed(
    () => new Set(this.filters().excludedTags().value()),
  );

  /** Hand-wired: a tag multi-select is a set, not a single control value. */
  protected toggleExcludedTag(tag: string): void {
    this.filters()
      .excludedTags()
      .value.update((selected) => toggleOption(selected, tag, this.tagOptions()));
  }
}
