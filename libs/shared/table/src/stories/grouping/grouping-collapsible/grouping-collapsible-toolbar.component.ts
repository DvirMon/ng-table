import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Toolbar for the collapsible grouping story — outline expand/collapse, refetch, and regroup.
 */
@Component({
  selector: 'ngp-grouping-collapsible-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grouping-collapsible-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class GroupingCollapsibleToolbarComponent {
  readonly isRefetching = input.required<boolean>();
  readonly isRenested = input.required<boolean>();

  readonly expandAll = output<void>();
  readonly collapseAll = output<void>();
  readonly refetchRows = output<void>();
  readonly regroup = output<void>();
}
