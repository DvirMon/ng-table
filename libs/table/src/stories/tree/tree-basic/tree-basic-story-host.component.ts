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
 * Basic tree story — flat data nested by parentId, with toggle and bulk control
 *
 * Demonstrates the tree feature baseline: toggling individual parents, expand/collapse all,
 * and the three-state readout. The story seeds the initial open set to depth 3 so tree
 * structure is visible on load. Reopening a parent after closing it restores all open
 * descendants (TR36). The tree toggle sits on every row in the name cell; leaf toggles
 * render disabled and hidden by the recipe while keeping their width so labels align (TR38).
 * Tab reaches parents only; leaf toggles are skipped (TR36). The toggle label is
 * 'Children of ' + row.data.name per TR39, carrying no depth level (OQ-8).
 *
 * The directive stamps the expanded state and the recipe handles depth and the leaf case,
 * so the template carries no state attributes, per-depth CSS or leaf guard (TR38). The
 * toggle's click bubbles freely (TR44). Only the tree feature is composed — filtering,
 * sorting, selection, and row-click handlers are separate stories.
 */
@Component({
  selector: 'ngp-tree-basic-story-host',
  templateUrl: './tree-basic-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../tree-story.css'],
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
    })
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
