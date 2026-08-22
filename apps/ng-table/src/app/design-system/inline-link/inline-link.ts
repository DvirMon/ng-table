import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ngpt-inline-link',
  templateUrl: './inline-link.html',
  styleUrl: './inline-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineLink {
  readonly href = input<string>();
  readonly external = input<boolean>(false);
}
