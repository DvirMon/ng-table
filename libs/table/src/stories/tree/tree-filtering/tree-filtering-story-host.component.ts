import { Component, computed, signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import { createTable } from '../../../api/create-table';
import { withFiltering } from '../../../api/features/with-filtering';
import { withTree } from '../../../api/features/with-tree/feature';
import { NgpTableDirective } from '../../../directives/ngp-table.directive';
import { NgpTableRowDirective } from '../../../directives/ngp-table-row.directive';
import { NgpTableTreeRowDirective } from '../../../directives/ngp-table-tree-row.directive';
import { NgpTableTreeToggleDirective } from '../../../directives/ngp-table-tree-toggle.directive';
import { TREE_ROWS_MOCK } from '../fixtures/mock';
import { treeConfig } from '../fixtures/schema';
import type { TaskRow } from '../fixtures/types';
import { treeFilters } from './tree-filtering.filters';
import { TreeFilteringToolbarComponent } from './tree-filtering-toolbar.component';

/**
 * Filtered tree story: demonstrates filtering (`withFiltering()`) composed with tree
 * nesting (`withTree()`). Shows:
 *
 * - Default reveal enabled: ancestors of matches are shown open (TR22).
 * - Context rows dimmed by the recipe's `[data-context-row]` rule (TR42, 2.3).
 * - The row count (`totalRowCount()`) is unchanged by open/close (3.1).
 * - A matching parent with no matching children renders a hidden, disabled toggle (2.6).
 * - Clearing the filter restores the open set from before filtering (2.4).
 *
 * Default reveal only (TR22): no reveal override and no descendant inclusion, since the
 * latter belongs to filtering's own docs. The detail-panel feature is not composed.
 */
@Component({
  selector: 'ngp-tree-filtering-story-host',
  imports: [
    NgpTableDirective,
    NgpTableRowDirective,
    NgpTableTreeRowDirective,
    NgpTableTreeToggleDirective,
    TreeFilteringToolbarComponent,
  ],
  templateUrl: './tree-filtering-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../tree-story.css'],
})
export class TreeFilteringStoryHostComponent {
  protected readonly data = signal<TaskRow[]>(TREE_ROWS_MOCK);

  protected readonly table = createTable(
    this.data,
    treeConfig,
    withFiltering({ schema: treeFilters }),
    withTree({ parentId: (row: TaskRow) => row.parentId }),
  );

  protected readonly filters = this.table.filters;

  /** Signal Forms directly over the criterion model — `filters().value` is a `WritableSignal`,
   * so the form writes through to the nodes and there is nothing to keep in sync. */
  protected readonly filterForm = form(this.table.filters().value);

  protected readonly rowCount = computed(() => this.table.totalRowCount());

  protected clearFilter(): void {
    this.filters().reset(null);
  }
}
