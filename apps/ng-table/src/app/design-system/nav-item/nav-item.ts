import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ngpt-nav-item',
  templateUrl: './nav-item.html',
  styleUrl: './nav-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-active]': "active() ? '' : null",
    '[attr.data-nested]': "nested() ? '' : null",
  },
})
export class NavItem {
  readonly active = input<boolean>(false);
  readonly nested = input<boolean>(false);
  readonly href = input<string>('#');
}
