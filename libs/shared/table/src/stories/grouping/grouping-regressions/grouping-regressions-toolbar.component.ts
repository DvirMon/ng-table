import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Toolbar for the grouping regressions story — reset levels, force a missing grouping
 * level, and break/restore one group's summary.
 */
@Component({
  selector: 'ngp-grouping-regressions-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grouping-regressions-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class GroupingRegressionsToolbarComponent {
  readonly isSummaryBroken = input.required<boolean>();

  readonly resetLevels = output<void>();
  readonly groupByMissingColumn = output<void>();
  readonly toggleBrokenSummary = output<void>();
}
