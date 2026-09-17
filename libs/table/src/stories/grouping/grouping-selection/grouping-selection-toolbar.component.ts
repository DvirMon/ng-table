import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Toolbar for the group-selection story — rep filter, grouping toggle, clear selection,
 * and the selection readouts.
 */
@Component({
  selector: 'ngp-grouping-selection-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grouping-selection-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class GroupingSelectionToolbarComponent {
  readonly repFilter = input.required<string>();
  readonly isGrouped = input.required<boolean>();
  readonly selectionReadout = input.required<string>();
  readonly selectedGroupHeaderCount = input.required<number>();

  readonly filterRep = output<string>();
  readonly toggleGrouping = output<void>();
  readonly clearSelection = output<void>();

  protected onFilterRepInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    this.filterRep.emit(target.value);
  }
}
