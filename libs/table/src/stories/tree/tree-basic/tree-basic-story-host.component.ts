import { Component, computed, signal } from '@angular/core';
import {
  createTable,
  withTree,
  NgpTableDirective,
  NgpTableRowDirective,
  NgpTableTreeRowDirective,
  NgpTableTreeToggleDirective,
} from '../../../index';
import { TREE_ROWS_MOCK } from '../fixtures/mock';
import { treeConfig } from '../fixtures/schema';
import { TreeBasicToolbarComponent } from './tree-basic-toolbar.component';

/**
 * Basic tree story. Proves the tree feature alone: `withTree()` with nothing composed beside it
 * (TR34, TR36, TR38, TR39, TR41).
 */
@Component({
  selector: 'ngp-tree-basic-story-host',
  templateUrl: './tree-basic-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../../styles/tree-recipe.css'],
  imports: [
    TreeBasicToolbarComponent,
    NgpTableDirective,
    NgpTableRowDirective,
    NgpTableTreeRowDirective,
    NgpTableTreeToggleDirective,
  ],
})
export class TreeBasicStoryHostComponent {
  /** Seed the open set to depth 3 on load so tree structure is visible.
   * Open: t1 (root), t2 (depth 1), t3 (depth 2).
   * This shows one branch nested to depth 3, plus siblings at each level. */
  private static readonly INITIAL_OPEN = ['t1', 't2', 't3'];

  private readonly data = signal(TREE_ROWS_MOCK);

  protected readonly table = createTable(
    this.data,
    treeConfig,
    withTree({
      parentId: (row) => row.parentId,
      initial: TreeBasicStoryHostComponent.INITIAL_OPEN,
    }),
  );

  /** Readout of tree expansion state: 'all', 'some', or 'none'. */
  protected readonly treeState = computed(() => {
    const state = this.table.tree.state();
    if (state === 'all') return 'All open';
    if (state === 'some') return 'Some open';
    return 'None open';
  });

  protected expandAll(): void {
    this.table.tree.expand();
  }

  protected collapseAll(): void {
    this.table.tree.collapse();
  }
}
