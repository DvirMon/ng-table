import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Toolbar for sorting + row editing composed — clear sort and the two "add while sorted" demo
 * actions. Sort controls themselves live in the `<th>` headers, not here. */
@Component({
  selector: 'ngp-sorting-editing-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sorting-editing-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class SortingEditingToolbarComponent {
  readonly saveError = input.required<string | null>();

  readonly clearSort = output<void>();
  readonly addRowWhileSorted = output<void>();
  readonly addRowWithBlankDueDate = output<void>();
}
