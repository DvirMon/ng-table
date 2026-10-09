import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import { FormField } from '@angular/forms/signals';

/**
 * Toolbar for the tree-filtering story: a name search box and a Clear button.
 * Emits `clearFilter` → the host calls `table.filters().reset(null)`.
 */
@Component({
  selector: 'ngp-tree-filtering-toolbar',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tree-filtering-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css', '../../styles/tree-recipe.css'],
})
export class TreeFilteringToolbarComponent {
  readonly nameField = input.required<FieldTree<string>>();
  readonly clearFilter = output<void>();
}
