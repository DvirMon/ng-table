import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Toolbar for the aggregates story — poisons or restores the one row `sumAmount` refuses. */
@Component({
  selector: 'ngp-grouping-aggregates-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grouping-aggregates-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class GroupingAggregatesToolbarComponent {
  readonly isSummaryBroken = input(false);
  readonly toggleBrokenSummary = output<void>();
}
