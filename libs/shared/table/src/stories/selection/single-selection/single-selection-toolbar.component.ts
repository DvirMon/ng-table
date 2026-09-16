import { ChangeDetectionStrategy, Component, output } from '@angular/core';

/** Toolbar for the single-selection story: clear and restore-conflicting-selection demo actions. */
@Component({
  selector: 'ngp-single-selection-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './single-selection-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class SingleSelectionToolbarComponent {
  readonly clearSelection = output<void>();
  readonly restoreConflictingSelection = output<void>();
}
