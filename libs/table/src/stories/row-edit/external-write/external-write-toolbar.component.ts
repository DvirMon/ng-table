import { ChangeDetectionStrategy, Component, output } from '@angular/core';

/** Toolbar for the external-write-conflict demo — pushes a change to a row the person isn't
 * currently editing. */
@Component({
  selector: 'ngp-external-write-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './external-write-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class ExternalWriteToolbarComponent {
  readonly pushToUnopenedRow = output<void>();
}
