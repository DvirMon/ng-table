import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import { FormField } from '@angular/forms/signals';
import type { Filters } from '../../../filters/types';
import type { InvoiceRow, InvoiceStatus } from '../../filtering/fixtures/types';
import type { SelectionCriteria } from './filtering-selection.filters';

/**
 * Toolbar for the filtering-selection story: "Clear filters" and the per-column filter
 * controls. Selection UI (header checkbox, per-row delete, header-click sort) stays on the host
 * — it lives inside the `<table>`, not the toolbar.
 */
@Component({
  selector: 'ngp-filtering-selection-toolbar',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filtering-selection-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css', '../../filtering/filtering-story.css'],
})
export class FilteringSelectionToolbarComponent {
  readonly statusField = input.required<FieldTree<string>>();
  readonly customerField = input.required<FieldTree<string>>();

  readonly filters = input.required<Filters<InvoiceRow, SelectionCriteria>>();
  readonly statusOptions = input.required<readonly InvoiceStatus[]>();
  readonly tagOptions = input.required<readonly string[]>();

  readonly toggleTag = output<string>();
  readonly clearAllFilters = output<void>();

  protected readonly selectedTagSet = computed(() => new Set(this.filters().tags().value()));
}
