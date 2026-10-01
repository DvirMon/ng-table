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
 * Filtered tree story. Proves `withFiltering()` over `withTree()` with the default reveal
 * (TR22, TR36, TR38, TR39, TR42).
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

  /** Signal Forms directly over the criterion model — `filters().value` is a `WritableSignal`,
   * so the form writes through to the nodes and there is nothing to keep in sync. */
  protected readonly filterForm = form(this.table.filters().value);

  protected readonly rowCount = computed(() => this.table.totalRowCount());

  protected clearFilter(): void {
    this.table.filters().reset(null);
  }
}
