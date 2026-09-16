import { ChangeDetectionStrategy, Component, output } from '@angular/core';

/**
 * Toolbar for the static grouping story — a single reset action.
 */
@Component({
  selector: 'ngp-grouping-static-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grouping-static-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class GroupingStaticToolbarComponent {
  readonly resetLevels = output<void>();
}
