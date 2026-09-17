import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

/** Toolbar for the grouping CRUD story: live row count, and a reset back to the fixture. */
@Component({
  selector: 'ngp-grouping-crud-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grouping-crud-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class GroupingCrudToolbarComponent {
  readonly rowCount = input.required<number>();
  readonly resetData = output<void>();
}
