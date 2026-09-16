import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { InvoiceStatus } from '../fixtures/types';

/**
 * Toolbar for the predicate-filtering story: the two handwritten-predicate controls (search,
 * status) plus "Clear both". No filter model exists here, so state is plain primitives rather
 * than Signal Forms fields.
 */
@Component({
  selector: 'ngp-predicate-filtering-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './predicate-filtering-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css', '../filtering-story.css'],
})
export class PredicateFilteringToolbarComponent {
  readonly search = input.required<string>();
  readonly status = input.required<InvoiceStatus | null>();
  readonly statusOptions = input.required<readonly InvoiceStatus[]>();

  readonly setSearch = output<string>();
  readonly selectStatus = output<string>();
  readonly clearFilters = output<void>();

  protected readonly isSearchActive = computed(() => this.search().trim().length > 0);
  protected readonly isStatusActive = computed(() => this.status() !== null);
}
