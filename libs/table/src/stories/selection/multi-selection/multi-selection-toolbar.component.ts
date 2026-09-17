import { ChangeDetectionStrategy, Component, output } from '@angular/core';

/** Toolbar for the multi-selection story: lock/restore/delete-externally demo actions. */
@Component({
  selector: 'ngp-multi-selection-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './multi-selection-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class MultiSelectionToolbarComponent {
  readonly lockSelectedRow = output<void>();
  readonly restoreSavedSelection = output<void>();
  readonly deleteSelectedRowExternally = output<void>();
}
