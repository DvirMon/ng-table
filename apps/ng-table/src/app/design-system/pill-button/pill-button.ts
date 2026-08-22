import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { PillButtonVariant } from './pill-button.types';

@Component({
  selector: 'ngpt-pill-button',
  templateUrl: './pill-button.html',
  styleUrl: './pill-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-variant]': 'variant()',
  },
})
export class PillButton {
  readonly variant = input<PillButtonVariant>('default');
  readonly disabled = input<boolean>(false);
}
