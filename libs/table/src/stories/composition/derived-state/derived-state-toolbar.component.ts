import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Department filter select — reports the raw select value, `''` meaning "All". */
@Component({
  selector: 'ngp-derived-state-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './derived-state-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class DerivedStateToolbarComponent {
  readonly activeDept = input.required<string | null>();
  readonly deptOptions = input.required<readonly string[]>();

  readonly selectDept = output<string>();
}
