import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Toolbar for the `when` story — the per-column threshold, editable on canvas. */
@Component({
  selector: 'ngp-grouping-when-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grouping-when-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class GroupingWhenToolbarComponent {
  readonly minCategoryRowCount = input<number>(2);
  readonly minCategoryRowCountChange = output<number>();
}
