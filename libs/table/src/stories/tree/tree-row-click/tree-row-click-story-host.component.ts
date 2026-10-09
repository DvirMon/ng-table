import { Component, signal } from '@angular/core';
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
import type { RenderRow } from '../../../index';
import type { TaskRow } from '../fixtures/types';

/**
 * Whole-row click to toggle parent expansion (TR44).
 *
 * Clicking anywhere on a parent row toggles its expansion. The toggle button's
 * click bubbles to the row handler; the handler must guard against it to prevent
 * toggling twice. The guard returns if the click came from inside the toggle
 * button (using instanceof Element check, not an assertion), or if the row has
 * no children. Otherwise, the click toggles the row's expansion. The toggle
 * renders on every row in the name cell; leaf toggles are disabled and hidden
 * by the recipe while keeping their width for label alignment.
 */
@Component({
  selector: 'ngp-tree-row-click-story-host',
  templateUrl: './tree-row-click-story-host.component.html',
  styleUrls: [
    '../../styles/story-host.css',
    '../../styles/tree-recipe.css',
    './tree-row-click.css',
  ],
  imports: [
    NgpTableDirective,
    NgpTableRowDirective,
    NgpTableTreeRowDirective,
    NgpTableTreeToggleDirective,
  ],
})
export class TreeRowClickStoryHostComponent {
  private readonly data = signal(TREE_ROWS_MOCK);

  protected readonly table = createTable(
    this.data,
    treeConfig,
    withTree({
      parentId: (row: TaskRow) => row.parentId,
    }),
  );

  /**
   * Toggle the row when clicked, unless the click came from the toggle button
   * or the row has no children.
   *
   * The row handler receives clicks bubbling from the toggle. Two named
   * guards, then the toggle:
   * 1. Skip if the click targeted the toggle button itself.
   * 2. Skip if the row is a leaf (has no children).
   * 3. Otherwise toggle the row's expansion.
   */
  protected toggleFromRowClick(row: RenderRow<TaskRow>, event: Event): void {
    const clickedToggle = this.isClickFromToggleButton(event);
    if (clickedToggle) {
      return;
    }

    const rowHasChildren = row.hasChildren;
    if (!rowHasChildren) {
      return;
    }

    this.table.tree.toggle(row.id);
  }

  private isClickFromToggleButton(event: Event): boolean {
    if (!(event.target instanceof Element)) {
      return false;
    }

    return event.target.closest('[ngpTableTreeToggle]') !== null;
  }
}
