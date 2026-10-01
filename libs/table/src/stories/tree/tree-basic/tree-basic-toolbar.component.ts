import { Component, output } from '@angular/core';

/**
 * Tree Basic story toolbar — expand/collapse all controls
 *
 * Emits `expandAll` and `collapseAll` events to the story host, which
 * routes them to `table.tree.expand()` and `table.tree.collapse()`.
 */
@Component({
  selector: 'ngp-tree-basic-toolbar',
  templateUrl: './tree-basic-toolbar.component.html',
  standalone: true,
})
export class TreeBasicToolbarComponent {
  readonly expandAll = output<void>();
  readonly collapseAll = output<void>();
}
