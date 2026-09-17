import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Toolbar for the static grouping story — reset levels and (optional) minimum category size.
 */
@Component({
  selector: 'ngp-grouping-static-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grouping-static-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class GroupingStaticToolbarComponent {
  readonly minCategoryRowCount = input<number>(2);
  readonly resetLevels = output<void>();
  readonly minCategoryRowCountChange = output<number>();
}
